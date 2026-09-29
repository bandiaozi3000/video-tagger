import type { MultiMediaPocInput } from './types';
import { themeOfPreset, type TemplateStyle } from './theme';
import { RECOMMEND_TIERS } from './tier';

/**
 * 推荐模板参数契约。
 *
 * 与旧模板的关系（设计规格 §4）：参数**只表达意图**（文案/时长/版式/背景/BGM/分组），
 * 不再 1:1 镜像旧 HTML 的 29 个占位符——`groupBy/groupSort/perScreen` 现在是**被消费**的
 * （分组章节页 + 每屏 N 部网格），不再是"透传但不生效"。
 *
 * clamp 区间仍与 Java `RecommendService` 对齐（`clamp` / `clampSpeed` / `normalizeCoverSize` /
 * `normalizeDurations`），两侧不得对同一参数给出两套语义。
 */

/**
 * BGM 播放范围（2026-09-20 用户：先要「只在开头和结尾」，再要「片名卡也顺带播」→ **多选集合**）。
 *
 * 取值：`all`（默认，铺满全片）/ `none`（不播）/ `opening,cards,ending` 的任意子集（逗号分隔）。
 * 解析与白名单在 `bgm.ts` 的 `parseBgmRange`（单一事实来源）。
 */
export type BgmRange = string;

export interface BgmTrack {
  name: string;
  /** 单曲时长（秒）。由 Java 探测后传入——BGM 条的时间轴与 ducking 都按它算。 */
  durationSec?: number;
  /** 音频素材相对路径（相对 `assetBaseUrl`）。缺省 → 只驱动 UI，不发声。 */
  assetPath?: string;
}

export interface Durations {
  opening: number;
  intro: number;
  group: number;
  detail: number;
  ending: number;
  /** 片名卡时长（秒）——**独立可调**（2026-09-20 用户：原来从详情推、封顶 2s，怎么拖都到不了）。 */
  title: number;
}

export interface DetailShow {
  status: boolean;
  note: boolean;
  tag: boolean;
  /** 结尾（落款）的开关（2026-09-20 用户：「显示序号 名称 年份即可，或者做成可配置」
   *  + 「把封面页当做可选项」）。 */
  endingWall?: boolean;
  /** 结尾名单：true = 翻页（动漫 ED 职员表那样一页一页换），false = 连续滚动。 */
  endingPaging?: boolean;
  endingList?: boolean;
  endingIndex?: boolean;
  endingYear?: boolean;
  endingStats?: boolean;
}

export interface RenderParams {
  // —— 文案 ——
  title: string;
  /**
   * 片段原声音量（0~100，0 = 全静音）。
   *
   * 用户 2026-09-20：「BGM 新增设置，可以全静音片段原声 以及 当前默认设置（即涉及到片段音量调小）」
   * → 一个旋钮同时覆盖「静音」(0) 与「调小」(1~99)；默认 100 = 维持现状。
   * 静音时 Remotion 侧也不再压 BGM（见 `cinema/plan.ts` 的 audioWindows）。
   */
  clipVolume: number;
  brandTitle: string;
  subtitle: string;
  intro: string;
  prologueTitle: string;
  endingTitle: string;
  endingText: string;
  /**
   * 推荐等级名单：**写死不做配置**（2026-09-26 用户拍板）。卡片视觉只按名次走（见 `src/tier.tsx`）。
   */
  tiers: string[];

  // —— 版式 ——
  /** 0-100（Java `normalizeCoverSize`），默认 50。 */
  coverSize: number;
  detailShow: DetailShow;

  // —— 全片背景层 ——
  bgColor: string;
  bgImages: string[];
  bgRotationSec: number;
  bgOpacity: number;
  bgBlur: number;
  bgBrightness: number;

  // —— BGM（音频在 Remotion 内建：多曲顺序播放 + 循环 + 原声 ducking）——
  bgmTracks: BgmTrack[];
  bgmScale: number;
  /** 0-100，模板里是百分比坐标（Java 默认 1）。 */
  bgmX: number;
  /** 0-100，模板里是百分比坐标（Java 默认 8）。 */
  bgmY: number;
  /** 转场音乐（片名卡专用，甲方案）：素材相对路径，空 = 不放。 */
  stingPath: string;
  /** 转场音乐音量（0-100，用户 2026-09-20 定 60）。 */
  stingVolume: number;

  /** BGM 基准增益（0-1）。 */
  bgmGain: number;
  /** 片段原声出现时 BGM 压低到的增益（0-1）。 */
  bgmDuckTo: number;
  /** ducking / 曲间交叉淡化时长（秒）。 */
  bgmFadeSec: number;
  /** BGM 播放范围（见 `BgmRange`：all / none / 逗号集合）。 */
  bgmRange: BgmRange;

  // —— 动效档位（0-100 线格式，帧模型下映射为动画帧数 / spring 手感）——
  openingSpeed: number;
  endingScrollSpeed: number;

  // —— 时长（秒）——
  durations: Durations;

  // —— 输出 ——
  fps: number;
  width: number;
  height: number;
  /**
   * 中景卡摆位的随机种子（编辑器「🎲 重排」写入草稿，随请求体一起到后端）。
   *
   * 为什么是种子而不是每帧 Math.random：Remotion 逐帧**并行**渲染，帧内随机会让同一帧
   * 在不同 chunk 里摆不同位置（拼接处跳位）、预览与成片也不一致。种子在渲染前定死，帧内只读它。
   */
  seed: number;

  // —— 分组与选择 ——
  /** `year` / `subcategory` / `collection` / 空（不分屏）。 */
  groupBy: string;
  /** 一级分组内**再按推荐等级分群**（用户 2026-09-26：「按年份分组后再支持按推荐等级接着分组」；默认开）。 */
  tierGroup: boolean;
  /** `date-asc` / `date-desc` / `none`。 */
  groupSort: string;
  /** 每屏展示 N 部（1 = 逐部资料卡；≥2 = 一屏 N 卡网格）。 */
  perScreen: number;
  /** 开场只显影这些媒体（空 = 全部）。 */
  openingIds: number[];
  /** 视觉主题预设 id（`theme.ts` 的 THEME_PRESETS；缺省/未知 → 基线外观）。 */
  preset: string;
}

export const DEFAULT_PARAMS: RenderParams = {
  title: '',
  brandTitle: '',
  subtitle: '',
  intro: '',
  prologueTitle: '',
  endingTitle: '',
  endingText: '',
  tiers: [...RECOMMEND_TIERS],

  coverSize: 50,
  detailShow: { status: true, note: true, tag: true, endingWall: true, endingPaging: false, endingList: true, endingIndex: true, endingYear: true, endingStats: false },

  bgColor: '',
  bgImages: [],
  bgRotationSec: 8,
  bgOpacity: 100,
  bgBlur: 0,
  bgBrightness: 50,

  bgmTracks: [],
  bgmScale: 100,
  bgmX: 1,
  bgmY: 8,
  stingPath: '',
  stingVolume: 60,
  bgmGain: 0.45,
  bgmDuckTo: 0.16,
  bgmFadeSec: 0.6,
  bgmRange: 'all',

  openingSpeed: 50,
  endingScrollSpeed: 50,

  durations: { opening: 10, intro: 5, group: 5, detail: 10, ending: 5, title: 2 },

  fps: 30,
  width: 1280,
  height: 720,
  clipVolume: 100,
  /** 摆位随机种子（编辑器「🎲 重排」写入；同一份草稿预览与成片一致）。0 = 固定布局。 */
  seed: 0,

  groupBy: '',
  tierGroup: true,
  groupSort: 'date-desc',
  perScreen: 1,
  openingIds: [],
  preset: 'starlit',
};

/** 是否配置了全片背景层（bgColor 或 bgImages）。配置后各场景底色让位。 */
export function hasBackdrop(p: RenderParams): boolean {
  return p.bgColor.trim() !== '' || p.bgImages.length > 0;
}

/**
 * 单段显示时长的**兑底**上限（秒）：仅防手滑（填 999999 会渲几十小时），不是产品限制。
 * 与 Java `RecommendService.normalizeDurations` 的上限保持一致（两处改一起改）。
 */
export const MAX_SEGMENT_SEC = 600;

const clamp = (v: unknown, min: number, max: number, dft: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dft;
  return Math.max(min, Math.min(max, n));
};

const str = (v: unknown, dft = ''): string => (typeof v === 'string' ? v : dft);

/** 动效档位 → 动画帧数（30fps 基准）：0 → 36 帧，50 → 22 帧，100 → 8 帧（下限 6）。 */
export function speedToFrames(speed: number, fps: number): number {
  const frames = Math.max(6, Math.round(36 - clamp(speed, 0, 100, 50) * 0.28));
  return Math.max(1, Math.round((frames / 30) * fps));
}

export function resolveStyle(input: MultiMediaPocInput): TemplateStyle {
  return input.style === 'clip' ? 'clip' : 'chapter';
}

/** 模板形态对应的主题（视觉令牌）。 */
export function resolveTheme(input: MultiMediaPocInput) {
  return themeOfPreset(resolveStyle(input), input.params?.preset);
}

export function resolveParams(raw?: Partial<RenderParams>, fallbackText?: { title?: string; subtitle?: string; intro?: string }): RenderParams {
  const p = raw ?? {};
  const d = (p.durations ?? {}) as Partial<Durations>;
  const show = (p.detailShow ?? {}) as Partial<DetailShow>;
  return {
    title: str(p.title) || str(fallbackText?.title),
    brandTitle: str(p.brandTitle),
    subtitle: str(p.subtitle) || str(fallbackText?.subtitle),
    intro: str(p.intro) || str(fallbackText?.intro),
    prologueTitle: str(p.prologueTitle),
    endingTitle: str(p.endingTitle),
    endingText: str(p.endingText),
    tiers: Array.isArray(p.tiers) && p.tiers.length > 0
      ? p.tiers.map((name) => String(name ?? '').trim()).filter(Boolean)
      : [...RECOMMEND_TIERS],

    coverSize: clamp(p.coverSize ?? 50, 0, 100, 50),
    detailShow: {
      status: typeof show.status === 'boolean' ? show.status : true,
      note: typeof show.note === 'boolean' ? show.note : true,
      tag: typeof show.tag === 'boolean' ? show.tag : true,
      // 结尾名单：默认开（用户点名要「序号 名称 年份」），统计行默认关（用户：「左侧文字不用太多」）
      endingWall: typeof show.endingWall === 'boolean' ? show.endingWall : true,
      endingPaging: show.endingPaging === true,
      endingList: typeof show.endingList === 'boolean' ? show.endingList : true,
      endingIndex: typeof show.endingIndex === 'boolean' ? show.endingIndex : true,
      endingYear: typeof show.endingYear === 'boolean' ? show.endingYear : true,
      endingStats: typeof show.endingStats === 'boolean' ? show.endingStats : false,
    },

    bgColor: str(p.bgColor),
    bgImages: Array.isArray(p.bgImages) ? p.bgImages.filter((v): v is string => typeof v === 'string') : [],
    bgRotationSec: clamp(p.bgRotationSec, 1, 60, 8),
    bgOpacity: clamp(p.bgOpacity, 0, 100, 100),
    bgBlur: clamp(p.bgBlur, 0, 100, 0),
    bgBrightness: clamp(p.bgBrightness, 0, 100, 50),

    bgmTracks: Array.isArray(p.bgmTracks)
      ? p.bgmTracks
          .filter((t) => t && typeof t.name === 'string' && t.name.trim() !== '')
          .map((t) => ({
            name: t.name,
            durationSec: typeof t.durationSec === 'number' && t.durationSec > 0 ? t.durationSec : undefined,
            assetPath: typeof t.assetPath === 'string' && t.assetPath.trim() !== '' ? t.assetPath : undefined,
          }))
      : [],
    bgmScale: clamp(p.bgmScale, 50, 200, 100),
    bgmX: clamp(p.bgmX, 0, 100, 1),
    bgmY: clamp(p.bgmY, 0, 100, 8),
    stingPath: typeof p.stingPath === 'string' ? p.stingPath : '',
    stingVolume: clamp(p.stingVolume ?? 60, 0, 100, 60),
    bgmGain: clamp(p.bgmGain ?? 0.45, 0, 1, 0.45),
    bgmDuckTo: clamp(p.bgmDuckTo ?? 0.16, 0, 1, 0.16),
    bgmFadeSec: clamp(p.bgmFadeSec ?? 0.6, 0, 3, 0.6),
    bgmRange: typeof p.bgmRange === 'string' && p.bgmRange.trim() !== '' ? p.bgmRange.trim().toLowerCase() : 'all',

    openingSpeed: clamp(p.openingSpeed, 0, 100, 50),
    endingScrollSpeed: clamp(p.endingScrollSpeed, 0, 100, 50),

    // 各段时长：**只留下限、上不封顶**（用户 2026-09-26：「显示时长无限制可自由发挥」）。
    // `MAX_SEGMENT_SEC` 是防手滑的兑底（填 999999 会让渲染跑几十小时），不是产品上限。
    durations: {
      opening: clamp(d.opening, 2, MAX_SEGMENT_SEC, 10),
      intro: clamp(d.intro, 1, MAX_SEGMENT_SEC, 5),
      group: clamp(d.group, 1, MAX_SEGMENT_SEC, 5),
      detail: clamp(d.detail, 3, MAX_SEGMENT_SEC, 10),
      ending: clamp(d.ending, 1, MAX_SEGMENT_SEC, 5),
      title: clamp(d.title, 1, MAX_SEGMENT_SEC, 2),
    },

    clipVolume: clamp(p.clipVolume ?? 100, 0, 100, 100),
    fps: clamp(p.fps, 1, 120, 30),
    width: clamp(p.width, 2, 7680, 1280),
    height: clamp(p.height, 2, 4320, 720),
    seed: Number.isFinite(p.seed) ? Math.trunc(p.seed as number) : 0,

    groupBy: str(p.groupBy),
    tierGroup: typeof p.tierGroup === 'boolean' ? p.tierGroup : true,
    groupSort: str(p.groupSort) || 'date-desc',
    perScreen: clamp(p.perScreen ?? 1, 1, 10, 1),
    openingIds: Array.isArray(p.openingIds) ? p.openingIds.filter((v): v is number => typeof v === 'number') : [],
    preset: str(p.preset) || 'starlit',
  };
}
