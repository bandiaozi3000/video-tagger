import React from 'react';
import { AbsoluteFill, Img, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from './asset-url';
import { bgmTimeline } from './bgm';
import { hasBackdrop, type RenderParams } from './params';
import { bgFilter, type Theme } from './theme';
import type { ScenePlan } from './types';

/**
 * 常驻装饰层与外壳（视觉语言来自旧模板，驱动方式全部按帧）。
 *
 * 旧模板里这些是 canvas 逐帧绘制（星场）+ CSS `@keyframes`（云漂移/顶部发光线呼吸）；
 * 帧模型下必须由帧号决定状态，否则两次渲染不一致。
 */

/** 星空（确定性点位 + 帧驱动闪烁）。 */
export function Stars({ theme }: { theme: Theme }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const points = React.useMemo(
    () =>
      Array.from({ length: theme.decor.stars }, (_, index) => ({
        x: random(`star-x-${index}`) * 100,
        y: random(`star-y-${index}`) * 100,
        r: random(`star-r-${index}`) * 1.3 + 0.4,
        phase: random(`star-p-${index}`) * Math.PI * 2,
        speed: random(`star-s-${index}`) * 0.02 + 0.008,
        hue: [200, 218, 262][Math.floor(random(`star-h-${index}`) * 3)],
      })),
    [theme.decor.stars],
  );
  if (theme.decor.stars === 0) return null;
  const t = frame / fps;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {points.map((point, index) => (
        <span
          key={index}
          style={{
            position: 'absolute',
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: point.r * 2,
            height: point.r * 2,
            borderRadius: '50%',
            background: `hsla(${point.hue},80%,78%,${(0.35 + Math.sin(point.phase + t * point.speed * 30) * 0.25) * theme.decor.starOpacity})`,
          }}
        />
      ))}
    </div>
  );
}

/** 云光（帧驱动漂移，替代 CSS `@keyframes drift`）。 */
export function Clouds({ theme }: { theme: Theme }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clouds = React.useMemo(
    () =>
      Array.from({ length: theme.decor.clouds }, (_, index) => ({
        top: random(`cloud-t-${index}`) * 80,
        left: random(`cloud-l-${index}`) * 80,
        size: 220 + random(`cloud-s-${index}`) * 260,
        scale: 0.7 + random(`cloud-k-${index}`) * 1.1,
        phase: random(`cloud-p-${index}`) * 60,
        period: 60 + random(`cloud-d-${index}`) * 70,
      })),
    [theme.decor.clouds],
  );
  if (theme.decor.clouds === 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {clouds.map((cloud, index) => {
        const cycle = cloud.period * fps;
        const t = (frame + cloud.phase * fps) % cycle;
        const x = interpolate(t, [0, cycle / 2, cycle], [-4, 4, -4]);
        const y = interpolate(t, [0, cycle / 2, cycle], [2, -3, 2]);
        const k = interpolate(t, [0, cycle / 2, cycle], [1, 1.08, 1]);
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: `${cloud.top}%`,
              left: `${cloud.left}%`,
              width: cloud.size,
              height: cloud.size,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(111,139,255,.34) 0%, rgba(111,139,255,0) 70%)',
              filter: 'blur(26px)',
              opacity: theme.decor.cloudOpacity,
              transform: `translate3d(${x}vw, ${y}vh, 0) scale(${cloud.scale * k})`,
            }}
          />
        );
      })}
    </div>
  );
}

/** 顶部发光细线（静态渐变，透明度按帧极缓呼吸）。 */
export function TopLine({ theme }: { theme: Theme }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!theme.topLine) return null;
  const opacity = interpolate(Math.sin((frame / fps / 9) * Math.PI * 2), [-1, 1], [0.5, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        left: '-10%',
        right: '-10%',
        top: 0,
        height: 3,
        background: theme.topLine,
        filter: 'blur(.5px)',
        opacity: opacity * theme.decor.topLineOpacity,
        zIndex: 2,
      }}
    />
  );
}

/** 全片背景层：底色 / 底色渐变 / 背景图轮播（索引与透明度都由帧决定）。 */
export function Backdrop({ params, theme, assetBaseUrl, plan }: { params: RenderParams; theme: Theme; assetBaseUrl: string; plan: ScenePlan }) {
  const frame = useCurrentFrame();
  const images = params.bgImages;
  const rotationFrames = Math.max(1, Math.round(params.bgRotationSec * plan.fps));
  const index = images.length > 0 ? Math.floor(frame / rotationFrames) % images.length : -1;
  const src = index >= 0 ? assetUrl(images[index], assetBaseUrl) : null;
  const decorated = hasBackdrop(params);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: params.bgColor || (decorated ? 'transparent' : theme.canvas),
        backgroundImage: params.bgColor ? undefined : theme.canvasGlow,
        zIndex: 0,
      }}
    >
      {src ? (
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: params.bgOpacity / 100,
            filter: bgFilter(params.bgBrightness, params.bgBlur) || undefined,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}

/** 顶栏：品牌标识 + 标题（无交互控件）。 */
export function Topbar({ params, theme }: { params: RenderParams; theme: Theme }) {
  const { width, height } = useVideoConfig();
  const logo = Math.round(height * 0.045);
  return (
    <header
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${Math.round(height * 0.028)}px ${Math.round(width * 0.045)}px`,
        fontFamily: theme.font.body,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(height * 0.016), fontWeight: 700, letterSpacing: 2, fontSize: Math.round(height * 0.022), color: theme.colors.ink }}>
        <span
          style={{
            width: logo,
            height: logo,
            borderRadius: Math.round(logo * 0.3),
            display: 'grid',
            placeItems: 'center',
            background: `linear-gradient(135deg,${theme.colors.sky},${theme.colors.blue} 55%,${theme.colors.pink})`,
            boxShadow: '0 4px 18px rgba(79,195,247,.5)',
            fontSize: Math.round(logo * 0.5),
            color: '#08070f',
          }}
        >
          ✦
        </span>
        <span>{params.brandTitle.trim() || params.title}</span>
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: Math.round(height * 0.017), letterSpacing: 2, color: theme.colors.faint }}>
        {params.subtitle.trim()}
      </div>
    </header>
  );
}

/** 底部胶囊进度条（帧驱动，恒亮）。 */
export function Trackbar({ label, theme, plan }: { label: string; theme: Theme; plan: ScenePlan }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const progress = Math.min(100, (frame / Math.max(1, plan.durationInFrames - 1)) * 100);
  const barWidth = Math.round(width * 0.19);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: Math.round(height * 0.035),
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(height * 0.02),
        background: theme.glass.background,
        border: theme.glass.border,
        borderRadius: 999,
        padding: `${Math.round(height * 0.012)}px ${Math.round(height * 0.026)}px`,
        backdropFilter: `blur(${theme.glass.blur + 6}px)`,
        boxShadow: '0 10px 34px rgba(0,0,0,.55)',
        fontSize: Math.round(height * 0.019),
        letterSpacing: 1,
        color: theme.colors.muted,
        fontFamily: theme.font.body,
      }}
    >
      <span>{label}</span>
      <div style={{ width: barWidth, height: 3, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,.09)' }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${progress}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg,${theme.colors.sky},${theme.colors.blue},${theme.colors.pink})`,
            boxShadow: '0 0 12px rgba(79,195,247,.8)',
          }}
        />
      </div>
      <span style={{ fontFamily: theme.font.mono }}>{Math.floor(frame / plan.fps / 60)}:{String(Math.floor(frame / plan.fps) % 60).padStart(2, '0')}</span>
    </div>
  );
}

/** BGM 条：真实曲名 + 真实时间轴进度（无播放/静音按钮——成片里点不到；预览的交互由 Player 提供）。 */
export function BgmBadge({ params, theme, plan }: { params: RenderParams; theme: Theme; plan: ScenePlan }) {
  const frame = useCurrentFrame();
  const { height, width } = useVideoConfig();
  const slots = bgmTimeline(params, plan);
  if (slots.length === 0) return null;
  const index = Math.max(0, slots.findIndex((slot, i) => frame >= slot.fromFrame && (i === slots.length - 1 || frame < slots[i + 1].fromFrame)));
  const slot = slots[index];
  const isLast = index === slots.length - 1;
  const elapsed = frame - slot.fromFrame;
  // 最后一首在片长内循环播放（与音频行为一致）：进度按循环取模，而不是停在 100%
  const progress = isLast
    ? Math.min(1, (elapsed % Math.max(1, slot.durationInFrames)) / Math.max(1, slot.durationInFrames))
    : Math.min(1, Math.max(0, elapsed / Math.max(1, slot.durationInFrames)));
  const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const barWidth = Math.round(width * 0.12);
  return (
    <div
      style={{
        position: 'absolute',
        left: `${params.bgmX}%`,
        bottom: `${params.bgmY}%`,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(height * 0.014),
        transform: `scale(${params.bgmScale / 100})`,
        transformOrigin: 'left bottom',
        background: theme.glass.background,
        border: theme.glass.border,
        borderRadius: 999,
        padding: `${Math.round(height * 0.012)}px ${Math.round(height * 0.022)}px`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 26px rgba(0,0,0,.5)',
        fontFamily: theme.font.body,
        fontSize: Math.round(height * 0.019),
        color: theme.colors.muted,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: theme.colors.pink }}>♪</span>
      <span style={{ color: theme.colors.gold, letterSpacing: 1 }}>{slot.name}</span>
      <div style={{ width: barWidth, height: 3, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,.12)' }}>
        <span style={{ display: 'block', height: '100%', width: `${progress * 100}%`, background: `linear-gradient(90deg,${theme.colors.pink},${theme.colors.gold})` }} />
      </div>
      <span style={{ fontFamily: theme.font.mono, fontSize: Math.round(height * 0.017) }}>
        {mmss(isLast && elapsed > slot.durationInFrames ? elapsed / plan.fps : (slot.fromFrame + progress * slot.durationInFrames) / plan.fps)} / {mmss(slot.durationInFrames / plan.fps)}
        {isLast && elapsed > slot.durationInFrames ? ' ↻' : ''}
      </span>
    </div>
  );
}
