import { describe, expect, it } from 'vitest';
import { formatElapsed, sessionSignature, taskProgressLabel } from './state';
import type { EditorConfig } from './api';

/** 造一个最小可用的配置（只填签名关心的字段）。 */
function config(over: Partial<EditorConfig> = {}): EditorConfig {
  return {
    ids: [1, 2],
    mediaClips: {},
    groupBy: 'none',
    bgmTracks: [],
    stingTracks: [],
    stingVolume: 60,
    ...over,
  } as EditorConfig;
}

describe('会话重建签名', () => {
  it('换/删转场音必须重建会话（否则预览里永远不生效——2026-09-20 实测踩到）', () => {
    const before = sessionSignature(config());
    const added = sessionSignature(config({ stingTracks: [{ name: 'whoosh.wav', base64: 'AAAA' }] }));
    expect(added).not.toBe(before);
    // 签名按 `文件名:base64 长度` 认（与 BGM 同口径）：换长度不同的素材要重建
    expect(sessionSignature(config({ stingTracks: [{ name: 'whoosh.wav', base64: 'BBBBBBBB' }] }))).not.toBe(added);
    // 已知上限：同名且同长度的不同文件认不出来（要与 BGM 一起改就一起改）
  });

  it('纯音量变化不重建（走本地参数补丁）', () => {
    const tracks = [{ name: 'whoosh.wav', base64: 'AAAA' }];
    expect(sessionSignature(config({ stingTracks: tracks, stingVolume: 20 })))
      .toBe(sessionSignature(config({ stingTracks: tracks, stingVolume: 90 })));
  });
});

describe('导出任务的耗时与预计剩余', () => {
  it('格式化：秒 / 分 / 时分', () => {
    expect(formatElapsed(45_000)).toBe('45 秒');
    expect(formatElapsed(5 * 60_000)).toBe('5 分');
    expect(formatElapsed(12 * 60_000 + 34_000)).toBe('12 分 34 秒');
    expect(formatElapsed(75 * 60_000)).toBe('1 小时 15 分');
    expect(formatElapsed(0)).toBe('—');
  });

  it('RUNNING：已用 + 百分比 + 线性外推的剩余', () => {
    const t = { status: 'RUNNING', progress: 25, createdAt: 0, finishedAt: 0 };
    expect(taskProgressLabel(t, 4 * 60_000)).toBe('已用 4 分 · 25% · 预计还需 12 分');
  });

  it('进度太小先不报剩余（早期百分比抖动会带偏）', () => {
    expect(taskProgressLabel({ status: 'RUNNING', progress: 1, createdAt: 0 }, 30_000)).toBe('已用 30 秒 · 1%');
  });

  it('结束的任务报总时长', () => {
    expect(taskProgressLabel({ status: 'DONE', progress: 100, createdAt: 0, finishedAt: 754_000 }, 999_999))
      .toBe('共 12 分 34 秒');
  });
});
