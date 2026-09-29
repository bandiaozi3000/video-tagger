/**
 * 候选库筛选改造的浏览器验收（无头 Chrome + 真实 8080 后端）。
 * 用法（项目根）：node backend/scripts/accept-editor-filter.mjs　或　npm --prefix backend/scripts run accept:filter
 *
 * 覆盖：旧控件已移除 / 浮层维度列表 / 单维度生效 / 多维 AND / confirmed=0 不被吞 /
 *       搜索防抖 / 移除 chip / 清除全部 / 空态 / 筛选不动已选。
 */
import { createRequire } from 'node:module';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..'); // backend/scripts → 仓库根
const requireFromScripts = createRequire(path.join(repo, 'backend', 'scripts', 'package.json'));
const puppeteer = requireFromScripts('puppeteer-core');
const CHROME = process.env.RENDER_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 轮询等待条件成立（上限 timeout 毫秒）——取值段/列表是异步渲染，死等固定毫秒会偶发假阴性。 */
const waitFor = async (predicate, timeout = 3000, step = 80) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(step);
  }
  return false;
};

// 跑前备份草稿（编辑器会自动写回草稿，测试不能污染用户正在编辑的搜索/筛选/已选）
const draftBackup = (await (await fetch('http://127.0.0.1:8080/api/recommend/draft')).json()).config;
const restoreDraft = async () => {
  if (!draftBackup) return;
  const res = await fetch('http://127.0.0.1:8080/api/recommend/draft', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: draftBackup }),
  });
  const after = JSON.parse((await (await fetch('http://127.0.0.1:8080/api/recommend/draft')).json()).config);
  console.log(`（草稿还原 HTTP ${res.status}：已选 ${after.config.ids.length} 部 · q="${after.filter.q}"）`);
};

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${ok || !detail ? '' : ` —— ${detail}`}`);
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'], defaultViewport: { width: 1600, height: 1000 } });
try {
  const tab = await browser.newPage();
  const mediaReqs = [];
  tab.on('request', (req) => { const u = req.url(); if (u.includes('/api/media?') || u.includes('/api/media/count')) mediaReqs.push(u); });
  await tab.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle2', timeout: 60000 });
  await tab.evaluate(() => document.querySelector('.tab[data-view="recommend"]')?.click());
  await tab.waitForSelector('#recommend-editor-root .vt-filterbar', { timeout: 30000 });
  await sleep(1200);

  const lastMedia = (sub) => [...mediaReqs].reverse().find((u) => u.includes(sub)) ?? '';
  const headTotal = () => tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-colhead-meta')?.textContent?.trim() ?? '');
  const selectedCount = () => tab.evaluate(() => {
    const el = [...document.querySelectorAll('#recommend-editor-root .vt-tab')].find((e) => e.textContent?.includes('已选'));
    return el ? Number((el.textContent || '').replace(/\D/g, '')) : -1;
  });
  const chips = () => tab.evaluate(() => [...document.querySelectorAll('#recommend-editor-root .vt-chip-dim')].map((e) => e.textContent?.replace(/\s+/g, ' ').trim()));
  const cards = () => tab.evaluate(() => document.querySelectorAll('#recommend-editor-root .vt-media-card').length);
  const popOpen = () => tab.evaluate(() => document.querySelectorAll('.vt-pop').length > 0);
  /**
   * 幂等打开筛选浮层，并确保停在**维度列表**（取值段先「‹ 返回」）。
   *
   * 为什么不用定点 sleep：＋筛选 是开/关切换，而浮层内容也是异步渲染的；
   * 固定等待会偶发地把浮层点开又点关（实测出现过“维度列表 = 7 个”假阴性）。
   * 改成：轮询到维度条目出现为止，最多重试 3 轮。
   */
  const openPop = async () => {
    // 注意：不能用“条目数 ≥ 7”当就位判据 —— 年份取值列表有 28 项，会被误认为维度列表。
    // 只认「七个维度名都在场」。
    const DIM_NAMES = ['收藏夹', '年份', '格式', '子分类', '标签', '状态', '档案'];
    const dimsReady = () => tab.evaluate((names) => {
      const texts = [...document.querySelectorAll('.vt-pop .vt-pop-item')].map((e) => ((e.querySelector('span')?.textContent || '') + '').trim());
      return names.every((n) => texts.includes(n));
    }, DIM_NAMES);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await dimsReady()) return true;
      await tab.evaluate(() => {
        const back = document.querySelector('.vt-pop .vt-pop-head button');
        if (back && (back.textContent || '').includes('返回')) back.click();
      });
      await sleep(150);
      if (!(await popOpen())) await tab.click('#recommend-editor-root .vt-filter-btn');
      await waitFor(dimsReady, 2000);
    }
    return dimsReady();
  };
  const clickDim = async (label) => {
    await tab.evaluate((text) => {
      // 已激活维度会多一个 <small>当前值</small>：只能看第一个 span
      const el = [...document.querySelectorAll('.vt-pop .vt-pop-item')].find((e) => (e.querySelector('span')?.textContent || '').trim() === text);
      el?.click();
    }, label);
    // 取值段是异步渲染的：死等固定毫秒会偶发失败（实测过一次 5 项假阴性）。
    // 改成轮询到“出现一个不是维度名的值项”为止，最多 3s。
    await waitFor(async () => {
      const values = await tab.evaluate(() => [...document.querySelectorAll('.vt-pop .vt-pop-item span')].map((e) => (e.textContent || '').trim()));
      const DIMS = ['收藏夹', '年份', '格式', '子分类', '标签', '状态', '档案'];
      return values.some((v) => !DIMS.includes(v));
    }, 3000);
  };
  const clickValue = async (label) => {
    await waitFor(async () => tab.evaluate((text) => {
      const el = [...document.querySelectorAll('.vt-pop .vt-pop-item span')].find((e) => (e.textContent || '').trim() === text);
      return Boolean(el);
    }, label), 3000);
    await tab.evaluate((text) => {
      const el = [...document.querySelectorAll('.vt-pop .vt-pop-item span')].find((e) => (e.textContent || '').trim() === text);
      el?.closest('button')?.click();
    }, label);
    await sleep(900);
  };

  // ① 旧控件移除 + 新控件在位
  const legacy = await tab.evaluate(() => ({
    oldFilters: document.querySelectorAll('#recommend-editor-root .vt-filters').length,
    oldTagInput: document.querySelectorAll('#recommend-editor-root .vt-tag-input').length,
    search: document.querySelectorAll('#recommend-editor-root .vt-search-input').length,
    button: document.querySelectorAll('#recommend-editor-root .vt-filter-btn').length,
  }));
  check('旧三个内联控件已移除', legacy.oldFilters === 0 && legacy.oldTagInput === 0, JSON.stringify(legacy));
  check('搜索框 + ＋筛选 常驻', legacy.search === 1 && legacy.button === 1, JSON.stringify(legacy));

  const total0raw = await headTotal();
  // 草稿里可能带着用户正在用的搜索/筛选：先归零，建立“无筛选”基线
  const startQ = await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-search-input')?.value ?? '');
  if (startQ) {
    await tab.evaluate(() => { const el = document.querySelector('#recommend-editor-root .vt-search-input'); el.focus(); el.select(); });
    await tab.keyboard.press('Backspace');
    await sleep(1400);
  }
  const hadChips = (await chips()).length > 0;
  if (hadChips) {
    await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-chip-clear')?.click());
    await sleep(1200);
  }
  // 基线就位：清完筛选后再等列表真的渲染出来（后端在忙时 1200ms 可能不够 ——
  // 实测过一次 cards=0 的假阴性，后面全部检查项跟着一起翻车）
  await waitFor(async () => (await cards()) > 0, 6000);
  const keyword = (await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-media-title')?.textContent?.trim() ?? '')).slice(0, 2);
  const total0 = await headTotal();
  console.log(`（起始共 ${total0raw}${hadChips ? ' → 清除草稿筛选后' : ''} 共 ${total0}）`);
  const sel0 = await selectedCount();
  const cards0 = await cards();

  // ② 浮层：portal + 7 个维度
  await openPop();
  const pop = await tab.evaluate(() => ({
    inBody: Boolean(document.body.querySelector(':scope > .vt-pop')),
    dims: [...document.querySelectorAll('.vt-pop .vt-pop-item')].map((e) => (e.textContent || '').trim()),
  }));
  check('浮层 portal 到 body', pop.inBody);
  check('维度列表 = 7 个', pop.dims.length === 7, JSON.stringify(pop.dims));

  // ③ 单维度：年份
  await clickDim('年份');
  const yearValue = await tab.evaluate(() => {
    const items = [...document.querySelectorAll('.vt-pop .vt-pop-item span')].map((e) => (e.textContent || '').trim());
    return items.find((t) => /^\d{4} 年$/.test(t)) ?? null;
  });
  await clickValue(yearValue);
  await sleep(300);
  const yearParam = new URL(lastMedia('/api/media?')).searchParams.get('year');
  check('选年份 → chip 出现', (await chips()).some((c) => c.startsWith('年份')), JSON.stringify(await chips()));
  check('选年份 → 请求带 year', yearParam === String(yearValue).replace(' 年', ''), `year=${yearParam} 期望 ${yearValue}`);

  // ④ 多维 AND：状态=在看（已激活维度排序后仍能点到）
  await openPop();
  await clickDim('状态');
  await clickValue('在看');
  // 断言前轮询到“带 year + status 的请求真的发出”（防抖 + 重排会让定点 sleep 偶发假阴性）
  await waitFor(async () => {
    const u = lastMedia('/api/media?');
    if (!u) return false;
    const q = new URL(u).searchParams;
    return Boolean(q.get('year')) && q.get('status') === 'WATCHING';
  }, 4000);
  const url2 = new URL(lastMedia('/api/media?'));
  check('多维 AND → 请求同时带 year + status', Boolean(url2.searchParams.get('year')) && url2.searchParams.get('status') === 'WATCHING', url2.search);
  await waitFor(async () => {
    const u = lastMedia('/api/media/count');
    if (!u) return false;
    const q = new URL(u).searchParams;
    return Boolean(q.get('year')) && q.get('status') === 'WATCHING';
  }, 4000);
  const countUrl = new URL(lastMedia('/api/media/count'));
  check('命中数请求同条件', Boolean(countUrl.searchParams.get('year')) && countUrl.searchParams.get('status') === 'WATCHING', countUrl.search);
  check('两个 chip 同时在位', (await chips()).length >= 2, JSON.stringify(await chips()));

  // ⑤ 陷阱：confirmed=0（待确认）不能被真值判断吞掉
  await openPop();
  await clickDim('档案');
  await clickValue('待确认');
  await sleep(300);
  const url3 = new URL(lastMedia('/api/media?'));
  check('confirmed=0 照发（未被吞）', url3.searchParams.get('confirmed') === '0', url3.search);

  // ⑥ 搜索防抖（关键字取自最初的列表：此时列表可能已被筛空）
  await tab.evaluate(() => { const el = document.querySelector('#recommend-editor-root .vt-search-input'); el.value = ''; });
  await tab.click('#recommend-editor-root .vt-search-input');
  await tab.type('#recommend-editor-root .vt-search-input', keyword, { delay: 40 });
  const before = mediaReqs.length;
  await sleep(900);
  const url4 = new URL(lastMedia('/api/media?'));
  check(`搜索「${keyword}」→ 请求带 q（防抖 ${mediaReqs.length - before} 次请求）`, url4.searchParams.get('q') === keyword, url4.search);

  // ⑦ 已选不受筛选影响
  const sel1 = await selectedCount();
  check('筛选/搜索不改动已选', sel0 === sel1 && sel0 >= 0, `${sel0} → ${sel1}`);

  // ⑧ 空态（搜一个不存在的串）
  await tab.evaluate(() => { const el = document.querySelector('#recommend-editor-root .vt-search-input'); el.value = ''; });
  await tab.click('#recommend-editor-root .vt-search-input');
  await tab.type('#recommend-editor-root .vt-search-input', 'zzzz-不存在的标题-zzzz', { delay: 20 });
  await sleep(1200);
  const empty = await tab.evaluate(() => ({
    emptyBox: document.querySelectorAll('#recommend-editor-root .vt-empty-hits').length,
    cards: document.querySelectorAll('#recommend-editor-root .vt-media-card').length,
  }));
  check('命中 0 → 空态 + 无卡片', empty.emptyBox === 1 && empty.cards === 0, JSON.stringify(empty));

  // ⑨ 清除全部
  await tab.evaluate(() => {
    const el = [...document.querySelectorAll('#recommend-editor-root .vt-empty-hits button')][0];
    el?.click();
  });
  await sleep(1200);
  const after = await tab.evaluate(() => ({
    chips: document.querySelectorAll('#recommend-editor-root .vt-chip-dim').length,
    q: document.querySelector('#recommend-editor-root .vt-search-input')?.value ?? '',
    cards: document.querySelectorAll('#recommend-editor-root .vt-media-card').length,
  }));
  const cleanUrl = new URL(lastMedia('/api/media?'));
  check('清除全部 → chips/搜索/参数全清', after.chips === 0 && after.q === '' && [...cleanUrl.searchParams.keys()].every((k) => k === 'limit' || k === 'offset'), `${JSON.stringify(after)} ${cleanUrl.search}`);
  check('清除全部 → 列表恢复', after.cards === cards0, `${cards0} → ${after.cards}（总 ${total0} → ${await headTotal()}）`);

  // ⑩ 维度列表显示已激活维度的当前值 + 单个 chip 移除
  await openPop();
  await clickDim('状态');
  await clickValue('看完');
  await sleep(300);
  await openPop();   // 已幂等：会先「‹ 返回」回维度列表
  const shown = await tab.evaluate(() => [...document.querySelectorAll('.vt-pop .vt-pop-item small')].map((e) => e.textContent));
  check('已激活维度在维度列表里显示当前值', shown.includes('看完'), JSON.stringify(shown));
  await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-filter-btn')?.click());   // 关浮层
  await sleep(200);
  const urlBefore = new URL(lastMedia('/api/media?'));
  const chipsBefore = (await chips()).length;
  await tab.evaluate(() => {
    const chip = [...document.querySelectorAll('#recommend-editor-root .vt-chip-dim')].find((c) => (c.textContent || '').includes('状态'));
    chip?.querySelector('button:last-child')?.click();
  });
  await sleep(1200);
  const url5 = new URL(lastMedia('/api/media?'));
  check('点 chip ✕ → 该维度参数消失', urlBefore !== url5.toString().replace(/^/, '') && !url5.searchParams.get('status') && (await chips()).length === chipsBefore - 1,
    `before=${urlBefore.search} after=${url5.search} chips ${chipsBefore}→${(await chips()).length}`);

  // ⑪ 只看已勾选（2026-09-26）：候选收窄到 config.ids，一次取满、无「加载更多」
  const selCount = await selectedCount();
  const toggleSelectedOnly = () => tab.evaluate(() => {
    const btn = [...document.querySelectorAll('#recommend-editor-root .vt-search-row button')]
      .find((el) => (el.textContent || '').includes('已勾选'));
    btn?.click();
  });
  if (selCount > 0) {
    const before = mediaReqs.length;
    await toggleSelectedOnly();
    await waitFor(async () => new URL(lastMedia('/api/media?')).searchParams.get('ids') !== null, 4000);
    await sleep(600);
    const scoped = new URL(lastMedia('/api/media?'));
    const scopedCards = await cards();
    const meta1 = await headTotal();
    check('只看已勾选 → 请求带 ids（条目数 = 已选数）',
      (scoped.searchParams.get('ids') || '').split(',').length === selCount, `ids 条目 ${(scoped.searchParams.get('ids') || '').split(',').length} 已选 ${selCount}`);
    check('只看已勾选 → 卡片数 = 命中数、无分页',
      scopedCards > 0 && scopedCards <= selCount && meta1 === `${scopedCards} 部`
      && (await tab.evaluate(() => document.querySelectorAll('#recommend-editor-root .vt-loadmore button').length)) === 0,
      `cards=${scopedCards} meta=${meta1} 已选=${selCount} 请求 ${mediaReqs.length - before} 次`);
    // 组合：只看已勾选 × 按年份分组（用户截图里就是分组开着的状态）
    await tab.evaluate(() => {
      const btn = [...document.querySelectorAll('#recommend-editor-root .vt-search-row button')]
        .find((el) => (el.textContent || '').includes('按年份'));
      btn?.click();
    });
    await waitFor(async () => {
      const q = new URL(lastMedia('/api/media?')).searchParams;
      return q.get('ids') !== null && q.get('sort') === 'year';
    }, 4000);
    await sleep(600);
    const grouped = await tab.evaluate(() => ({
      years: document.querySelectorAll('#recommend-editor-root .vt-year-head').length,
      cards: document.querySelectorAll('#recommend-editor-root .vt-media-card').length,
    }));
    check('只看已勾选 + 按年份分组 → 有年份段且有卡片', grouped.years > 0 && grouped.cards > 0, JSON.stringify(grouped));
    await tab.evaluate(() => {
      const btn = [...document.querySelectorAll('#recommend-editor-root .vt-search-row button')]
        .find((el) => (el.textContent || '').includes('按年份'));
      btn?.click();
    });
    await waitFor(async () => new URL(lastMedia('/api/media?')).searchParams.get('sort') === null, 4000);
    await sleep(400);
    await toggleSelectedOnly();
    await waitFor(async () => new URL(lastMedia('/api/media?')).searchParams.get('ids') === null, 4000);
    await sleep(600);
    check('再点一次 → 回到全库候选', (await headTotal()).includes('已加载'), `${await headTotal()} 卡片 ${await cards()}`);
    check('关闭分组/只看已选后无 sort/ids 残留',
      [...new URL(lastMedia('/api/media?')).searchParams.keys()].every((k) => k === 'limit' || k === 'offset'),
      new URL(lastMedia('/api/media?')).search);
  } else {
    check('只看已勾选：草稿无已选，跳过（先手动勾几部）', false, `已选 ${selCount}`);
  }

  // ⑫ 独立排序：年份 ↑（不分组也能排）
  const readYears = () => tab.evaluate(() => [...document.querySelectorAll('#recommend-editor-root .vt-media-year')].map((e) => Number(e.textContent)));
  /** 年份升序（长度 > 1；`—` 会被 Number 成 NaN，比较为 false → 当年份缺失时不会假通过）。 */
  const ascending = (years) => years.length > 1 && years.every((y, i) => i === 0 || years[i - 1] <= y);
  await tab.select('#recommend-editor-root .vt-sort-sel', 'year-asc');
  await waitFor(async () => {
    const q = new URL(lastMedia('/api/media?')).searchParams;
    return q.get('sort') === 'year' && q.get('order') === 'asc';
  }, 4000);
  // 等**列表真的换完**：只等请求发出会读到上一版列表（实测过一次假阴性：读到默认序 2008→2000）
  const ascOk = await waitFor(async () => ascending(await readYears()), 5000);
  const ascYears = await readYears();
  const asc = new URL(lastMedia('/api/media?'));
  check('选「年份 ↑」→ 请求 sort=year&order=asc，且首卡最旧',
    asc.searchParams.get('sort') === 'year' && asc.searchParams.get('order') === 'asc' && ascOk,
    `${asc.search} 年份 ${ascYears[0]}…${ascYears[ascYears.length - 1]} 名单前5 ${ascYears.slice(0, 5)}`);
  await tab.select('#recommend-editor-root .vt-sort-sel', 'default');
  await waitFor(async () => new URL(lastMedia('/api/media?')).searchParams.get('sort') === null, 4000);

  // 收尾：清干净，不给草稿留测试残留
  await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-chip-clear')?.click());
  await sleep(1300);
  const finalUrl = new URL(lastMedia('/api/media?'));
  check('收尾已清空筛选（草稿不留残留）', [...finalUrl.searchParams.keys()].every((k) => k === 'limit' || k === 'offset'), finalUrl.search);

  console.log('\n=== 汇总 ===');
  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ 检查项: results.length, 失败: failed.length, 失败项: failed.map((f) => f.name) }));
  process.exitCode = failed.length > 0 ? 1 : 0;
} finally {
  await browser.close().catch(() => undefined);
  await restoreDraft().catch(() => undefined);
}
