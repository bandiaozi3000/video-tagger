import { describe, expect, it } from 'vitest';
import { buildScenePlan } from './scene-plan';
import type { MultiMediaPocInput } from './types';

const clip = (clipId: number, durationMs: number) => ({
  clipId,
  title: `Clip ${clipId}`,
  assetPath: `media/clip-${clipId}.mp4`,
  durationMs,
  hasAudio: false,
});

const input = (media: MultiMediaPocInput['media']): MultiMediaPocInput => ({
  template: 'MULTI_MEDIA_REMOTION_POC',
  title: 'POC 推荐合集',
  subtitle: '测试多个媒体混合推荐',
  media,
});

describe('buildScenePlan', () => {
  it('keeps an info-only media and creates no clip scene', () => {
    const plan = buildScenePlan(input([{
      mediaId: 1002,
      order: 1,
      mode: 'INFO_ONLY',
      title: '作品 B',
      tags: [],
      clips: [],
    }]));

    expect(plan.scenes.map((scene) => scene.type)).toEqual([
      'COLLECTION_OPENING',
      'MEDIA_INFO',
      'COLLECTION_ENDING',
    ]);
  });

  it('keeps media order and clip order', () => {
    const plan = buildScenePlan(input([
      { mediaId: 1001, order: 1, mode: 'CLIPS_SELECTED', title: '作品 A', tags: [], clips: [clip(502, 2000), clip(501, 1000)] },
      { mediaId: 1002, order: 2, mode: 'INFO_ONLY', title: '作品 B', tags: [], clips: [] },
      { mediaId: 1003, order: 3, mode: 'CLIPS_SELECTED', title: '作品 C', tags: [], clips: [clip(503, 3000)] },
    ]));

    expect(plan.scenes.map((scene) => scene.mediaId)).toEqual([
      undefined, 1001, 1001, 1001, 1002, 1003, 1003, undefined,
    ]);
    expect(plan.scenes.map((scene) => scene.clipId).filter(Boolean)).toEqual([502, 501, 503]);
  });

  it('uses prepared clip duration and exact frame totals', () => {
    const plan = buildScenePlan(input([
      { mediaId: 1001, order: 1, mode: 'CLIPS_SELECTED', title: '作品 A', tags: [], clips: [clip(501, 1234)] },
    ]));

    expect(plan.scenes.find((scene) => scene.clipId === 501)?.durationInFrames).toBe(37);
    expect(plan.durationInFrames).toBe(
      plan.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0),
    );
  });

  it('rejects invalid media and clip data', () => {
    expect(() => buildScenePlan(input([
      { mediaId: 1, order: 1, mode: 'INFO_ONLY', title: '重复', tags: [], clips: [] },
      { mediaId: 1, order: 2, mode: 'INFO_ONLY', title: '重复', tags: [], clips: [] },
    ]))).toThrow('媒体 ID 重复');

    expect(() => buildScenePlan(input([
      { mediaId: 1, order: 1, mode: 'INFO_ONLY', title: '非法', tags: [], clips: [clip(1, 1000)] },
    ]))).toThrow('INFO_ONLY 媒体不能包含 Clip');

    expect(() => buildScenePlan(input([
      { mediaId: 1, order: 1, mode: 'CLIPS_SELECTED', title: '非法', tags: [], clips: [clip(1, 0)] },
    ]))).toThrow('Clip 时长必须大于 0');
  });
});
