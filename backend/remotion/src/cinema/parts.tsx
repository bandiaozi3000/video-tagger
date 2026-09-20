import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import { riseIn } from '../animation';
import type { RenderParams } from '../params';
import type { PocMedia } from '../types';
import { CINEMA_COLOR, CINEMA_FONT, CINEMA_LAYOUT, CINEMA_MOTION, readableOn, withAlpha } from './plan';

/**
 * 银幕式的入场 spring（自带手感参数，不依赖旧模板的 `Theme`）。
 *
 * 旧模板的 `useEnter(delay, theme)` 要传 `Theme`，而银幕式刻意不引入旧的玻璃/发光令牌，
 * 所以这里只取同一套 motion 参数自己起 spring——语义与旧版一致（帧驱动、可复现）。
 */
export function useEnterCinema(delayFrames: number): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: Math.max(0, frame - delayFrames), fps, config: CINEMA_MOTION });
}

/**
 * 银幕式模板的共用零件。全部帧驱动：入场用 `useEnter`（spring），
 * 位移/推镜/擦除用 `interpolate` —— 无 CSS 过渡、无关键帧、无定时器。
 */

/**
 * 推荐语 / 备注的**引语块**：主色引语竖线 + 正文。
 *
 * 用户 2026-09-20：「片名卡备注展示不太友好，调整下样式，符合页面布局且能让人注意到」
 * —— 旧写法是 `maxWidth: '16ch'`：CJK 下 `ch` 只有约半字宽，等于把备注挤成**一行 6~7 个字**的碎块；
 * 而且没有引语标记、也没接「备注」开关（片名卡是唯一一处不认开关的）。
 *
 * 现在：宽度按 `字号 × 17.5 字` 换算成 px（一行 17 个汉字上下）、主色竖线把它标成「引语」、
 * 暗底上提亮到 `#f0eeea`、`WebkitLineClamp` 钳行数（长备注不会一路拖到画面底部）。
 */
export function NoteQuote({ text, accent, width, height, size = 0.026, maxLines = 3, color = '#f0eeea', maxWidth, style }: {
  text: string;
  accent: string;
  width: number;
  height: number;
  /** 字号（画幅高比例）。 */
  size?: number;
  maxLines?: number;
  /** 正文颜色：片段屏备注用它提亮比展带更白一档（2026-09-20）。 */
  color?: string;
  /** 文字列最大宽度（px）。不传就按字号推（展带旧行为）。 */
  maxWidth?: number;
  style?: React.CSSProperties;
}) {
  if (!text.trim()) return null;
  return (
    <div style={{ ...style, display: 'flex', gap: Math.round(width * 0.012), maxWidth: maxWidth ?? Math.round(height * size * 17.5) }}>
      <span style={{ flex: 'none', width: Math.max(2, Math.round(height * 0.0035)), background: accent, opacity: 0.9 }} />
      <div style={{ fontFamily: CINEMA_FONT.body, fontSize: Math.round(height * size), lineHeight: 1.6, color, display: '-webkit-box', WebkitLineClamp: maxLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {text.trim()}
      </div>
    </div>
  );
}

/** 强调细线：全片唯一允许的"装饰"，用该部主色。 */
export function Rule({ color, width, height }: { color: string; width: number; height: number }) {
  return <div style={{ width: Math.round(width * CINEMA_LAYOUT.ruleLength), height: Math.max(2, Math.round(height * 0.004)), background: color }} />;
}

/**
 * 幕间「色带擦除」：用**上一部**的主色当幕布推走，同时本幕内容从右侧揭开。
 *
 * 用户审定稿里这是唯一的转场语言：转场本身在预告"换片子了"，
 * 且不需要跨 Sequence 叠画（`Sequence` 内 frame 已归零），任何幕都适用。
 */
export function CinemaEntrance({ prevAccent, children }: { prevAccent?: string; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const reveal = interpolate(frame, [0, CINEMA_LAYOUT.wipeFrames], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const band = interpolate(frame, [0, CINEMA_LAYOUT.wipeFrames + 3], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${reveal.toFixed(2)}%)` }}>{children}</AbsoluteFill>
      {prevAccent && band < 100 ? (
        <AbsoluteFill
          style={{
            left: `${-band}%`,
            width: `${width}px`,
            height: `${height}px`,
            background: prevAccent,
            transform: 'translateX(-10%)',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}

/** 「年份 · 集数 · 类型」事实行（缺数据自动省略，不编造）。 */
export function Facts({ media, size, color }: { media: PocMedia; size: number; color: string }) {
  const { height } = useVideoConfig();
  const parts = [
    media.year ? String(media.year) : '',
    media.episodeCount ? `${media.episodeCount} 集` : '',
    media.subcategory || '',
    ...(media.genres ?? []).slice(0, 2),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(height * 0.014), fontFamily: CINEMA_FONT.num, fontSize: size, letterSpacing: Math.round(size * 0.18), color, whiteSpace: 'nowrap' }}>
      {parts.map((part, index) => (
        <React.Fragment key={part}>
          {index > 0 ? <span style={{ opacity: 0.5 }}>·</span> : null}
          <span>{part}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * lower-third：片名行 + 一句推荐语（静音也要读得清）+ 该部主色的底线。
 *
 * 推荐语优先级：用户手写的那句 > Bangumi 剧情简介；都没有就整行不出现（宁可留白）。
 */
export function LowerThird({ media, params, accent, note }: {
  media: PocMedia;
  params: RenderParams;
  accent: string;
  /** 片段自己的备注优先于媒体的推荐语。 */
  note?: string;
}) {
  const { width, height } = useVideoConfig();
  const quote = (params.detailShow.note ? (note?.trim() || media.description?.trim() || media.synopsis?.trim()) : '') ?? '';
  const safe = Math.round(width * CINEMA_LAYOUT.safeX);
  return (
    <div style={{ position: 'absolute', left: safe, right: safe, bottom: Math.round(height * 0.12) }}>
      <div style={{ fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * CINEMA_LAYOUT.lowerNameRatio), letterSpacing: Math.round(height * CINEMA_LAYOUT.lowerNameRatio * 0.18), color: 'rgba(255,255,255,.9)' }}>
        {[media.title, media.year ? String(media.year) : ''].filter(Boolean).join(' · ')}
      </div>
      {quote ? (
        <div
          style={{
            marginTop: Math.round(height * 0.016),
            maxWidth: '28ch',
            fontFamily: CINEMA_FONT.body,
            fontSize: Math.round(height * CINEMA_LAYOUT.lowerQuoteRatio),
            lineHeight: 1.45,
            color: '#fff',
            textShadow: '0 4px 26px rgba(0,0,0,.9)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {quote}
        </div>
      ) : null}
      <div style={{ marginTop: Math.round(height * 0.028) }}>
        <Rule color={accent} width={width} height={height} />
      </div>
    </div>
  );
}

/** 片名（真字重，两行截断）。 */
export function BigTitle({ text, size, color, maxWidth, from }: { text: string; size: number; color: string; maxWidth?: string; from: number }) {
  const { height } = useVideoConfig();
  const progress = useEnterCinema(from);
  return (
    <h2
      style={{
        ...riseIn(progress, height * 0.03),
        margin: 0,
        maxWidth,
        fontFamily: CINEMA_FONT.display,
        fontSize: size,
        lineHeight: 1.0,
        letterSpacing: Math.round(size * -0.01),
        color,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        // 换行要均衡：否则中文标题会出现「蓝兰岛漂流 / 记」这种单字孤独行（用户 2026-09-20 的截图）
        textWrap: 'balance',
      }}
    >
      {text}
    </h2>
  );
}

/** 数字（Mona-Sans，真字重）。 */
export function BigNumber({ text, size, color, from = 0, opacity = 1 }: { text: string; size: number; color: string; from?: number; opacity?: number }) {
  const { height } = useVideoConfig();
  const progress = useEnterCinema(from);
  return (
    <div
      style={{
        ...riseIn(progress, height * 0.03),
        opacity: progress * opacity,
        fontFamily: CINEMA_FONT.num,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 0.9,
        letterSpacing: Math.round(size * -0.02),
        color,
      }}
    >
      {text}
    </div>
  );
}

/** 背景图（用户配置的 bgColor / bgImages 在银幕式里同样生效——那是用户内容，不是我们的装饰）。 */
export function CinemaBackdrop({ params, assetBaseUrl }: { params: RenderParams; assetBaseUrl: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const images = params.bgImages;
  const rotationFrames = Math.max(1, Math.round(params.bgRotationSec * fps));
  const index = images.length > 0 ? Math.floor(frame / rotationFrames) % images.length : -1;
  return (
    <AbsoluteFill style={{ background: params.bgColor.trim() || CINEMA_COLOR.canvas }}>
      {index >= 0 ? (
        <Img
          src={assetUrl(images[index], assetBaseUrl)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: params.bgOpacity / 100,
            filter: `blur(${((params.bgBlur / 100) * 20).toFixed(1)}px) brightness(${(0.4 + params.bgBrightness / 100).toFixed(2)})`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}

export { readableOn };
