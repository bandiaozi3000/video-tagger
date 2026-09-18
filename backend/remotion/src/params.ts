import type { MultiMediaPocInput } from './types';
import { themeOfPreset, type TemplateStyle } from './theme';

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
}

export interface DetailShow {
  status: boolean;
  note: boolean;
  tag: boolean;
}

export interface RenderParams {
  // —— 文案 ——
  title: string;
  brandTitle: string;
  subtitle: string;
  intro: string;
  prologueTitle: string;
  endingTitle: string;
  endingText: string;

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
  /** BGM 基准增益（0-1）。 */
  bgmGain: number;
  /** 片段原声出现时 BGM 压低到的增益（0-1）。 */
  bgmDuckTo: number;
  /** ducking / 曲间交叉淡化时长（秒）。 */
  bgmFadeSec: number;

  // —— 动效档位（0-100 线格式，帧模型下映射为动画帧数 / spring 手感）——
  openingSpeed: number;
  endingScrollSpeed: number;

  // —— 时长（秒）——
  durations: Durations;

  // —— 输出 ——
  fps: number;
  width: number;
  height: number;

  // —— 分组与选择 ——
  /** `year` / `subcategory` / `collection` / 空（不分屏）。 */
  groupBy: string;
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

  coverSize: 50,
  detailShow: { status: true, note: true, tag: true },

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
  bgmGain: 0.45,
  bgmDuckTo: 0.16,
  bgmFadeSec: 0.6,

  openingSpeed: 50,
  endingScrollSpeed: 50,

  durations: { opening: 10, intro: 5, group: 5, detail: 10, ending: 5 },

  fps: 30,
  width: 1280,
  height: 720,

  groupBy: '',
  groupSort: 'date-desc',
  perScreen: 1,
  openingIds: [],
  preset: 'starlit',
};

/** 是否配置了全片背景层（bgColor 或 bgImages）。配置后各场景底色让位。 */
export function hasBackdrop(p: RenderParams): boolean {
  return p.bgColor.trim() !== '' || p.bgImages.length > 0;
}

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

    coverSize: clamp(p.coverSize ?? 50, 0, 100, 50),
    detailShow: {
      status: typeof show.status === 'boolean' ? show.status : true,
      note: typeof show.note === 'boolean' ? show.note : true,
      tag: typeof show.tag === 'boolean' ? show.tag : true,
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
    bgmGain: clamp(p.bgmGain ?? 0.45, 0, 1, 0.45),
    bgmDuckTo: clamp(p.bgmDuckTo ?? 0.16, 0, 1, 0.16),
    bgmFadeSec: clamp(p.bgmFadeSec ?? 0.6, 0, 3, 0.6),

    openingSpeed: clamp(p.openingSpeed, 0, 100, 50),
    endingScrollSpeed: clamp(p.endingScrollSpeed, 0, 100, 50),

    // Java normalizeDurations：opening 2-20 / intro 1-10 / group 1-10 / detail 3-15 / ending 1-10
    durations: {
      opening: clamp(d.opening, 2, 20, 10),
      intro: clamp(d.intro, 1, 10, 5),
      group: clamp(d.group, 1, 10, 5),
      detail: clamp(d.detail, 3, 15, 10),
      ending: clamp(d.ending, 1, 10, 5),
    },

    fps: clamp(p.fps, 1, 120, 30),
    width: clamp(p.width, 2, 7680, 1280),
    height: clamp(p.height, 2, 4320, 720),

    groupBy: str(p.groupBy),
    groupSort: str(p.groupSort) || 'date-desc',
    perScreen: clamp(p.perScreen ?? 1, 1, 10, 1),
    openingIds: Array.isArray(p.openingIds) ? p.openingIds.filter((v): v is number => typeof v === 'number') : [],
    preset: str(p.preset) || 'starlit',
  };
}
