/**
 * 临时脚本：验证三套正式推荐模板（stream/chapter/overview）。
 * 用假 SLIDES 数据替换占位符 → puppeteer 加载 → 检查分组渲染 + 新功能（多曲BGM/record徽标/副题/封面系数）+ JS 错误。
 * 用法：cd backend/scripts && node validate-templates.js
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEMPLATES = path.resolve(__dirname, '../src/main/resources/templates');

const grad = (a, b) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/></svg>`);

const G = (t, c, note, y) => ({ title: t, flag: '热血', cat: c, note, cover: grad('#4fc3f7', '#6f8bff'), tags: [['热血', 3]], group: y });
const SLIDES_GROUPED = [
  G('勇者王FINAL', '热血机甲', '燃到最后一刻。', '2024 年'),
  G('星屑与黄昏', '治愈日常', '黄昏的温柔。', '2024 年'),
  G('地狱模式', '异世界', '难度拉满。', '2024 年'),
  G('螺旋境界线', '科幻', '边界之外。', '2024 年'),
  G('钢之炼金术师', '奇幻', '等价交换。', '2023 年'),
  G('轻松熊', '日常', '什么都不做。', '2023 年'),
  G('奇诺之旅', '旅行', '世界并不美丽。', '2023 年'),
  G('初音岛', '恋爱', '樱花约定。', '2023 年'),
  G('青之芦苇', '运动', '绿茵起点。', '2022 年'),
  G('落第骑士', '战斗', '垫底到顶点。', '2022 年'),
  G('狼雨', '致郁', '雪中消失。', '2022 年'),
  G('爱的魔法', '搞笑', '笑着流泪。', '2022 年'),
];
const SLIDES_FLAT = SLIDES_GROUPED.map(({ group, ...rest }) => rest);

const BGM2 = [
  { name: 'A.mp3', src: 'data:audio/mpeg;base64,QUJD' },
  { name: 'B.mp3', src: 'data:audio/mpeg;base64,REVG' },
];

function fill(tpl, slides, opts = {}) {
  /* 注意：JS String.replace 只替换第一个匹配，必须用全局正则（占位符可能多次出现，如 __TITLE__ 在 title+h1） */
  return tpl
    .replace(/__TITLE__/g, '剧场 · 此刻')
    .replace(/__SLIDES_JSON__/g, JSON.stringify(slides))
    .replace(/__SUBTITLE__/g, opts.subtitle || '')
    .replace(/__COVER_SIZE__/g, opts.coverSize || 'md')
    .replace(/__INTRO__/g, opts.intro || '')
    .replace(/__PROLOGUE_TITLE__/g, opts.prologueTitle || '')
    .replace(/__ENDING_TITLE__/g, opts.endingTitle || '')
    .replace(/__ENDING_TEXT__/g, opts.endingText || '')
    .replace(/__BG_COLOR__/g, opts.bgColor || '')
    .replace(/__BG_IMAGE__/g, opts.bgImage || '')
    .replace(/__OPENING_SEC__/g, String(opts.openingSec || 8))
    .replace(/__INTRO_SEC__/g, String(opts.introSec || 3))
    .replace(/__GROUP_SEC__/g, String(opts.groupSec || 3))
    .replace(/__DETAIL_SEC__/g, String(opts.detailSec || 6))
    .replace(/__ENDING_SEC__/g, String(opts.endingSec || 4))
    .replace(/__BGM_TRACKS__/g, JSON.stringify(opts.bgmTracks || []))
    .replace(/__BGM_SRC__/g, '')
    .replace(/__BGM_NAME__/g, '');
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--window-size=1600,900', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

  const cases = [
    { file: 'recommend-stream.html', slides: SLIDES_GROUPED, name: 'stream+分组' },
    { file: 'recommend-chapter.html', slides: SLIDES_GROUPED, name: 'chapter+分组' },
    { file: 'recommend-overview.html', slides: SLIDES_GROUPED, name: 'overview+分组', postClick: true },
    { file: 'recommend-stream.html', slides: SLIDES_FLAT, name: 'stream+无分组' },
    { file: 'recommend-overview.html', slides: SLIDES_FLAT, name: 'overview+无分组', postClick: true },
    { file: 'recommend-stream.html', slides: SLIDES_GROUPED, name: 'stream+多曲BGM+record+大封面',
      record: true, opts: { bgmTracks: BGM2, coverSize: 'lg', subtitle: '年度精选' } },
    { file: 'recommend-stream.html', slides: SLIDES_FLAT, name: 'stream+副题空', opts: { subtitle: '' } },
    { file: 'recommend-stream.html', slides: SLIDES_GROUPED.map((s, i) => i < 8 ? { ...s, open: true } : s),
      name: 'stream+开场子集8（正片12）', expectCards: 8 },
    { file: 'recommend-chapter.html', slides: SLIDES_GROUPED.map((s, i) => i < 6 ? { ...s, open: true } : s),
      name: 'chapter+开场子集6（正片12）', expectCards: 6 },
    { file: 'recommend-stream.html', slides: SLIDES_GROUPED, name: 'stream+序言+结尾',
      opts: { intro: '这一季的 12 部珍藏，从燃到治愈一网打尽。' }, expectPrologue: 1 },
    { file: 'recommend-stream.html', slides: SLIDES_FLAT, name: 'stream+无简介（无序言页）', opts: {}, expectPrologue: 0 },
    { file: 'recommend-chapter.html', slides: SLIDES_GROUPED, name: 'chapter+序言+结尾',
      opts: { intro: '章节序言文字' }, expectPrologue: 1 },
    { file: 'recommend-overview.html', slides: SLIDES_FLAT, name: 'overview+序言+结尾(直排)',
      opts: { intro: '总览序言' }, expectPrologue: 1 },
    { file: 'recommend-stream.html',
      slides: [...SLIDES_GROUPED, G('番外1', '热血', 'n', '2021 年'), G('番外2', '日常', 'n', '2021 年'),
        G('番外3', '奇幻', 'n', '2021 年'), G('番外4', '恋爱', 'n', '2021 年')]
        .map((s, i) => i < 16 ? { ...s, open: true } : s),
      name: 'stream+开场16(网格不重叠)', expectCards: 16, checkSpots: true },
    { file: 'recommend-stream.html', slides: SLIDES_FLAT, name: 'stream+背景图',
      opts: { bgImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }, checkBgImage: true },
  ];

  for (const c of cases) {
    const tpl = fs.readFileSync(path.join(TEMPLATES, c.file), 'utf8');
    const html = fill(tpl, c.slides, c.opts || {});
    const f = path.join(os.tmpdir(), 'vt-' + c.file);
    fs.writeFileSync(f, html, 'utf8');

    const errors = [];
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    const url = 'file:///' + f.replace(/\\/g, '/') + (c.record ? '?record=1' : '');
    await page.goto(url, { waitUntil: 'load' });
    if (c.postClick) { await page.evaluate(() => document.getElementById('skipBtn').click()); await new Promise(r => setTimeout(r, 1200)); }
    else await new Promise(r => setTimeout(r, 600));

    const st = await page.evaluate(() => ({
      interlude: document.querySelectorAll('.interlude').length,
      chapter: document.querySelectorAll('.chapter').length,
      story: document.querySelectorAll('.story-card').length,
      badge: document.querySelectorAll('.group-badge').length,
      ovCard: document.querySelectorAll('.ov-card').length,
      gv: document.querySelectorAll('.group-view').length,
      nav: document.querySelectorAll('.group-nav .gn').length,
      gvCardVisible: [...document.querySelectorAll('.gv-card')].filter(x => parseFloat(getComputedStyle(x).opacity) > 0).length,
      bgmBarShown: !document.getElementById('bgmBar').hidden,
      bgmPlayHidden: document.getElementById('bgmPlayBtn').hidden,
      autoBadgeHidden: document.getElementById('autoBadge').hidden,
      heroSubHidden: document.getElementById('heroSub').style.display === 'none',
      cardScale: (document.querySelector('.card') || {}).style ? document.querySelector('.card').style.transform : '',
      card: document.querySelectorAll('.card').length,
      bgmName: document.getElementById('bgmName').textContent,
      prologue: document.querySelectorAll('.prologue').length,
      ending: document.querySelectorAll('.ending').length,
      transforms: [...document.querySelectorAll('.card')].map(el => el.style.transform),
      bgImage: (document.querySelector('.bg-image-layer') || { style: {} }).style.backgroundImage || '',
      bgOpacity: (document.querySelector('.bg-image-layer') || { style: {} }).style.opacity || '',
    }));

    const issues = [];
    if (c.expectCards && st.card !== c.expectCards) issues.push(`开场卡片 ${st.card} != 期望 ${c.expectCards}`);
    if (c.checkSpots && new Set(st.transforms).size !== st.transforms.length) issues.push(`开场位置重复（有覆盖）：${st.transforms.length - new Set(st.transforms).size} 张重复`);
    if (c.checkBgImage && !st.bgImage.includes('url("data:')) issues.push(`背景图层 url 未正确注入引号：${st.bgImage}`);
    if (c.checkBgImage && Math.abs(parseFloat(st.bgOpacity) - 0.4) > 0.01) issues.push(`背景图层透明度异常：${st.bgOpacity}`);
    if (typeof c.expectPrologue === 'number' && st.prologue !== c.expectPrologue) issues.push(`序言页 ${st.prologue} != 期望 ${c.expectPrologue}`);
    if (st.ending !== 1) issues.push(`结尾页 ${st.ending} != 期望 1`);
    if (c.record && !st.autoBadgeHidden) issues.push('record 未隐藏 autoBadge');
    if (c.record && c.opts && c.opts.bgmTracks && !st.bgmPlayHidden) issues.push('record 未隐藏 BGM 工具栏按钮');
    if (c.opts && c.opts.bgmTracks && st.bgmName !== c.opts.bgmTracks[0].name) issues.push(`BGM 初始应显示当前曲名「${c.opts.bgmTracks[0].name}」实际「${st.bgmName}」（播放中不应被即将播放覆盖）`);
    if (c.opts && c.opts.bgmTracks && st.bgmName.includes('即将播放')) issues.push('加载后不应立即显示「即将播放」');
    if (c.opts && c.opts.subtitle === '' && !st.heroSubHidden) issues.push('副题空未隐藏');
    if (c.opts && c.opts.bgmTracks && !st.bgmBarShown) issues.push('BGM 条未显示');
    if (c.opts && c.opts.coverSize === 'lg' && !st.cardScale.includes('scale(1.')) issues.push('大封面系数未生效: ' + st.cardScale);
    if (errors.length) issues.push('JS错误: ' + errors.slice(0, 3).join('|'));
    const pass = issues.length === 0;
    console.log(`[${c.name}] ${pass ? '✓' : '✗'}`);
    console.log('  ', JSON.stringify(st));
    if (issues.length) console.log('  问题:', issues.join(' ; '));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
