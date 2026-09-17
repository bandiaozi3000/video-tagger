import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { riseIn, useEnter } from '../animation';
import type { RenderParams } from '../params';
import type { Theme } from '../theme';
import { GradientTitle } from './parts';

/** 序言屏：kicker / 标题 / 正文。正文超长时按画幅自动收字号（旧模板靠滚动页容纳，画幅下必须收口）。 */
export function Intro({ params, theme }: { params: RenderParams; theme: Theme }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const titleIn = useEnter(0, theme);
  const textIn = useEnter(Math.round(fps * 0.25), theme);

  const text = params.intro;
  const base = Math.round(height * theme.layout.bodyRatio * 1.15);
  const size = text.length > 220 ? Math.round(base * 0.72) : text.length > 120 ? Math.round(base * 0.86) : base;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: `${Math.round(height * 0.1)}px ${Math.round(width * 0.12)}px` }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(${Math.round(width * 0.55)}px ${Math.round(height * 0.58)}px at 50% 55%, rgba(79,195,247,.14), transparent 70%)`,
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', fontFamily: theme.font.mono, fontSize: Math.round(height * 0.019), letterSpacing: 10, color: theme.colors.sky, fontWeight: 600, marginBottom: Math.round(height * 0.03), opacity: titleIn }}>
        PROLOGUE
      </div>
      <div style={{ position: 'relative', ...riseIn(titleIn, height * 0.05) }}>
        <GradientTitle text={params.prologueTitle.trim() || params.title} theme={theme} size={Math.round(height * 0.085)} />
      </div>
      <p
        style={{
          position: 'relative',
          maxWidth: width * 0.7,
          marginTop: Math.round(height * 0.045),
          ...riseIn(textIn, height * 0.04),
          fontFamily: theme.font.body,
          fontSize: size,
          lineHeight: 2.05,
          color: theme.colors.muted,
          whiteSpace: 'pre-line',
          display: '-webkit-box',
          WebkitLineClamp: 8,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {text}
      </p>
      <div
        style={{
          position: 'relative',
          marginTop: Math.round(height * 0.055),
          fontFamily: theme.font.body,
          fontSize: Math.round(height * 0.019),
          letterSpacing: 6,
          color: theme.colors.gold,
          opacity: interpolate(Math.sin((frame / fps / 2) * Math.PI * 2), [-1, 1], [0.45, 1]),
        }}
      >
        ✦ 本期片单 ✦
      </div>
    </div>
  );
}
