import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import { useEnter } from '../animation';
import type { RenderParams } from '../params';
import { coverCoef, type Theme } from '../theme';
import type { MultiMediaPocInput } from '../types';
import { GradientTitle } from './parts';

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

/**
 * 显影曲线（导出供单测）。前 35% 完全不显示，之后线性到 1。
 * 2026-09-27 用户：开场「卡片周围一圈金线框…和显影有关系」——那圈是**封面图自带的亮边**
 * （实测 covers/ext/7540-386fed48.jpg 外圈亮度 190 vs 内部 130），显影早期封面压暗去色后
 * 只剩亮边可见 → 看着像金线框。推迟到 35% 之后显影即可。
 */
export function openingReveal(progress: number) {
  return progress <= 0.35 ? 0 : (progress - 0.35) / 0.65;
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
          /*
           * 显影前 35% **完全不显示**（用户 2026-09-27：「卡片周围一圈金线框…和显影有关系」）。
           * ⚠️ 这里原先写的「根因 = 封面图自带的印刷亮边」**已被推翻**（用户：「我看了图片哪有边框？」）：
           * 「外圈比内部亮」证明不了有边框。真正的框是**卡片外层 filter: blur() 的模糊外溢**，
           * 现已把 filter 移到内层 <img>（见下面 img 的注释）。这条 35% 曲线保留 —— 它让卡片出现时封面
           * 已有样子，仍然是对的观感处理。
           */
          const reveal = openingReveal(progress);
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
                /*
                 * 描边去掉（2026-09-27 实测确认）：开场卡片那圈 `1px solid rgba(255,255,255,.14)`
                 * 就是用户报的「卡片周围一圈金色线框」。
                 * 证据：预览 DOM 全量清单里，卡片 `DIV` 上**只有**这条 border（`1px rgba(255,255,255,.14)`）
                 * + 暗投影；全清单无任何 gold / outline / dashed 元素（`getComputedStyle` 扫描）。
                 * 半透明白叠在暖色背景/封面上 → 看着偏金；预览缩放下更明显。
                 * 卡片与背景的分离交给已有的暗投影，不再描边。
                 */
                boxShadow: '0 22px 54px rgba(5,8,30,.65)',
                opacity: reveal,
              }}
            >
              <img
                src={assetUrl(media.coverAssetPath!, assetBaseUrl)}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  /*
                   * 滤镜必须加在**内层 img**、不能加在卡片外层 div（2026-09-27 修「卡片外一圈会闪烁的虚线」）。
                   * 根因：CSS `filter` 的绘制结果会画到元素矩形**之外**（模糊外溢）——加在外层时，封面边缘像素被
                   * 糊出卡片四周，形成一圈光晕；封面边缘亮度沿周边凹凸 + blur/opacity 逐帧变化 → 看着就是
                   * 「卡片外一圈虚线、显影时闪烁」。
                   * 数字（卡片 275×391 @1080p、基线取矩形外 30px 那圈）：σ=3 时矩形外 1/2/3px = +63/+39/+24，
                   * 且断成 15 亮段/14 隙；σ=1.5 时 22 亮段/21 隙。挪到内层后：所有距离 = 0.0。
                   * 外层 `overflow: hidden` + `borderRadius` 会把内层滤镜的输出裁掉（正是我们要的）。
                   */
                  filter: `grayscale(${1 - progress}) blur(${(1 - progress) * 5}px) contrast(${0.8 + progress * 0.24}) brightness(${0.7 + progress * 0.3})`,
                }}
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
    </div>
  );
}
