import { describe, expect, it } from 'vitest';
import { buildCinemaPlan, cinemaStatLines } from './plan';
import type { MultiMediaPocInput, PocMedia } from '../types';

function media(id: number, order: number, year: number, episodeCount?: number): PocMedia {
  return {
    mediaId: id,
    order,
    mode: 'INFO_ONLY',
    title: `作品 ${id}`,
    year,
    episodeCount,
    tags: [],
    clips: [],
  };
}

function input(partial: Partial<MultiMediaPocInput> = {}): MultiMediaPocInput {
  return {
    template: 'MULTI_MEDIA_RECOMMEND',
    style: 'cinema',
    title: 'T',
    media: [media(1, 1, 2003, 24), media(2, 2, 2019, 12)],
    ...partial,
  };
}

describe('cinema 开场时长', () => {
  it('开场时长由设置说了算（不再被 4.5s/5s 夹死）', () => {
    const ten = buildCinemaPlan(input({ params: { durations: { opening: 10, intro: 5, group: 5, detail: 10, ending: 5, title: 2 } } }));
    // 用户 2026-09-20 报的 bug：设 10s 与设 20s 都是 9.5s → 现在必须成正比
    expect(ten.scenes[0].fromFrame).toBe(0);
    expect(ten.scenes[0].durationInFrames + ten.scenes[1].durationInFrames).toBe(300);

    const twenty = buildCinemaPlan(input({ params: { durations: { opening: 20, intro: 5, group: 5, detail: 10, ending: 5, title: 2 } } }));
    expect(twenty.scenes[0].durationInFrames + twenty.scenes[1].durationInFrames).toBe(600);
    expect(twenty.scenes[0].durationInFrames).toBeGreaterThan(ten.scenes[0].durationInFrames);
  });

  it('掠影段占 55%，其余留给定格段', () => {
    const plan = buildCinemaPlan(input({ params: { durations: { opening: 10, intro: 5, group: 5, detail: 10, ending: 5, title: 2 } } }));
    expect(plan.scenes[0].type).toBe('SCAN');
    expect(plan.scenes[0].durationInFrames).toBe(165);
    expect(plan.scenes[1].type).toBe('SETTLE');
    expect(plan.scenes[1].durationInFrames).toBe(135);
  });
});

describe('开场代表秀（openingIds）', () => {
  it('勾选的媒体排到最前 —— 它们会落在开场那几张**大卡**上', () => {
    const plan = buildCinemaPlan(input({
      media: [media(1, 1, 2003), media(2, 2, 2010), media(3, 3, 2019)],
      params: { openingIds: [3] },
    }));
    expect(plan.scenes[0].mediaIds).toEqual([3, 1, 2]);
  });

  it('多选按勾选顺序；不在清单里的残留 id 直接忽略', () => {
    const plan = buildCinemaPlan(input({
      media: [media(1, 1, 2003), media(2, 2, 2010), media(3, 3, 2019)],
      params: { openingIds: [2, 999, 1] },
    }));
    expect(plan.scenes[0].mediaIds).toEqual([2, 1, 3]);
  });

  it('不选代表秀 → 保持清单原序（旧行为不变）', () => {
    const plan = buildCinemaPlan(input({ media: [media(1, 1, 2003), media(2, 2, 2010)] }));
    expect(plan.scenes[0].mediaIds).toEqual([1, 2]);
  });

  it('不选开场秀 → 按**推荐顺序**（order）取，不是按 id（用户 2026-09-20：没勾就按推荐顺序来）', () => {
    const plan = buildCinemaPlan(input({ media: [media(9, 2, 2003), media(4, 1, 2010)] }));
    expect(plan.scenes[0].mediaIds).toEqual([4, 9]);
  });
});

describe('cinemaStatLines', () => {
  it('只给年份区间（集数/片段数不进开场行）', () => {
    const plan = buildCinemaPlan(input());
    expect(cinemaStatLines(plan)).toEqual(['2003 – 2019']);
  });

  it('同年只显示一个年份', () => {
    const plan = buildCinemaPlan(input({ media: [media(1, 1, 2019, 12), media(2, 2, 2019, 24)] }));
    expect(cinemaStatLines(plan)).toEqual(['2019']);
  });

  it('没有年份就不编数字', () => {
    const plan = buildCinemaPlan(input({ media: [{ ...media(1, 1, 2019), year: undefined }, { ...media(2, 2, 2019), year: undefined }] }));
    expect(cinemaStatLines(plan)).toEqual([]);
  });
});

describe('片段原声音量（用户 2026-09-20）', () => {
  it('默认 100：有原声的片段幕照旧进 audioWindows（BGM 在片段期间压低）', () => {
    const plan = buildCinemaPlan(input({
      media: [{ ...media(1, 1, 2003), clips: [{ clipId: 7, title: '片段', assetPath: 'a.mp4', durationMs: 3000, hasAudio: true }] }],
    }));
    expect(plan.params.clipVolume).toBe(100);
    expect(plan.audioWindows.length).toBe(1);
  });

  it('静音（0）：audioWindows 为空 —— 不再白白压 BGM', () => {
    const plan = buildCinemaPlan(input({
      media: [{ ...media(1, 1, 2003), clips: [{ clipId: 7, title: '片段', assetPath: 'a.mp4', durationMs: 3000, hasAudio: true }] }],
      params: { clipVolume: 0 },
    }));
    expect(plan.params.clipVolume).toBe(0);
    expect(plan.audioWindows).toEqual([]);
  });

  it('调小（如 60）：仍然算作「有原声」→ 照旧压低 BGM', () => {
    const plan = buildCinemaPlan(input({
      media: [{ ...media(1, 1, 2003), clips: [{ clipId: 7, title: '片段', assetPath: 'a.mp4', durationMs: 3000, hasAudio: true }] }],
      params: { clipVolume: 60 },
    }));
    expect(plan.params.clipVolume).toBe(60);
    expect(plan.audioWindows.length).toBe(1);
  });
});
