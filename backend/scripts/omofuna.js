/**
 * 从 omofuna 按年份抓取番剧列表（中文标题 / 年份 / 封面）。
 *
 * 站点特性（2026-08-08 实测）：
 * - URL 结构：show/{分类ID}--------{页码}---{年份}.html；分类 1=日漫 5=动画 24=剧场；
 *   页码在第 8 段、年份在末段；年份筛选实际生效。
 * - 反爬：MaccMS「系统安全验证」页（title 含该词 + input.verify_submit「继续访问」按钮）。
 *   真实浏览器点按钮 → AJAX 后 location.reload() 放行，同会话后续翻页不再验证；纯 HTTP 不可行。
 *   注意：点击会触发 navigation，navigation 中 evaluate 抛「Execution context was destroyed」
 *   属正常，countCards 已容错（返回 -1 视为未就绪）并等待导航完成。
 * - 卡片：a.lazyload[href^="/anime/"]，title 属性=中文标题，data-original=封面 webp URL。
 * - 每类每年 ~5~6 页，每页 ~72 条；顶部「共检索到 N 条」是静态假计数不可信。
 *
 * 用法：
 *   node omofuna.js --years 2026,2025 --out <out.json> [--delay 300] [--headed] [--chrome <path>]
 *
 * 退出码：0 成功；非 0 失败（stderr 含原因）。进度行 ASCII-only 打印 stdout，供后端解析。
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

// ---------- 常量 ----------
const BASE = 'https://www.omofuna.com';
const CATEGORIES = [
  { id: 1, name: '日漫' },
  { id: 5, name: '动画' },
  { id: 24, name: '剧场' },
];
const MAX_PAGES_PER_YEAR_CAT = 30; // 安全上限（实测每类每年 5~6 页）
const MAX_CONSECUTIVE_FAILURES = 5; // 连续失败熔断，避免长时间空跑
const NAV_TIMEOUT = 30000;
const CARD_WAIT_MS = 20000; // 验证放行 / 卡片渲染等待上限
const RETRY_ATTEMPTS = 2; // 每页重试次数（指数退避 1s/2s）
const CARD_SELECTOR = 'a.lazyload[href^="/anime/"]';
const CHECKPOINT_EVERY = 5; // 每 N 页覆写一次 JSON（崩溃残留不导入，仅防全丢）
const NO_PROGRESS_TIMEOUT_MS = 180_000; // 无进度 watchdog：3 分钟无新进度行 → 强制退出（防 page.evaluate 挂起成无底洞）
const LAUNCH_TIMEOUT_MS = 60_000; // Chrome 启动超时（低配机 / profile 锁 / 老版本可能卡 launch）

// ---------- CLI 参数 ----------
function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}
function fail(msg) {
  console.error('[omofuna] ' + msg);
  process.exit(1);
}

const yearsArg = arg('--years');
const outPath = arg('--out');
const delayMs = parseInt(arg('--delay') || '300', 10);
const headed = process.argv.indexOf('--headed') >= 0;
const chromePath = arg('--chrome') || process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const typesArg = arg('--types'); // 可选：分类 id 逗号分隔（1 日漫 / 5 动画 / 24 剧场），缺省全部

if (!yearsArg || !outPath) {
  fail('参数缺失：--years <2000,2026> 与 --out <out.json> 必填');
}
const years = yearsArg.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isInteger(n) && n >= 2000 && n <= 2026);
if (years.length === 0) {
  fail('--years 非法：需 2000~2026 之间的年份（逗号分隔）');
}
// 分类过滤：默认全部 3 类；--types 只抓所选类目（控制导入量）
const catIds = typesArg
  ? typesArg.split(',').map(s => parseInt(s.trim(), 10)).filter(n => CATEGORIES.some(c => c.id === n))
  : CATEGORIES.map(c => c.id);
const cats = CATEGORIES.filter(c => catIds.includes(c.id));
if (cats.length === 0) {
  fail('--types 无有效分类：可选 ' + CATEGORIES.map(c => c.id).join('/'));
}

function urlFor(catId, page, year) {
  return `${BASE}/show/${catId}--------${page}---${year}.html`;
}
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------- 页面工具 ----------
function isVerifyPage(page) {
  return page.evaluate(() =>
    (document.title || '').includes('系统安全验证') ||
    !!document.querySelector('input.verify_submit'));
}

/**
 * 数卡片。navigation 中 evaluate 抛「Execution context was destroyed」属正常，
 * 捕获后返回 -1 视为「未就绪」，由 waitForCards 继续等。
 */
async function countCards(page) {
  try {
    return await page.evaluate(sel => document.querySelectorAll(sel).length, CARD_SELECTOR);
  } catch (e) {
    return -1;
  }
}

/** 轮询直到卡片出现（验证点按钮后 reload 的两种节奏都覆盖）。 */
async function waitForCards(page, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const n = await countCards(page);
    if (n > 0) return true;
    await sleep(200);
  }
  return false;
}

/**
 * 点「继续访问」→ 验证 JS 会 location.reload() 放行。
 * 先等导航完成（可能没导航则 catch 忽略），再轮询卡片。
 */
async function passVerification(page) {
  const clicked = await page.evaluate(() => {
    const b = document.querySelector('input.verify_submit');
    if (b) { b.click(); return true; }
    return false;
  });
  if (!clicked) return;
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {});
  await waitForCards(page, CARD_WAIT_MS);
}

/** 提取卡片：title 属性=中文标题，data-original=封面，href 正则抽 32hex hash。 */
function extractCards(page, year, catId) {
  return page.evaluate((sel, year, catId) =>
    Array.from(document.querySelectorAll(sel))
      .map(a => {
        const m = (a.getAttribute('href') || '').match(/\/anime\/([0-9a-f]{24})\.html/);
        return {
          title: (a.getAttribute('title') || '').trim(),
          coverUrl: a.getAttribute('data-original') || '',
          hash: m ? m[1] : '',
          year,
          categoryId: catId,
        };
      })
      .filter(x => x.title && x.hash),
    CARD_SELECTOR, year, catId);
}

/**
 * 抓一页（复用同一 page，验证放行后 cookie 已带，翻页更快）：
 * goto → 过验证（自动点「继续访问」）→ 等卡片 → 提取。
 * 返回 { cards } 或 { cards:[], error } / { cards:[], verifyStuck }。
 */
async function fetchPage(page, catId, pageNum, year) {
  const url = urlFor(catId, pageNum, year);
  console.log(`[omofuna] dbg goto ${year}/${catId}/${pageNum} ${url}`);
  try {
    for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      const verify = await isVerifyPage(page);
      console.log(`[omofuna] dbg verify=${verify ? 'Y' : 'N'} attempt=${attempt}`);
      if (verify) {
        console.log(`[omofuna] dbg passVerification 开始`);
        await passVerification(page);
        console.log(`[omofuna] dbg passVerification 完成`);
      }
      const cardCount = await countCards(page);
      console.log(`[omofuna] dbg cards=${cardCount}`);
      if (cardCount > 0) {
        const cards = await extractCards(page, year, catId);
        console.log(`[omofuna] dbg extract=${cards.length}`);
        return { cards };
      }
      // 无卡片：仍是验证页 → 重试退避；否则是正常空页（到尾）
      if (!(await isVerifyPage(page))) {
        return { cards: [] };
      }
      await sleep(1000 * (attempt + 1));
    }
    return { cards: [], verifyStuck: true }; // 验证始终没过
  } catch (e) {
    return { cards: [], error: e ? e.message : String(e) };
  }
}

function writeCheckpoint() {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    years,
    items: allItems,
    stats: { pages, items: total, failedPages },
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 0), 'utf8');
}

// ---------- 主流程 ----------
const seen = new Set(); // hash 去重：同一番可同时挂日漫/动画/剧场，保留首次
const allItems = [];
let total = 0, pages = 0, failedPages = 0, consecutiveFailures = 0;
let lastProgress = Date.now(); // 无进度 watchdog 基准：每成功输出一页进度行后刷新

(async () => {
  let browser = null;
  try {
    // 无进度 watchdog：page.evaluate 挂起不阻塞 node 事件循环，setInterval 仍可触发 → 超时自爆（进程级兜底）
    const watchdog = setInterval(() => {
      const idle = Date.now() - lastProgress;
      if (idle > NO_PROGRESS_TIMEOUT_MS) {
        console.error(`[omofuna] 无进度超时（${Math.round(idle / 1000)}s 无新进度行），强制退出`);
        process.exit(1);
      }
    }, 10_000);
    watchdog.unref(); // 不阻塞正常流程结束
    // Chrome 启动超时（puppeteer.launch 本身可能挂起：低配机/profile 锁/老版本）
    // dbg 行经后端 reader 转发进 Java 日志：看到 launching 后紧跟「失败」即定位到 launch 阶段
    console.log(`[omofuna] dbg chrome=${chromePath} headless=${headed ? 'false(headed)' : 'new'} launching...`);
    const launchTimeout = new Promise((_, rej) => {
      const t = setTimeout(() => rej(new Error('Chrome 启动超时（' + (LAUNCH_TIMEOUT_MS / 1000) + 's）')), LAUNCH_TIMEOUT_MS);
      t.unref();
    });
    browser = await Promise.race([
      puppeteer.launch({
        executablePath: chromePath,
        headless: headed ? false : 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--mute-audio',
          '--hide-scrollbars',
          '--force-color-profile=srgb',
          '--force-device-scale-factor=1',
          '--disable-dev-shm-usage',
        ],
      }),
      launchTimeout,
    ]);
    console.log(`[omofuna] dbg launched ok`);
    try { console.log(`[omofuna] dbg browserVersion=${await browser.version()}`); } catch (_) {}
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(NAV_TIMEOUT);

    for (const year of years) {
      for (const cat of cats) {
        for (let pageNum = 1; pageNum <= MAX_PAGES_PER_YEAR_CAT; pageNum++) {
          const res = await fetchPage(page, cat.id, pageNum, year);
          pages++;
          console.log(`[omofuna] page=${year}/${cat.id}/${pageNum} items=${res.cards.length} total=${total}`);
          lastProgress = Date.now(); // 刷新 watchdog 基准

          if (res.error || res.verifyStuck) {
            failedPages++;
            consecutiveFailures++;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              throw new Error('连续失败 ' + consecutiveFailures + ' 次，中止（可能站点结构变化或封禁）');
            }
            await sleep(delayMs);
            continue;
          }
          consecutiveFailures = 0;

          if (res.cards.length === 0) {
            break; // 到尾
          }
          let fresh = 0;
          for (const c of res.cards) {
            if (!seen.has(c.hash)) {
              seen.add(c.hash);
              allItems.push(c);
              total++;
              fresh++;
            }
          }
          if (fresh === 0) {
            break; // 本页全为已见 hash → 越界重复末页，防死循环
          }
          if (pages % CHECKPOINT_EVERY === 0) {
            writeCheckpoint();
          }
          await sleep(delayMs);
        }
      }
    }

    writeCheckpoint();
    console.log(`[omofuna] 完成: 页数=${pages} 唯一作品=${total} 失败页=${failedPages}`);
  } catch (e) {
    // 崩溃也留一个 checkpoint 供人工检查（后端仅在 exit 0 时导入）
    try { writeCheckpoint(); } catch (_) { /* 忽略 */ }
    console.error('[omofuna] 失败: ' + (e && e.message ? e.message : String(e)));
    process.exit(1);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { /* 忽略 */ }
    }
  }
})();
