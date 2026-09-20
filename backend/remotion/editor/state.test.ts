import { describe, expect, it } from 'vitest';
import { sessionSignature } from './state';
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
