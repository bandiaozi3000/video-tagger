import { describe, expect, it } from 'vitest';
import { clipDurationLabel, clipSourceLine, mmss } from './time';

describe('出处写法（几分几秒）', () => {
  it('分钟秒数补零，超过一小时才带小时', () => {
    expect(mmss(252700)).toBe('04:12');
    expect(mmss(0)).toBe('00:00');
    expect(mmss(59_999)).toBe('00:59');
    expect(mmss(3_600_000 + 252_000)).toBe('1:04:12');
  });

  it('脏值不炸（负数 / NaN）', () => {
    expect(mmss(-1)).toBe('00:00');
    expect(mmss(Number.NaN)).toBe('00:00');
  });

  it('出处取「起点 → 起点+片段长度」', () => {
    expect(clipSourceLine({ sourceStartMs: 252_700, durationMs: 16_800 })).toBe('04:12 – 04:29');
  });

  it('片段时长取整到秒的「几分几秒」（用户 2026-09-20）', () => {
    expect(clipDurationLabel(5_100)).toBe('00:05');
    expect(clipDurationLabel(65_400)).toBe('01:05');
    expect(clipDurationLabel(400)).toBe('00:01');   // 不足 1 秒不显示 00:00
    expect(clipDurationLabel(Number.NaN)).toBe('00:01');
  });

  it('没标时间段（整集）→ 空串，交给时长兜底', () => {
    expect(clipSourceLine({ durationMs: 16_800 })).toBe('');
  });
});
