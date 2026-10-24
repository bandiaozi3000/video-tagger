/**
 * v0.32 第二部分（统计视频）参数契约与纯几何 —— **单一事实来源**。
 *
 * 为什么把边界校验放在这里：秒/年是用户**自由输入**的，Java 侧与前端都可能漏校验，
 * Remotion 这里必须自己兜住（`0` / 负数 / `"abc"` / 超大值 → 回落默认），
 * 否则总帧数算出 0 或负数会让渲染直接崩。
 */

export interface TrendPoint {
  year: number;
  count: number;
}

export interface TrendLine {
  name: string;
  color: string;
  points: TrendPoint[];
}

export interface TrendRefCard {
  title: string;
  coverUrl?: string | null;
  bgmScore?: number | null;
  bgmVotes?: number | null;
  personalRating?: number | null;
  clipCount?: number | null;
}

export interface TrendVideoInput {
  title?: string;
  chartType?: 'line' | 'bar';
  /** 画面风格（2026-10-04 用户：「我说的就是画面风格」）：light = 白底亮色（默认，照番剧排行视频那种），dark = 旧深色。 */
  theme?: 'light' | 'dark';
  secPerYear?: number;
  holdSec?: number;
  years?: number[];
  lines?: TrendLine[];
  refs?: TrendRefCard[];
  /** 每年「当年第一名」的封面（小圆头像用；Java 侧先下载再内联成 data URI）。 */
  yearCovers?: TrendYearCover[];
}

export interface TrendYearCover {
  year: number;
  url: string;
}

export const TREND_FPS = 30;
export const TREND_WIDTH = 1920;
export const TREND_HEIGHT = 1080;
export const MIN_SEC_PER_YEAR = 0.25;
export const MAX_SEC_PER_YEAR = 10;
export const DEFAULT_SEC_PER_YEAR = 1.5;
export const DEFAULT_HOLD_SEC = 3;

/** 秒/年：非有限值或越界一律回落默认（信任边界，必须校验）。 */
export function clampSecPerYear(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SEC_PER_YEAR;
  if (n < MIN_SEC_PER_YEAR) return MIN_SEC_PER_YEAR;
  if (n > MAX_SEC_PER_YEAR) return MAX_SEC_PER_YEAR;
  return n;
}

export function holdSecOf(input: TrendVideoInput): number {
  const n = Number(input?.holdSec);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_HOLD_SEC;
}

export function chartTypeOf(input: TrendVideoInput): 'line' | 'bar' {
  return input?.chartType === 'bar' ? 'bar' : 'line';
}

/** 横轴年份：去重升序；没有 years 时从各线的点里推。 */
export function yearsOf(input: TrendVideoInput): number[] {
  const set = new Set<number>();
  for (const y of input?.years || []) set.add(Number(y));
  if (set.size === 0) {
    for (const line of input?.lines || []) for (const p of line.points || []) set.add(Number(p.year));
  }
  return [...set].filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
}

export function countOf(line: TrendLine, year: number): number {
  const hit = (line?.points || []).find((p) => p.year === year);
  return hit ? hit.count : 0;
}

export function maxCountOf(input: TrendVideoInput): number {
  let max = 0;
  for (const line of input?.lines || []) for (const p of line.points || []) max = Math.max(max, p.count);
  return max;
}

/** 总帧数 = 年份数 × 秒/年 × fps + 结尾定格。 */
export function totalFrames(input: TrendVideoInput, fps: number = TREND_FPS): number {
  const n = yearsOf(input).length;
  const sec = clampSecPerYear(input?.secPerYear);
  return Math.max(fps, Math.round((n * sec + holdSecOf(input)) * fps));
}

/** 当前推进到第几年（小数）：0 → 第 1 年开头；n → 全部放完（进入定格）。 */
export function elapsedYearsAtFrame(frame: number, input: TrendVideoInput, fps: number = TREND_FPS): number {
  const n = yearsOf(input).length;
  if (n === 0) return 0;
  const perYearFrames = clampSecPerYear(input?.secPerYear) * fps;
  return Math.min(n, Math.max(0, frame / perYearFrames));
}

/** 当前大字号显示的年份下标（推进中显示 floor，定格显示末年）。 */
export function currentYearIndex(elapsed: number, total: number): number {
  if (total <= 0) return 0;
  if (elapsed >= total) return total - 1;
  return Math.min(total - 1, Math.floor(elapsed));
}

/** 是否已进入结尾定格（代表作出现的那一段）。 */
export function isHoldPhase(frame: number, input: TrendVideoInput, fps: number = TREND_FPS): boolean {
  const n = yearsOf(input).length;
  return frame >= n * clampSecPerYear(input?.secPerYear) * fps;
}

/** 折线「生长」：只暴露 elapsed 之前的点，末段按比例插一个点（渲染时逐帧延伸）。 */
export function revealedPoints(line: TrendLine, years: number[], elapsed: number): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = 0; i < years.length; i++) {
    const reveal = Math.min(1, Math.max(0, elapsed - i));
    if (reveal <= 0) break;
    const cur = countOf(line, years[i]);
    if (reveal >= 1) {
      out.push({ year: years[i], count: cur });
      continue;
    }
    const next = i + 1 < years.length ? countOf(line, years[i + 1]) : cur;
    out.push({ year: years[i], count: cur });
    out.push({ year: years[i] + reveal, count: cur + (next - cur) * reveal });
    break;
  }
  return out;
}

/** 柱状「生长」比例：第 i 根柱在 elapsed 时刻的高度系数 0..1。 */
export function barReveal(elapsed: number, index: number): number {
  return Math.min(1, Math.max(0, elapsed - index));
}

/** 画面风格（颜色 + 背景）。light 照番剧排行视频那种白底亮色；dark = 旧版。 */
export type TrendThemeName = 'light' | 'dark';

export interface TrendTheme {
  name: TrendThemeName;
  bg: string;
  text: string;
  dim: string;
  grid: string;
  axis: string;
  ring: string;
}

export const TREND_THEMES: Record<TrendThemeName, TrendTheme> = {
  light: { name: 'light', bg: '#f4f4f6', text: '#2b2b33', dim: '#8b8b96', grid: '#e3e3e9', axis: '#c6c6d0', ring: '#ffffff' },
  dark: { name: 'dark', bg: '#11111b', text: '#cdd6f4', dim: '#a6adc8', grid: '#313244', axis: '#45475a', ring: '#11111b' },
};

/** 系列配色：light = 柔和马克（截图里那种粉/绿/青/黄），dark = 旧的高饱和亮色。 */
export const TREND_PALETTES: Record<TrendThemeName, string[]> = {
  light: ['#f0a6b4', '#a6d3a0', '#7ec8e3', '#f2cf6b', '#c3a6e6'],
  dark: ['#cba6f7', '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8'],
};

export function themeOf(input: TrendVideoInput): TrendTheme {
  return TREND_THEMES[input?.theme === 'dark' ? 'dark' : 'light'];
}

/** 某年的「第一名封面」（没有就返回 null，图上就不贴头像）。 */
export function coverForYear(input: TrendVideoInput, year: number): string | null {
  const hit = (input?.yearCovers || []).find((c) => c.year === year);
  return hit && hit.url ? hit.url : null;
}

/** 顶部刻度标签的绘制高度（刻度数字写在顶线之上）。 */
export const TREND_TOP_LABEL_H = 30;
export interface TrendLayout {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// 版式（2026-10-04 换白底亮色时重排）：左侧留给竖排图例，顶部是年份轴线，右侧留白给大年份。
export const TREND_LAYOUT: TrendLayout = { left: 470, right: 1830, top: 320, bottom: 940 };

export function xAt(index: number, total: number, layout: TrendLayout = TREND_LAYOUT): number {
  if (total <= 1) return layout.left;
  return layout.left + ((layout.right - layout.left) * index) / (total - 1);
}

export function yAt(count: number, max: number, layout: TrendLayout = TREND_LAYOUT): number {
  if (max <= 0) return layout.bottom;
  const ratio = Math.max(0, Math.min(1, count / max));
  return layout.bottom - (layout.bottom - layout.top) * ratio;
}

/** 帧 → 秒（进度文案用）。 */
export function frameToSec(frame: number, fps: number = TREND_FPS): number {
  return frame / fps;
}
