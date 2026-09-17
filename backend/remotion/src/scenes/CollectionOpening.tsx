import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import { chapterCoverCoef, type RenderParams } from '../params';
import type { MultiMediaPocInput } from '../types';

/** 旧模板的错落分布（SPOTS），≤12 部时按序取用；位置确定性，无 Math.random。 */
const SPOTS = [
  { x: -44, y: -14, s: 1.0, r: -7 }, { x: -26, y: -30, s: 0.64, r: 5 }, { x: -8, y: -25, s: 0.92, r: -3 },
  { x: 18, y: -32, s: 0.6, r: 9 }, { x: 38, y: -20, s: 0.86, r: -5 }, { x: 42, y: -6, s: 1.12, r: 3 },
  { x: -42, y: 8, s: 0.58, r: 8 }, { x: -28, y: 20, s: 1.06, r: -2 }, { x: -10, y: 10, s: 0.68, r: 6 },
  { x: 14, y: 22, s: 0.98, r: -4 }, { x: 30, y: 6, s: 0.66, r: 7 }, { x: 43, y: 16, s: 0.9, r: -6 },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** calc() 里 `+ -44vw` 是非法写法，整条声明会被丢弃 → 卡片全堆在正中。必须拼成 `- 44vw`。 */
const vwTerm = (value: number) => (value >= 0 ? `+ ${value}vw` : `- ${Math.abs(value)}vw`);
const vhTerm = (value: number) => (value >= 0 ? `+ ${value}vh` : `- ${Math.abs(value)}vh`);

/**
 * 开场屏：旧模板 `.hero` + `.darkroom` 暗房显影。
 * 旧模板用 setTimeout 逐个「显影」（灰阶→彩色，.develop → .done）；这里按帧推进同一套 CSS 类。
 * 近似说明：`dev-count` 计数与 `skip` 按钮在成片里无意义，保留计数、隐藏跳过按钮。
 */
export function CollectionOpening({ input, params, assetBaseUrl, beatFrames }: {
  input: MultiMediaPocInput;
  params: RenderParams;
  assetBaseUrl: string;
  beatFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const coef = chapterCoverCoef(params);
  const allCovered = input.media.filter((media) => media.coverAssetPath);
  // openingIds 非空 → 只显影这些媒体（对应旧模板 `OPENING = SLIDES.filter(s => s.open)`）
  const covers = params.openingIds.length > 0
    ? params.openingIds
        .map((id) => allCovered.find((media) => media.mediaId === id))
        .filter((media): media is (typeof allCovered)[number] => Boolean(media))
    : allCovered;
  const spots = covers.map((_, index) => SPOTS[index % SPOTS.length]);
  // 每张封面「显影」占 step 帧，按序错开；显影完成后加 .done（对应旧模板 transition 1.4s）
  const step = Math.max(2, Math.round(beatFrames / 2));
  const developWindow = Math.max(4, Math.round(fps * 1.4));
  const startedAt = (index: number) => index * step;
  const activeIndex = covers.length === 0 ? 0 : Math.min(covers.length, Math.floor(frame / step) + 1);
  const heroIn = interpolate(frame, [0, Math.max(2, Math.round(fps * 0.6))], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <section className="hero" id="hero" style={{ opacity: heroIn }}>
      <div className="darkroom" id="darkroom">
        {covers.map((media, index) => {
          const spot = spots[index];
          const started = frame >= startedAt(index);
          const done = frame >= startedAt(index) + developWindow;
          return (
            <div
              key={media.mediaId}
              className="card"
              style={{
                ['--c1' as string]: '#221a3a',
                ['--c2' as string]: '#0d0a18',
                transform: `translate(calc(-50% ${vwTerm(spot.x)}), calc(-50% ${vhTerm(spot.y)})) scale(${(spot.s * coef).toFixed(3)}) rotate(${spot.r}deg)`,
                opacity: started ? 1 : 0,
              }}
            >
              <div className={`cover${started ? ' develop' : ''}${done ? ' done' : ''}`}>
                <img src={assetUrl(media.coverAssetPath!, assetBaseUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="hero-plate">
        <div className="eyebrow">SEASON IN REVIEW</div>
        <h1>{params.title || input.title}</h1>
        {params.subtitle ? <div className="sub">{params.subtitle}</div> : null}
      </div>
      {covers.length > 0 ? (
        <div className={`dev-count${activeIndex > 0 ? ' show' : ''}`}>
          <b>{pad(activeIndex)}</b> 显影中
        </div>
      ) : null}
    </section>
  );
}
