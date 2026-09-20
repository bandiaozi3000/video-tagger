import { interpolate } from 'remotion';
import type { RenderParams } from './params';

/**
 * BGM 时间轴与增益曲线（帧为单位）——UI 与音频共用同一份计算，避免"条上显示的"和"听到的"不一致。
 *
 * 与旧链路的区别：旧模板把曲名注入 HTML、曲长靠 ffprobe 拼 `BGM_TRACK_DURS`，
 * 音频再由 Java FFmpeg 事后混流；现在曲长与素材都在同一个计划里，音频由 Remotion 内建。
 *
 * 2026-09-20：用户先要「只在开头和结尾」，再要「片名卡这块也顺带播」→ 范围变成**多选集合**：
 * `opening` / `cards` / `ending` 任意组合；不做任何勾选 = `none`（全片不播）；`all` = 旧行为（铺满全片）。
 */

export type BgmRangeSegment = 'opening' | 'cards' | 'ending';

export interface BgmRangeSpec {
  /** `all` = 铺满全片；`none` = 完全不播；`windows` = 只在这些段里播。 */
  mode: 'all' | 'none' | 'windows';
  /** `mode === 'windows'` 时生效，已归一化顺序（开场 → 片名卡 → 结尾）。 */
  windows: BgmRangeSegment[];
}

const SEGMENTS: readonly BgmRangeSegment[] = ['opening', 'cards', 'ending'];

/**
 * 解析 `params.bgmRange`：接受 `all` / `none` / 逗号集合（大小写与顺序无关，未知项丢弃）。
 * 空串或缺省 → `all`（保持旧行为，不会因为漏传而突然静音）。
 */
export function parseBgmRange(raw: unknown): BgmRangeSpec {
  const text = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (text === '' || text === 'all') return { mode: 'all', windows: [] };
  if (text === 'none') return { mode: 'none', windows: [] };
  const picked = SEGMENTS.filter((segment) => text.split(',').map((part) => part.trim()).includes(segment));
  if (picked.length === 0) return { mode: 'all', windows: [] };
  return { mode: 'windows', windows: picked };
}

/** `bgm.ts` 需要的最小计划形状（旧模板的真 plan 与银幕式的适配计划都能满足）。 */
export interface BgmPlanLike {
  fps: number;
  durationInFrames: number;
  audioWindows: Array<{ fromFrame: number; toFrame: number }>;
  /** 银幕式传真场景表（片名卡窗口靠它定位）；旧模板不传 → 只支持开场/结尾窗口。 */
  scenes?: Array<{ type: string; fromFrame: number; durationInFrames: number }>;
}

export interface BgmSlot {
  name: string;
  assetPath?: string;
  fromFrame: number;
  durationInFrames: number;
  /** 从曲子第几秒开始放（各窗口接着往下走；结尾固定用曲子后半段）。 */
  startFromSec?: number;
  /** 段自身的头尾淡入淡出（秒）：只有「不铺满全片」的范围才需要，否则段末会硬切。 */
  edgeFadeSec: number;
}

/** 每首曲子的起始帧与占用帧数：优先用真实曲长，缺省按画幅总时长均分。 */
export function bgmTimeline(params: RenderParams, plan: BgmPlanLike): BgmSlot[] {
  const tracks = params.bgmTracks;
  if (tracks.length === 0) return [];
  const spec = parseBgmRange(params.bgmRange);
  if (spec.mode === 'none') return [];
  const fps = plan.fps;
  const total = plan.durationInFrames;
  if (spec.mode === 'all') {
    // 旧行为：一首接一首铺满，无段边淡入淡出（铺满全片本来就没有段边界）
    const fallbackSec = total / fps / Math.max(1, tracks.length);
    const slots: BgmSlot[] = [];
    let cursor = 0;
    tracks.forEach((track) => {
      const seconds = track.durationSec ?? fallbackSec;
      const frames = Math.max(1, Math.round(seconds * fps));
      slots.push({ name: track.name, assetPath: track.assetPath, fromFrame: cursor, durationInFrames: frames, edgeFadeSec: 0 });
      cursor += frames;
    });
    return slots;
  }

  const openingFrames = Math.max(1, Math.round(params.durations.opening * fps));
  const endingFrames = Math.max(1, Math.round(params.durations.ending * fps));
  const endingStart = Math.max(0, total - endingFrames);
  const cardWindows = (plan.scenes ?? [])
    .filter((scene) => scene.type === 'TITLE')
    .map((scene) => [scene.fromFrame, scene.fromFrame + scene.durationInFrames] as [number, number]);

  const slots: BgmSlot[] = [];
  // 曲内游标：各窗口**接着往下放**（片名卡逐张往下走，而不是每张卡都从头重放同一句）
  let cursorSec = 0;
  const push = (windowSlots: BgmSlot[]): void => {
    slots.push(...windowSlots);
    const last = windowSlots[windowSlots.length - 1];
    if (last) cursorSec = last.fromFrame + last.durationInFrames;
  };
  if (spec.windows.includes('opening')) push(windowSlots(tracks, 0, openingFrames, fps, params.bgmFadeSec, cursorSec));
  if (spec.windows.includes('cards')) {
    for (const [from, to] of cardWindows) push(windowSlots(tracks, from, to, fps, params.bgmFadeSec, cursorSec));
  }
  if (spec.windows.includes('ending')) push(secondHalfSlot(tracks[0], endingStart, total, fps, params.bgmFadeSec));
  return slots;
}

/**
 * 窗口内从曲子第几秒起放：**跟全片时间走**（按曲长取模）。
 *
 * 这样每张片名卡听到的是曲子里**不同的一段**，而不是每张卡都从头重放同一句；
 * 反过来“跳过间隙连续累加”会让音乐位置与全片进度脱钩，取舍取前者。
 */
function startFromSecAt(track: RenderParams['bgmTracks'][number], from: number, fps: number): number {
  if (track.durationSec == null || track.durationSec <= 0) return 0;
  return (from / fps) % track.durationSec;
}

/**
 * 一个窗口的曲子：
 *
 * - 只有一首 → 让它自己 loop 铺满整个窗口（否则曲短于窗口时后半截会变成静音）；
 * - 多首 → 按顺序铺、裁到窗口里（超出截断，不够就让后面的曲子上）。
 */
function windowSlots(
  tracks: RenderParams['bgmTracks'],
  from: number,
  to: number,
  fps: number,
  edgeFadeSec: number,
  cursorFrame: number,
): BgmSlot[] {
  if (to <= from) return [];
  if (tracks.length === 1) {
    return [{
      ...tracks[0],
      fromFrame: from,
      durationInFrames: to - from,
      startFromSec: startFromSecAt(tracks[0], from, fps),
      edgeFadeSec,
    }];
  }
  return sequentialSlots(tracks, from, to, fps, edgeFadeSec, cursorFrame);
}

/** 把按顺序铺的曲子裁到 `[from, to)` 里：段起点偏移换算成曲子内的偏移（循环播放时按曲长取模）。 */
function sequentialSlots(
  tracks: RenderParams['bgmTracks'],
  from: number,
  to: number,
  fps: number,
  edgeFadeSec: number,
  cursorFrame: number,
): BgmSlot[] {
  const fallbackSec = (to - from) / fps / Math.max(1, tracks.length);
  const slots: BgmSlot[] = [];
  let cursor = cursorFrame;
  for (const track of tracks) {
    const seconds = track.durationSec ?? fallbackSec;
    const frames = Math.max(1, Math.round(seconds * fps));
    const overlapFrom = Math.max(from, cursor);
    const overlapTo = Math.min(to, cursor + frames);
    cursor += frames;
    if (overlapTo <= overlapFrom) {
      if (cursor >= to) break;
      continue;
    }
    slots.push({
      name: track.name,
      assetPath: track.assetPath,
      fromFrame: overlapFrom,
      durationInFrames: overlapTo - overlapFrom,
      startFromSec: startFromSecAt(track, overlapFrom, fps),
      edgeFadeSec,
    });
    if (cursor >= to) break;
  }
  return slots;
}

/** 结尾窗口用**第一首曲子的后半段**（用户 2026-09-20 选的「乙」）：与开场听感不同，不像 loop。 */
function secondHalfSlot(
  track: RenderParams['bgmTracks'][number],
  from: number,
  to: number,
  fps: number,
  edgeFadeSec: number,
): BgmSlot[] {
  const seconds = Math.max(1, to - from) / fps;
  const half = track.durationSec != null ? track.durationSec / 2 : 0;
  return [{
    name: track.name,
    assetPath: track.assetPath,
    fromFrame: from,
    durationInFrames: Math.max(1, Math.round(seconds * fps)),
    startFromSec: half,
    edgeFadeSec,
  }];
}

/**
 * 全局帧 → BGM 增益：基准 `bgmGain`，落在"有片段原声"的帧区间内压到 `bgmDuckTo`（进出各 fadeSec 渐变）。
 */
export function bgmGainAt(frame: number, params: RenderParams, plan: BgmPlanLike): number {
  const fade = Math.max(1, Math.round(params.bgmFadeSec * plan.fps));
  let gain = params.bgmGain;
  // 片段原声 + 转场音都要把 BGM 压低（用户 2026-09-20：「压」）
  for (const window of [...plan.audioWindows, ...stingWindows(plan, params)]) {
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

/**
 * 段内实际增益 = ducking 曲线 × **段自身的头尾淡入淡出**。
 *
 * 为什么需要：`bgmFadeSec` 原本只管"原声压 BGM"的进出；BGM 只在若干段播时，
 * 段末会**音乐戛然而止**（用户 2026-09-20 提的缓入缓出就是这个）。
 */
export function bgmSlotGainAt(frame: number, slot: BgmSlot, params: RenderParams, plan: BgmPlanLike): number {
  const gain = bgmGainAt(frame, params, plan);
  if (slot.edgeFadeSec <= 0) return gain;
  const fade = Math.max(1, Math.round(slot.edgeFadeSec * plan.fps));
  const head = interpolate(frame - slot.fromFrame, [0, fade], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tail = interpolate(frame, [slot.fromFrame + slot.durationInFrames - fade, slot.fromFrame + slot.durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.max(0, Math.min(1, gain * Math.min(head, tail)));
}

/** 转场音乐（甲：只在片名卡响一次，不循环）。 */
export interface StingSlot {
  fromFrame: number;
  durationInFrames: number;
}

/**
 * 每张片名卡一个转场音窗口：**从卡片第一帧起**，长度不超过卡片（卡片 1s 就自动截断），不循环。
 *
 * 与 BGM 完全独立的一层：BGM 范围选了什么都不影响它（用户 2026-09-20 的方案「甲」）。
 */
export function stingTimeline(params: RenderParams, plan: BgmPlanLike): StingSlot[] {
  if (!params.stingPath) return [];
  return (plan.scenes ?? [])
    .filter((scene) => scene.type === 'TITLE' && scene.durationInFrames > 0)
    .map((scene) => ({ fromFrame: scene.fromFrame, durationInFrames: scene.durationInFrames }));
}

/** 转场音增益：0 → `stingVolume`，最后 `bgmFadeSec` 秒淡出（尾端若比素材长就自然无声）。 */
export function stingGainAt(frame: number, slot: StingSlot, params: RenderParams, plan: BgmPlanLike): number {
  const peak = Math.max(0, Math.min(1, params.stingVolume / 100));
  const fade = Math.max(1, Math.round(0.12 * plan.fps));          // 起手 0.12s，避免爆音
  const out = Math.max(1, Math.round(Math.min(params.bgmFadeSec, 0.4) * plan.fps));
  const head = interpolate(frame - slot.fromFrame, [0, fade], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tail = interpolate(frame, [slot.fromFrame + slot.durationInFrames - out, slot.fromFrame + slot.durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.max(0, Math.min(1, peak * Math.min(head, tail)));
}

/** 转场音窗口（供 BGM ducking 复用同一套数学）。 */
function stingWindows(plan: BgmPlanLike, params: RenderParams): Array<{ fromFrame: number; toFrame: number }> {
  return stingTimeline(params, plan).map((slot) => ({ fromFrame: slot.fromFrame, toFrame: slot.fromFrame + slot.durationInFrames }));
}
