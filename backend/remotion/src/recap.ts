import type { PocMedia } from './types';

/**
 * 结尾「全片回顾」**分页小卡墙**的纯计算：不依赖 Remotion，好被单测盯住。
 *
 * 背景（用户 2026-09-26，两轮）：
 *   · 第一轮「结尾回顾太长了，几乎和整片一样了……类似滚动条，一行展示：缩略图-番剧名称-集数」→ 做了滚动清单（359s → 61s）；
 *   · 第二轮「不太舒服，小卡片一图流能支持吗」→「不要后面的背景框，直接展示。按年份左右往后直接铺开，完整展示。
 *     若本页展示不下，展示完毕后停留 5S，展示下一页。小卡片带标题、日期、集数」→ 改成**分页卡墙**（本模块）。
 *
 * 三条口径（用户拍板）：
 *   1. **按年份顺序打包填满**（不是「一年一行」）：年份印在卡上，页边界不切断年份连续性 —— 实测强推档 34 部跨 17 年，
 *      「一年一行」会摊出 17 行、每行只 2 张卡（页里大半是空的），页数从 1 页涨到 5 页。
 *   2. **分页停留**：每页 = 卡片错峰入场 + 停留（`endingScrollSpeed` 当节奏档：100 → 2.5s，50 → 5.25s，0 → 8s）。
 *   3. 每张卡三格：封面 / 标题（最多两行）/ `年份 · 集数`。
 */

/** 每页卡片列数 × 行数（12 × 3 = 36 张/页，1920×1080 下卡片约 133×245）。 */
export const RECAP_COLS = 12;
export const RECAP_ROWS = 3;
export const RECAP_PER_PAGE = RECAP_COLS * RECAP_ROWS;

/** 上下留白 / 档名行（与网格屏同一体例的上限，见下注）与卡片区宽度。 */
export const RECAP_PAD_RATIO = 0.115;
export const RECAP_BOTTOM_RATIO = 0.085;
export const RECAP_LABEL_RATIO = 0.055;
export const RECAP_COL_RATIO = 0.9;
export const RECAP_GAP_RATIO = 0.006;
export const RECAP_ROW_GAP_RATIO = 0.008;
/**
 * 卡内文字区高（标题两行 + 一行`年份 · 集数`）。
 *
 * 0.062 是错的：实测出帧里**只有单行标题的卡才看得到集数**，标题两行的卡把集数顶到卡外被裁了
 * （两行标题 48.8px + 上边距 9.6 + 间隔 4 + 集数 15.7 = 78 > 67）。现在按最坏情况（两行标题）给预算。
 */
export const RECAP_TEXT_RATIO = 0.074;
/** 卡内字号与行高（组件与“文字区够不够”的单测共用，免得两处各写一套数字）。 */
export const RECAP_TITLE_RATIO = 0.0185;
export const RECAP_META_RATIO = 0.0135;
export const RECAP_TITLE_LINE_HEIGHT = 1.22;

/** 卡片区可用高（占画幅高比例）：扣掉留白与固定档名行。 */
export const RECAP_VIEW_H = 1 - RECAP_PAD_RATIO - RECAP_BOTTOM_RATIO - RECAP_LABEL_RATIO;

export interface RecapGeometry {
  columns: number;
  rows: number;
  gap: number;
  rowGap: number;
  contentW: number;
  cardW: number;
  cardH: number;
  coverH: number;
  textH: number;
}

/**
 * 卡墙几何：列数固定，卡片宽由画幅宽算、高按 3:4 封面推；
 * **再用可用高兜一次底**（极端画幅下宁可卡片变小，也不能溢出画幅 —— 与 `gridGeometry` 同一套思路）。
 */
export function recapGeometry(width: number, height: number, columns = RECAP_COLS, rows = RECAP_ROWS): RecapGeometry {
  const gap = width * RECAP_GAP_RATIO;
  const rowGap = height * RECAP_ROW_GAP_RATIO;
  const contentW = width * RECAP_COL_RATIO;
  const textH = height * RECAP_TEXT_RATIO;
  const byColumns = (contentW - gap * (columns - 1)) / columns;
  const maxCardH = (height * RECAP_VIEW_H - rowGap * (rows - 1)) / rows;
  // 3:4 封面（宽 = 封面高 × 0.75）→ 反推卡片高，再与可用高取小
  const wanted = byColumns / 0.75 + textH;
  const cardH = Math.min(wanted, maxCardH);
  const coverH = cardH - textH;
  return { columns, rows, gap, rowGap, contentW, cardW: coverH * 0.75, cardH, coverH, textH };
}

/** 媒体序列 → 分页（每页 ≤ `perPage` 张，保持顺序；空输入 → 空数组）。 */
export function recapPages(list: PocMedia[], perPage = RECAP_PER_PAGE): PocMedia[][] {
  const size = Math.max(1, Math.floor(perPage));
  const pages: PocMedia[][] = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages;
}

/** 卡片的错峰入场时长（秒）：多一张多 0.025s，钳在 0.5~1.5s（36 张 ≈ 1.25s）。 */
export function recapEntranceSeconds(cards: number): number {
  return Math.max(0.5, Math.min(1.5, 0.35 + Math.max(0, cards) * 0.025));
}

/**
 * 每页的**停留**秒数：挂已有参数 `endingScrollSpeed`（0-100）当初"节奏档"。
 *
 * 为什么还是它：编辑器里已经有「结尾滚动速度」这个旋钮（银幕式结尾墙/名单在用），
 * 分页形态下它的含义自然变成「每页停多久」—— 快 = 停得短。
 * 锚点取**用户明说的 5s**：100（你当前的值）→ 5s，50 → 6.5s，0 → 8s（范围 5~8s，再快也看得清）。
 */
export function recapHoldSeconds(speed: number): number {
  const value = Number.isFinite(speed) ? Math.max(0, Math.min(100, speed)) : 100;
  return Math.max(5, Math.min(8, 8 - value * 0.03));
}

/** 每页时长（秒）= 错峰入场 + 停留。 */
export function recapPageSeconds(cards: number, speed: number): number {
  return recapEntranceSeconds(cards) + recapHoldSeconds(speed);
}

/** 一段回顾（一档）的总时长（秒）= 各页之和（页卡片数可能不同）。 */
export function recapSeconds(pages: PocMedia[][], speed: number): number {
  return pages.reduce((sum, page) => sum + recapPageSeconds(page.length, speed), 0);
}

/** 页内时间 → 第几页（`elapsed` 从本场景第 0 帧算起，单位秒；越界钳到最后一页）。 */
export function recapPageAt(pages: PocMedia[][], speed: number, elapsed: number): { index: number; local: number } {
  if (pages.length === 0) return { index: 0, local: 0 };
  let left = Math.max(0, elapsed);
  for (let index = 0; index < pages.length; index += 1) {
    const seconds = recapPageSeconds(pages[index].length, speed);
    if (left < seconds || index === pages.length - 1) return { index, local: left };
    left -= seconds;
  }
  return { index: pages.length - 1, local: 0 };
}
