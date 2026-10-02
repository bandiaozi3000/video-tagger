import { describe, expect, it } from 'vitest';
import { buildCinemaPlan } from '../src/cinema/plan';
import { buildScenePlan } from '../src/scene-plan';
import { hiddenSectionsOf, SECTION_LABEL, sectionKeyOfScene, withoutHiddenSections } from '../src/sections';
import type { MultiMediaPocInput, PocMedia } from '../src/types';

/** 结构化场景关闭机制的自检（用户 2026-09-30）。 */

function media(id: number, order: number, clips = 0): PocMedia {
  return {
    mediaId: id,
    order,
    mode: clips > 0 ? 'CLIPS_SELECTED' : 'INFO_ONLY',
    title: `作品 ${id}`,
    year: 2024,
    tags: [],
    group: '2024 年',
    clips: Array.from({ length: clips }, (_, i) => ({
      clipId: id * 100 + i,
      title: `片段 ${i + 1}`,
      assetPath: `clip-${id}-${i}.mp4`,
      durationMs: 3000,
      hasAudio: false,
    })),
  };
}

function input(partial: Partial<MultiMediaPocInput> = {}): MultiMediaPocInput {
  return {
    template: 'MULTI_MEDIA_RECOMMEND',
    style: 'chapter',
    title: 'T',
    intro: '一句话简介',
    media: [media(1, 1, 1), media(2, 2, 0)],
    ...partial,
  };
}

const showOf = (...keys: string[]): Record<string, boolean> =>
  Object.fromEntries(keys.map((key) => [key, false]));

describe('sections', () => {
  it('场景 → 类别：回顾题头跟卡墙同属 recap，内容页没有类别', () => {
    expect(sectionKeyOfScene({ type: 'COLLECTION_OPENING' })).toBe('opening');
    expect(sectionKeyOfScene({ type: 'SCAN' })).toBe('opening');
    expect(sectionKeyOfScene({ type: 'SETTLE' })).toBe('opening');
    expect(sectionKeyOfScene({ type: 'COLLECTION_INTRO' })).toBe('intro');
    expect(sectionKeyOfScene({ type: 'GROUP_INTRO' })).toBe('group');
    expect(sectionKeyOfScene({ type: 'GROUP_INTRO', mediaIds: [1, 2] })).toBe('recap');
    expect(sectionKeyOfScene({ type: 'RECAP_LIST' })).toBe('recap');
    expect(sectionKeyOfScene({ type: 'COLLECTION_ENDING' })).toBe('ending');
    expect(sectionKeyOfScene({ type: 'ENDING' })).toBe('ending');
    // 内容页：不给 ✕
    expect(sectionKeyOfScene({ type: 'MEDIA_INFO' })).toBeNull();
    expect(sectionKeyOfScene({ type: 'MEDIA_GRID' })).toBeNull();
    expect(sectionKeyOfScene({ type: 'MEDIA_CLIP' })).toBeNull();
    expect(sectionKeyOfScene({ type: 'TITLE' })).toBeNull();
    expect(sectionKeyOfScene({ type: 'COVER' })).toBeNull();
    expect(sectionKeyOfScene({ type: 'CLIP' })).toBeNull();
  });

  it('开关省略 = 开（老草稿零变化）；只有显式 false 才算关', () => {
    expect(hiddenSectionsOf(undefined)).toEqual([]);
    expect(hiddenSectionsOf({ status: true })).toEqual([]);
    expect(hiddenSectionsOf(showOf('sectionOpening', 'sectionEnding'))).toEqual(['opening', 'ending']);
    expect(Object.keys(SECTION_LABEL)).toEqual(['opening', 'intro', 'group', 'recap', 'ending']);
  });

  it('过滤后重排 fromFrame，总长 = 剩余段之和', () => {
    const scenes = [
      { type: 'A', fromFrame: 0, durationInFrames: 10 },
      { type: 'COLLECTION_OPENING', fromFrame: 10, durationInFrames: 5 },
      { type: 'C', fromFrame: 15, durationInFrames: 7 },
    ];
    const kept = withoutHiddenSections(scenes, ['opening']);
    expect(kept.map((scene) => scene.fromFrame)).toEqual([0, 10]);
    expect(kept.reduce((sum, scene) => sum + scene.durationInFrames, 0)).toBe(17);
  });
});

describe('buildScenePlan 关闭结构化场景', () => {
  it('默认全开：开场 + 序言 + 章节页 + 回顾 + 结尾都在', () => {
    const plan = buildScenePlan(input({ params: { groupBy: 'year' } as never }));
    const types = plan.scenes.map((scene) => scene.type);
    expect(types[0]).toBe('COLLECTION_OPENING');
    expect(types[1]).toBe('COLLECTION_INTRO');
    expect(types).toContain('GROUP_INTRO');
    expect(types).toContain('RECAP_LIST');
    expect(types[types.length - 1]).toBe('COLLECTION_ENDING');
  });

  it('关掉开场/序言/章节页/回顾/结尾 → 只剩内容段，且首段 fromFrame = 0', () => {
    const open = buildScenePlan(input({ params: { groupBy: 'year' } as never }));
    const closed = buildScenePlan(input({
      params: {
        groupBy: 'year',
        detailShow: { status: true, note: true, tag: true, ...showOf('sectionOpening', 'sectionIntro', 'sectionGroup', 'sectionRecap', 'sectionEnding') },
      } as never,
    }));
    const types = closed.scenes.map((scene) => scene.type);
    expect(types).not.toContain('COLLECTION_OPENING');
    expect(types).not.toContain('COLLECTION_INTRO');
    expect(types).not.toContain('GROUP_INTRO');     // 章节页与回顾题头都是 GROUP_INTRO → 一起没了
    expect(types).not.toContain('RECAP_LIST');
    expect(types).not.toContain('COLLECTION_ENDING');
    expect(types.every((type) => ['MEDIA_INFO', 'MEDIA_GRID', 'MEDIA_CLIP'].includes(type))).toBe(true);
    expect(closed.scenes[0].fromFrame).toBe(0);
    expect(closed.durationInFrames).toBeLessThan(open.durationInFrames);
    expect(closed.durationInFrames).toBe(closed.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0));
  });
});

describe('buildCinemaPlan 关闭结构化场景', () => {
  it('关掉开场（SCAN+SETTLE 一起）与结尾', () => {
    const cinemaInput = input({ style: 'cinema' });
    const open = buildCinemaPlan(cinemaInput);
    expect(open.scenes[0].type).toBe('SCAN');
    expect(open.scenes[open.scenes.length - 1].type).toBe('ENDING');

    const closed = buildCinemaPlan({
      ...cinemaInput,
      params: {
        detailShow: { status: true, note: true, tag: true, ...showOf('sectionOpening', 'sectionEnding') },
      } as never,
    });
    const types = closed.scenes.map((scene) => scene.type);
    expect(types).not.toContain('SCAN');
    expect(types).not.toContain('SETTLE');
    expect(types).not.toContain('ENDING');
    expect(types[0]).toBe('TITLE');
    expect(closed.durationInFrames).toBe(closed.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0));
  });
});
