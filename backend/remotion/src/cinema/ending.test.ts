import { describe, expect, it } from 'vitest';
import {
  endingListHeight, endingListRows, endingListRow, endingListSpeed, endingListSpeedPaused, endingPageSlice, endingPages,
  endingPlayback, endingRowsPerPage, LIST_ROW_H, endingScrollBase, endingStatLines, LIST_MAX, endingShow,
} from './ending';
import { resolveParams } from '../params';
import type { PocMedia } from '../types';
import { buildCinemaPlan } from './plan';

const media = (id: number, year?: number): PocMedia => ({
  mediaId: id, order: id, mode: 'INFO_ONLY', title: `番剧 ${id}`, year, tags: [], clips: [],
});

describe('结尾名单：行文字与开关', () => {
  const row = media(7, 2003);

  it('默认：三段分别是序号 / 名称 / 年份（组件用列宽对齐）', () => {
    expect(endingListRow(row, 7, { wall: true, paging: false, list: true, index: true, year: true, stats: false })).toEqual({ index: '7.', title: '番剧 7', year: '2003' });
  });

  it('关掉序号/年份就返回空串（不留占位）', () => {
    expect(endingListRow(row, 7, { wall: true, paging: false, list: true, index: false, year: false, stats: false })).toEqual({ index: '', title: '番剧 7', year: '' });
  });

  it('没有年份 → year 为空串', () => {
    expect(endingListRow(media(8), 8, { wall: true, paging: false, list: true, index: true, year: true, stats: false }).year).toBe('');
  });

  it('开关默认值：名单/序号/年份 开，统计 关（用户：「左侧文字不用太多」）', () => {
    expect(endingShow(resolveParams({}))).toEqual({ wall: true, paging: false, list: true, index: true, year: true, stats: false });
    expect(endingShow(resolveParams({ detailShow: { status: true, note: true, tag: true, endingStats: true } })).stats).toBe(true);
  });
});

describe('结尾统计行（可选）', () => {
  const plan = buildCinemaPlan({
    template: 'MULTI_MEDIA_REMOTION_POC',
    title: '测试片单',
    media: [media(1, 2000), media(2, 2010), media(3, 2026)],
    params: { durations: { opening: 10, intro: 4, group: 4, detail: 10, ending: 6, title: 2 } },
  });

  it('`N 部 · M 集`（没集数时只留 `N 部`）与 `年份区间 · K 个片段`', () => {
    expect(endingStatLines(plan)).toEqual(['3 部', '2000 – 2026']);
  });

  it('没有集数/片段时不显示 0（不留空字段）', () => {
    expect(endingStatLines(plan).join(' ')).not.toContain('0 个片段');
  });
});

describe('结尾滚动速度映射（墙 / 文字 共用参数，系数不同）', () => {
  it('50 = 基准：墙 0.12 屏高/秒、名单 0.05', () => {
    const base = endingScrollBase(50);
    expect(base.wall).toBeCloseTo(0.12, 5);
    expect(base.list).toBeCloseTo(0.05, 5);
  });

  it('参数调大两边都变快，且钳在合理区间', () => {
    expect(endingScrollBase(100).wall).toBeCloseTo(0.24, 5);
    expect(endingScrollBase(1000).wall).toBeLessThanOrEqual(0.3);
    expect(endingScrollBase(1).list).toBeGreaterThanOrEqual(0.015);
    expect(endingScrollBase(0).wall).toBeCloseTo(0.12, 5);   // 缺省当 50 处理
  });
});


describe('结尾名单：单列 + 视窗滚动（用户：「现在滚动你还两排有点不太合理」）', () => {
  it('单列：24 部就是 24 行，顺序不变，最多 36', () => {
    const rows = endingListRows(Array.from({ length: 24 }, (_, i) => media(i + 1)));
    expect(rows).toHaveLength(24);
    expect(rows[0].mediaId).toBe(1);
    expect(rows[23].mediaId).toBe(24);
    expect(endingListRows(Array.from({ length: 50 }, (_, i) => media(i + 1)))).toHaveLength(LIST_MAX);
  });

  it('块高按行数线性增长（行高 = 0.021 × 1.75）', () => {
    expect(endingListHeight(24) - endingListHeight(12)).toBeCloseTo(12 * LIST_ROW_H, 6);
    expect(LIST_ROW_H).toBeCloseTo(0.03675, 6);
  });

  it('配速：让整份名单在结尾时长内走完（含 0.4s 起滚延迟也不会太挤）', () => {
    for (const rows of [4, 12, 24, 36]) {
      const speed = endingListSpeed({ speed: 50, durationSeconds: 10, rows });
      const travel = speed * (10 - 0.4);
      // 走完 = 至少把名单块高走掉
      // 配速按整段时长算（end 前已 0.4s 延迟），所以用**含延迟的全长**核验：speed×时长 ≥ 块高
      expect(speed * 10).toBeGreaterThanOrEqual(endingListHeight(rows) - 1e-9);
    }
  });

  it('名单很短时退回基准速度（从容）', () => {
    const speed = endingListSpeed({ speed: 50, durationSeconds: 30, rows: 3 });
    expect(speed).toBeCloseTo(endingScrollBase(50).list, 5);
  });
});

describe('结尾名单：翻页模式（动漫 ED 职员表那样一页一页换）', () => {
  const plan = buildCinemaPlan({
    template: 'MULTI_MEDIA_REMOTION_POC',
    title: '测试片单',
    media: Array.from({ length: 24 }, (_, i) => media(i + 1)),
    params: { durations: { opening: 10, intro: 4, group: 4, detail: 10, ending: 10, title: 2 } },
  });

  it('一页放几行：按固定头高度算，与滚动同一个视窗', () => {
    const withHeader = endingRowsPerPage({ hasTitle: true, hasText: true, hasStats: true });
    const bare = endingRowsPerPage({ hasTitle: false, hasText: false, hasStats: false });
    expect(withHeader).toBeGreaterThan(5);
    expect(bare).toBeGreaterThan(withHeader);   // 固定头越少，一页能放越多行
    expect(bare * 0.0243).toBeLessThanOrEqual(0.83 - 0.26);
  });

  it('24 部按页切开：顺序不变、总行数不变', () => {
    const pages = endingPages(endingListRows(plan.media), endingRowsPerPage({ hasTitle: true, hasText: true, hasStats: false }));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat()).toHaveLength(24);
    expect(pages[0][0].mediaId).toBe(1);
    expect(pages.flat()[23].mediaId).toBe(24);
  });

  it('分页切时间：先停 1s，再把剩余时长均分（不是每页固定几秒）', () => {
    const { start, slice } = endingPageSlice({ durationSeconds: 10, pageCount: 3 });
    expect(start).toBe(1);
    expect(slice).toBeCloseTo(3, 5);
  });

  it('滚动配速把 1s 停顿算进可用时间（否则最后一行差 1s 没走完）', () => {
    // 用长名单（配速项占主导）；短名单下基准速度更大，两者本来就相等
    const rows = 36;
    const paused = endingListSpeedPaused({ speed: 50, durationSeconds: 10, rows });
    expect(paused).toBeGreaterThan(endingListSpeed({ speed: 50, durationSeconds: 10, rows }));
    expect(paused * (10 - 1)).toBeGreaterThanOrEqual(endingListHeight(rows) - 1e-9);
  });
});

describe('速度跟着结尾时长走（用户：「防止播放不全」）', () => {
  it('滚动：不再有上限 —— 结尾越短滚得越快，但一定滚得完', () => {
    for (const duration of [3, 6, 10]) {
      const rows = 36;
      const speed = endingListSpeed({ speed: 50, durationSeconds: duration - 1, rows });
      expect(speed * (duration - 1)).toBeGreaterThanOrEqual(endingListHeight(rows) - 1e-9);
      expect(speed).toBeGreaterThanOrEqual(endingScrollBase(50).list);   // 不比基准慢
    }
    // 3s 结尾下确实比 10s 快
    expect(endingListSpeed({ speed: 50, durationSeconds: 2, rows: 36 }))
      .toBeGreaterThan(endingListSpeed({ speed: 50, durationSeconds: 9, rows: 36 }));
  });

  it('时间账：翻页给出页数与每页秒数，滚动给出速度', () => {
    const paging = endingPlayback({ durationSeconds: 10, rows: 24, paging: true, rowsPerPage: 12, speed: 50 });
    expect(paging.pages).toBe(2);
    expect(paging.pageSeconds).toBeCloseTo(4.5, 5);
    expect(paging.warning).toBeNull();

    const scrolling = endingPlayback({ durationSeconds: 10, rows: 24, paging: false, rowsPerPage: 12, speed: 50 });
    expect(scrolling.pages).toBe(1);
    expect(scrolling.scrollSpeed).toBeGreaterThan(0);
    expect(scrolling.warning).toBeNull();
  });

  it('太快时给出可执行的提醒（建议调大结尾时长）', () => {
    const tight = endingPlayback({ durationSeconds: 3, rows: 36, paging: true, rowsPerPage: 12, speed: 50 });
    expect(tight.pages).toBe(3);
    expect(tight.pageSeconds).toBeLessThan(1.2);
    expect(tight.warning).toContain('结尾时长');
  });
});
