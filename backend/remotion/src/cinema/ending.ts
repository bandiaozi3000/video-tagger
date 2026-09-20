import type { RenderParams } from '../params';
import type { PocMedia } from '../types';
import type { CinemaPlan } from './plan';
import { CINEMA_COLOR, CINEMA_FONT, cinemaStatLines } from './plan';

/**
 * 结尾（落款）的纯计算部分：**不依赖 Remotion**，好被单测盯住。
 *
 * 设计（2026-09-20 用户拍板「按你的建议来」+「左侧显示序号 名称 年份即可，或者做成可配置」）：
 *   · 右侧 4 列封面**纵向无缝滚动**（各列速度差 ±15% = 视差），纯图不带字；
 *   · 左侧：结局标题 → 文案 → 主色短线 →（可选统计行）→ **名单（序号 名称 年份）**，整块**向上滚动**（用户 2026-09-20：「文字不是滚动显示吗？」）；
 *   · 名单按行数自动分列（≤12 一行一列，≤24 两列，之上三列），最多 36 部后收尾。
 */

/**
 * 滚动速度映射（挂到已有参数 `endingScrollSpeed`，50 = 基准）：
 *   · 右墙 0.12 屏高/秒（用户 2026-09-20 选）→ 看得出在动又不催；
 *   · 左侧文字 0.05 屏高/秒（**必须比墙慢**：文字要读）。
 * 确定性、不用随机（Remotion 逐帧并行，随机会让同一帧在不同 chunk 里错位）。
 */
export function endingScrollBase(speed: number): { wall: number; list: number } {
  const scaled = 0.12 * ((speed > 0 ? speed : 50) / 50);
  return {
    wall: Math.min(0.3, Math.max(0.04, scaled)),
    list: Math.min(0.12, Math.max(0.015, scaled * (0.05 / 0.12))),
  };
}

export const WALL_SPEED_FACTORS = [0.85, 1, 1.15, 0.95];

/** 名单最多显示多少部。 */
export const LIST_MAX = 36;

/** 结尾左侧的开关（来自 `params.detailShow`，与「详情显示」同源，零后端改动）。 */
export interface EndingShow {
  /** 右侧滚动封面墙（用户 2026-09-20：「把封面页当做可选项」）。 */
  wall: boolean;
  /** 名单是「翻页」还是「滚动」（用户 2026-09-20：「做成可选项吧，滚动和翻页」）。 */
  paging: boolean;
  list: boolean;
  index: boolean;
  year: boolean;
  stats: boolean;
}

export function endingShow(params: RenderParams): EndingShow {
  const show = params.detailShow ?? {};
  return {
    wall: show.endingWall !== false,
    paging: show.endingPaging === true,
    list: show.endingList !== false,
    index: show.endingIndex !== false,
    year: show.endingYear !== false,
    stats: show.endingStats === true,
  };
}

/**
 * 名单行：**单列**，最多 36 部。
 *
 * 第一版按 12 行一列自动分列（那时候是「静态汇总」，不分列就会出画）；改成滚动字幕后它就**不合理**了
 * —— 用户 2026-09-20：「现在滚动你还两排有点不太合理」：片尾名单就是一行一行读的，
 * 而且整块本来就在滚，分列只会把阅读顺序打乱。
 */
export function endingListRows(media: PocMedia[]): PocMedia[] {
  return media.slice(0, LIST_MAX);
}

/**
 * 名单里的一行 → **三段**（序号 / 名称 / 年份）。
 *
 * 第一版拼成一个字符串（`1.名称　2003`），渲帧一看两段挤在一起、年份像粘在标题尾巴上（用户看片时
 * 一眼就看出不对）→ 拆成三段，由组件用列宽对齐（序号右对齐、名称弹性省略、年份右对齐），像片尾名单。
 */
export function endingListRow(media: PocMedia, order: number, show: EndingShow): { index: string; title: string; year: string } {
  return {
    index: show.index ? `${order}.` : '',
    title: media.title,
    year: show.year && media.year ? String(media.year) : '',
  };
}

/** 结尾的统计行（默认关闭）：`N 部 · M 集` / `年份区间 · K 个片段`，空字段自动省略。 */
export function endingStatLines(plan: CinemaPlan): string[] {
  const { stats } = plan;
  const head = stats.episodes > 0 ? `${stats.titles} 部 · ${stats.episodes} 集` : `${stats.titles} 部`;
  const tail = [
    cinemaStatLines(plan)[0] ?? '',
    stats.clips > 0 ? `${stats.clips} 个片段` : '',
  ].filter(Boolean).join(' · ');
  return [head, tail].filter(Boolean);
}

export const ENDING_COLOR = {
  line: 'rgba(255,255,255,.16)',
  ink: CINEMA_COLOR.ink,
  muted: CINEMA_COLOR.muted,
  dim: CINEMA_COLOR.dim,
  font: CINEMA_FONT,
};

/**
 * 名单一行占的画幅高（与组件一致）：字号 0.021h × 行高 1.75 = 0.0368h。
 *
 * 2026-09-20 从「0.018h × 1.35 = 0.0243h」放宽 —— 用户「结局文字排版看着太难受」，
 * 渲帧看下来主因就是行太密、行间无呼吸；放宽后一页行数变少（约 9 行/页），但**好读**。
 */
export const LIST_ROW_H = 0.021 * 1.75;

/** 名单块高（画幅比例）：只为算配速，不求精确（末尾留 0.02 余量）。 */
export function endingListHeight(rows: number): number {
  return rows * LIST_ROW_H + 0.02;
}

/**
 * 名单在视窗里每秒滚多少屏高。
 *
 * **只有名单滚**（用户 2026-09-20：「感谢观看统计这些固定内容别滚动，滚动的只有清单」），
 * 标题/文案/统计/BGM 都是固定的。视窗会把出画的行裁掉，所以配速只需要让**整份名单走完**：
 * （起点是名单顶部对齐视窗顶部，终点是最后一行刚从视窗上沿离开）。
 * 取「基准速度」与「按时长配速」的较大值，上限 0.14 防一闪而过。
 */
export function endingListSpeed(options: { speed: number; durationSeconds: number; rows: number }): number {
  const base = endingScrollBase(options.speed).list;
  const duration = Math.max(0.5, options.durationSeconds);
  // **不再设上限**：用户 2026-09-20「速度能根据结局显示时长做下调整，防止播放不全」。
  // 名单块高 / 可用时长 = 刚好走完的速度；名单长或结尾短时它自然会更快（宁快也别看不全）。
  return Math.max(base, endingListHeight(options.rows) / duration);
}

/** 名单开始滚/翻之前的停顿（秒）：用户 2026-09-20「滚动的话先暂停 1S 再滚动吧，不然开头来不及看」。 */
export const ENDING_START_PAUSE_SEC = 1;

/** 名单上方固定头的高度估算（画幅比例，只为算「一页放几行」）。 */
export function endingHeaderHeight(options: { hasTitle: boolean; hasText: boolean; hasStats: boolean }): number {
  // 名单上方的分组标签「收录」：字号 0.016 + 上边距 0.045
  return (options.hasTitle ? 0.072 : 0) + (options.hasText ? 0.048 : 0) + 0.043 + (options.hasStats ? 0.064 : 0) + 0.061;
}

/**
 * 左栏可用的总高（画幅比例）：`top 0.21h` 到 `bottom 0.17h`。
 *
 * 2026-09-20 用户「整体上提一点」：从 0.26h 提到 0.21h（上方本来空得太多），
 * 顺便把视窗加高 0.05h → 一页多放 1~2 行。
 */
export const ENDING_COLUMN_H = 0.83 - 0.21;

/**
 * 一页能放几行（翻页模式）：`(列高 - 固定头 - 名单上边距 0.04) / 行高`。
 *
 * 与滚动模式共用同一个视窗，所以两模式切换时不会出现「翻页放不下」的意外。
 */
export function endingRowsPerPage(options: { hasTitle: boolean; hasText: boolean; hasStats: boolean }): number {
  const windowH = ENDING_COLUMN_H - endingHeaderHeight(options) - 0.04;
  return Math.max(1, Math.floor(windowH / LIST_ROW_H));
}

/** 翻页：把名单切成若干页（每页 ≤ rowsPerPage 行，保持顺序）。 */
export function endingPages(rows: PocMedia[], rowsPerPage: number): PocMedia[][] {
  const size = Math.max(1, rowsPerPage);
  const pages: PocMedia[][] = [];
  for (let i = 0; i < rows.length; i += size) pages.push(rows.slice(i, i + size));
  return pages.length > 0 ? pages : [[]];
}

/**
 * 结尾名单的**播放时间账**（组合与编辑器共用，避免两边各算一遍）。
 *
 * 翻页：页数 / 每页几秒（每页都看得到 → 天然「播得完」）；
 * 滚动：速度（按名单块高与可用时长配速 → 天然「滚得完」）。
 * 快了给一句提醒（每页 < 1.2s、或滚动 > 0.25 屏/秒）→ 建议把结尾时长调大。
 */
export function endingPlayback(options: {
  durationSeconds: number;
  rows: number;
  paging: boolean;
  rowsPerPage: number;
  speed: number;
}): { pages: number; pageSeconds: number; scrollSpeed: number; warning: string | null } {
  const usable = Math.max(0.5, options.durationSeconds - ENDING_START_PAUSE_SEC);
  const pages = options.paging ? Math.max(1, Math.ceil(options.rows / Math.max(1, options.rowsPerPage))) : 1;
  const pageSeconds = usable / pages;
  const scrollSpeed = endingListSpeed({ speed: options.speed, durationSeconds: usable, rows: options.rows });
  const tooFast = options.paging ? pageSeconds < 1.2 : scrollSpeed > 0.25;
  const warning = tooFast
    ? `${options.rows} 部在 ${options.durationSeconds.toFixed(0)}s 里偏紧（`
      + (options.paging ? `每页 ${pageSeconds.toFixed(1)}s` : `${scrollSpeed.toFixed(2)} 屏/秒`)
      + '）→ 建议把「结尾时长」调大'
    : null;
  return { pages, pageSeconds, scrollSpeed, warning };
}

/** 第 `pageIndex` 页占据哪一段（秒）：起点是 `ENDING_START_PAUSE_SEC`，各页均分剩余时长。 */
export function endingPageSlice(options: { durationSeconds: number; pageCount: number }): { start: number; slice: number } {
  const usable = Math.max(0.5, options.durationSeconds - ENDING_START_PAUSE_SEC);
  return { start: ENDING_START_PAUSE_SEC, slice: usable / Math.max(1, options.pageCount) };
}

export function endingListSpeedPaused(options: { speed: number; durationSeconds: number; rows: number }): number {
  const usable = Math.max(0.5, options.durationSeconds - ENDING_START_PAUSE_SEC);
  return endingListSpeed({ speed: options.speed, durationSeconds: usable, rows: options.rows });
}
