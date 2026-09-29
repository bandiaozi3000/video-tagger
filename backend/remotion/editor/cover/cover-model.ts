/**
 * 封面工坊的参数模型（2026-09-29）。
 *
 * **为什么单独一个模块**：版式清单、张数降级、安全区校验、参数钳位都是纯函数，
 * 既给画布用、也给 UI 用，还能被单测盯住（`cover-model.test.ts`）——画布本身不好测。
 *
 * 与出图的关系：这里只描述参数；真正的视觉在 `CoverCanvas.tsx` + `cover-css.ts`。
 * 导出时把这棵 DOM 与同一份 CSS 交给后端 Chrome 截图（`CoverRenderService`），
 * 所以**预览与成品是同一份代码**，不存在"两边各写一遍版式"的漂移。
 */

/** 文字处理（用户 2026-09-29 选定 R8 双层重影为默认）。 */
export type CoverEffect = 'plain' | 'r8' | 'vertical';

/** 九宫锚点。 */
export type CoverAnchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'mid-left' | 'center' | 'mid-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type CoverAlign = 'left' | 'center' | 'right';

export interface CoverConfig {
  /** 版式 id（LAYOUTS 的 id） */
  layout: string;
  /** 参与排布的片段 id（顺序 = 排布顺序）。**不入模板**：模板只存参数，片段每次重勾 */
  frames: number[];
  title: string;
  subtitle: string;
  anchor: CoverAnchor;
  align: CoverAlign;
  /** 位置微调（px，画布坐标；±200 内，超出会被 `sanitizeCover` 钳住） */
  offsetX: number;
  offsetY: number;
  /** 主标题字号（px；88~150） */
  titleSize: number;
  effect: CoverEffect;
  /** R8 重影偏移（px；0 = 关掉重影，>6 缩略图会发虚） */
  ghostOffset: number;
  /** 强调色：纯色栏底色 / R8 重影色 / 色带色。默认取自实测素材主色。 */
  accent: string;
  /** 副标题在主标题下方（默认上方） */
  subtitleBelow: boolean;
}

/** 一段可用的素材（片段封面）。 */
export interface CoverFrame {
  clipId: number;
  mediaId: number;
  mediaTitle: string;
  clipTitle: string;
  /** 画布里的封面地址（`/covers/clip/{id}.jpg`；导出时后端自动升级到 `-xl`） */
  url: string;
}

export interface CoverLayout {
  id: string;
  name: string;
  /** 需要的张数；超出会按"推荐等级 → 勾选顺序"截断，不足会降级到别的版式 */
  needs: number;
  group: '基础' | '网格' | '非网格';
  hint: string;
  /** 标题单独占一端、副标题占另一端（T10 上下夹字） */
  splitText?: boolean;
}

/**
 * 版式清单（20 套）。
 *
 * **不含**「破格出血 BLEED」（要抠图，用户 2026-09-29 拍板先不做）
 * 与「分镜条 STORYBOARD」（要同一片段的 4 个时刻，而素材只有片段封面 —— 4 张会是同一张）。
 */
export const LAYOUTS: CoverLayout[] = [
  { id: 'T04', name: '单帧满幅', needs: 1, group: '基础', hint: '一张图铺满，最稳' },
  { id: 'T08', name: '左字右图', needs: 1, group: '网格', hint: '左侧纯色栏放字，缩略图最清楚' },
  { id: 'T10', name: '上下夹字', needs: 1, group: '网格', hint: '标题在上、副标题在下，中间画面完整', splitText: true },
  { id: 'T15', name: '文字主导', needs: 1, group: '非网格', hint: '文字占主体，图退成右侧一条' },
  { id: 'T16', name: '取景窗', needs: 1, group: '非网格', hint: '整幅虚化 + 中间清晰窗口' },
  { id: 'T18', name: '圆形取景', needs: 1, group: '非网格', hint: '圆形切人物' },
  { id: 'T12', name: '二联', needs: 2, group: '网格', hint: '两张各占一半' },
  { id: 'T13', name: '斜切', needs: 2, group: '网格', hint: '一条硬斜边，无光缝' },
  { id: 'T17', name: '双重曝光', needs: 2, group: '非网格', hint: '两张叠化（screen），讲情绪' },
  { id: 'T03', name: '三条', needs: 3, group: '基础', hint: '三张等高横条' },
  { id: 'T11', name: '三竖条', needs: 3, group: '网格', hint: '三张竖裁并排' },
  { id: 'T20', name: '散落相纸', needs: 3, group: '非网格', hint: '带白边相纸轻微旋转叠放' },
  { id: 'T01', name: '四格', needs: 4, group: '基础', hint: '2×2 满幅，最通用' },
  { id: 'T02', name: '一主三辅', needs: 4, group: '基础', hint: '左主图 + 右三张小图' },
  { id: 'T06', name: '四竖条', needs: 4, group: '网格', hint: '四张竖裁并排' },
  { id: 'T09', name: '错位四格', needs: 4, group: '网格', hint: '两行的分割线错开' },
  { id: 'T21', name: '斜置网格', needs: 4, group: '非网格', hint: '整块网格旋转，超出画布' },
  { id: 'T05', name: '五格', needs: 5, group: '网格', hint: '左大满高 + 右四小' },
  { id: 'T19', name: '漫画分格', needs: 5, group: '非网格', hint: '不等高错位 + 白色分格线' },
  { id: 'T07', name: '九宫格', needs: 9, group: '网格', hint: '3×3；缩略图下只作"很多部"的暗示' },
];

export function layoutById(id: string): CoverLayout {
  return LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];
}

/** 按张数自动选（数量正好时的首选；其他数量走 `resolveLayout` 的降级）。 */
const AUTO_PICK: Record<number, string> = { 1: 'T04', 2: 'T12', 3: 'T11', 4: 'T01', 5: 'T05', 9: 'T07' };

export function pickLayout(count: number): string {
  return AUTO_PICK[count] ?? resolveLayout('T07', count).layout.id;
}

/**
 * 版式降级：**张数不够就换一个装得下的**（不留空框）。
 *
 * 选择规则：同组优先 → 需要张数最多（信息密度最大）→ 清单顺序。
 */
export function resolveLayout(id: string, count: number): { layout: CoverLayout; degraded: boolean } {
  const want = layoutById(id);
  if (count >= want.needs) {
    return { layout: want, degraded: false };
  }
  const usable = LAYOUTS.filter((layout) => layout.needs <= Math.max(count, 1));
  if (usable.length === 0) {
    return { layout: want, degraded: true };
  }
  const sameGroup = usable.filter((layout) => layout.group === want.group);
  const pool = sameGroup.length > 0 ? sameGroup : usable;
  const best = [...pool].sort((a, b) => b.needs - a.needs || LAYOUTS.indexOf(a) - LAYOUTS.indexOf(b))[0];
  return { layout: best, degraded: true };
}

/** 参与排布的片段：多了就截断（保持用户勾选顺序）。 */
export function framesFor(layout: CoverLayout, frames: CoverFrame[]): CoverFrame[] {
  return frames.slice(0, layout.needs);
}

export const TITLE_SIZE_MIN = 88;
export const TITLE_SIZE_MAX = 150;

export function sanitizeCover(config: CoverConfig): CoverConfig {
  const clamp = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  return {
    ...config,
    frames: Array.from(new Set(config.frames ?? [])),
    title: config.title ?? '',
    subtitle: config.subtitle ?? '',
    offsetX: clamp(config.offsetX, -200, 200, 0),
    offsetY: clamp(config.offsetY, -200, 200, 0),
    titleSize: clamp(config.titleSize, TITLE_SIZE_MIN, TITLE_SIZE_MAX, 104),
    ghostOffset: clamp(config.ghostOffset, 0, 8, 4),
    accent: /^#[0-9a-fA-F]{6}$/.test(config.accent ?? '') ? config.accent : '#831F36',
  };
}

export function defaultCoverConfig(): CoverConfig {
  return {
    layout: 'T04',
    frames: [],
    title: '',
    subtitle: '',
    anchor: 'bottom-left',
    align: 'left',
    offsetX: 0,
    offsetY: 0,
    titleSize: 104,
    effect: 'r8',
    ghostOffset: 4,
    accent: '#831F36',
    subtitleBelow: false,
  };
}

/**
 * 老草稿/模板回填：字段缺失用默认补（`cover` 是对象，必须逐键合并，不能整个替换）。
 */
export function mergeCoverConfig(stored: Partial<CoverConfig> | null | undefined): CoverConfig {
  return sanitizeCover({ ...defaultCoverConfig(), ...(stored ?? {}) });
}

export interface CoverWarning {
  level: 'warn' | 'info';
  text: string;
}

/**
 * 安全区校验（依据见设计规格 §5）：
 *  - 右下 400×150 = B 站时长角标 / 水印
 *  - 右上 = 热门 / 联合投稿实心遮罩
 *  - 左右各 ~160px 会被 16:10 居中裁剪吃掉 → 文字左边距下限 200px（画布样式已保证）
 */
export function coverWarnings(config: CoverConfig): CoverWarning[] {
  const out: CoverWarning[] = [];
  const atBottom = config.anchor.startsWith('bottom');
  const atTop = config.anchor.startsWith('top');
  const onRight = config.anchor.endsWith('right') || config.align === 'right';
  const onLeft = config.anchor.endsWith('left') || config.align === 'left';

  if (atBottom && onRight) {
    out.push({ level: 'warn', text: '右下 400×150 是 B 站时长角标位，关键文字建议移开' });
  }
  if (atTop && onRight) {
    out.push({ level: 'warn', text: '右上会被热门/联合投稿遮罩压住' });
  }
  if (onRight && config.offsetX > 0) {
    out.push({ level: 'warn', text: `再右移 ${config.offsetX}px 会越过 16:10 裁剪线（B 站主页会切掉左右各 ~160px）` });
  }
  if (onLeft && config.offsetX < 0) {
    out.push({ level: 'warn', text: `再左移 ${-config.offsetX}px 会越过 16:10 裁剪线` });
  }
  if (config.effect === 'r8' && config.ghostOffset > 6) {
    out.push({ level: 'info', text: `重影偏移 ${config.ghostOffset}px 在 320px 缩略图下会发虚（≤4px 更稳）` });
  }
  if (config.effect === 'vertical' && config.title.replace(/\s/g, '').length > 10) {
    out.push({ level: 'info', text: '竖排建议标题不超过 10 字' });
  }
  return out;
}

/** 参数指纹：变了才重新出图（预览是实时 DOM，用它决定是否需要重挂载）。 */
export function coverSignature(config: CoverConfig): string {
  return JSON.stringify([
    config.layout, config.frames, config.title, config.subtitle, config.anchor, config.align,
    config.offsetX, config.offsetY, config.titleSize, config.effect, config.ghostOffset,
    config.accent, config.subtitleBelow,
  ]);
}
