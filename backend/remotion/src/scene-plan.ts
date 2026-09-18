import { resolveParams, resolveStyle } from './params';
import type { GroupPlan, MultiMediaPocInput, PocMedia, Scene, ScenePlan } from './types';
import { TEMPLATE_IDS } from './types';

export type { GroupPlan };

/**
 * 帧级场景计划 —— **唯一时长权威**（设计规格 §6.1）。
 *
 * 秒 → 帧只在这里发生；Java 侧只保留"给用户看的预估时长"。
 * 分组、每屏几部、两套模板形态的差异全部在这里表达，组件不再自己判断结构。
 */

/** 秒 → 帧（舍入，至少 1 帧）。 */
const secToFrames = (seconds: number, fps: number): number => Math.max(1, Math.round(seconds * fps));

/** 分组名里的年份（用于 `groupBy=year` 的组排序）；解析不出 → null（排最后）。 */
function yearOfGroup(name: string): number | null {
  const matched = /(\d{2,4})/.exec(name);
  return matched ? Number(matched[1]) : null;
}

/**
 * 按 `groupBy` / `groupSort` 排出「组 → 媒体」结构。
 *
 * 分组名由 Java 侧计算（`year` / `subcategory` / `collection` 需要 DB 查询，见
 * `RecommendService.groupOf`），这里只负责排序与兜底文案。
 */
export function groupMedia(input: MultiMediaPocInput, groupBy: string, groupSort: string): GroupPlan[] {
  const useGroups = groupBy.trim() !== '' && groupBy !== 'none';
  const buckets = new Map<string, PocMedia[]>();
  const order: string[] = [];
  for (const media of input.media) {
    const name = useGroups ? (media.group?.trim() || '未分组') : '';
    if (!buckets.has(name)) {
      buckets.set(name, []);
      order.push(name);
    }
    buckets.get(name)!.push(media);
  }
  let names = order;
  if (useGroups && groupBy === 'year' && groupSort !== 'none') {
    const desc = groupSort !== 'date-asc';
    names = [...order].sort((a, b) => {
      const an = yearOfGroup(a);
      const bn = yearOfGroup(b);
      if (an === null && bn === null) return a.localeCompare(b);
      if (an === null) return 1;
      if (bn === null) return -1;
      return desc ? bn - an : an - bn;
    });
  }
  return names.map((name, index) => ({ name, index: useGroups ? index : -1, media: buckets.get(name)! }));
}

export function buildScenePlan(input: MultiMediaPocInput): ScenePlan {
  validateInput(input);
  const params = resolveParams(input.params, input);
  const style = resolveStyle(input);
  const { fps, width, height, perScreen } = params;
  const scenes: Scene[] = [];
  let fromFrame = 0;
  const push = (scene: Omit<Scene, 'fromFrame' | 'durationInFrames'>, durationInFrames: number): Scene => {
    const full: Scene = { ...scene, fromFrame, durationInFrames };
    scenes.push(full);
    fromFrame += durationInFrames;
    return full;
  };

  push({ type: 'COLLECTION_OPENING' }, secToFrames(params.durations.opening, fps));
  // 序言屏：intro 文案为空则不产生；片段型形态跳过（形态差异，见设计规格 §6.2）
  if (params.intro.trim() && style === 'chapter') {
    push({ type: 'COLLECTION_INTRO' }, secToFrames(params.durations.intro, fps));
  }

  const groups = groupMedia(input, params.groupBy, params.groupSort);
  for (const group of groups) {
    // 分组章节页：只有章节叙事型且确实有分组时才出现
    if (group.index >= 0 && style === 'chapter') {
      push({ type: 'GROUP_INTRO', groupName: group.name, groupIndex: group.index }, secToFrames(params.durations.group, fps));
    }
    // 资料卡 / 每屏 N 部网格
    const chunks: PocMedia[][] = [];
    for (let i = 0; i < group.media.length; i += perScreen) {
      chunks.push(group.media.slice(i, i + perScreen));
    }
    for (const chunk of chunks) {
      if (chunk.length === 1 && perScreen === 1) {
        push({ type: 'MEDIA_INFO', mediaId: chunk[0].mediaId }, secToFrames(params.durations.detail, fps));
      } else {
        push({ type: 'MEDIA_GRID', mediaIds: chunk.map((m) => m.mediaId) }, secToFrames(params.durations.detail, fps));
      }
      // 片段屏：每个片段独占一个场景（时长来自素材本身，不由 durations 决定）
      for (const media of chunk) {
        for (const clip of media.clips) {
          push(
            { type: 'MEDIA_CLIP', mediaId: media.mediaId, clipId: clip.clipId },
            secToFrames(clip.durationMs / 1000, fps),
          );
        }
      }
    }
  }

  push({ type: 'COLLECTION_ENDING' }, secToFrames(params.durations.ending, fps));

  const audioWindows = scenes
    .filter((scene) => {
      if (scene.type !== 'MEDIA_CLIP') return false;
      const media = input.media.find((m) => m.mediaId === scene.mediaId);
      const clip = media?.clips.find((c) => c.clipId === scene.clipId);
      return Boolean(clip?.hasAudio);
    })
    .map((scene) => ({ fromFrame: scene.fromFrame, toFrame: scene.fromFrame + scene.durationInFrames }));

  return {
    style,
    fps,
    width,
    height,
    durationInFrames: fromFrame,
    scenes,
    audioWindows,
    params,
    mediaIndex: new Map(input.media.map((media) => [media.mediaId, media])),
    groups,
  };
}

/** 某帧是否有片段原声（BGM ducking 依据）。 */
export function hasOriginalAudioAt(plan: ScenePlan, frame: number): boolean {
  return plan.audioWindows.some((w) => frame >= w.fromFrame && frame < w.toFrame);
}

function validateInput(input: MultiMediaPocInput): void {
  if (!input || !TEMPLATE_IDS.includes(input.template)) throw new Error('推荐模板类型无效');
  if (input.style !== undefined && input.style !== 'chapter' && input.style !== 'clip') throw new Error('模板形态无效');
  if (!Array.isArray(input.media) || input.media.length === 0) throw new Error('至少需要一个媒体');
  const mediaIds = new Set<number>();
  const clipIds = new Set<number>();
  for (const media of input.media) {
    validateMedia(media, mediaIds, clipIds);
  }
}

function validateMedia(media: PocMedia, mediaIds: Set<number>, clipIds: Set<number>): void {
  if (!Number.isInteger(media.mediaId) || media.mediaId <= 0) throw new Error('媒体 ID 无效');
  if (mediaIds.has(media.mediaId)) throw new Error('媒体 ID 重复');
  mediaIds.add(media.mediaId);
  if (!media.title?.trim()) throw new Error('媒体标题不能为空');
  if (!Array.isArray(media.tags)) throw new Error('媒体标签必须是数组');
  if (!Array.isArray(media.clips)) throw new Error('媒体 Clip 必须是数组');
  if (media.mode === 'INFO_ONLY' && media.clips.length > 0) throw new Error('INFO_ONLY 媒体不能包含 Clip');
  if (media.mode === 'CLIPS_SELECTED' && media.clips.length === 0) throw new Error('CLIPS_SELECTED 媒体必须包含 Clip');
  for (const clip of media.clips) {
    if (!Number.isInteger(clip.clipId) || clip.clipId <= 0) throw new Error('Clip ID 无效');
    if (clipIds.has(clip.clipId)) throw new Error('Clip ID 重复');
    clipIds.add(clip.clipId);
    if (!clip.title?.trim()) throw new Error('Clip 标题不能为空');
    if (!clip.assetPath?.trim()) throw new Error('Clip 素材路径不能为空');
    if (!Number.isFinite(clip.durationMs) || clip.durationMs <= 0) throw new Error('Clip 时长必须大于 0');
  }
}

export function mediaForScene(plan: ScenePlan, scene: Scene): PocMedia | undefined {
  return scene.mediaId === undefined ? undefined : plan.mediaIndex.get(scene.mediaId);
}

/** 按组名取成员（章节页用；预先分组过，避免每帧扫全表）。 */
export function mediaOfGroup(plan: ScenePlan, groupName: string | undefined): PocMedia[] {
  if (!groupName) return [];
  return plan.groups.find((group) => group.name === groupName)?.media ?? [];
}

/** 底部进度条文案。 */
export function sceneLabel(plan: ScenePlan, scene: Scene | undefined, total: number): string {
  if (!scene) return '—';
  if (scene.type === 'COLLECTION_OPENING') return '开场';
  if (scene.type === 'COLLECTION_INTRO') return '序言';
  if (scene.type === 'COLLECTION_ENDING') return '结尾';
  if (scene.type === 'GROUP_INTRO') return `章节 · ${scene.groupName ?? ''}`;
  if (scene.type === 'MEDIA_GRID') {
    const first = scene.mediaIds?.[0] === undefined ? undefined : plan.mediaIndex.get(scene.mediaIds[0]);
    return `${first?.order ?? 1}-${(scene.mediaIds?.length ?? 1) + (first?.order ?? 1) - 1} / ${total}`;
  }
  const media = mediaForScene(plan, scene);
  if (!media) return '—';
  return scene.type === 'MEDIA_CLIP' ? `${media.title} · 片段` : `${media.title}`;
}
