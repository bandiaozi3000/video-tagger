/**
 * 临时脚本：验证 docs/design 三套新版样板（漫画/电视/像素）无 JS 错误 + 两段式状态正确。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DESIGN = path.resolve(__dirname, '../../docs/design');

const jobs = [
  { file: 'manga-panel-gallery.html',    flash: 2400, settle: 7200, name: '漫画分镜' },
  { file: 'crt-television-gallery.html', flash: 3000, settle: 8000, name: '老电视墙' },
  { file: 'pixel-game-gallery.html',     flash: 2600, settle: 6600, name: '像素游戏' },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--window-size=1600,900', '--force-device-scale-factor=1'],
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
    await new Promise(r => setTimeout(r, j.flash));
    const flashState = await page.evaluate(() => {
      const vis = [...document.querySelectorAll('.card,.panel,.tv')].filter(el =>
        parseFloat(getComputedStyle(el).opacity) > 0).length;
      return { visible: vis };
    });
    await new Promise(r => setTimeout(r, j.settle - j.flash));
    const galState = await page.evaluate(() => ({
      wallShow: !!document.querySelector('#wall.show, #hpWrap.show, #chanWrap.show'),
      visible: [...document.querySelectorAll('.card,.panel,.tv')].filter(el =>
        parseFloat(getComputedStyle(el).opacity) > 0).length,
    }));

    console.log(`[${j.name} ${j.file}]`);
    console.log(`  errors: ${errors.length ? errors.slice(0, 5).join(' | ') : '无'}`);
    console.log(`  闪回中段可见: ${flashState.visible} / 画廊定格: ${galState.visible} (壁显示: ${galState.wallShow})`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
