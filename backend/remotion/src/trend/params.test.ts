import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEC_PER_YEAR, MAX_SEC_PER_YEAR, MIN_SEC_PER_YEAR, TREND_FPS, TREND_LAYOUT,
  barReveal, clampSecPerYear, countOf, currentYearIndex, elapsedYearsAtFrame, isHoldPhase,
  revealedPoints, totalFrames, xAt, yAt, yearsOf, type TrendVideoInput,
} from './params';

const LINE_0 = { name: '异世界', color: '#cba6f7', points: [{ year: 2020, count: 10 }, { year: 2021, count: 20 }, { year: 2022, count: 40 }] };
const input: TrendVideoInput = {
  secPerYear: 1.5,
  holdSec: 3,
  years: [2020, 2021, 2022],
  lines: [{
    name: '异世界', color: '#cba6f7',
    points: [{ year: 2020, count: 10 }, { year: 2021, count: 20 }, { year: 2022, count: 40 }],
  }],
};

describe('秒/年是自由输入 —— 信任边界必须兜住', () => {
  it('越界/非法一律回落默认，绝不产出 0 或负数总帧数', () => {
    expect(clampSecPerYear(undefined)).toBe(DEFAULT_SEC_PER_YEAR);
    expect(clampSecPerYear('abc')).toBe(DEFAULT_SEC_PER_YEAR);
    expect(clampSecPerYear(NaN)).toBe(DEFAULT_SEC_PER_YEAR);
    expect(clampSecPerYear(0)).toBe(MIN_SEC_PER_YEAR);
    expect(clampSecPerYear(-5)).toBe(MIN_SEC_PER_YEAR);
    expect(clampSecPerYear(99)).toBe(MAX_SEC_PER_YEAR);
    expect(clampSecPerYear(2)).toBe(2);
    expect(totalFrames({ ...input, secPerYear: 0 })).toBeGreaterThan(0);
    expect(totalFrames({ years: [], lines: [] })).toBeGreaterThan(0);
  });
});

describe('总帧数与年份推进', () => {
  it('总帧 = 年份数 × 秒/年 × fps + 定格', () => {
    expect(totalFrames(input)).toBe(Math.round((3 * 1.5 + 3) * TREND_FPS));
  });

  it('第 N 年出现在第 N × 秒/年 × fps 帧；推进到末年即进入定格', () => {
    const perYear = 1.5 * TREND_FPS;
    expect(elapsedYearsAtFrame(0, input)).toBe(0);
    expect(elapsedYearsAtFrame(perYear, input)).toBe(1);
    expect(elapsedYearsAtFrame(perYear * 2, input)).toBe(2);
    expect(elapsedYearsAtFrame(perYear * 3, input)).toBe(3);
    expect(elapsedYearsAtFrame(perYear * 3 + 30, input)).toBe(3);
    expect(isHoldPhase(perYear * 3 - 1, input)).toBe(false);
    expect(isHoldPhase(perYear * 3, input)).toBe(true);
    expect(currentYearIndex(0, 3)).toBe(0);
    expect(currentYearIndex(1.2, 3)).toBe(1);
    expect(currentYearIndex(3, 3)).toBe(2);
  });

  it('横轴年份去重升序，缺 years 时从各线推', () => {
    expect(yearsOf({ years: [2021, 2020, 2021] })).toEqual([2020, 2021]);
    expect(yearsOf({ lines: [{ name: 'x', color: '#fff', points: [{ year: 2022, count: 1 }, { year: 2019, count: 2 }] }] })).toEqual([2019, 2022]);
  });
});

describe('逐帧生长', () => {
  it('折线只画到当前进度，末段按比例插点', () => {
    expect(revealedPoints(LINE_0, input.years!, 0.5).map((p) => p.year)).toEqual([2020, 2020.5]);
    expect(revealedPoints(LINE_0, input.years!, 0.5)[1].count).toBe(15);
    expect(revealedPoints(LINE_0, input.years!, 1).map((p) => p.year)).toEqual([2020]);
    expect(revealedPoints(LINE_0, input.years!, 1.5).map((p) => p.year)).toEqual([2020, 2021, 2021.5]);
    expect(revealedPoints(LINE_0, input.years!, 3).map((p) => p.year)).toEqual([2020, 2021, 2022]);
    expect(revealedPoints(LINE_0, input.years!, 0)).toEqual([]);
  });

  it('柱状生长系数 clamp 在 0..1', () => {
    expect(barReveal(0.5, 0)).toBe(0.5);
    expect(barReveal(1, 1)).toBe(0);
    expect(barReveal(2.5, 1)).toBe(1);
    expect(barReveal(-1, 0)).toBe(0);
  });

  it('缺年份的点算 0（不能因为没数据就崩）', () => {
    expect(countOf(LINE_0, 1999)).toBe(0);
  });
});

describe('几何', () => {
  it('横轴两端贴边、纵轴按最大值顶到 top', () => {
    expect(xAt(0, 3)).toBe(TREND_LAYOUT.left);
    expect(xAt(2, 3)).toBe(TREND_LAYOUT.right);
    expect(yAt(40, 40)).toBe(TREND_LAYOUT.top);
    expect(yAt(0, 40)).toBe(TREND_LAYOUT.bottom);
    expect(yAt(20, 40)).toBe((TREND_LAYOUT.top + TREND_LAYOUT.bottom) / 2);
    expect(yAt(5, 0)).toBe(TREND_LAYOUT.bottom);
  });
});
