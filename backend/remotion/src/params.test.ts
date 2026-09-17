import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, resolveParams, speedToFrames } from './params';
import { buildScenePlan } from './scene-plan';
import type { MultiMediaPocInput } from './types';

const input = (params?: MultiMediaPocInput['params']): MultiMediaPocInput => ({
  template: 'MULTI_MEDIA_REMOTION_POC',
  title: '输入标题',
  subtitle: '输入副标题',
  intro: '输入序言',
  media: [
    {
      mediaId: 1, order: 1, mode: 'CLIPS_SELECTED', title: '作品', tags: [],
      clips: [{ clipId: 9, title: '片段', assetPath: 'media/c.mp4', durationMs: 2000, hasAudio: false }],
    },
  ],
  params,
});

describe('resolveParams', () => {
  it('默认值与 Java 侧保持一致', () => {
    const p = resolveParams();
    expect(p.durations).toEqual({ opening: 10, intro: 5, group: 5, detail: 10, ending: 5 });
    expect([p.coverSize, p.bgRotationSec, p.bgOpacity, p.bgBrightness, p.bgBlur]).toEqual([50, 8, 100, 50, 0]);
    expect([p.bgmScale, p.bgmX, p.bgmY]).toEqual([100, 1, 8]);
    expect([p.perScreen, p.groupSort, p.openingSpeed, p.endingScrollSpeed]).toEqual([1, 'date-desc', 50, 50]);
    expect([p.fps, p.width, p.height]).toEqual([30, 1280, 720]);
  });

  it('按 Java 区间 clamp', () => {
    const p = resolveParams({
      durations: { opening: 999, intro: 99, group: 0, detail: 1, ending: 999 },
      bgmScale: 10, perScreen: 99, openingSpeed: 500, bgRotationSec: 0, width: 99,
    });
    expect(p.durations).toEqual({ opening: 20, intro: 10, group: 1, detail: 3, ending: 10 });
    expect(p.bgmScale).toBe(50);
    expect(p.perScreen).toBe(10);
    expect(p.openingSpeed).toBe(100);
    expect(p.bgRotationSec).toBe(1);
    expect(p.width).toBe(99);
    expect(DEFAULT_PARAMS.bgmScale).toBe(100);
  });

  it('文案优先取 params，缺省回退到输入顶层', () => {
    const p = resolveParams({}, { title: '输入标题', subtitle: '输入副标题', intro: '输入序言' });
    expect([p.title, p.subtitle, p.intro]).toEqual(['输入标题', '输入副标题', '输入序言']);
    expect(resolveParams({ title: '参数标题' }, { title: '输入标题' }).title).toBe('参数标题');
  });

  it('速度 → 帧数：50 → 22 帧（30fps）', () => {
    expect(speedToFrames(50, 30)).toBe(22);
    expect(speedToFrames(100, 30)).toBe(8);
    expect(speedToFrames(0, 30)).toBe(36);
    expect(speedToFrames(50, 60)).toBe(44);
  });
});

describe('buildScenePlan 参数驱动', () => {
  it('时长参数驱动场景帧数', () => {
    const plan = buildScenePlan(input({ durations: { opening: 2, intro: 1, group: 1, detail: 3, ending: 1 } }));
    const frames = (type: string) => plan.scenes.find((scene) => scene.type === type)?.durationInFrames;
    expect(frames('COLLECTION_OPENING')).toBe(60);
    expect(frames('COLLECTION_INTRO')).toBe(30);
    expect(frames('MEDIA_INFO')).toBe(90);
    expect(frames('COLLECTION_ENDING')).toBe(30);
    expect(plan.scenes.find((scene) => scene.type === 'MEDIA_CLIP')?.durationInFrames).toBe(60);
    expect(plan.durationInFrames).toBe(plan.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0));
  });

  it('intro 为空则不产生序言场景', () => {
    const withoutIntro = { ...input(), intro: '' };
    expect(buildScenePlan(withoutIntro).scenes.some((scene) => scene.type === 'COLLECTION_INTRO')).toBe(false);
  });

  it('分辨率与 fps 透传到计划', () => {
    const plan = buildScenePlan(input({ fps: 60, width: 1920, height: 1080, durations: { opening: 2, intro: 1, group: 1, detail: 3, ending: 1 } }));
    expect([plan.fps, plan.width, plan.height]).toEqual([60, 1920, 1080]);
    expect(plan.scenes.find((scene) => scene.type === 'COLLECTION_OPENING')?.durationInFrames).toBe(120);
  });
});
