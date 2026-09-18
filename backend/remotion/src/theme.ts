/**
 * 视觉语言令牌 —— 唯一风格来源。
 *
 * 设计基线（设计规格 §4）：旧模板只提供"视觉语言"，不提供结构/时间轴/交互。
 * 因此这里用**字面常量**固化色板、发光、玻璃卡、渐变标题、大序号、胶囊、装饰层强度与
 * 版式比例，不再有"整页 CSS 机械提取"这一层。换风格只改本文件 + 各场景的排布比例。
 *
 * 两套模板形态共用同一组键（`chapter` 叙事型 / `clip` 片段型），
 * 差异仅在装饰强度、信息密度与场景序列（见 `scene-plan.ts`）。
 */

export type TemplateStyle = 'chapter' | 'clip';

export interface Theme {
  id: TemplateStyle;
  /** 画布底色（全片背景层的兜底色）。 */
  canvas: string;
  /** 画布渐层（radial 光斑）——纯静态，不做动画。 */
  canvasGlow: string;
  /** 顶部发光细线（静态渐变，透明度由帧微调）。 */
  topLine: string | null;
  colors: {
    ink: string;
    muted: string;
    faint: string;
    line: string;
    card: string;
    sky: string;
    blue: string;
    pink: string;
    gold: string;
    green: string;
  };
  /** 章节强调色轮转（旧模板 GLOWS）。 */
  glows: string[];
  font: { display: string; body: string; mono: string };
  /** 玻璃卡面：底渐变 + 亮边 + 外发光。 */
  glass: { background: string; border: string; shadow: string; radius: number; blur: number };
  /** 装饰层强度：0 = 关闭。 */
  decor: { stars: number; clouds: number; starOpacity: number; cloudOpacity: number; topLineOpacity: number };
  /** 版式比例（全部相对画幅宽/高，720P 与 4K 同比例成立）。 */
  layout: {
    contentRatio: number;      // 内容区宽度占画幅宽比例
    posterColumnRatio: number; // 资料卡海报列占内容区比例
    posterAspect: number;      // 海报宽/高
    posterMaxHeightRatio: number;
    gapRatio: number;
    cardRatio: number;         // 开场封面卡宽占画幅高比例
    cardAspect: number;        // 开场封面卡宽/高
    numberRatio: number;       // 大序号字号占画幅高比例
    titleRatio: number;        // 场景主标题字号占画幅高比例
    bodyRatio: number;         // 正文字号占画幅高比例
    chipRatio: number;         // 胶囊字号占画幅高比例
    wallRatio: number;         // 结尾封面墙图片高度占画幅高比例
    gridGapRatio: number;
  };
  /** 入场手感：spring 阻尼/频率（帧模型下不再有 CSS 缓动）。 */
  motion: { damping: number; stiffness: number; mass: number; staggerSec: number };
}

const FONT = {
  display: '"Yuanti SC","YouYuan","PingFang SC","Microsoft YaHei UI",system-ui,sans-serif',
  body: '"PingFang SC","Microsoft YaHei",system-ui,sans-serif',
  mono: '"Cascadia Code",Consolas,monospace',
};

const COLORS = {
  ink: '#f5f4fb',
  muted: '#aaa9bf',
  faint: '#6d6d85',
  line: 'rgba(255,255,255,.12)',
  card: 'rgba(18,16,32,.55)',
  sky: '#4fc3f7',
  blue: '#6f8bff',
  pink: '#ff8fb8',
  gold: '#ffd166',
  green: '#34d399',
};

const GLOWS = [COLORS.sky, COLORS.pink, '#a78bfa', COLORS.gold, COLORS.green];

/** 章节叙事型：星云装饰齐备、暗房开场、信息留白宽。 */
export const CHAPTER_THEME: Theme = {
  id: 'chapter',
  canvas: '#08070f',
  canvasGlow:
    'radial-gradient(900px 560px at 76% -10%, rgba(79,195,247,.18), transparent 62%),'
    + 'radial-gradient(700px 520px at -12% 44%, rgba(255,143,184,.10), transparent 60%),'
    + 'linear-gradient(150deg,#07060f,#0a0a16 48%,#090812)',
  topLine: `linear-gradient(90deg,transparent,${COLORS.sky},${COLORS.blue},${COLORS.pink},transparent)`,
  colors: COLORS,
  glows: GLOWS,
  font: FONT,
  glass: {
    background: 'linear-gradient(160deg, rgba(18,15,34,.78), rgba(10,8,22,.62))',
    border: '1px solid rgba(130,160,255,.24)',
    shadow: '0 0 44px rgba(79,195,247,.28), inset 0 0 34px rgba(111,139,255,.08)',
    radius: 26,
    blur: 8,
  },
  decor: { stars: 70, clouds: 6, starOpacity: 1, cloudOpacity: 1, topLineOpacity: 1 },
  layout: {
    contentRatio: 0.86,
    posterColumnRatio: 0.42,
    posterAspect: 3 / 4,
    posterMaxHeightRatio: 0.62,
    gapRatio: 0.05,
    cardRatio: 0.26,
    cardAspect: 190 / 270,
    numberRatio: 0.15,
    titleRatio: 0.062,
    bodyRatio: 0.026,
    chipRatio: 0.021,
    wallRatio: 0.14,
    gridGapRatio: 0.025,
  },
  motion: { damping: 200, stiffness: 100, mass: 1, staggerSec: 0.12 },
};

/** 片段型：装饰克制（无星云/无顶部发光线）、信息更密、海报更小。 */
export const CLIP_THEME: Theme = {
  ...CHAPTER_THEME,
  id: 'clip',
  canvas: '#080912',
  canvasGlow:
    'radial-gradient(820px 520px at 72% -8%, rgba(82,226,245,.16), transparent 60%),'
    + 'radial-gradient(640px 460px at -10% 46%, rgba(255,91,154,.10), transparent 58%),'
    + 'linear-gradient(150deg,#070811,#0a0d19 48%,#090a14)',
  topLine: null,
  glass: {
    background: 'linear-gradient(150deg, rgba(18,21,42,.82), rgba(11,13,26,.66))',
    border: '1px solid rgba(82,226,245,.22)',
    shadow: '0 18px 46px rgba(5,8,30,.55)',
    radius: 18,
    blur: 6,
  },
  decor: { stars: 40, clouds: 3, starOpacity: 0.6, cloudOpacity: 0.55, topLineOpacity: 0 },
  layout: {
    ...CHAPTER_THEME.layout,
    contentRatio: 0.9,
    posterColumnRatio: 0.32,
    posterMaxHeightRatio: 0.5,
    numberRatio: 0.12,
    titleRatio: 0.055,
    bodyRatio: 0.024,
    gridGapRatio: 0.018,
  },
  motion: { damping: 180, stiffness: 110, mass: 0.9, staggerSec: 0.09 },
};

export const themeOf = (style: TemplateStyle): Theme => (style === 'clip' ? CLIP_THEME : CHAPTER_THEME);

/** 主题预设：令牌覆盖（一套 = 一个 Partial<Theme>）。`starlit` 为空覆盖 = 与今天外观完全一致。 */
export interface ThemePreset {
  id: string;
  name: string;
  /** 一句话说明（编辑器里悬停可见）。 */
  note: string;
  tokens: DeepPartial<Theme>;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const PRESETS: ThemePreset[] = [
  {
    id: 'starlit',
    name: '星云暗房（现状）',
    note: '与当前成片一致的基线外观：星场 + 云光 + 顶部发光线',
    tokens: {},
  },
  {
    id: 'cyan-rail',
    name: '冷青光轨',
    note: '冷青主色、装饰收敛、节奏略快',
    tokens: {
      canvas: '#050a10',
      canvasGlow:
        'radial-gradient(880px 540px at 74% -8%, rgba(82,226,245,.20), transparent 62%),'
        + 'radial-gradient(680px 500px at -12% 46%, rgba(127,227,201,.10), transparent 60%),'
        + 'linear-gradient(150deg,#04080e,#071019 48%,#050a11)',
      topLine: 'linear-gradient(90deg,transparent,#52e2f5,#3aa8d0,#7fe3c9,transparent)',
      colors: {
        ink: '#eef7fa', muted: '#9fb6c2', faint: '#5e7684', line: 'rgba(120,220,240,.14)',
        card: 'rgba(12,26,32,.55)', sky: '#52e2f5', blue: '#3aa8d0', pink: '#7fe3c9',
        gold: '#d8f0a0', green: '#52e2a0',
      },
      glows: ['#52e2f5', '#3aa8d0', '#7fe3c9', '#d8f0a0', '#9ad6ff'],
      glass: {
        background: 'linear-gradient(155deg, rgba(10,26,34,.8), rgba(6,16,22,.66))',
        border: '1px solid rgba(120,220,240,.22)',
        shadow: '0 0 40px rgba(82,226,245,.22), inset 0 0 30px rgba(58,168,208,.08)',
        radius: 22, blur: 7,
      },
      decor: { stars: 42, clouds: 2, starOpacity: 0.75, cloudOpacity: 0.5, topLineOpacity: 0.85 },
      layout: { contentRatio: 0.88, posterMaxHeightRatio: 0.58, numberRatio: 0.13 },
      motion: { damping: 170, stiffness: 120, mass: 0.9, staggerSec: 0.1 },
    },
  },
  {
    id: 'minimal-ink',
    name: '极简墨白',
    note: '无星场无云光，平玻璃卡面，留白更大',
    tokens: {
      canvas: '#0b0b0d',
      canvasGlow: 'linear-gradient(150deg,#0b0b0d,#101013 52%,#0b0b0d)',
      topLine: null,
      colors: {
        ink: '#f2f2f4', muted: '#a7a7ae', faint: '#6a6a72', line: 'rgba(255,255,255,.1)',
        card: 'rgba(20,20,22,.6)', sky: '#dcdce4', blue: '#b8b8c4', pink: '#e0c9a6',
        gold: '#e6c98a', green: '#9fbf9f',
      },
      glows: ['#dcdce4', '#b8b8c4', '#e0c9a6', '#e6c98a', '#9fbf9f'],
      glass: {
        background: 'linear-gradient(160deg, rgba(24,24,27,.86), rgba(14,14,16,.78))',
        border: '1px solid rgba(255,255,255,.12)',
        shadow: '0 18px 40px rgba(0,0,0,.55)',
        radius: 14, blur: 4,
      },
      decor: { stars: 0, clouds: 0, starOpacity: 0, cloudOpacity: 0, topLineOpacity: 0 },
      layout: { contentRatio: 0.9, posterColumnRatio: 0.4, numberRatio: 0.11, titleRatio: 0.056 },
      motion: { damping: 200, stiffness: 90, mass: 1, staggerSec: 0.14 },
    },
  },
  {
    id: 'ember-dusk',
    name: '暖霞余晖',
    note: '暖橙粉调，云光更明显，标题板偏暖',
    tokens: {
      canvas: '#120a0c',
      canvasGlow:
        'radial-gradient(900px 560px at 76% -10%, rgba(255,178,122,.20), transparent 62%),'
        + 'radial-gradient(700px 520px at -12% 44%, rgba(255,111,145,.12), transparent 60%),'
        + 'linear-gradient(150deg,#100809,#170d10 48%,#120a0c)',
      topLine: 'linear-gradient(90deg,transparent,#ffb27a,#ff6f91,#ffd166,transparent)',
      colors: {
        ink: '#fdf1ea', muted: '#c9a99c', faint: '#8b6f65', line: 'rgba(255,180,140,.14)',
        card: 'rgba(34,18,20,.6)', sky: '#ffb27a', blue: '#ff8fb8', pink: '#ff6f91',
        gold: '#ffd166', green: '#c9e08a',
      },
      glows: ['#ffb27a', '#ff6f91', '#ff9d6f', '#ffd166', '#ffc9a0'],
      glass: {
        background: 'linear-gradient(160deg, rgba(40,20,22,.8), rgba(24,12,14,.66))',
        border: '1px solid rgba(255,180,140,.24)',
        shadow: '0 0 44px rgba(255,143,113,.26), inset 0 0 34px rgba(255,180,140,.08)',
        radius: 26, blur: 8,
      },
      decor: { stars: 48, clouds: 7, starOpacity: 0.9, cloudOpacity: 0.8, topLineOpacity: 1 },
      layout: { posterMaxHeightRatio: 0.6, numberRatio: 0.14 },
      motion: { damping: 190, stiffness: 105, mass: 0.95, staggerSec: 0.12 },
    },
  },
];

export const THEME_PRESETS = PRESETS;
export const DEFAULT_PRESET_ID = 'starlit';

/** 浅层合并一套预设（子对象逐层合并，不整块替换）。 */
export function themeOfPreset(style: TemplateStyle, presetId?: string | null): Theme {
  const base = themeOf(style);
  const preset = PRESETS.find((item) => item.id === presetId);
  if (!preset || Object.keys(preset.tokens).length === 0) return base;
  const o = preset.tokens;
  return {
    ...base,
    ...o,
    colors: { ...base.colors, ...(o.colors ?? {}) },
    glows: (o.glows as string[] | undefined) ?? base.glows,
    font: { ...base.font, ...(o.font ?? {}) },
    glass: { ...base.glass, ...(o.glass ?? {}) },
    decor: { ...base.decor, ...(o.decor ?? {}) },
    layout: { ...base.layout, ...(o.layout ?? {}) },
    motion: { ...base.motion, ...(o.motion ?? {}) },
  };
}

/** 章节强调色（按媒体序号轮转）。 */
export function glowOf(theme: Theme, index: number): string {
  const list = theme.glows;
  return list[((index % list.length) + list.length) % list.length];
}

/** 开场封面大小系数（沿用旧模板语义 `0.65 + coverSize/100`）。 */
export function coverCoef(coverSize: number): number {
  return 0.65 + coverSize / 100;
}

/** 背景层滤镜（沿用旧模板映射：brightness = 0.2 + v*0.016、blur = v/20 px）。 */
export function bgFilter(bgBrightness: number, bgBlur: number): string {
  const parts: string[] = [];
  if (bgBrightness !== 50) parts.push(`brightness(${0.2 + bgBrightness * 0.016})`);
  if (bgBlur > 0) parts.push(`blur(${bgBlur / 20}px)`);
  return parts.join(' ');
}
