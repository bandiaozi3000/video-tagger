import { describe, expect, it } from 'vitest';
import {
  recapEntranceSeconds, recapGeometry, recapHoldSeconds, recapPageAt, recapPages, recapPageSeconds, recapSeconds,
  RECAP_META_RATIO, RECAP_PER_PAGE, RECAP_TITLE_LINE_HEIGHT, RECAP_TITLE_RATIO, RECAP_VIEW_H,
} from './recap';
import type { PocMedia } from './types';

function media(id: number, year = 2020): PocMedia {
  return { mediaId: id, order: id, mode: 'INFO_ONLY', title: `作品 ${id}`, year, tags: [], clips: [] };
}
const list = (n: number): PocMedia[] => Array.from({ length: n }, (_, i) => media(i + 1));

describe('结尾回顾 = 分页小卡墙（用户 2026-09-26：「小卡片一图流」「按年份铺开，完整展示，展示完毕停留 5S 再下一页」）', () => {
  it('每页 36 张（12×3），保持顺序、最后一页留余数；空输入不产生页', () => {
    expect(RECAP_PER_PAGE).toBe(36);
    const pages = recapPages(list(185));
    expect(pages).toHaveLength(6);
    expect(pages.map((page) => page.length)).toEqual([36, 36, 36, 36, 36, 5]);
    expect(pages[0][0].mediaId).toBe(1);
    expect(pages[5][4].mediaId).toBe(185);
    expect(recapPages([])).toEqual([]);
  });

  it('几何：任何画幅下卡片都不溢出画幅，封面守 3:4', () => {
    const frames = [[1920, 1080], [1280, 720], [3840, 2160], [1080, 1080], [1080, 1920]];
    for (const [w, h] of frames) {
      const g = recapGeometry(w, h);
      const used = g.rows * g.cardH + (g.rows - 1) * g.rowGap;
      expect(used).toBeLessThanOrEqual(h * RECAP_VIEW_H + 0.01);
      expect(g.columns * g.cardW + (g.columns - 1) * g.gap).toBeLessThanOrEqual(g.contentW + 0.01);
      expect(g.cardW / g.coverH).toBeCloseTo(0.75, 6);   // 3:4
      expect(g.coverH).toBeGreaterThan(0);
    }
  });

  it('卡内文字区预算按**两行标题**给：上边距 + 2 行标题 + 间隔 + 集数行 ≤ 文字区（否则集数会被卡边裁掉）', () => {
    for (const h of [720, 1080, 2160]) {
      const g = recapGeometry(h * (16 / 9), h);
      const need = Math.round(g.textH * 0.12) + Math.round(h * RECAP_TITLE_RATIO) * RECAP_TITLE_LINE_HEIGHT * 2
        + Math.round(g.textH * 0.05) + Math.round(h * RECAP_META_RATIO);
      expect(need).toBeLessThanOrEqual(g.textH + 0.5);
    }
  });

  it('停留秒数挂已有参数 `endingScrollSpeed`：100（用户当前值）→ 5s（他明说的那个数），50 → 6.5s，0 → 8s，越界钳位', () => {
    expect(recapHoldSeconds(100)).toBeCloseTo(5, 6);
    expect(recapHoldSeconds(50)).toBeCloseTo(6.5, 6);
    expect(recapHoldSeconds(0)).toBeCloseTo(8, 6);
    expect(recapHoldSeconds(999)).toBeCloseTo(5, 6);
    expect(recapHoldSeconds(-5)).toBeCloseTo(8, 6);
  });

  it('错峰入场随卡片数增长但钳在 0.5~1.5s；每页时长 = 入场 + 停留', () => {
    expect(recapEntranceSeconds(1)).toBeCloseTo(0.5, 6);
    expect(recapEntranceSeconds(36)).toBeCloseTo(1.25, 6);
    expect(recapEntranceSeconds(999)).toBeCloseTo(1.5, 6);
    expect(recapPageSeconds(36, 100)).toBeCloseTo(6.25, 6);
  });

  it('一档总时长 = 各页之和；185 张在速度 100 下 = 6 页 ≈ 37.5s（旧口径按每屏 7 秒要 1295s）', () => {
    const pages = recapPages(list(185));
    const seconds = recapSeconds(pages, 100);
    expect(seconds).toBeCloseTo(5 * 6.25 + (0.5 + 5), 6);   // 末页只有 5 张 → 入场 0.5s
    expect(seconds).toBeLessThan(45);
  });

  it('页内时间 → 第几页：边界归下一页，越界钳到最后一页', () => {
    const pages = recapPages(list(40));                 // 2 页：36 + 4
    const first = recapPageSeconds(36, 100);            // 6.25s
    expect(recapPageAt(pages, 100, 0)).toEqual({ index: 0, local: 0 });
    expect(recapPageAt(pages, 100, first - 0.1).index).toBe(0);
    expect(recapPageAt(pages, 100, first).index).toBe(1);
    expect(recapPageAt(pages, 100, first).local).toBeCloseTo(0, 6);
    expect(recapPageAt(pages, 100, 9999).index).toBe(1);
    expect(recapPageAt([], 100, 3)).toEqual({ index: 0, local: 0 });
  });
});
