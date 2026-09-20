import React from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';

/**
 * 银幕式自带字体（`public/fonts` 的项目内 ttf）——渲染自足，不赌系统装没装字体。
 *
 * 为什么必须自带：2026-09-20 用**渲染同一个浏览器**（`chrome-headless-shell`）实测，
 * `CINEMA_FONT` 里旧的 `阿里巴巴普惠体 2 115 Black` 与 `Mona-Sans` 两个名字都**没命中**
 * （受保护字体真名是 `阿里巴巴普惠体 2.0` / `Mona Sans`），标题一直退化成系统默认 sans 的 Regular 字重
 * ——这就是"字体不突出"的根因。真名也写进 `CINEMA_FONT` 当兜底。
 *
 * 加载失败**不阻断渲染**：直接放行 → 退回系统字体栈。
 * 编辑器预览（Vite 产物不含 `public/`，`/fonts/...` 会 404）走的正是这条兜底，观感一致（同一套字体已装在系统里）。
 */
const FACES = [
  // 标题用真字重黑体（文件中 usWeightClass=1000，按 900 声明）
  { family: 'VTPuhuiBlack', file: 'fonts/AlibabaPuHuiTi2-115-Black.ttf', weight: '900', probe: '900' },
  // 数字/西文：可变字体（wght 200..900），声明成区间让 font-weight 真的走可变轴
  { family: 'VTMonaSans', file: 'fonts/Mona-Sans.ttf', weight: '200 900', probe: '400' },
];

const CSS = FACES.map(
  (face) => `@font-face{font-family:'${face.family}';src:url('${staticFile(face.file)}');font-weight:${face.weight};font-style:normal;font-display:block;}`,
).join('\n');

/** 挂在合成根上：注入 `@font-face`，等字体加载完成（或失败）才继续渲染，避免前几帧用错字体。 */
export function useCinemaFonts(): void {
  const handle = React.useMemo(() => delayRender('加载银幕式字体'), []);
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    let settled = false;
    const release = (): void => {
      if (settled) return;
      settled = true;
      continueRender(handle);
    };
    Promise.all(FACES.map((face) => document.fonts.load(`${face.probe} 16px '${face.family}'`)))
      .then(release)
      .catch(release);
    return () => style.remove();
  }, [handle]);
}
