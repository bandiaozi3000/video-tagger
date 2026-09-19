/** 验收：右栏分组开关「记住」（切对象 + 刷新后都保持），且不写进草稿。 */
import { createRequire } from 'node:module';
import path from 'node:path';
const repo = path.resolve(import.meta.dirname, '..', '..');
const puppeteer = createRequire(path.join(repo, 'backend', 'scripts', 'package.json'))('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = []; const check = (n, ok, d) => { out.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${ok || !d ? '' : ` —— ${d}`}`); };
const backup = (await (await fetch('http://127.0.0.1:8080/api/recommend/draft')).json()).config;
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'], defaultViewport: { width: 1600, height: 950 } });
const openSecs = (tab) => tab.evaluate(() => [...document.querySelectorAll('#recommend-editor-root .vt-sec.open .lb')].map((e) => e.textContent.replace(/^[A-Za-z]+\s*/, '')));
try {
  const tab = await b.newPage();
  const load = async () => {
    await tab.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle2', timeout: 60000 });
    await tab.evaluate(() => document.querySelector('.tab[data-view="recommend"]')?.click());
    await tab.waitForSelector('#recommend-editor-root .vt-toolbar', { timeout: 30000 });
    await sleep(1800);
  };
  await load();
  const init = await openSecs(tab);
  check('默认只开「全局参数」', init.length === 1 && init[0].includes('全局参数'), JSON.stringify(init));

  // 手动打开「背景层」
  await tab.evaluate(() => [...document.querySelectorAll('#recommend-editor-root .vt-sec-h')].find((h) => h.textContent.includes('背景层'))?.click());
  await sleep(300);
  check('点开「背景层」', (await openSecs(tab)).some((t) => t.includes('背景层')));

  // 切对象（点一张卡片）后仍在
  await tab.evaluate(() => document.querySelectorAll('#recommend-editor-root .vt-media-card')[0]?.click());
  await sleep(400);
  const afterSwitch = await openSecs(tab);
  check('切到媒体对象后「背景层」仍开着', afterSwitch.some((t) => t.includes('背景层')), JSON.stringify(afterSwitch));

  // 刷新后仍在（localStorage）
  await load();
  const afterReload = await openSecs(tab);
  check('刷新后仍是「开了背景层」', afterReload.some((t) => t.includes('背景层')) && afterReload.some((t) => t.includes('全局参数')), JSON.stringify(afterReload));

  // 收起「全局参数」→ 刷新后保持收起
  await tab.evaluate(() => [...document.querySelectorAll('#recommend-editor-root .vt-sec-h')].find((h) => h.textContent.includes('全局参数'))?.click());
  await sleep(300);
  await load();
  const collapsed = await openSecs(tab);
  check('收起「全局参数」后刷新仍收起', !collapsed.some((t) => t.includes('全局参数')) && collapsed.some((t) => t.includes('背景层')), JSON.stringify(collapsed));

  // 草稿里不应包含 UI 偏好
  const draft = JSON.parse((await (await fetch('http://127.0.0.1:8080/api/recommend/draft')).json()).config);
  check('UI 偏好没进草稿', !JSON.stringify(draft).includes('vt-recommend-editor-ui') && !('ui' in draft) && !('openGroups' in (draft.filter ?? {})));
  console.log('汇总:', JSON.stringify({ 检查项: out.length, 失败: out.filter((x) => !x).length }));
} finally {
  await b.close().catch(() => undefined);
  if (backup) {
    const r = await fetch('http://127.0.0.1:8080/api/recommend/draft', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: backup }) });
    const after = JSON.parse((await (await fetch('http://127.0.0.1:8080/api/recommend/draft')).json()).config);
    console.log(`（草稿还原 HTTP ${r.status}：已选 ${after.config.ids.length} 部 · q="${after.filter.q}"）`);
  }
}
