/**
 * 导出时字体基址的占位符：前端把带这个标记的 CSS 交给后端，后端换成 `file://` 字体目录。
 * 这样 @font-face **只有一份**（不会出现前后端各写一遍、浏览器挑到坏掉那条的情况）。
 */
export const COVER_FONT_TOKEN = '__CV_FONT_BASE__';

/**
 * 封面画布的样式（2026-09-29）：**预览与导出共用的唯一一份 CSS**。
 *
 * - 编辑器预览：`coverCss('/fonts')` 注入 `<style>`（`/fonts/**` 由 WebConfig 映射到项目字体目录）
 * - 导出：`coverCss('')` 只用于取"同一份字符串"给后端，后端再把字体声明换成 `file://` 绝对路径
 *
 * 版式要点（都是实测结论，别随手改）：
 *  1. **统一裁切**：`.cv-inner` 放大 1.4286× 后偏置，可见窗口 = 源图中间那条（去掉顶部 10% + 底部 20%）。
 *     原片的内嵌名牌/字幕就压在上下这两条里（实测 183 顶部「捏他：北斗神拳——拉奥」、底部台词），
 *     不裁会直接毁掉专业感；横向顺带吃掉 15%，正好落在 B 站 16:10 裁剪线内。
 *  2. **零装饰**：无描边 / 无 glow / 无渐变徽章 / 无斜切光缝（用户批评过"AI 味太重"）。
 *  3. 文字只放"底部渐层"这类承托上，且**只有两级文字**（标题 + 副标题），别的字一律不加。
 */
export function coverCss(fontBase: string): string {
  const font = (name: string) => `${fontBase}/${name}`;
  return `
/* —— 字体（普惠 115 Black 是用户选定的主标题字；思源负责副标题；Mona 管数字/拉丁）—— */
@font-face { font-family:'PuHui115'; src:url('${font('AlibabaPuHuiTi2-115-Black.ttf')}'); }
@font-face { font-family:'NotoSC'; font-weight:100 900; src:url('${font('NotoSansSC-VF.ttf')}') format('truetype-variations'); }
@font-face { font-family:'Mona'; src:url('${font('Mona-Sans.ttf')}'); }

.cv { position:relative; width:1920px; height:1080px; overflow:hidden; background:#0d0c12; color:#fff;
      font-family:'NotoSC'; --cv-accent:#831F36; }
.cv * { box-sizing:border-box; }

/* —— 格子与裁切 —— */
.cv-grid { position:absolute; inset:0; display:grid; gap:6px; }
.cv-cell { position:relative; overflow:hidden; background:#15141b; }
.cv-inner { position:absolute; left:-21.43%; top:-14.29%; width:142.86%; height:142.86%; }
.cv-img { width:100%; height:100%; object-fit:cover; display:block;
          filter:saturate(.88) contrast(1.06) brightness(.97); }
.cv-wash { position:absolute; inset:0; background:#14121c; opacity:.14; pointer-events:none; }
.cv-missing { position:absolute; inset:0; display:grid; place-items:center; color:rgba(255,255,255,.32);
              font-size:34px; letter-spacing:.12em; }

/* —— 版式：网格系 —— */
.cv-l-T01 { grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; }
.cv-l-T02 { grid-template-columns:1.62fr 1fr; grid-template-rows:repeat(3,1fr); }
.cv-l-T02 .cv-cell:first-child { grid-row:span 3; }
.cv-l-T03 { grid-template-rows:repeat(3,1fr); }
.cv-l-T04 { grid-template:1fr / 1fr; }
.cv-l-T05 { grid-template-columns:1.5fr 1fr; grid-template-rows:1fr 1fr; }
.cv-l-T05 .cv-cell:first-child { grid-row:span 2; }
.cv-l-T06 { grid-template-columns:repeat(4,1fr); }
.cv-l-T07 { grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr); }
.cv-l-T08 { grid-template-columns:32% 1fr; gap:0; }
.cv-panel { background:var(--cv-accent); }
.cv-l-T11 { grid-template-columns:repeat(3,1fr); }
.cv-l-T12 { grid-template-columns:1fr 1fr; }
.cv-l-T13 { grid-template-columns:1fr 1fr; gap:0; }
.cv-l-T13 .cv-cell:last-child { position:absolute; inset:0; }
.cv-l-T13 .cv-cell:first-child { position:relative; z-index:2; width:58%;
  clip-path:polygon(0 0, 100% 0, 74% 100%, 0 100%); }

/* 错位四格：上下两行各自分栏（单靠一个 grid 的列是共用一条线的） */
.cv-rows { position:absolute; inset:0; display:flex; flex-direction:column; gap:6px; }
.cv-rows .cv-row { display:flex; gap:6px; flex:1; }
.cv-rows .cv-row .cv-cell { flex:1; height:auto; }

/* 斜置网格：整块转出去，靠根元素 overflow 裁边 */
.cv-l-T21 { inset:-16%; gap:6px; transform:rotate(-6deg); }

/* —— 版式：非网格系 —— */
.cv-l-T09, .cv-l-T20, .cv-l-T16, .cv-l-T18 { position:absolute; inset:0; }
.cv-typo-bg { position:absolute; inset:0; }
.cv-typo-strip { position:absolute; right:0; top:0; width:34%; height:100%; overflow:hidden; }
.cv-typo-veil { position:absolute; left:0; top:0; width:70%; height:100%;
  background:linear-gradient(to right, #0b0a10 0%, #0b0a10 62%, rgba(11,10,16,0) 100%); }
.cv-viewfinder { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:62%; height:62%; overflow:hidden; border-radius:26px; box-shadow:0 30px 90px rgba(0,0,0,.6); }
.cv-blur { position:absolute; inset:0; overflow:hidden; }
.cv-blur .cv-inner { filter:blur(26px) brightness(.62) saturate(.8); }
.cv-circle { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  width:62%; height:110%; overflow:hidden; border-radius:50%; }
.cv-exposure .cv-cell { position:absolute; inset:0; }
.cv-exposure .cv-cell:last-child { mix-blend-mode:screen; opacity:.72; }
.cv-l-T19 { grid-template-columns:repeat(3,1fr); grid-template-rows:1fr 1fr; gap:12px; background:#F2EDE4; }
.cv-l-T19 .cv-cell:first-child { grid-column:span 2; }
.cv-print { position:absolute; background:#F2EDE4; padding:16px; box-shadow:0 26px 70px rgba(0,0,0,.55); }
.cv-print .cv-cell { position:absolute; inset:16px; }
.cv-print-1 { left:118px; top:132px; width:860px; height:492px; transform:rotate(-4deg); }
.cv-print-2 { left:706px; top:378px; width:900px; height:516px; transform:rotate(2.4deg); }
.cv-print-3 { left:330px; top:520px; width:760px; height:440px; transform:rotate(-1.6deg); }

/* —— 文字承托（按锚点自动选方向）—— */
.cv-scrim { position:absolute; pointer-events:none; }
.cv-scrim-b { left:0; right:0; bottom:0; height:640px;
  background:linear-gradient(to top, rgba(6,5,9,.94) 0%, rgba(6,5,9,.86) 26%, rgba(6,5,9,.55) 55%, rgba(6,5,9,0) 100%); }
.cv-scrim-t { left:0; right:0; top:0; height:640px;
  background:linear-gradient(to bottom, rgba(6,5,9,.9) 0%, rgba(6,5,9,.6) 45%, rgba(6,5,9,0) 100%); }
.cv-scrim-l { left:0; top:0; bottom:0; width:1200px;
  background:linear-gradient(to right, rgba(6,5,9,.94) 0%, rgba(6,5,9,.6) 40%, rgba(6,5,9,0) 88%); }
.cv-scrim-r { right:0; top:0; bottom:0; width:1200px;
  background:linear-gradient(to left, rgba(6,5,9,.94) 0%, rgba(6,5,9,.6) 40%, rgba(6,5,9,0) 88%); }
.cv-scrim-c { inset:0; background:radial-gradient(ellipse at center, rgba(6,5,9,.62) 0%, rgba(6,5,9,.12) 72%); }

/* —— 文字块：位置（九宫） + 对齐 + 微调 —— */
.cv-text { position:absolute; max-width:1180px; }
.cv-text-inner { transform:translate(var(--cv-x, 0), var(--cv-y, 0)); }
.cv-a-top-left { left:200px; top:96px; }
.cv-a-top-center { left:50%; top:96px; transform:translateX(-50%); }
.cv-a-top-right { right:200px; top:96px; }
.cv-a-mid-left { left:200px; top:50%; transform:translateY(-50%); }
.cv-a-center { left:50%; top:50%; transform:translate(-50%,-50%); }
.cv-a-mid-right { right:200px; top:50%; transform:translateY(-50%); }
.cv-a-bottom-left { left:200px; bottom:96px; }
.cv-a-bottom-center { left:50%; bottom:96px; transform:translateX(-50%); }
.cv-a-bottom-right { right:200px; bottom:96px; }
.cv-al-left { text-align:left; }
.cv-al-center { text-align:center; }
.cv-al-right { text-align:right; }
.cv-text.cv-inline { position:static; display:inline-block; }

.cv-t-sub { font-family:'NotoSC'; font-weight:300; font-size:30px; letter-spacing:.22em;
  color:rgba(255,255,255,.82); margin-bottom:20px; }
.cv-t-sub.cv-below { margin:20px 0 0; }
.cv-t-wrap { position:relative; display:inline-block; }
.cv-t-title { font-family:'PuHui115'; line-height:1.04; letter-spacing:-.01em; color:#fff;
  white-space:pre-line; }
.cv-t-ghost { position:absolute; left:0; top:0; color:var(--cv-accent); }
.cv-vertical .cv-t-title { writing-mode:vertical-rl; letter-spacing:.06em; line-height:1.12; }
.cv-vertical .cv-t-sub { writing-mode:vertical-rl; letter-spacing:.42em; margin:0 0 0 28px; }
`;
}
