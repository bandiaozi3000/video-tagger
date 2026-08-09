/** 临时脚本：验证三套分组模板无 JS 错误 + 分组结构正确。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const DESIGN = path.resolve(__dirname, '../../docs/design');

const jobs = [
  { file: 'recommend-group-chapter.html',  wait: 10200, name: 'A 章节式',  expect: { chapter: 3, story: 12, badge: 12 } },
  { file: 'recommend-group-overview.html', wait: 11800, name: 'B 总览式',  expect: { ovcard: 3, gview: 3, chips: 4 } },
  { file: 'recommend-group-stream.html',   wait: 10200, name: 'C 流式',    expect: { interlude: 3, story: 12, badge: 12 } },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--window-size=1600,900', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

  for (const j of jobs) {
    const url = 'file:///' + path.join(DESIGN, j.file).replace(/\\/g, '/');
    const errors = [];
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

    await page.goto(url, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 4000));
    const mid = await page.evaluate(() => ({
      dev: !!document.querySelector('#devCount.show'),
      visibleCards: [...document.querySelectorAll('.card')].filter(p => parseFloat(getComputedStyle(p).opacity) > 0).length,
    }));
    await new Promise(r => setTimeout(r, j.wait - 4000));
    const late = await page.evaluate(() => ({
      chapter: document.querySelectorAll('.chapter').length,
      interlude: document.querySelectorAll('.interlude').length,
      story: document.querySelectorAll('.story-card').length,
      badge: document.querySelectorAll('.group-badge').length,
      ovcard: document.querySelectorAll('.ov-card').length,
      gview: document.querySelectorAll('.group-view').length,
      chips: document.querySelectorAll('.group-nav .gn').length,
      auto: !!document.querySelector('#trackbar.auto'),
      scrollY: Math.round(scrollY),
    }));

    const ok = Object.entries(j.expect).every(([k, v]) => late[k] === v);
    console.log(`[${j.name}] errors:${errors.length ? errors.slice(0,4).join('|') : '无'}  显影:${mid.visibleCards}/12 ${mid.dev?'中':''}`);
    console.log(`   组结构: ${JSON.stringify(Object.fromEntries(Object.entries(j.expect).map(([k])=>[k,late[k]])))} ${ok?'✓':'✗'}  auto:${late.auto} scrollY:${late.scrollY}`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
