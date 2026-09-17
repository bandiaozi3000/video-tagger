import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from './theme';

/**
 * 帧驱动动画助手 —— 全片**唯一**的动画来源。
 *
 * 硬禁则（设计规格 §12.1）：组件与样式中不允许出现 `transition` / `animation` / `@keyframes` /
 * `setTimeout` / `setInterval` / `requestAnimationFrame` / `Math.random`。
 * Remotion 逐帧渲染时帧可能乱序或重复，靠浏览器实时时钟驱动的动画会闪烁且不可复现。
 */

/** 入场进度 0→1：`delayFrames` 帧后起跳，用当前主题的 spring 手感。 */
export function useEnter(delayFrames: number, theme: Theme): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: Math.max(0, frame - delayFrames),
    fps,
    config: { damping: theme.motion.damping, stiffness: theme.motion.stiffness, mass: theme.motion.mass },
  });
}

/** 第 index 个元素的错峰延迟（帧）。 */
export function staggerFrames(theme: Theme, index: number, fps: number): number {
  return Math.round(index * theme.motion.staggerSec * fps);
}

/** 上浮入场样式。 */
export function riseIn(progress: number, distance: number): React.CSSProperties {
  return { opacity: progress, transform: `translateY(${(1 - progress) * distance}px)` };
}

/** 线性区间映射（clamp 两端）。 */
export function fadeIn(frame: number, start: number, durationInFrames: number): number {
  return interpolate(frame, [start, start + Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** 进出场（用于场景内的多次出现/消失）。 */
export function inOut(frame: number, start: number, end: number, fadeFrames: number): number {
  return interpolate(frame, [start, start + fadeFrames, end - fadeFrames, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}
