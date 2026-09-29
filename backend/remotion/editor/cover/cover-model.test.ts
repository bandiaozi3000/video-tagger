/**
 * 封面参数模型的单测（2026-09-29）：盯住"降级、钳位、安全区提示"三件容易悄悄坏掉的事。
 */
import { describe, expect, it } from 'vitest';
import {
  coverSignature, coverWarnings, defaultCoverConfig, LAYOUTS, layoutById, mergeCoverConfig,
  pickLayout, resolveLayout, sanitizeCover, type CoverConfig, type CoverFrame,
} from './cover-model';

const frame = (clipId: number): CoverFrame => ({
  clipId, mediaId: 1, mediaTitle: 'M', clipTitle: 'C', url: `/covers/clip/${clipId}.jpg`,
});

describe('版式清单', () => {
  it('不含要抠图的破格出血与要同一片段多时刻的分镜条', () => {
    expect(LAYOUTS.map((l) => l.id)).not.toContain('T14');
    expect(LAYOUTS.map((l) => l.id)).not.toContain('T22');
    expect(LAYOUTS).toHaveLength(20);
  });

  it('id 唯一', () => {
    expect(new Set(LAYOUTS.map((l) => l.id)).size).toBe(LAYOUTS.length);
  });
});

describe('按张数自动选 / 降级', () => {
  it('数量正好时按预设首选', () => {
    expect(pickLayout(1)).toBe('T04');
    expect(pickLayout(2)).toBe('T12');
    expect(pickLayout(3)).toBe('T11');
    expect(pickLayout(4)).toBe('T01');
    expect(pickLayout(5)).toBe('T05');
    expect(pickLayout(9)).toBe('T07');
  });

  it('张数不够：降级到装得下的版式，绝不留空框', () => {
    const { layout, degraded } = resolveLayout('T09', 2);   // 九宫格选了但只有 2 张
    expect(degraded).toBe(true);
    expect(layout.needs).toBeLessThanOrEqual(2);
  });

  it('张数够：原样用', () => {
    const { layout, degraded } = resolveLayout('T07', 9);
    expect(layout.id).toBe('T07');
    expect(degraded).toBe(false);
  });

  it('一张都没有也不抛异常', () => {
    expect(resolveLayout('T07', 0).layout.needs).toBeGreaterThanOrEqual(1);
    expect(resolveLayout('T01', 1).layout).toBeTruthy();
  });
});

describe('参数钳位', () => {
  it('字号/偏移/重影越界都被钳住', () => {
    const out = sanitizeCover({ ...defaultCoverConfig(), titleSize: 400, offsetX: -999, ghostOffset: 30 });
    expect(out.titleSize).toBe(150);
    expect(out.offsetX).toBe(-200);
    expect(out.ghostOffset).toBe(8);
  });

  it('强调色非法时回退默认色；frames 去重', () => {
    const out = sanitizeCover({ ...defaultCoverConfig(), accent: 'red', frames: [3, 3, 5] });
    expect(out.accent).toBe('#831F36');
    expect(out.frames).toEqual([3, 5]);
  });

  it('缺字段的老草稿回填成默认值（逐键合并，不能整个替换）', () => {
    const merged = mergeCoverConfig({ layout: 'T07', title: '旧草稿' } as Partial<CoverConfig>);
    expect(merged.layout).toBe('T07');
    expect(merged.effect).toBe('r8');
    expect(merged.anchor).toBe('bottom-left');
  });
});

describe('安全区提示', () => {
  it('右下角会被时长角标压住 → 警告', () => {
    const warns = coverWarnings({ ...defaultCoverConfig(), anchor: 'bottom-right' });
    expect(warns.some((w) => w.text.includes('时长角标'))).toBe(true);
  });

  it('重影偏移过大 → 提示缩略图会发虚', () => {
    const warns = coverWarnings({ ...defaultCoverConfig(), ghostOffset: 8 });
    expect(warns.some((w) => w.text.includes('发虚'))).toBe(true);
  });

  it('左下角默认位没有警告', () => {
    expect(coverWarnings(defaultCoverConfig())).toHaveLength(0);
  });
});

describe('指纹', () => {
  it('参数变了指纹就变（用来决定是否重出图）', () => {
    const base = defaultCoverConfig();
    expect(coverSignature(base)).toBe(coverSignature({ ...base }));
    expect(coverSignature(base)).not.toBe(coverSignature({ ...base, titleSize: 120 }));
    expect(coverSignature(base)).not.toBe(coverSignature({ ...base, frames: [1, 2] }));
  });

  it('未知版式 id 退回清单第一个（不崩）', () => {
    expect(layoutById('NOPE').id).toBe(LAYOUTS[0].id);
  });
});
