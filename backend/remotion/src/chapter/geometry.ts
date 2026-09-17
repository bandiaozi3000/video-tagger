/**
 * Remotion 几何适配层（**不改动机械提取的 chapter.css**）。
 *
 * 原因：旧模板是一张纵向滚动页——`.story` 是 1080px 定宽居中容器，各段靠 `min-height:100vh`
 * 撑满并靠浏览器滚动切换。Remotion 是固定画幅逐帧渲染，没有滚动容器，
 * 因此这里把「每段独占一帧」的几何关系显式补回来。
 */
export const CHAPTER_GEOMETRY_CSS = `
.vt-chapter-root{position:absolute;inset:0;overflow:hidden;}
.vt-chapter-root .content{position:absolute;inset:0;width:100%;height:100%;}
.vt-chapter-root .story{max-width:none;margin:0;padding:0;position:absolute;inset:0;width:100%;height:100%;}
.vt-chapter-root .hero,
.vt-chapter-root .prologue,
.vt-chapter-root .story-card,
.vt-chapter-root .ending{position:absolute;inset:0;width:100%;min-height:100%;height:100%;box-sizing:border-box;}
/* 底部进度条：旧模板靠 .show/.auto 由自动导览点亮，成片里恒亮 */
.vt-chapter-root .trackbar{opacity:1;pointer-events:none;}
.vt-chapter-root .trackbar .tb-progress{opacity:1;}
`;
