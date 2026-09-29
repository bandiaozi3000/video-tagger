/**
 * 封面画布：把 `CoverConfig` + 素材渲染成 1920×1080 的 DOM（2026-09-29）。
 *
 * **这份 DOM 有两个身份**：
 *   1. 编辑器弹窗里的实时预览（外面套一层缩放容器）
 *   2. 导出时被 `outerHTML` 抓下来交给后端 Chrome 截图
 * 所以这里**不要**写依赖交互/状态的东西（hover、动画、ref 里的临时态），
 * 也不要放行内样式以外的"只有编辑器才知道"的信息 —— 抓下来就是最终画面。
 */
import React from 'react';
import { coverCss } from './cover-css';
import {
  coverSignature, defaultCoverConfig, layoutById, mergeCoverConfig, resolveLayout,
  type CoverAnchor, type CoverConfig, type CoverFrame,
} from './cover-model';

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** 预览用样式：`/fonts/**` 由 WebConfig 映射到项目字体目录。导出走后端自己的字体声明（占位符替换）。
 *
 * ⚠️ **模块级注入，不要改成"谁用谁调 hook"**：2026-09-29 真踩过 —— 钩子写了没人调，
 * 预览就渲染成一堆没样式的图堆在原尺寸上（导出反而正常，因为导出单独把 CSS 发给了后端），
 * 表现为「封面预览显示有问题」。模块加载即注入，不可能忘。
 */
let coverCssInjected = false;
function ensureCoverCss(): void {
  if (coverCssInjected || typeof document === 'undefined') return;   // SSR / 单测环境：不碰 DOM
  coverCssInjected = true;
  const style = document.createElement('style');
  style.id = 'cv-style';
  style.textContent = coverCss('/fonts');
  document.head.appendChild(style);
}
ensureCoverCss();

function Cell({ frame }: { frame?: CoverFrame }) {
  return (
    <div className="cv-cell">
      {frame ? (
        <div className="cv-inner"><img className="cv-img" src={frame.url} alt="" /></div>
      ) : (
        <div className="cv-missing">空</div>
      )}
    </div>
  );
}

/** 版式骨架。返回的 DOM 必须**自包含**（导出时会被整棵抓走）。 */
function Layout({ id, frames }: { id: string; frames: CoverFrame[] }) {
  const f = (index: number) => frames[index];
  switch (id) {
    case 'T08':
      // 左纯色栏不是图片格，必须显式渲染（通用分支只画 needs 个图片格）
      return (
        <div className="cv-grid cv-l-T08">
          <div className="cv-cell cv-panel" />
          <Cell frame={f(0)} />
        </div>
      );
    case 'T09':
      return (
        <div className="cv-rows">
          <div className="cv-row">{[0, 1].map((i) => <div key={i} style={{ flex: i === 0 ? 1.38 : 1, display: 'flex' }}><Cell frame={f(i)} /></div>)}</div>
          <div className="cv-row">{[2, 3].map((i) => <div key={i} style={{ flex: i === 2 ? 1 : 1.62, display: 'flex' }}><Cell frame={f(i)} /></div>)}</div>
        </div>
      );
    case 'T13':
      return (
        <div className="cv-l-T13" style={{ position: 'absolute', inset: 0 }}>
          <Cell frame={f(0)} />
          <Cell frame={f(1)} />
        </div>
      );
    case 'T15':
      return (
        <>
          <div className="cv-typo-strip"><div className="cv-inner"><img className="cv-img" src={f(0)?.url} alt="" /></div></div>
          <div className="cv-typo-veil" />
        </>
      );
    case 'T16':
      return (
        <>
          <div className="cv-blur"><div className="cv-inner"><img className="cv-img" src={f(0)?.url} alt="" /></div></div>
          <div className="cv-viewfinder"><div className="cv-inner"><img className="cv-img" src={f(0)?.url} alt="" /></div></div>
        </>
      );
    case 'T17':
      return (
        <>
          <div className="cv-exposure" style={{ position: 'absolute', inset: 0 }}>
            <Cell frame={f(0)} />
            <Cell frame={f(1)} />
          </div>
        </>
      );
    case 'T18':
      return (
        <>
          <div className="cv-l-T04" style={{ opacity: .42 }}>
            <div className="cv-inner"><img className="cv-img" src={f(0)?.url} alt="" /></div>
          </div>
          <div className="cv-circle"><div className="cv-inner"><img className="cv-img" src={f(0)?.url} alt="" /></div></div>
        </>
      );
    case 'T20':
      return (
        <>
          {frames.slice(0, 3).map((frame, index) => (
            <div key={frame.clipId} className={cls('cv-print', `cv-print-${index + 1}`)}>
              <div className="cv-cell"><div className="cv-inner"><img className="cv-img" src={frame.url} alt="" /></div></div>
            </div>
          ))}
        </>
      );
    default:
      return (
        <div className={cls('cv-grid', `cv-l-${id}`)}>
          {frames.map((frame) => <Cell key={frame.clipId} frame={frame} />)}
        </div>
      );
  }
}

/** 文字承托方向跟着锚点走（不然字会压在亮画面上读不清）。 */
function scrimFor(anchor: CoverAnchor): string | null {
  if (anchor.startsWith('bottom')) return 'cv-scrim-b';
  if (anchor.startsWith('top')) return 'cv-scrim-t';
  if (anchor.endsWith('left')) return 'cv-scrim-l';
  if (anchor.endsWith('right')) return 'cv-scrim-r';
  return 'cv-scrim-c';
}

/** 标题 + 副标题（**只有这两级文字**，别的字一律不加）。 */
function TextBlock({ config, anchor, titleOnly, subtitleOnly }: {
  config: CoverConfig;
  anchor: CoverAnchor;
  titleOnly?: boolean;
  subtitleOnly?: boolean;
}) {
  const title = config.title.trim();
  const subtitle = config.subtitle.trim();
  const titleStyle: React.CSSProperties = { fontSize: config.titleSize };
  const ghost = config.effect === 'r8' && config.ghostOffset > 0;
  return (
    <div className={cls('cv-text', 'cv-al-' + config.align, 'cv-a-' + anchor, config.effect === 'vertical' && 'cv-vertical')}>
      <div className="cv-text-inner" style={{ '--cv-x': config.offsetX + 'px', '--cv-y': config.offsetY + 'px' } as React.CSSProperties}>
        {subtitle && !config.subtitleBelow && !titleOnly ? <div className="cv-t-sub">{subtitle}</div> : null}
        {title && !subtitleOnly ? (
          <div className="cv-t-wrap">
            {ghost ? (
              <div className="cv-t-title cv-t-ghost" aria-hidden="true"
                   style={{ ...titleStyle, transform: `translate(${config.ghostOffset}px, ${config.ghostOffset}px)` }}>{title}</div>
            ) : null}
            <div className="cv-t-title" style={titleStyle}>{title}</div>
          </div>
        ) : null}
        {subtitle && (config.subtitleBelow || titleOnly) ? <div className="cv-t-sub cv-below">{subtitle}</div> : null}
      </div>
    </div>
  );
}

function mirrorVertical(anchor: CoverAnchor): CoverAnchor {
  return anchor.replace(/^(top|bottom)/, (edge) => (edge === 'top' ? 'bottom' : 'top')) as CoverAnchor;
}

export function CoverCanvas({ config, frames, canvasRef }: {
  config: CoverConfig;
  frames: CoverFrame[];
  canvasRef?: React.Ref<HTMLDivElement>;
}) {
  const { layout } = resolveLayout(config.layout, frames.length);
  const used = frames.slice(0, layout.needs);
  const scrim = scrimFor(config.anchor);
  return (
    <div className="cv" ref={canvasRef} data-cover-layout={layout.id}
         style={{ '--cv-accent': config.accent } as React.CSSProperties}>
      {used.length === 0
        ? <div className="cv-cell"><div className="cv-missing">右侧勾选片段封面</div></div>
        : <Layout id={layout.id} frames={used} />}
      {layout.id !== 'T15' ? <div className="cv-wash" /> : null}
      {scrim ? <div className={cls('cv-scrim', scrim)} /> : null}
      {layout.splitText ? (
        <>
          <TextBlock config={config} anchor={config.anchor} titleOnly />
          <TextBlock config={config} anchor={mirrorVertical(config.anchor)} subtitleOnly />
        </>
      ) : (
        <TextBlock config={config} anchor={config.anchor} />
      )}
    </div>
  );
}

export { coverSignature, defaultCoverConfig, layoutById, mergeCoverConfig };
export type { CoverConfig, CoverFrame };
