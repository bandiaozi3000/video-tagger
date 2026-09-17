/**
 * 临时脚本：加载三套画廊样板，捕获 JS 错误 + 在两个时刻 dump DOM 状态，验证动画逻辑。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DESIGN = path.resolve(__dirname, '../../docs/design');

const jobs = [
  { file: 'flicker-reel-gallery.html',      flash: 2400, settle: 7600, name: '放映机'      },
  { file: 'montage-starburst-gallery.html', flash: 2600, settle: 8200, name: '意识流'      },
  { file: 'darkroom-develop-gallery.html',  flash: 4600, settle: 11200, name: '暗房'       },
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
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

    await page.goto(url, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, j.flash));
    const flashState = await page.evaluate(() => {
      const vis = [...document.querySelectorAll('.card,.polaroid')].map(c =>
        (getComputedStyle(c).opacity));
      return { visible: vis.filter(o => parseFloat(o) > 0).length, total: vis.length };
    });
    await new Promise(r => setTimeout(r, j.settle - j.flash));
    const galState = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.card,.polaroid')];
      return {
        visible: cards.filter(c => parseFloat(getComputedStyle(c).opacity) > 0).length,
        total: cards.length,
        mounted: cards.filter(c => c.classList.contains('mount') || c.classList.contains('scattered') || c.classList.contains('focused')).length,
        filmstrip: !!document.querySelector('#filmstrip.show, #trail.show'),
      };
    });

    console.log(`\n[${j.name} ${j.file}]`);
    console.log('  errors:', errors.length ? errors.slice(0, 5).join(' | ') : '无');
    console.log(`  闪回中段: ${flashState.visible}/${flashState.total} 张可见`);
    console.log(`  画廊定格: ${galState.visible}/${galState.total} 张可见, 状态标记 ${galState.mounted}, 底部条 ${galState.filmstrip}`);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
