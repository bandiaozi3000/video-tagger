/**
 * 推荐模板参数契约：与 Java `RecommendService.buildHtml()` 注入的 29 个占位符一一对应。
 *
 * 设计要点：
 * 1. 默认值与 clamp 区间**逐项对齐 Java**（`RecommendService.clamp/clampSpeed/normalizeCoverSize/normalizeDurations`），
 *    避免 Remotion 侧和 Java 侧对同一参数给出两套语义。
 * 2. 全部参数可选；缺省即 Java 默认值，因此旧的 4 份 POC 输入 JSON 不改也能跑。
 * 3. 文案类（title/subtitle/intro）优先取 `params`，回退到输入顶层的同名字段，兼容 POC 输入结构。
 * 4. `STRUCTURE_PENDING_KEYS` 里的参数依赖旧模板的「分组网格屏」，本切片只做占位与透传，
 *    尚未接线 → `scripts/verify-params.ts` 会如实报告为“未生效”。
 */

export interface BgmTrack {
  name: string;
  /** 预览用 data URI；正式链路 BGM 音频由 Java FFmpeg 混流，这里只驱动 BGM 条 UI。 */
  src?: string;
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

  // —— BGM 条 UI（音频本身由 Java FFmpeg 混流）——
  bgmTracks: BgmTrack[];
  bgmScale: number;
  /** 0-100，模板里是百分比坐标（Java 默认 1）。 */
  bgmX: number;
  /** 0-100，模板里是百分比坐标（Java 默认 8）。 */
  bgmY: number;

  // —— 动效速度（0-100 滑块）——
  // 语义重定义：旧模板 = 实时滚动像素/秒；帧模型下 = 动画用多少帧完成（见 speedToFrames）。
  openingSpeed: number;
  endingScrollSpeed: number;

  // —— 时长（秒）——
  durations: Durations;

  // —— 输出 ——
  fps: number;
  width: number;
  height: number;

  // —— 依赖「分组网格屏」结构，本切片未接线（占位透传）——
  groupBy: string;
  groupSort: string;
  perScreen: number;
  openingIds: number[];
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
};

/**
 * 按 2026-09-17 决策 B：本版不补「分组网格屏」，以下参数 **Remotion 侧不消费**。
 *
 * 注意这不是 TODO，也不是“未生效”：它们是**有意不实现**（见设计规格 §11.1）。
 * 接线时的硬要求：选择 Remotion 模板时，推荐向导里这四项控件必须隐藏/禁用，
 * 否则就是“调了没效果”的死开关；但在 `clip` 样式仍走旧链路期间，
 * 只能“按模板”隐藏，不能全局删控件。
 */
export const NOT_CONSUMED_KEYS: ReadonlyArray<keyof RenderParams> = [
  'groupBy',
  'groupSort',
  'perScreen',
];

/** 是否配置了全片背景层（bgColor 或 bgImages）。配置后各场景自带的底色让位给背景层。 */
export function hasBackdrop(p: RenderParams): boolean {
  return p.bgColor.trim() !== '' || p.bgImages.length > 0;
}

/** 开场封面大小系数：与旧模板 `COVER_COEF = 0.65 + coverSize/100` 一致。 */
export function chapterCoverCoef(p: RenderParams): number {
  return 0.65 + p.coverSize / 100;
}

/** 章节强调色（旧模板 GLOWS 轮转）。 */
export const CHAPTER_GLOWS = ['#4fc3f7', '#ff8fb8', '#a78bfa', '#ffd166', '#34d399'];
export function glowOf(index: number): string {
  return CHAPTER_GLOWS[((index % CHAPTER_GLOWS.length) + CHAPTER_GLOWS.length) % CHAPTER_GLOWS.length];
}

/** 旧模板背景层映射（逐字对齐，避免两侧两套换算）：
 *  brightness = 0.2 + BG_BRIGHTNESS * 0.016（50 → 1.0）
 *  blur       = BG_BLUR / 20 px
 */
export function chapterBgFilter(p: RenderParams): string {
  const parts: string[] = [];
  if (p.bgBrightness !== 50) parts.push(`brightness(${0.2 + p.bgBrightness * 0.016})`);
  if (p.bgBlur > 0) parts.push(`blur(${p.bgBlur / 20}px)`);
  return parts.join(' ');
}

const clamp = (v: unknown, min: number, max: number, dft: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dft;
  return Math.max(min, Math.min(max, n));
};

const str = (v: unknown, dft = ''): string => (typeof v === 'string' ? v : dft);

/** 速度滑块 → 动画帧数（30fps 基准）：0 → 36 帧，50 → 22 帧，100 → 8 帧（下限 6）。 */
export function speedToFrames(speed: number, fps: number): number {
  const frames = Math.max(6, Math.round(36 - clamp(speed, 0, 100, 50) * 0.28));
  return Math.max(1, Math.round((frames / 30) * fps));
}

/** 详情屏时长（秒）：旧模板 `storyHold = max(detailSec, Σ已知片段 + 2)` 只在滚筒结构下成立；
 *  本切片保持 POC 的「资料卡 + 每片段独立场景」结构，故资料卡时长就是 `detailSec`。 */
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

    // Java normalizeCoverSize：空/非法 → 50，否则 0-100
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

    bgmTracks: Array.isArray(p.bgmTracks) ? p.bgmTracks.filter((t) => t && typeof t.name === 'string' && t.name.trim() !== '') : [],
    bgmScale: clamp(p.bgmScale, 50, 200, 100),
    bgmX: clamp(p.bgmX, 0, 100, 1),
    bgmY: clamp(p.bgmY, 0, 100, 8),

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
  };
}
