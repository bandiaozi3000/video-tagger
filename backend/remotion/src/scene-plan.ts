import type { MultiMediaPocInput, PocMedia, Scene, ScenePlan } from './types';

export const POC_FPS = 30;
export const POC_WIDTH = 1280;
export const POC_HEIGHT = 720;

const openingFrames = 3 * POC_FPS;
const clipInfoFrames = 3 * POC_FPS;
const infoOnlyFrames = 5 * POC_FPS;
const endingFrames = 3 * POC_FPS;

export function buildScenePlan(input: MultiMediaPocInput): ScenePlan {
  validateInput(input);
  const scenes: Scene[] = [];
  let fromFrame = 0;
  scenes.push({ type: 'COLLECTION_OPENING', fromFrame, durationInFrames: openingFrames });
  fromFrame += openingFrames;

  for (const media of input.media) {
    const infoDuration = media.clips.length > 0 ? clipInfoFrames : infoOnlyFrames;
    scenes.push({ type: 'MEDIA_INFO', mediaId: media.mediaId, fromFrame, durationInFrames: infoDuration });
    fromFrame += infoDuration;
    for (const clip of media.clips) {
      const durationInFrames = Math.max(1, Math.round((clip.durationMs / 1000) * POC_FPS));
      scenes.push({ type: 'MEDIA_CLIP', mediaId: media.mediaId, clipId: clip.clipId, fromFrame, durationInFrames });
      fromFrame += durationInFrames;
    }
  }

  scenes.push({ type: 'COLLECTION_ENDING', fromFrame, durationInFrames: endingFrames });
  fromFrame += endingFrames;
  return { fps: POC_FPS, width: POC_WIDTH, height: POC_HEIGHT, durationInFrames: fromFrame, scenes };
}

function validateInput(input: MultiMediaPocInput): void {
  if (!input || input.template !== 'MULTI_MEDIA_REMOTION_POC') throw new Error('POC 模板类型无效');
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
