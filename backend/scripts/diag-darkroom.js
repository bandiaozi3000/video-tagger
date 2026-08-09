/** 临时脚本：验证 recommend-darkroom.html（暗房开场完整模板）无 JS 错误 + 显影状态正确。 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const DESIGN = path.resolve(__dirname, '../../docs/design');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--window-size=1600,900', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  const url = 'file:///' + path.join(DESIGN, 'recommend-darkroom.html').replace(/\\/g, '/');

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(url, { waitUntil: 'load' });

  for (const t of [4000, 10000, 12800]) {
    await new Promise(r => setTimeout(r, t === 4000 ? 4000 : (t === 10000 ? 6000 : 2800)));
    const st = await page.evaluate(() => ({
      dev: !!document.querySelector('#devCount.show'),
      visible: [...document.querySelectorAll('.card')].filter(p => parseFloat(getComputedStyle(p).opacity) > 0).length,
      mounted: [...document.querySelectorAll('.card')].filter(p => p.classList.contains('mount')).length,
      story: document.querySelectorAll('.story-card').length,
      scrollY: Math.round(scrollY),
      auto: !!document.querySelector('#trackbar.auto'),
    }));
    console.log(t + 'ms:', JSON.stringify(st));
  }
  console.log('errors:', errors.length ? errors.slice(0, 6).join(' | ') : '无');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
