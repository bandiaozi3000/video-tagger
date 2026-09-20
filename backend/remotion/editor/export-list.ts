/**
 * 「📋 导出清单」的文本生成：**纯函数**，好被单测盯住格式（粘贴到微信/贴吧要能直接读）。
 *
 * 元素全部可勾选（序号/标题/年份/集数/标签/分类/来源/片段数），可「按年份分组」。
 * 分组时年份上提到组标题，行内不再重复（避免同一行里出现两遍年份）。
 */

/** 行用换行拼接，**末尾恰好一个换行**（粘贴到聊天框/记事本都合适）。 */
function joinLines(lines: string[]): string {
  return lines.join('\n').replace(/\n+$/, '') + '\n';
}

export interface ExportRow {
  id: number;
  title: string;
  year?: number | null;
  episodeCount?: number | null;
  subcategory?: string | null;
  source?: string | null;
  clipCount?: number | null;
  /** 逗号分隔（后端 GROUP_CONCAT 的结果）。 */
  tags?: string | null;
}

export interface ExportToggles {
  index: boolean;
  title: boolean;
  year: boolean;
  episode: boolean;
  subcategory: boolean;
  source: boolean;
  clips: boolean;
  tags: boolean;
  /** 首行「XX片单 · 共 N 部」。 */
  header: boolean;
  groupByYear: boolean;
}

/** 默认勾选：用户点名的五个元素 + 标题行（其余关掉，避免一行太长）。 */
export const DEFAULT_TOGGLES: ExportToggles = {
  index: true,
  title: true,
  year: true,
  episode: true,
  subcategory: false,
  source: false,
  clips: false,
  tags: true,
  header: true,
  groupByYear: false,
};

/** 行内元素的最低门槛：标题都不显示就等于只输出序号，允许但没意义 —— 由 UI 兜住。 */
export function rowMeta(row: ExportRow, toggles: ExportToggles): string[] {
  const meta: string[] = [];
  if (!toggles.groupByYear && toggles.year && row.year) meta.push(`${row.year} 年`);
  if (toggles.episode && row.episodeCount && row.episodeCount > 0) meta.push(`${row.episodeCount} 集`);
  if (toggles.subcategory && row.subcategory) meta.push(row.subcategory);
  if (toggles.clips && row.clipCount && row.clipCount > 0) meta.push(`${row.clipCount} 个片段`);
  if (toggles.source && row.source) meta.push(row.source);
  if (toggles.tags && row.tags) {
    const tags = row.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (tags.length > 0) meta.push(tags.join('、'));
  }
  return meta;
}

/** 生成清单文本（`rows` 顺序即输出顺序：候选=后端顺序，已选=推荐顺序）。 */
export function buildListText(rows: ExportRow[], toggles: ExportToggles, headerText = ''): string {
  const lines: string[] = [];
  if (toggles.header) {
    const title = headerText.trim() || '推荐清单';
    lines.push(`${title} · 共 ${rows.length} 部`, '');
  }
  const line = (row: ExportRow, index: number): string => {
    const head: string[] = [];
    if (toggles.index) head.push(`${index + 1}.`);
    if (toggles.title) head.push(row.title);
    const meta = rowMeta(row, toggles);
    return [head.join(' '), meta.join(' · ')].filter(Boolean).join('  ');
  };
  if (!toggles.groupByYear) {
    rows.forEach((row, index) => lines.push(line(row, index)));
    return joinLines(lines);
  }
  // 按年份分组（年份倒序，组内保持传入顺序）
  const groups = new Map<string, ExportRow[]>();
  const order: string[] = [];
  for (const row of rows) {
    const key = row.year ? String(row.year) : '年份未知';
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(row);
  }
  order.sort((a, b) => {
    if (a === '年份未知') return 1;
    if (b === '年份未知') return -1;
    return Number(b) - Number(a);
  });
  let index = 0;
  order.forEach((key, position) => {
    if (position > 0) lines.push('');
    lines.push(`【${key}】`);
    for (const row of groups.get(key)!) {
      lines.push(line(row, index));
      index += 1;
    }
  });
  return joinLines(lines);
}
