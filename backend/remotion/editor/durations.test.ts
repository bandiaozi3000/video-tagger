import { describe, expect, it } from 'vitest';
import { clampSeconds, countByKey, durationKeyOfScene, DURATION_FIELD, DURATION_LIMITS } from './durations';

describe('段 → 时长类别', () => {
  it('chapter 形态', () => {
    expect(durationKeyOfScene({ type: 'COLLECTION_OPENING' })).toBe('opening');
    expect(durationKeyOfScene({ type: 'COLLECTION_INTRO' })).toBe('intro');
    expect(durationKeyOfScene({ type: 'GROUP_INTRO' })).toBe('group');
    expect(durationKeyOfScene({ type: 'MEDIA_INFO' })).toBe('detail');
    expect(durationKeyOfScene({ type: 'MEDIA_GRID' })).toBe('detail');
    expect(durationKeyOfScene({ type: 'COLLECTION_ENDING' })).toBe('ending');
  });

  it('cinema 形态（SCAN/SETTLE 派生自开场；TITLE/COVER 派生自资料）', () => {
    expect(durationKeyOfScene({ type: 'SCAN' })).toBe('opening');
    expect(durationKeyOfScene({ type: 'SETTLE' })).toBe('opening');
    expect(durationKeyOfScene({ type: 'TITLE' })).toBe('title');
    expect(durationKeyOfScene({ type: 'COVER' })).toBe('detail');
    expect(durationKeyOfScene({ type: 'ENDING' })).toBe('ending');
  });

  it('片段段不可调（素材决定）', () => {
    expect(durationKeyOfScene({ type: 'MEDIA_CLIP' })).toBeNull();
    expect(durationKeyOfScene({ type: 'CLIP' })).toBeNull();
  });

  it('统计每类覆盖多少段', () => {
    const counts = countByKey([
      { type: 'SCAN' }, { type: 'SETTLE' },
      { type: 'TITLE' }, { type: 'COVER' }, { type: 'CLIP' },
      { type: 'TITLE' }, { type: 'CLIP' },
      { type: 'ENDING' },
    ]);
    // TITLE 走自己的 title 类（2026-09-20），COVER 仍算资料
    expect(counts).toEqual({ opening: 2, intro: 0, group: 0, detail: 1, title: 2, ending: 1 });
  });

  it('钳位与 params.ts 同区间，并取到 0.5s', () => {
    expect(clampSeconds('opening', 999)).toBe(DURATION_LIMITS.opening[1]);
    expect(clampSeconds('opening', 0)).toBe(DURATION_LIMITS.opening[0]);
    expect(clampSeconds('detail', 7.3)).toBe(7.5);
    expect(clampSeconds('detail', 7.2)).toBe(7);
  });

  it('字段映射齐全（拖拽写回用）', () => {
    expect(Object.values(DURATION_FIELD)).toEqual(['openingSec', 'introSec', 'groupSec', 'detailSec', 'titleSec', 'endingSec']);
  });
});
