import { describe, expect, it } from 'vitest';
import { buildListText, DEFAULT_TOGGLES, prepareRows, type ExportRow, type ExportToggles } from './export-list';

const rows: ExportRow[] = [
  { id: 1, title: '铃铛猫娘 夏季特别篇2000', year: 2000, episodeCount: 4, tags: '日常,搞笑', subcategory: '番剧', source: 'bangumi', clipCount: 2 },
  { id: 2, title: '全金属狂潮 校园篇', year: 2003, episodeCount: 12, tags: '搞笑', subcategory: '番剧', source: 'bangumi', clipCount: 0 },
  { id: 3, title: '某部没年份的', episodeCount: null, tags: null },
];

// 旧用例只关心元素/版式 → 固定 sortBy:none（排序/去重由文件末尾的新用例单独盯）
const toggles = (patch: Partial<ExportToggles> = {}): ExportToggles => ({ ...DEFAULT_TOGGLES, header: false, sortBy: 'none', ...patch });

describe('清单文本：元素可勾选', () => {
  it('默认勾选 = 序号 标题 年份 集数 标签', () => {
    expect(buildListText([rows[0], rows[1]], toggles())).toBe([
      '1. 铃铛猫娘 夏季特别篇2000  2000 年 · 4 集 · 日常、搞笑',
      '2. 全金属狂潮 校园篇  2003 年 · 12 集 · 搞笑',
    ].join('\n') + '\n');
  });

  it('关掉年份/集数/标签后不留多余的「·」', () => {
    expect(buildListText([rows[0]], toggles({ year: false, episode: false, tags: false })))
      .toBe('1. 铃铛猫娘 夏季特别篇2000\n');
  });

  it('关掉序号后从标题开头', () => {
    expect(buildListText([rows[1]], toggles({ index: false, year: false, episode: false, tags: false })))
      .toBe('全金属狂潮 校园篇\n');
  });

  it('分类/来源/片段数可选（默认关）', () => {
    expect(buildListText([rows[0]], toggles({ year: false, tags: false, subcategory: true, source: true, clips: true })))
      .toBe('1. 铃铛猫娘 夏季特别篇2000  4 集 · 番剧 · 2 个片段 · bangumi\n');
  });

  it('标题行带片单名与总数', () => {
    const text = buildListText([rows[1]], toggles({ header: true, year: false, episode: false, tags: false }), '小众搞笑番推荐');
    expect(text.split('\n')[0]).toBe('小众搞笑番推荐 · 共 1 部');
    expect(text).toContain('1. 全金属狂潮 校园篇');
  });
});

describe('清单文本：按年份分组', () => {
  const text = buildListText(rows, toggles({ groupByYear: true }));

  it('组标题带【年份】，年份倒序，行内不再重复年份', () => {
    expect(text).toBe([
      '【2003】',
      '1. 全金属狂潮 校园篇  12 集 · 搞笑',
      '',
      '【2000】',
      '2. 铃铛猫娘 夏季特别篇2000  4 集 · 日常、搞笑',
      '',
      '【年份未知】',
      '3. 某部没年份的',
    ].join('\n') + '\n');
  });

  it('序号跨组连续（不是每组从 1 重来）', () => {
    const numbers = text.split('\n').filter((line) => /^\d+\./.test(line)).map((line) => line.split('.')[0]);
    expect(numbers).toEqual(['1', '2', '3']);
  });

  it('没年份的归到「年份未知」且排最后', () => {
    expect(text.trimEnd().endsWith('3. 某部没年份的')).toBe(true);
  });

  // 2026-09-27：以前组顺序写死成年份倒序 → 分组一开「年份 ↑」就不生效（用户报「排序不生效」）
  it('组顺序跟随排序：年份 ↑ 时组标题升序，「年份未知」仍排最后', () => {
    const asc = buildListText(rows, toggles({ groupByYear: true, sortBy: 'year-asc' }));
    expect(asc.split('\n').filter((line) => line.startsWith('【'))).toEqual(['【2000】', '【2003】', '【年份未知】']);
  });

  it('不排序 + 分组：组顺序沿用年份倒序（组内保持传入顺序）', () => {
    const none = buildListText(rows, toggles({ groupByYear: true, sortBy: 'none' }));
    expect(none.split('\n').filter((line) => line.startsWith('【'))).toEqual(['【2003】', '【2000】', '【年份未知】']);
  });
});

describe('清单文本：边界', () => {
  it('空清单只输出标题行', () => {
    expect(buildListText([], toggles({ header: true }), '空片单')).toBe('空片单 · 共 0 部\n');
  });

  it('标题里的逗号不会被当成标签分隔（标签来自后端 GROUP_CONCAT）', () => {
    expect(buildListText([{ id: 9, title: '标题,带逗号', tags: 'a,b' }], toggles({ year: false, episode: false })))
      .toBe('1. 标题,带逗号  a、b\n');
  });
});

// ---- 2026-09-21 新增：按年份排序（默认倒排）+ 同系列去重 ----
describe('排序与去重', () => {
  const rows: ExportRow[] = [
    { id: 3, title: '草莓棉花糖 OVA 2卷', year: 2007, seriesBaseId: 1 },
    { id: 1, title: '草莓棉花糖', year: 2005 },
    { id: 2, title: '未知年份的片', year: null },
    { id: 4, title: '现视研2', year: 2007 },
  ];

  it('默认按年份倒排（新→旧），缺年份排最后，同年保持原顺序（稳定）', () => {
    const got = prepareRows(rows, { ...DEFAULT_TOGGLES }).map((row) => row.id);
    expect(got).toEqual([3, 4, 1, 2]);
  });

  it('年份升序：缺年份仍排最后', () => {
    const got = prepareRows(rows, { ...DEFAULT_TOGGLES, sortBy: 'year-asc' }).map((row) => row.id);
    expect(got).toEqual([1, 3, 4, 2]);
  });

  it('不排序 = 维持传入顺序（推荐顺序/后端顺序）', () => {
    const got = prepareRows(rows, { ...DEFAULT_TOGGLES, sortBy: 'none' }).map((row) => row.id);
    expect(got).toEqual([3, 1, 2, 4]);
  });

  it('去重只留本体：seriesBaseId 非空的派生条目被去掉', () => {
    const got = prepareRows(rows, { ...DEFAULT_TOGGLES, dedupe: true, sortBy: 'none' }).map((row) => row.id);
    expect(got).toEqual([1, 2, 4]);
  });

  it('去重后行号连续，且标题行按去重后的数量计数', () => {
    const text = buildListText(rows, { ...DEFAULT_TOGGLES, dedupe: true, sortBy: 'none' }, '我的片单');
    expect(text).toContain('我的片单 · 共 3 部');
    expect(text).toContain('1. 草莓棉花糖');
    expect(text).toContain('3. 现视研2');
    expect(text).not.toContain('OVA 2卷');
  });
});
