import { describe, expect, it } from 'vitest';
import { bgmGainAt, bgmTimeline } from '../src/bgm';
import { CORE_KICKER, FEATURED_RECAP_TITLE, buildScenePlan, groupMedia, hasOriginalAudioAt } from '../src/scene-plan';
import type { MultiMediaPocInput, PocMedia } from '../src/types';
import { DEFAULT_PARAMS, resolveParams } from '../src/params';

function media(id: number, order: number, year: number, clips = 0, group?: string): PocMedia {
  return {
    mediaId: id,
    order,
    mode: clips > 0 ? 'CLIPS_SELECTED' : 'INFO_ONLY',
    title: `作品 ${id}`,
    year,
    tags: [],
    group,
    clips: Array.from({ length: clips }, (_, i) => ({
      clipId: id * 100 + i,
      title: `片段 ${i + 1}`,
      assetPath: `media/clip-${id}-${i}.mp4`,
      durationMs: 4000,
      hasAudio: i % 2 === 0,
    })),
  };
}

function input(partial: Partial<MultiMediaPocInput> = {}): MultiMediaPocInput {
  return {
    template: 'MULTI_MEDIA_RECOMMEND',
    title: 'T',
    media: [media(1, 1, 2024, 2, '2024 年'), media(2, 2, 2020, 0, '2020 年')],
    ...partial,
  };
}

describe('groupMedia', () => {
  it('无分组 → 单组且 groupIndex 为 -1', () => {
    const groups = groupMedia(input(), '', 'date-desc');
    expect(groups).toHaveLength(1);
    expect(groups[0].index).toBe(-1);
    expect(groups[0].media).toHaveLength(2);
  });

  it('year 维度按年份降序（默认），组内保持原序', () => {
    const groups = groupMedia(input(), 'year', 'date-desc');
    expect(groups.map((g) => g.name)).toEqual(['2024 年', '2020 年']);
  });

  it('date-asc → 年份升序', () => {
    const groups = groupMedia(input(), 'year', 'date-asc');
    expect(groups.map((g) => g.name)).toEqual(['2020 年', '2024 年']);
  });

  it('groupSort=none 保持首次出现顺序', () => {
    const groups = groupMedia(input({ media: [media(1, 1, 2020, 0, '2020 年'), media(2, 2, 2024, 0, '2024 年')] }), 'year', 'none');
    expect(groups.map((g) => g.name)).toEqual(['2020 年', '2024 年']);
  });

  it('未知年份排最后', () => {
    const groups = groupMedia(input({ media: [media(1, 1, 2020, 0, '未知年份'), media(2, 2, 2024, 0, '2024 年')] }), 'year', 'date-desc');
    expect(groups.map((g) => g.name)).toEqual(['2024 年', '未知年份']);
  });
});

describe('buildScenePlan', () => {
  it('场景顺序：开场 →（序言）→ 章节页 → 资料卡 → 片段 → 结尾', () => {
    const plan = buildScenePlan(input({ intro: '序言文案', params: { groupBy: 'year' } }));
    expect(plan.scenes.map((s) => s.type)).toEqual([
      'COLLECTION_OPENING',
      'COLLECTION_INTRO',
      'GROUP_INTRO',
      'MEDIA_INFO',
      'MEDIA_CLIP',
      'MEDIA_CLIP',
      'GROUP_INTRO',
      'MEDIA_INFO',
      'COLLECTION_ENDING',
    ]);
    expect(plan.scenes[2].groupName).toBe('2024 年');
  });

  it('intro 为空则不产生序言屏；clip 形态跳过序言与章节页', () => {
    expect(buildScenePlan(input()).scenes.some((s) => s.type === 'COLLECTION_INTRO')).toBe(false);
    const clip = buildScenePlan(input({ style: 'clip', intro: '有文案也不出序言', params: { groupBy: 'year' } }));
    expect(clip.scenes.some((s) => s.type === 'COLLECTION_INTRO')).toBe(false);
    expect(clip.scenes.some((s) => s.type === 'GROUP_INTRO')).toBe(false);
  });

  it('perScreen ≥ 2 → 一屏 N 部网格，片段仍逐个成屏', () => {
    const plan = buildScenePlan(input({ params: { perScreen: 3 } }));
    const grid = plan.scenes.find((s) => s.type === 'MEDIA_GRID');
    expect(grid?.mediaIds).toEqual([1, 2]);
    expect(plan.scenes.filter((s) => s.type === 'MEDIA_CLIP')).toHaveLength(2);
  });

  it('时长 = 各场景之和，且片段时长来自素材', () => {
    const plan = buildScenePlan(input({ params: { durations: { opening: 2, intro: 1, group: 1, detail: 3, ending: 1, title: 2 } } }));
    const sum = plan.scenes.reduce((acc, s) => acc + s.durationInFrames, 0);
    expect(plan.durationInFrames).toBe(sum);
    // 2s 开场 + 3s 资料卡 + 两个 4s 片段 + 3s 资料卡 + 1s 结尾（30fps）
    expect(plan.durationInFrames).toBe(60 + 90 + 120 + 120 + 90 + 30);
  });

  it('帧率/分辨率由参数驱动', () => {
    const plan = buildScenePlan(input({ params: { fps: 60, width: 1920, height: 1080 } }));
    expect(plan.fps).toBe(60);
    expect(plan.width).toBe(1920);
    expect(plan.height).toBe(1080);
  });

  it('audioWindows 只覆盖有原声的片段', () => {
    const plan = buildScenePlan(input());
    expect(plan.audioWindows).toHaveLength(1);
    const clipScenes = plan.scenes.filter((s) => s.type === 'MEDIA_CLIP' && s.mediaId === 1);
    expect(hasOriginalAudioAt(plan, clipScenes[0].fromFrame)).toBe(true);
    expect(hasOriginalAudioAt(plan, clipScenes[1].fromFrame)).toBe(false);
  });

  it('非法输入报错（重复 ID / INFO_ONLY 带片段 / 空媒体）', () => {
    expect(() => buildScenePlan(input({ media: [] }))).toThrow('至少需要一个媒体');
    const dup = input({ media: [media(1, 1, 2024, 0), media(1, 2, 2024, 0)] });
    expect(() => buildScenePlan(dup)).toThrow('媒体 ID 重复');
    const bad = input({ media: [{ ...media(1, 1, 2024, 0), mode: 'INFO_ONLY', clips: [{ clipId: 9, title: 'x', assetPath: 'a.mp4', durationMs: 1000, hasAudio: false }] }] });
    expect(() => buildScenePlan(bad)).toThrow('INFO_ONLY 媒体不能包含 Clip');
  });
});

describe('BGM 时间轴与 ducking', () => {
  const plan = buildScenePlan(input());

  it('按真实曲长顺排，缺省时均分', () => {
    const params = resolveParams({ bgmTracks: [{ name: 'A', durationSec: 2 }, { name: 'B', durationSec: 3 }] });
    const slots = bgmTimeline(params, plan);
    expect(slots[0].fromFrame).toBe(0);
    expect(slots[0].durationInFrames).toBe(60);
    expect(slots[1].fromFrame).toBe(60);
    expect(slots[1].durationInFrames).toBe(90);
  });

  it('无曲目时为空', () => {
    expect(bgmTimeline(resolveParams(undefined), plan)).toEqual([]);
  });

  it('有原声的片段区间内压低 BGM，其余回到基准', () => {
    const params = resolveParams({ bgmTracks: [{ name: 'A', durationSec: 60 }] });
    const clip = plan.scenes.find((s) => s.type === 'MEDIA_CLIP' && s.mediaId === 1)!;
    const mid = clip.fromFrame + Math.floor(clip.durationInFrames / 2);
    expect(bgmGainAt(mid, params, plan)).toBeCloseTo(params.bgmDuckTo, 3);
    expect(bgmGainAt(0, params, plan)).toBeCloseTo(params.bgmGain, 3);
    // 淡入淡出：进窗前半段应处于基准与压低声之间
    const ramp = bgmGainAt(clip.fromFrame - Math.round(params.bgmFadeSec * plan.fps) / 2, params, plan);
    expect(ramp).toBeLessThan(params.bgmGain);
    expect(ramp).toBeGreaterThan(params.bgmDuckTo);
  });

  it('默认参数下不会超过 1', () => {
    const params = { ...DEFAULT_PARAMS, bgmGain: 1 };
    expect(bgmGainAt(0, params, plan)).toBeLessThanOrEqual(1);
  });
});

describe('★ 重点项（A+C+D，2026-09-26 用户拍板）', () => {
  it('核心 ≤2 部：组章节页后**紧跟逐部满屏**（MEDIA_INFO）', () => {
    const a = { ...media(1, 1, 2020, 0, '2020 年'), featured: true };
    const b = media(2, 2, 2020, 0, '2020 年');
    const plan = buildScenePlan(input({
      media: [a, b],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    const types = plan.scenes.map((s) => s.type);
    const groupAt = types.indexOf('GROUP_INTRO');
    expect(groupAt).toBeGreaterThan(-1);
    // 组章节页 → 核心满屏（不是先给群像）
    expect(types[groupAt + 1]).toBe('MEDIA_INFO');
    const core = plan.scenes[groupAt + 1];
    expect(core.mediaId).toBe(1);
    expect(core.kicker).toBe(CORE_KICKER);
    expect(core.numberFrom).toBe(1);
  });

  it('核心 ≥3 部：组章节页后**紧跟一屏大卡**（MEDIA_GRID + 金色题头）', () => {
    const list = [1, 2, 3, 4].map((i) => ({ ...media(i, i, 2020, 0, '2020 年'), featured: i <= 3 }));
    const plan = buildScenePlan(input({
      media: list,
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    const groupAt = plan.scenes.findIndex((s) => s.type === 'GROUP_INTRO');
    const core = plan.scenes[groupAt + 1];
    expect(core.type).toBe('MEDIA_GRID');
    expect(core.kicker).toBe(CORE_KICKER);
    expect(core.mediaIds).toEqual([1, 2, 3]);           // 只装核心项
    expect(core.numberFrom).toBe(1);
  });

  it('核心项排到组内最前，群像序号按**组内**从 1 数', () => {
    // ids 顺序故意把核心项放在后面 —— 靠分组时重排把它提到最前
    const list = [media(1, 1, 2020, 0, '2020 年'), { ...media(2, 2, 2020, 0, '2020 年'), featured: true }, media(3, 3, 2020, 0, '2020 年')];
    const plan = buildScenePlan(input({
      media: list,
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    // 群像网格（非核心场景）里的第一项应当是核心项 2，且序号从 1 开始
    const grid = plan.scenes.find((s) => s.type === 'MEDIA_GRID' && !s.kicker);
    expect(grid?.mediaIds?.[0]).toBe(2);
    expect(grid?.numberFrom).toBe(1);
  });

  it('D：结尾前有「全片核心回顾」章节页 + 只含核心项的网格', () => {
    const plan = buildScenePlan(input({
      media: [
        { ...media(1, 1, 2020, 0, '2020 年'), featured: true },
        media(2, 2, 2020, 0, '2020 年'),
        { ...media(3, 3, 2019, 0, '2019 年'), featured: true },
      ],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    const recapAt = plan.scenes.findIndex((s) => s.type === 'GROUP_INTRO' && s.groupName === FEATURED_RECAP_TITLE);
    expect(recapAt).toBeGreaterThan(-1);
    // 回顾章节页之后必须紧跟一格网格，里面**只**放核心项，且在结尾之前
    expect(plan.scenes[recapAt + 1].type).toBe('MEDIA_GRID');
    expect(plan.scenes[recapAt + 1].mediaIds).toEqual([1, 3]);
    expect(plan.scenes[recapAt + 1].numberFrom).toBe(1);
    expect(plan.scenes.findIndex((s) => s.type === 'COLLECTION_ENDING')).toBeGreaterThan(recapAt);
  });

  it('无重点项时不产生多余资料卡', () => {
    const plan = buildScenePlan(input({
      media: [media(1, 1, 2020, 0, '2020 年'), media(2, 2, 2020, 0, '2020 年')],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    expect(plan.scenes.filter((s) => s.type === 'MEDIA_INFO')).toHaveLength(0);
  });

  it('D：结尾前有「全片重点回顾」章节页 + 重点项的网格', () => {
    const plan = buildScenePlan(input({
      media: [
        { ...media(1, 1, 2020, 0, '2020 年'), featured: true },
        media(2, 2, 2020, 0, '2020 年'),
        { ...media(3, 3, 2019, 0, '2019 年'), featured: true },
      ],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    const recapAt = plan.scenes.findIndex((s) => s.type === 'GROUP_INTRO' && s.groupName === FEATURED_RECAP_TITLE);
    expect(recapAt).toBeGreaterThan(-1);
    // 回顾章节页之后必须紧跟一格网格，里面**只**放重点项，且在结尾之前
    expect(plan.scenes[recapAt + 1].type).toBe('MEDIA_GRID');
    expect(plan.scenes[recapAt + 1].mediaIds).toEqual([1, 3]);
    expect(plan.scenes.findIndex((s) => s.type === 'COLLECTION_ENDING')).toBeGreaterThan(recapAt);
  });

  it('无核心项时不产生「全片核心回顾」章节', () => {
    const plan = buildScenePlan(input({
      media: [media(1, 1, 2020, 0, '2020 年')],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    expect(plan.scenes.some((s) => s.groupName === FEATURED_RECAP_TITLE)).toBe(false);
  });
});
