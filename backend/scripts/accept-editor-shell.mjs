/**
 * 工作台新壳验收（工具栏/胶片条/时间轴/对象轴/无限滚动/Ctrl+K/沉浸/点卡片选中）。
 * 注意：编辑器会自动把状态写回服务端草稿 —— 跑前备份、跑完还原，避免动到用户正在编辑的内容。
 */
import { createRequire } from 'node:module';
import path from 'node:path';
const repo = path.resolve(import.meta.dirname, '..', '..'); // backend/scripts → 仓库根
const puppeteer = createRequire(path.join(repo, 'backend', 'scripts', 'package.json'))('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 轮询等待条件成立（上限 timeout 毫秒）——会话要准备素材/BGM，耗时随片单增长，死等固定毫秒会假阴性。 */
const waitFor = async (predicate, timeout = 40000, step = 200) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(step);
  }
  return false;
};
const out = []; const check = (n, ok, d) => { out.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${ok || !d ? '' : ` —— ${d}`}`); };

// ① 备份草稿
const draftRes = await fetch('http://127.0.0.1:8080/api/recommend/draft');
const backup = (await draftRes.json()).config;
console.log(`（已备份草稿 ${backup ? JSON.parse(backup).config.ids.length + ' 部已选' : '空'}，跑完还原）`);

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'], defaultViewport: { width: 1600, height: 950 } });
const tab = await b.newPage(); const errs = []; tab.on('pageerror', (e) => errs.push(String(e.message)));
try {
  await tab.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle2', timeout: 60000 });
  await tab.evaluate(() => document.querySelector('.tab[data-view="recommend"]')?.click());
  await tab.waitForSelector('#recommend-editor-root .vt-toolbar', { timeout: 30000 });
  // 等预览**真的就绪**（胶片条出卡 + 时间轴在位），而不是定死 sleep：
  // 会话要现场准备片段素材与 BGM，实测 6 部 + 片段时约 6–10s（曾因此假报“胶片条 0 卡”）。
  await waitFor(async () => (await tab.evaluate(() => document.querySelectorAll('#recommend-editor-root .vt-film-card').length)) > 0
    && (await tab.evaluate(() => Boolean(document.querySelector('#recommend-editor-root .vt-tl')))), 60000);
  await sleep(300);
  const box = (s) => tab.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }, s);
  const txt = (s) => tab.evaluate((sel) => document.querySelector(sel)?.innerText?.replace(/\s+/g, ' ').trim() ?? '', s);
  const n = (s) => tab.evaluate((sel) => document.querySelectorAll(sel).length, s);

  check('工具栏 52px + 抬头卡已移除', (await box('#recommend-editor-root .vt-toolbar'))?.h === 52 && (await n('#recommend-editor-root .vt-hero')) === 0);
  check('三栏头 36px（无英文 kicker）', (await n('#recommend-editor-root .vt-colhead')) === 3 && (await n('#recommend-editor-root .kicker')) === 0 && (await box('#recommend-editor-root .vt-colhead'))?.h === 36);
  const sceneCount = await n('#recommend-editor-root .vt-film-card');
  check('胶片条 = 一段一卡', sceneCount > 0, `卡片 ${sceneCount}`);
  const tl0 = await box('#recommend-editor-root .vt-tl');
  check('时间轴默认收起（≤40px）', tl0 && tl0.h <= 40, JSON.stringify(tl0));
  await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-tl-toggle')?.click()); await sleep(300);
  check('点展开 → 变高 + 出现段单元', (await box('#recommend-editor-root .vt-tl')).h > tl0.h && (await n('#recommend-editor-root .vt-tl-cell')) > 0);
  await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-tl-toggle')?.click()); await sleep(200);
  check('右栏图标列 44px', (await box('#recommend-editor-root .vt-rail'))?.w === 44);

  // 先清掉草稿里带的搜索/筛选，才能测无限滚动
  const hasChips = (await n('#recommend-editor-root .vt-chip-dim')) > 0;
  const hasQuery = (await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-search-input')?.value ?? '')) !== '';
  if (hasChips) { await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-chip-clear')?.click()); await sleep(1200); }
  if (hasQuery) {
    await tab.evaluate(() => { const el = document.querySelector('#recommend-editor-root .vt-search-input'); el.focus(); el.select(); });
    await tab.keyboard.press('Backspace'); await sleep(1300);
  }
  const before = await n('#recommend-editor-root .vt-media-card');
  await tab.evaluate(() => { const s = document.querySelector('#recommend-editor-root .vt-scroll'); s.scrollTop = s.scrollHeight; });
  await sleep(2000);
  const after = await n('#recommend-editor-root .vt-media-card');
  check('滚到底自动加载下一页', after > before, `${before} → ${after}（${await txt('#recommend-editor-root .vt-colhead-meta')}）`);

  await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-colhead .btn-mini')?.click()); await sleep(250);
  check('⋯ 菜单：3 个批量操作', (await n('.vt-pop .vt-pop-item')) === 3);
  await tab.keyboard.press('Escape'); await sleep(250);

  // 点卡片 → 右栏切到该媒体
  const firstTitle = (await txt('#recommend-editor-root .vt-media-title')).slice(0, 6);
  await tab.evaluate(() => document.querySelectorAll('#recommend-editor-root .vt-media-card')[0]?.click()); await sleep(300);
  check('点卡片 → 右栏面包屑切到该媒体', (await txt('#recommend-editor-root .vt-crumb')).includes(firstTitle), `${await txt('#recommend-editor-root .vt-crumb')} / 期望含 ${firstTitle}`);
  check('点卡片 → 卡片高亮 picked', (await n('#recommend-editor-root .vt-media-card.picked')) === 1);
  check('点卡片 → 右栏显示该媒体（未加入推荐也给提示）', (await txt('#recommend-editor-root .vt-insp-pane')).includes(firstTitle) || (await n('#recommend-editor-root .vt-outside')) === 1, await txt('#recommend-editor-root .vt-insp-pane'));

  // 草稿备份/还原（PUT 语义，写错方法会 500）
  const backupOk = (r) => r.status === 204 || r.status === 200;

  // Ctrl+K（真实按键）
  await tab.keyboard.down('Control'); await tab.keyboard.press('KeyK'); await tab.keyboard.up('Control'); await sleep(350);
  check('Ctrl+K 打开参数面板', (await n('.vt-palette li button')) > 0);
  await tab.type('.vt-palette input', '时长', { delay: 25 }); await sleep(250);
  await tab.evaluate(() => document.querySelector('.vt-palette li button')?.click()); await sleep(800);
  const openSecs = await tab.evaluate(() => [...document.querySelectorAll('#recommend-editor-root .vt-sec.open .lb')].map((e) => e.textContent));
  check('参数搜索跳到「时长与显示」并展开', openSecs.some((t) => (t || '').includes('时长与显示')), JSON.stringify(openSecs));

  // 工具栏三个弹层（按 class 找，避免顺序依赖）
  await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-toolbar [data-vt="export-menu"]')?.click()); await sleep(300);
  check('导出 ▾ 弹层含画质/封装下拉', (await n('.vt-pop select')) >= 2, `select=${await n('.vt-pop select')}`);
  await tab.keyboard.press('Escape'); await sleep(250);
  await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-toolbar [data-vt="status"]')?.click()); await sleep(300);
  check('ⓘ 状态弹层 4 行', (await n('.vt-pop .vt-pop-kv')) === 4, `kv=${await n('.vt-pop .vt-pop-kv')}`);
  await tab.keyboard.press('Escape'); await sleep(250);
  await tab.evaluate(() => document.querySelector('#recommend-editor-root .vt-toolbar [data-vt="theme"]')?.click()); await sleep(300);
  check('主题 ▾ 弹层 4 个预设 + 色板', (await n('.vt-pop .vt-swatch')) === 4, `色板=${await n('.vt-pop .vt-swatch')}`);
  await tab.keyboard.press('Escape'); await sleep(250);

  // 点画布 = 选中当前画面所属的段/媒体（避开底部 Player 控制条）
  const beforeClick = await txt('#recommend-editor-root .vt-crumb');
  const shell = await box('#recommend-editor-root .vt-player-shell');
  const shellAt = await tab.evaluate(() => { const r = document.querySelector('#recommend-editor-root .vt-player-shell').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await tab.mouse.click(shellAt.x + shellAt.w / 2, shellAt.y + shellAt.h / 2);
  await sleep(400);
  const afterClick = await txt('#recommend-editor-root .vt-crumb');
  check('点画布 → 右栏切到当前段/媒体', beforeClick !== afterClick, `${beforeClick} → ${afterClick}（画布 ${shell?.w}×${shell?.h}）`);

  // 沉浸
  await tab.keyboard.press('KeyP'); await sleep(450);
  const flash = await tab.evaluate(() => ({
    toolbarHidden: getComputedStyle(document.querySelector('#recommend-editor-root .vt-toolbar')).display === 'none',
    stageOnly: document.querySelector('#recommend-editor-root .vt-body')?.className.includes('stage-only') ?? false,
    tip: Boolean(document.querySelector('#recommend-editor-root .vt-immersive-tip')),
  }));
  check('P 沉浸：隐工具栏 + 单栏 + 退出提示', flash.toolbarHidden && flash.stageOnly && flash.tip, JSON.stringify(flash));
  await tab.keyboard.press('Escape'); await sleep(350);
  check('Esc 退出沉浸', (await box('#recommend-editor-root .vt-toolbar'))?.h === 52);

  console.log('\n页面错误:', errs.length ? errs.slice(0, 3).join(' | ') : '(none)');
  console.log('汇总:', JSON.stringify({ 检查项: out.length, 失败: out.filter((x) => !x).length }));
} finally {
  await b.close().catch(() => undefined);
  // ② 还原草稿
  if (backup) {
    const r = await fetch('http://127.0.0.1:8080/api/recommend/draft', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: backup }),
    });
    const after = JSON.parse((await (await fetch('http://127.0.0.1:8080/api/recommend/draft')).json()).config);
    console.log(`草稿还原: HTTP ${r.status}（已选 ${after.config.ids.length} 部 · q="${after.filter.q}"）`);
  }
}
