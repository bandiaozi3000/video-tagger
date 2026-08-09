/**
 * 临时脚本：给 docs/design 三套画廊样板各截两帧 PNG（闪回中段 + 画廊定格）供对比。
 * 用法：cd backend/scripts && node snap-galleries.js
 * 依赖：本机 Chrome + puppeteer-core（已在 package.json）。
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = 1600, H = 900;
const DESIGN = path.resolve(__dirname, '../../docs/design');

const jobs = [
  { file: 'flicker-reel-gallery.html',      flash: 2800, settle: 7600, prefix: 'flicker-reel'      },
  { file: 'montage-starburst-gallery.html', flash: 2600, settle: 8200, prefix: 'montage-starburst' },
  { file: 'darkroom-develop-gallery.html',  flash: 4600, settle: 11200, prefix: 'darkroom-develop'  },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [`--window-size=${W},${H}`, '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });

  for (const j of jobs) {
    const url = 'file:///' + path.join(DESIGN, j.file).replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, j.flash));
    await page.screenshot({ path: path.join(DESIGN, j.prefix + '-flash.jpg'), type: 'jpeg', quality: 82 });
    await new Promise(r => setTimeout(r, j.settle - j.flash));
    await page.screenshot({ path: path.join(DESIGN, j.prefix + '-gallery.jpg'), type: 'jpeg', quality: 82 });
    console.log('done:', j.prefix);
  }

  await browser.close();
  console.log('ALL DONE');
})().catch(e => { console.error(e); process.exit(1); });
