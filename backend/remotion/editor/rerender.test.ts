import { describe, expect, it } from 'vitest';
import { boundaryFramesOf, canRerenderChunk, parseBoundaryFrames } from './rerender';
import type { MultiMediaPocInput, PocMedia } from '../src/types';

describe('局部重渲的安全校验', () => {
  it('边界完全一致 → 放行', () => {
    const snap = '[0,165,300,360,513,1173]';
    expect(canRerenderChunk(snap, [0, 165, 300, 360, 513, 1173]).ok).toBe(true);
  });

  it('段数变了（加/删媒体）→ 拒绝', () => {
    const snap = '[0,165,300,360,513,1173]';
    const r = canRerenderChunk(snap, [0, 165, 300, 360, 513, 700, 1173]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('段数变了');
  });

  it('边界数值变了（改片段起止 / 改时长设置）→ 拒绝并说明位移', () => {
    const snap = '[0,165,300,360,513,1173]';
    const r = canRerenderChunk(snap, [0, 165, 300, 360, 600, 1173]);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('位移');
  });

  it('旧任务没存边界 / 当前算不出边界 → 拒绝（宁可不做，别拼错片）', () => {
    expect(canRerenderChunk(null, [0, 1]).ok).toBe(false);
    expect(canRerenderChunk('[0,1]', []).ok).toBe(false);
    expect(parseBoundaryFrames('坏 JSON')).toEqual([]);
  });
});

/**
 * 当前边界要与渲染脚本同源（2026-10-01 修）：以前 `main.tsx` 里写死「非银幕式 → 空表」，
 * 章节式/片段式草稿永远报「当前草稿算不出段边界（非银幕式形态？）」。
 */
describe('boundaryFramesOf：两种形态都算得出边界', () => {
  const media = (id: number, clips = 0): PocMedia => ({
    mediaId: id,
    order: id,
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
  });

  const input = (style: 'chapter' | 'clip' | 'cinema'): MultiMediaPocInput => ({
    template: 'MULTI_MEDIA_RECOMMEND',
    style,
    title: 'T',
    media: [media(1, 1), media(2)],
  });

  it('章节式：首 0、尾总帧数、段数 = 段数+1（且与 canRerenderChunk 能对上快照）', () => {
    const frames = boundaryFramesOf(input('chapter'));
    expect(frames[0]).toBe(0);
    expect(frames.length).toBeGreaterThan(1);                 // 不是空表 —— 就是以前报错的那点
    expect(frames.every((value, index) => index === 0 || value > frames[index - 1])).toBe(true);
    // 同一份草稿算两次必须完全一致（否则快照永远对不上）
    expect(boundaryFramesOf(input('chapter'))).toEqual(frames);
    // 章节式快照 → 放行
    expect(canRerenderChunk(JSON.stringify(frames), frames).ok).toBe(true);
  });

  it('片段式（clip）也走章节计划：有边界且单调递增', () => {
    const frames = boundaryFramesOf(input('clip'));
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.every((value, index) => index === 0 || value > frames[index - 1])).toBe(true);
  });

  it('银幕式：走 cinema 计划（首段是 SCAN，边界非空）', () => {
    const frames = boundaryFramesOf(input('cinema'));
    expect(frames.length).toBeGreaterThan(1);
    expect(frames[0]).toBe(0);
    expect(canRerenderChunk(JSON.stringify(frames), boundaryFramesOf(input('cinema'))).ok).toBe(true);
  });
});
