import { resolveParams } from './params';
import type { MultiMediaPocInput, PocMedia, Scene, ScenePlan } from './types';
import { TEMPLATE_IDS } from './types';

/** 秒 → 帧（舍入，至少 1 帧）；秒到帧的转换只发生在这里。 */
const secToFrames = (seconds: number, fps: number): number => Math.max(1, Math.round(seconds * fps));

export function buildScenePlan(input: MultiMediaPocInput): ScenePlan {
  validateInput(input);
  const params = resolveParams(input.params, input);
  const { fps, width, height } = params;
  const scenes: Scene[] = [];
  let fromFrame = 0;
  const push = (scene: Omit<Scene, 'fromFrame'>): void => {
    scenes.push({ ...scene, fromFrame });
    fromFrame += scene.durationInFrames;
  };

  push({ type: 'COLLECTION_OPENING', durationInFrames: secToFrames(params.durations.opening, fps) });
  // 序言屏与旧模板一致：intro 文案为空则不产生该场景
  if (params.intro.trim()) {
    push({ type: 'COLLECTION_INTRO', durationInFrames: secToFrames(params.durations.intro, fps) });
  }

  for (const media of input.media) {
    push({ type: 'MEDIA_INFO', mediaId: media.mediaId, durationInFrames: secToFrames(params.durations.detail, fps) });
    for (const clip of media.clips) {
      push({
        type: 'MEDIA_CLIP',
        mediaId: media.mediaId,
        clipId: clip.clipId,
        durationInFrames: secToFrames(clip.durationMs / 1000, fps),
      });
    }
  }

  push({ type: 'COLLECTION_ENDING', durationInFrames: secToFrames(params.durations.ending, fps) });
  return { fps, width, height, durationInFrames: fromFrame, scenes };
}

function validateInput(input: MultiMediaPocInput): void {
  if (!input || !TEMPLATE_IDS.includes(input.template)) throw new Error('POC 模板类型无效');
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

export function mediaForScene(input: MultiMediaPocInput, scene: Scene): PocMedia | undefined {
  return input.media.find((media) => media.mediaId === scene.mediaId);
}
