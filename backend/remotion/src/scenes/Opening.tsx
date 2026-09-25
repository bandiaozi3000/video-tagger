import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import { useEnter } from '../animation';
import type { RenderParams } from '../params';
import { coverCoef, type Theme } from '../theme';
import type { MultiMediaPocInput } from '../types';
import { GradientTitle, pad2 } from './parts';

/**
 * 开场：暗房显影。
 *
 * 旧模板用 `setTimeout` 逐个加 `.develop` 类，显影本身是 CSS `transition`（filter/opacity 1.4s）——
 * 帧模型下这两者都不成立（会闪烁且不可复现）。这里全部改成 `interpolate` 逐帧算出来的值。
 */

/** 封面错落分布（沿用旧模板 SPOTS 的相对位置，单位改成画幅宽/高比例）。 */
const SPOTS = [
  { x: -0.44, y: -0.14, s: 1.0, r: -7 },
  { x: -0.26, y: -0.3, s: 0.64, r: 5 },
  { x: -0.08, y: -0.25, s: 0.92, r: -3 },
  { x: 0.18, y: -0.32, s: 0.6, r: 9 },
  { x: 0.38, y: -0.2, s: 0.86, r: -5 },
  { x: 0.42, y: -0.06, s: 1.12, r: 3 },
  { x: -0.42, y: 0.08, s: 0.58, r: 8 },
  { x: -0.28, y: 0.2, s: 1.06, r: -2 },
  { x: -0.1, y: 0.1, s: 0.68, r: 6 },
  { x: 0.14, y: 0.22, s: 0.98, r: -4 },
  { x: 0.3, y: 0.06, s: 0.66, r: 7 },
  { x: 0.43, y: 0.16, s: 0.9, r: -6 },
];

/**
 * 开场封面卡尺寸。**导出供单测断言「是竖版」** —— `cardAspect` 是宽/高比（190/270），
 * 必须**除**它；写成乘会得到横版卡并把竖版封面裁成横带（2026-09-26 踩过）。
 */
export function openingCardSize(theme: Theme, height: number, coverSize: number) {
  const coef = coverCoef(coverSize);
  const width = height * theme.layout.cardRatio * coef;
  return { width, height: width / theme.layout.cardAspect };
}

export function Opening({ input, params, theme, assetBaseUrl, beatFrames }: {
  input: MultiMediaPocInput;
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
  beatFrames: number;
}) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const covered = input.media.filter((media) => media.coverAssetPath);
  const covers = params.openingIds.length > 0
    ? params.openingIds.map((id) => covered.find((media) => media.mediaId === id)).filter((m): m is (typeof covered)[number] => Boolean(m))
    : covered;
  const step = Math.max(2, Math.round(beatFrames / 2));
  const developFrames = Math.max(4, Math.round(fps * 1.4));
  const plateIn = useEnter(0, theme);
  const coef = coverCoef(params.coverSize);

  const opening = openingCardSize(theme, height, params.coverSize);
  const cardWidth = opening.width;
  const cardHeight = opening.height;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* 暗房：错落封面逐个显影 */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {covers.map((media, index) => {
          const spot = SPOTS[index % SPOTS.length];
          const start = index * step;
          const progress = interpolate(frame, [start, start + developFrames], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={media.mediaId}
              style={{
                position: 'absolute',
                left: '50%',
                top: '52%',
                width: cardWidth,
                height: cardHeight,
                transform: `translate(-50%, -50%) translate(${spot.x * width}px, ${spot.y * height}px) scale(${(spot.s * coef).toFixed(3)}) rotate(${spot.r}deg)`,
                borderRadius: Math.round(cardWidth * 0.07),
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,.14)',
                boxShadow: '0 22px 54px rgba(5,8,30,.65)',
                opacity: progress,
                filter: `grayscale(${1 - progress}) blur(${(1 - progress) * 5}px) contrast(${0.8 + progress * 0.24}) brightness(${0.7 + progress * 0.3})`,
              }}
            >
              <img
                src={assetUrl(media.coverAssetPath!, assetBaseUrl)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          );
        })}
      </div>

      {/* 标题板 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translateY(${(1 - plateIn) * height * 0.04}px)`,
          opacity: plateIn,
          textAlign: 'center',
          padding: `${Math.round(height * 0.05)}px ${Math.round(width * 0.05)}px ${Math.round(height * 0.045)}px`,
          borderRadius: theme.glass.radius,
          background: theme.glass.background,
          border: theme.glass.border,
          boxShadow: theme.glass.shadow,
          backdropFilter: `blur(${theme.glass.blur}px)`,
          maxWidth: width * 0.8,
        }}
      >
        <div
          style={{
            fontFamily: theme.font.mono,
            fontSize: Math.round(height * 0.019),
            letterSpacing: 8,
            color: theme.colors.sky,
            fontWeight: 600,
            marginBottom: Math.round(height * 0.018),
          }}
        >
          SEASON IN REVIEW
        </div>
        <GradientTitle text={params.title || input.title} theme={theme} size={Math.round(height * 0.075)} />
        {params.subtitle.trim() ? (
          <div style={{ marginTop: Math.round(height * 0.016), fontFamily: theme.font.body, fontSize: Math.round(height * 0.022), letterSpacing: 2, color: theme.colors.muted }}>
            {params.subtitle}
          </div>
        ) : null}
      </div>

      {/* 计数：显影进度（成片里是"正在选片"的叙事信息，不是交互提示） */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: Math.round(height * 0.09),
          transform: 'translateX(-50%)',
          fontFamily: theme.font.body,
          fontSize: Math.round(height * 0.021),
          letterSpacing: 3,
          color: theme.colors.muted,
          opacity: interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        <b style={{ color: theme.colors.pink, fontWeight: 800 }}>{pad2(Math.min(covers.length, Math.floor(frame / step) + 1))}</b> 显影中
      </div>
    </div>
  );
}
