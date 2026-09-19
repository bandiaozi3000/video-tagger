import type { MultiMediaPocInput, PocMedia } from '../types';
import type { RenderParams } from '../params';
import { resolveParams } from '../params';

/**
 * 「银幕式」模板（v0.29 期间新增，与旧 chapter / clip **并存**）的视觉令牌与场景计划。
 *
 * 设计来源：用户 2026-09-19 审定的结构稿
 * `docs/design/2026-09-19-recommend-video-structure.html`：
 *   每一部 = 一个节拍单元 —— 片名卡（1.5s）→ 画面/片段（6–9s）→ 硬切进下一部；
 *   信息不再独立占屏，压成画面上的 lower-third；同一部的多个片段之间不插卡（硬切连播）。
 *
 * 与旧模板的硬差异（这些都是用户明确要求的"砍掉"）：
 *   · 无玻璃、无发光、无圆角、无胶囊、无描边空心数字、无等宽英文小标；
 *   · 无 Topbar / Trackbar / BgmBadge 等常驻 chrome（只在片尾一条落款）；
 *   · 单色系 + **每部一个从封面实测提取的强调色**；字体走真字重（普惠体 115 Black / Mona-Sans）。
 */

export const CINEMA_FONT = {
  /** 展示字体：真字重黑体（本机实测命中；旧版用的宋体没有 900 字重，会被浏览器合成伪粗 → 廉价感来源）。 */
  display: '"阿里巴巴普惠体 2 115 Black","阿里巴巴普惠体 2 105 Heavy","阿里巴巴普惠体 2 85 Bold","PingFang SC",sans-serif',
  /** 数字/西文：现代几何无衬线。 */
  num: '"Mona-Sans","阿里巴巴普惠体 2 65 Medium","PingFang SC",sans-serif',
  body: '"阿里巴巴普惠体 2 55 Regular","PingFang SC","Microsoft YaHei",sans-serif',
};

export const CINEMA_COLOR = {
  canvas: '#0b0b0c',
  ink: '#f2f1ee',
  muted: '#8a8a8f',
  dim: '#55555a',
  line: 'rgba(255,255,255,.14)',
};

/** 版式比例（全部相对画幅高/宽，720P 与 4K 同比例成立）。 */
export const CINEMA_MOTION = { damping: 200, stiffness: 90, mass: 1 } as const;

export const CINEMA_LAYOUT = {
  safeX: 0.078,            // 左右安全边（1280 下约 100px）
  ruleLength: 0.05,        // 强调细线长度（占画幅宽）
  titleRatio: 0.128,       // 片名卡主标题
  titleWideRatio: 0.133,   // 开屏/钩子标题
  hookQuoteRatio: 0.056,   // 钩子那一句
  coverTitleRatio: 0.083,  // 封面镜头的主标题
  lowerQuoteRatio: 0.042,  // lower-third 推荐语（静音可读）
  lowerNameRatio: 0.022,   // lower-third 片名行
  metaRatio: 0.024,        // 年份 · 集数 · 类型
  numRatio: 0.061,         // 片名卡编号
  slateNumRatio: 0.144,    // 片单卡大数字
  endingNumRatio: 0.133,   // 落款数字
  coverBleedRatio: 0.60,   // 封面镜头：封面出血宽度占画幅
  tintStrong: 0.24,        // 片名卡：主色染色强度
  tintSoft: 0.10,          // 封面镜头：主色染色强度
  kenBurnsFrom: 1.05,
  kenBurnsTo: 1.12,
  wipeFrames: 9,           // 色带擦除帧数
};

export type CinemaSceneType = 'SCAN' | 'SETTLE' | 'TITLE' | 'COVER' | 'CLIP' | 'ENDING';

export interface CinemaScene {
  type: CinemaSceneType;
  mediaId?: number;
  clipId?: number;
  fromFrame: number;
  durationInFrames: number;
  /** 速览段用：这一屏要铺开的媒体（顺序即清单顺序）。 */
  mediaIds?: number[];
  /** 上一部的主色：本幕入场时的「色带擦除」用它的颜色（转场即预告"换片子了"）。 */
  prevAccent?: string;
  /** 该幕的主色（本幕所属媒体的颜色）。 */
  accent?: string;
  /** 第几部（1 起）/ 共几部。 */
  order?: number;
}

export interface CinemaPlan {
  style: 'cinema';
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  params: RenderParams;
  scenes: CinemaScene[];
  media: PocMedia[];
  mediaIndex: Map<number, PocMedia>;
  /** 片尾/片单卡用的真实统计（不编造：缺数据就不显示）。 */
  stats: { titles: number; episodes: number; clips: number; yearFrom?: number; yearTo?: number };
  /** 每部的主色（封面实测值优先，缺失则按 mediaId 确定性派生）。 */
  accentOf: (media: PocMedia) => string;
  /** 有原声的片段幕区间（BGM ducking 按帧查询用；与旧模板同语义）。 */
  audioWindows: { fromFrame: number; toFrame: number }[];
}

const HEX = /^#([0-9a-f]{6})$/i;

/** HSL → #rrggbb（缺主色时的确定性兜底，纯函数、同 id 永远同色）。 */
function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v);
  };
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** 主色：封面实测值优先；缺失（webp 解不了 / 无封面）→ 按 mediaId 派生一个低饱和色。 */
export function accentColorOf(media: PocMedia): string {
  const raw = (media.accentColor ?? '').trim();
  if (HEX.test(raw)) return raw.toLowerCase();
  return hslToHex((media.mediaId * 47) % 360, 0.38, 0.44);
}

/** 该色上该用深字还是浅字（片名卡文字压在染色底上时用）。 */
export function readableOn(hex: string): string {
  const m = HEX.exec(hex);
  if (!m) return CINEMA_COLOR.ink;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.62 ? CINEMA_COLOR.canvas : CINEMA_COLOR.ink;
}

/** 主色 + 透明度 → rgba 字面量（染色层用）。 */
export function withAlpha(hex: string, alpha: number): string {
  const m = HEX.exec(hex);
  if (!m) return `rgba(11,11,12,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`;
}

const secondsToFrames = (sec: number, fps: number): number => Math.max(1, Math.round(sec * fps));

/**
 * 场景计划：`HOOK → SLATE → (TITLE → COVER|CLIP…) × N → ENDING`。
 *
 * 与旧 plan 的差别：**有片段的部不再产生资料页**（片名卡直接接片段），
 * 无片段的部用「封面镜头」顶上同一节拍；分组章节页与序言屏在新结构里没有位置（片名卡承担了它们的信息）。
 */
export function buildCinemaPlan(input: MultiMediaPocInput): CinemaPlan {
  const params = resolveParams(input.params, input);
  const { fps, width, height } = params;
  const media = [...input.media].sort((a, b) => a.order - b.order);
  const mediaIndex = new Map(media.map((item) => [item.mediaId, item]));
  const scenes: CinemaScene[] = [];
  let cursor = 0;
  const push = (scene: Omit<CinemaScene, 'fromFrame' | 'durationInFrames'>, durationInFrames: number): void => {
    scenes.push({ ...scene, fromFrame: cursor, durationInFrames });
    cursor += durationInFrames;
  };

  const openingFrames = secondsToFrames(params.durations.opening, fps);
  // 开屏 = 速览段 + 定格段（用户 2026-09-19 换思路：先让观众**快速扫一遍清单**建立印象，再定格主题）。
  // 速览段要容得下四个动作：整版铺开（每张错峰 2 帧）→ 轻微后退 → 数字升起 → 高光扫过一遍。
  // `durations.opening` 在这里是**上限**：比 scan+settle 大时不补空（宁可短，不拉长节奏）。
  const scanMedias = scanList(media);
  const scanFrames = Math.max(secondsToFrames(2.4, fps), Math.min(secondsToFrames(4.5, fps), Math.round(openingFrames * 0.6)));
  const settleFrames = Math.max(secondsToFrames(2.5, fps), Math.min(secondsToFrames(5, fps), openingFrames - scanFrames));
  const detailFrames = secondsToFrames(params.durations.detail, fps);
  const titleFrames = Math.max(secondsToFrames(1.0, fps), Math.min(secondsToFrames(2.0, fps), Math.round(detailFrames * 0.25)));

  push({ type: 'SCAN', mediaIds: scanMedias.map((item) => item.mediaId) }, scanFrames);
  push({ type: 'SETTLE' }, settleFrames);

  let previousAccent: string | undefined;
  media.forEach((item, index) => {
    const accent = accentColorOf(item);
    push({ type: 'TITLE', mediaId: item.mediaId, accent, prevAccent: previousAccent, order: index + 1 }, titleFrames);
    if (item.clips.length > 0) {
      item.clips.forEach((clip) => {
        const clipFrames = Math.max(secondsToFrames(1, fps), secondsToFrames(clip.durationMs / 1000, fps));
        push({ type: 'CLIP', mediaId: item.mediaId, clipId: clip.clipId, accent, order: index + 1 }, clipFrames);
      });
    } else {
      push({ type: 'COVER', mediaId: item.mediaId, accent, order: index + 1 }, Math.max(secondsToFrames(1.5, fps), detailFrames - titleFrames));
    }
    previousAccent = accent;
  });

  push({ type: 'ENDING' }, secondsToFrames(params.durations.ending, fps));

  const episodes = media.reduce((sum, item) => sum + (item.episodeCount ?? 0), 0);
  const clips = media.reduce((sum, item) => sum + item.clips.length, 0);
  const years = media.map((item) => item.year).filter((year): year is number => typeof year === 'number');
  // 原声区间：有音轨的片段幕（BGM 在这些帧里压低）
  const audioWindows = scenes
    .filter((scene) => {
      if (scene.type !== 'CLIP' || scene.mediaId === undefined) return false;
      const clip = mediaIndex.get(scene.mediaId)?.clips.find((item) => item.clipId === scene.clipId);
      return Boolean(clip?.hasAudio);
    })
    .map((scene) => ({ fromFrame: scene.fromFrame, toFrame: scene.fromFrame + scene.durationInFrames }));

  return {
    style: 'cinema',
    fps,
    width,
    height,
    durationInFrames: cursor,
    params,
    scenes,
    media,
    mediaIndex,
    stats: {
      titles: media.length,
      episodes,
      clips,
      yearFrom: years.length > 0 ? Math.min(...years) : undefined,
      yearTo: years.length > 0 ? Math.max(...years) : undefined,
    },
    accentOf: accentColorOf,
    audioWindows,
  };
}

/**
 * 速览用哪些媒体：**整份清单**（上限 36 张——再多也读不出印象了）。
 *
 * 与之前的“闪回”不同：速览不挑媒体、不逐个停留，而要**一屏全部铺开**，
 * 因为“大致印象”来自数量、色彩分布与密度，而不是顺序。
 */
export function scanList(media: PocMedia[]): PocMedia[] {
  return media.slice(0, 36);
}

/** 该场景所属媒体（场景阶段用；SCAN/SETTLE/ENDING 无媒体）。 */
export function mediaOfCinemaScene(plan: CinemaPlan, scene: CinemaScene): PocMedia | null {
  return scene.mediaId === undefined ? null : plan.mediaIndex.get(scene.mediaId) ?? null;
}

/** 片单卡/落款用的数字文案（缺数据就不显示，不编造）。 */
export function cinemaStatLines(plan: CinemaPlan): string[] {
  const { stats } = plan;
  const years = stats.yearFrom && stats.yearTo
    ? (stats.yearFrom === stats.yearTo ? `${stats.yearFrom}` : `${stats.yearFrom} – ${stats.yearTo}`)
    : '';
  return [
    stats.episodes > 0 ? `${stats.episodes} 集` : '',
    stats.clips > 0 ? `${stats.clips} 个片段` : '',
    years,
  ].filter(Boolean);
}
