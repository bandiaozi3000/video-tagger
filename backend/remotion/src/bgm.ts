import { interpolate } from 'remotion';
import type { RenderParams } from './params';
import type { ScenePlan } from './types';

/**
 * BGM 时间轴与增益曲线（帧为单位）——UI 与音频共用同一份计算，避免"条上显示的"和"听到的"不一致。
 *
 * 与旧链路的区别：旧模板把曲名注入 HTML、曲长靠 ffprobe 拼 `BGM_TRACK_DURS`，
 * 音频再由 Java FFmpeg 事后混流；现在曲长与素材都在同一个计划里，音频由 Remotion 内建。
 */

export interface BgmSlot {
  name: string;
  assetPath?: string;
  fromFrame: number;
  durationInFrames: number;
}

/** 每首曲子的起始帧与占用帧数：优先用真实曲长，缺省按画幅总时长均分。 */
export function bgmTimeline(params: RenderParams, plan: ScenePlan): BgmSlot[] {
  const tracks = params.bgmTracks;
  if (tracks.length === 0) return [];
  const fallbackSec = plan.durationInFrames / plan.fps / Math.max(1, tracks.length);
  const slots: BgmSlot[] = [];
  let cursor = 0;
  tracks.forEach((track) => {
    const seconds = track.durationSec ?? fallbackSec;
    const frames = Math.max(1, Math.round(seconds * plan.fps));
    slots.push({ name: track.name, assetPath: track.assetPath, fromFrame: cursor, durationInFrames: frames });
    cursor += frames;
  });
  return slots;
}

/**
 * 全局帧 → BGM 增益：基准 `bgmGain`，落在"有片段原声"的帧区间内压到 `bgmDuckTo`（进出各 fadeSec 渐变）。
 */
export function bgmGainAt(frame: number, params: RenderParams, plan: ScenePlan): number {
  const fade = Math.max(1, Math.round(params.bgmFadeSec * plan.fps));
  let gain = params.bgmGain;
  for (const window of plan.audioWindows) {
    if (frame < window.fromFrame - fade || frame >= window.toFrame + fade) continue;
    const enter = interpolate(frame, [window.fromFrame - fade, window.fromFrame], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const exit = interpolate(frame, [window.toFrame, window.toFrame + fade], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const strength = Math.min(enter, exit);
    if (strength > 0) gain = gain + (params.bgmDuckTo - gain) * strength;
  }
  return Math.max(0, Math.min(1, gain));
}
