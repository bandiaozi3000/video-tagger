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
