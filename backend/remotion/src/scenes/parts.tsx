import React from 'react';
import { Img, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import type { Theme } from '../theme';

/** 渐变文字标题（视觉语言：background-clip + drop-shadow）。 */
export function GradientTitle({ text, theme, size, align = 'center' }: { text: string; theme: Theme; size: number; align?: 'center' | 'left' }) {
  return (
    <h2
      style={{
        margin: 0,
        fontFamily: theme.font.display,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: Math.round(size * 0.12),
        lineHeight: 1.15,
        textAlign: align,
        background: `linear-gradient(115deg,#fff 8%,#bfe0ff 45%,#9fd4ff 85%)`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        filter: 'drop-shadow(0 2px 14px rgba(79,195,247,.5))',
      }}
    >
      {text}
    </h2>
  );
}

/** 胶囊（视觉语言：玻璃描边圆角）。 */
export function Chip({ text, theme, accent = false, size }: { text: string; theme: Theme; accent?: boolean; size: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: `${Math.round(size * 0.32)}px ${Math.round(size * 0.9)}px`,
        borderRadius: 999,
        border: `1px solid ${accent ? 'rgba(79,195,247,.4)' : theme.colors.line}`,
        background: accent ? 'rgba(79,195,247,.13)' : 'rgba(163,174,196,.1)',
        color: accent ? theme.colors.sky : '#b8c4da',
        fontFamily: theme.font.body,
        fontSize: size,
        fontWeight: 600,
        letterSpacing: 0.5,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

/**
 * 封面：模糊放大底图 + 完整清晰海报（任何画幅/格子形状都不裁图）。
 * 旧模板用 `.gs-blur` + `.gs-poster` 两层实现，这里沿用同一视觉语言。
 */
export function Poster({ src, theme, radius, contain = false }: { src?: string; theme: Theme; radius: number; contain?: boolean }) {
  const { width, height } = useVideoConfig();
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: radius,
        overflow: 'hidden',
        background: 'linear-gradient(160deg,#221a3a,#0d0a18)',
        border: theme.glass.border,
        boxShadow: '0 26px 60px rgba(0,0,0,.6)',
      }}
    >
      {src ? (
        <>
          <Img
            src={src}
            style={{
              position: 'absolute',
              inset: '-15%',
              width: '130%',
              height: '130%',
              objectFit: 'cover',
              filter: `blur(${Math.round(height * 0.02)}px) brightness(.6) saturate(1.25)`,
              transform: 'scale(1.08)',
            }}
          />
          <Img
            src={src}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: contain ? 'contain' : 'cover' }}
          />
        </>
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 0 1px rgba(79,195,247,.45), 0 0 34px rgba(79,195,247,.22)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 55%,rgba(5,8,30,.55))' }} />
    </div>
  );
}

/** 封面角标（片段推荐 / 资料推荐）。 */
export function PosterFlag({ text, theme, size }: { text: string; theme: Theme; size: number }) {
  return (
    <span
      style={{
        position: 'absolute',
        left: Math.round(size * 0.8),
        top: Math.round(size * 0.8),
        zIndex: 3,
        fontSize: size,
        letterSpacing: 1,
        padding: `${Math.round(size * 0.35)}px ${Math.round(size * 1.1)}px`,
        borderRadius: 999,
        color: '#ffd9a6',
        background: 'rgba(255,143,77,.14)',
        border: '1px solid rgba(255,143,77,.35)',
        backdropFilter: 'blur(4px)',
        fontFamily: theme.font.body,
      }}
    >
      {text}
    </span>
  );
}

/** 大号描边序号（视觉语言：透明填充 + 描边）。 */
export function OutlineNumber({ text, theme, size, style }: { text: string; theme: Theme; size: number; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: theme.font.display,
        fontSize: size,
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: Math.round(size * 0.04),
        color: 'transparent',
        WebkitTextStroke: `1.5px rgba(111,139,255,.28)`,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {text}
    </span>
  );
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');
