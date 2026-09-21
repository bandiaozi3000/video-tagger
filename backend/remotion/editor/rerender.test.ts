import { describe, expect, it } from 'vitest';
import { canRerenderChunk, parseBoundaryFrames } from './rerender';

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
