/** 临时脚本：诊断 overview 模板显示环节（显影→总览→切组→组内卡片可见性）。 */
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
  const url = 'file:///' + path.join(DESIGN, 'recommend-group-overview.html').replace(/\\/g, '/');
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(url, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 3000));   // 显影中
  console.log('3s  显影:', await page.evaluate(() => ({
    dev: !!document.querySelector('#devCount.show'),
    heroHidden: document.getElementById('hero').style.display === 'none',
    ovDisplay: getComputedStyle(document.getElementById('overview')).display,
    ovCards: document.querySelectorAll('.ov-card').length,
    ovInView: [...document.querySelectorAll('.ov-card')].filter(c => c.classList.contains('in-view')).length,
  })));

  await new Promise(r => setTimeout(r, 7000));   // 显影完 → 总览（openWall ~9.5s 完成）
  console.log('10s 总览:', await page.evaluate(() => ({
    heroHidden: document.getElementById('hero').style.display === 'none',
    ovDisplay: getComputedStyle(document.getElementById('overview')).display,
    ovInView: [...document.querySelectorAll('.ov-card')].filter(c => c.classList.contains('in-view')).length,
    ovVisible: [...document.querySelectorAll('.ov-card')].filter(c => parseFloat(getComputedStyle(c).opacity) > 0).length,
  })));

  // 模拟点击第一组 → 切组
  await page.evaluate(() => document.querySelector('.ov-card').click());
  await new Promise(r => setTimeout(r, 1600));   // 转场 620ms + 余量
  console.log('点击组后:', await page.evaluate(() => {
    const gv = document.querySelector('.group-view.show');
    const cards = gv ? [...gv.querySelectorAll('.gv-card')] : [];
    return {
      transShown: document.getElementById('transition').classList.contains('show'),
      gvShown: !!gv,
      gvCards: cards.length,
      inView: cards.filter(c => c.classList.contains('in-view')).length,
      visibleOp: cards.filter(c => parseFloat(getComputedStyle(c).opacity) > 0).length,
      scrollY: Math.round(scrollY),
    };
  }));
  console.log('errors:', errors.length ? errors.join(' | ') : '无');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
