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

/** `all` 模式最多铺多少条槽（防 `durationSec` 脏值把循环跑飞；正常片子几十条就到顶）。 */
const MAX_BGM_SLOTS = 500;

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
  /** 银幕式传真场景表（片名卡窗口靠它定位）；旧模板不传 → 只支持开场/结尾窗口。
   *  `kicker` 用于识别 chapter 的**组首「本组核心」区**（转场音挂点，2026-09-26）。 */
  scenes?: Array<{ type: string; fromFrame: number; durationInFrames: number; kicker?: string }>;
}

export interface BgmSlot {
  name: string;
  assetPath?: string;
  fromFrame: number;
  durationInFrames: number;
  /** 从曲子第几秒开始放（各窗口接着往下走；结尾固定用曲子后半段）。 */
  startFromSec?: number;
  /** 曲子总长（秒，Java 侧 ffprobe 探得）—— BGM 条要按它显示“曲子自身”的进度；缺省 → 条退回窗口口径。 */
  durationSec?: number;
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
    // 旧行为：一首接一首**铺满全片**，无段边淡入淡出（铺满全片本来就没有段边界）。
    // ⚠️ 2026-09-26 修：以前只把曲目列表走**一遍** —— 曲目总长 < 片长时就变成「全程只有前几分钟有音乐」
    // （实测：200s 曲子 + 1000s 片子 → 4 分钟后全静音；曲长探不到时才恰好铺满，所以一直没被发现）。
    // 现在**轮流循环铺到片尾**；`MAX_BGM_SLOTS` 只是防脏值（durationSec 极小）把循环跑飞。
    const fallbackSec = total / fps / Math.max(1, tracks.length);
    const slots: BgmSlot[] = [];
    let cursor = 0;
    for (let i = 0; i < MAX_BGM_SLOTS && cursor < total; i++) {
      const track = tracks[i % tracks.length];
      const seconds = track.durationSec ?? fallbackSec;
      if (!(seconds > 0)) break;
      const frames = Math.max(1, Math.round(seconds * fps));
      slots.push({ name: track.name, assetPath: track.assetPath, fromFrame: cursor, durationInFrames: frames, durationSec: track.durationSec, edgeFadeSec: 0 });
      cursor += frames;
    }
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
      durationSec: track.durationSec,
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
    durationSec: track.durationSec,
    edgeFadeSec,
  }];
}

/**
 * 当前帧哪首在响（`bgmTimeline` 的下标）；**静音段（曲与曲 / 窗口与窗口之间的空隙）返回 -1**。
 *
 * 为什么要单独判：以前找不到活动 slot 时回退到第 0 条/最后一条，于是「BGM 只在开头+结尾」的片子里，
 * 中间十几分钟也会挂一条音乐条，上面写着一个毫无意义的位置（实测：300s 时显示「1:25 ↻」）。
 * 没音乐就不显示条，与「条上显示的 = 听到的」这条底线一致。
 */
export function bgmSlotIndexAt(frame: number, slots: BgmSlot[]): number {
  // 用**该条自己的尾巴**判定，不能用「下一条的起点」—— 后者会让条在空隙里一直挂着（旧 bug）
  return slots.findIndex((slot) => frame >= slot.fromFrame && frame < slot.fromFrame + slot.durationInFrames);
}

/**
 * BGM 条上显示什么（用户 2026-09-26：「音乐条进度显示有问题，显示的是视频进度」）。
 *
 * 口径 = **这首曲子自己的位置**（像音乐播放器），不是全片/窗口的位置：
 *   · 进度条 = 曲内位置 ÷ **曲长**；
 *   · 左边时间 = 曲内位置（循环后归零 + 条上标 ↻）；
 *   · 右边时间 = **曲长**（不是窗口长）。
 *
 * 旧口径（已修）用的是「窗口 + 绝对视频时间」：在 `bgmRange=all` + 单曲（或曲长探不到）时，窗口就是全片，
 * 于是条上显示的就字面上是视频进度（用户看出来的就是这个）。
 *
 * ⚠️ 未验证：第二遍之后的位置假设为**从头（0s）循环**（与浏览器原生 `<audio loop>` 一致）；
 * 若 Remotion 实际是“回到 `startFromSec` 再来”，那么仅当窗口比剩余曲长还长时，条会比声音多算 `startFromSec`。
 */
export interface BgmBadgeState {
  /** 进度条比例 0~1。 */
  progress: number;
  /** 当前曲内位置（秒）。 */
  positionSec: number;
  /** “/”右边的总长（秒）：曲长优先，探不到则退回窗口长。 */
  totalSec: number;
  /** 已经循环过几遍（> 0 → 条上标 ↻）。 */
  loops: number;
}

export function bgmBadgeState(frame: number, slot: BgmSlot, fps: number): BgmBadgeState {
  const elapsedSec = Math.max(0, frame - slot.fromFrame) / fps;          // 还没轮到这首 → 0（条上显示它的起播位置）
  const playedSec = (slot.startFromSec ?? 0) + elapsedSec;
  const trackSec = slot.durationSec != null && slot.durationSec > 0 ? slot.durationSec : null;
  if (trackSec === null) {
    // 曲长探不到（ffprobe 失败 / 旧草稿）→ 只能按窗口算，至少不会显示成 100%
    const windowSec = Math.max(1, slot.durationInFrames) / fps;
    const capped = Math.min(elapsedSec, windowSec);
    return { progress: capped / windowSec, positionSec: capped, totalSec: windowSec, loops: 0 };
  }
  const loops = Math.floor(playedSec / trackSec);
  const positionSec = playedSec - loops * trackSec;
  return { progress: positionSec / trackSec, positionSec, totalSec: trackSec, loops };
}

/**
 * 给 Remotion `<Audio startFrom>` 的值：**单位是帧，不是秒**（`startFrom` 已改名 `trimBefore`，文档写明“in frames”）。
 *
 * 为什么单独拎出来：`BgmSlot.startFromSec` 是秒，直接传进去会被当成帧（结尾“后半段”实际只跳到第 3.7 秒）——
 * 这条单位坑靠一个函数 + 单测钉住，别再各处手写换算。
 */
export function bgmStartFromFrames(slot: BgmSlot, fps: number): number {
  return Math.round((slot.startFromSec ?? 0) * fps);
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
    // 银幕式的片名卡（TITLE）与 chapter 的**章节页**（GROUP_INTRO：年份页 + 结尾「全片回顾 · X」页）。
    // 2026-09-26 二级分组改造：原来挂的是 chapter「本组核心」区（那整块已按用户要求删除）→ 改挂章节页。
    .filter((scene) => scene.type === 'TITLE' || scene.type === 'GROUP_INTRO')
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
