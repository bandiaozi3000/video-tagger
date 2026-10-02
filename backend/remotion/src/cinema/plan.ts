import type { MultiMediaPocInput, PocMedia } from '../types';
import type { RenderParams } from '../params';
import { resolveParams } from '../params';
import { hiddenSectionsOf, totalFramesOf, withoutHiddenSections } from '../sections';

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
  /**
   * 展示字体：项目自带 ttf（`public/fonts`，由 `fonts.tsx` 用 FontFace 注入）+ 系统真名兜底。
   *
   * 2026-09-20 实测修正：旧写法 `阿里巴巴普惠体 2 115 Black` 在 Windows 上**从未命中**
   * （字体真名是 `阿里巴巴普惠体 2.0`），标题一直退化成系统默认 sans 的 Regular 字重。
   */
  display: '"VTPuhuiBlack","阿里巴巴普惠体 2.0","PingFang SC",sans-serif',
  /** 数字/西文：项目自带 Mona Sans（可变字体）；旧写法 `Mona-Sans` 同样没命中（真名带空格）。 */
  num: '"VTMonaSans","Mona Sans","阿里巴巴普惠体 2.0","PingFang SC",sans-serif',
  /** 正文：不内嵌（8MB 的 Regular 不值得进包），走系统真名 + 浏览器兜底。 */
  body: '"阿里巴巴普惠体 2.0","PingFang SC","Microsoft YaHei",sans-serif',
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
  // 开屏 = 速览段（掠影 + 落位）+ 定格段。
  // 时长**由用户设置说了算**（用户 2026-09-20 拍板）：掠影占 55%，其余留给定格段。
  // 旧版把这里夹成 scan≤4.5s / settle≤5s（=开场永远 9.5s 封顶），设置 ≥9.5s 就完全失效。
  // 场景短于自然拍点时由 `Scan` 自己等比压缩拍点，不再在这里夹紧。
  const scanMedias = scanList(media, params.openingIds);
  const scanFrames = Math.max(1, Math.round(openingFrames * 0.55));
  const settleFrames = Math.max(1, openingFrames - scanFrames);
  const detailFrames = secondsToFrames(params.durations.detail, fps);
  // 片名卡：**独立时长**（`durations.title`，1-5s，默认 2）。
  // 2026-09-20 之前它是 `clamp(detail × 0.25, 1s, 2s)` → 拖片名卡实际改的是「资料卡」时长，
  // 而且被 2s 封顶，用户反馈「2S 提不上去」。现在拖它只改它自己。
  const titleFrames = Math.max(1, secondsToFrames(params.durations.title, fps));

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
  // 原声区间：有音轨的片段幕（BGM 在这些帧里压低）。
  // 2026-09-20：用户把片段原声静音（clipVolume = 0）时**不应再压 BGM** —— 否则 BGM 白压一档、听感像「中途变小声」。
  // 结构化场景关闭（银幕式只有「开场」= SCAN+SETTLE 与「结尾」两块可关）：整段拿掉并重排帧位。
  const visibleScenes = withoutHiddenSections(scenes, hiddenSectionsOf(params.detailShow));

  const audioWindows = params.clipVolume <= 0 ? [] : visibleScenes
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
    durationInFrames: totalFramesOf(visibleScenes),
    params,
    scenes: visibleScenes,
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
 * 速览用哪些媒体：**开场代表秀（`openingIds`）优先**，其余按清单顺序补齐，上限 36 张（再多也读不出印象）。
 *
 * 前 5 张会落到开场那几张**大卡**上（`Scan` 的 hero + 4 张飘落卡），所以“开场封面选取”改这里才生效；
 * 旧版直接 `media.slice(0,36)`，用户在「开场代表秀」里勾了什么都会被忽略（用户 2026-09-20 报的 bug）。
 */
export function scanList(media: PocMedia[], openingIds: number[] = []): PocMedia[] {
  const picked: PocMedia[] = [];
  for (const id of openingIds) {
    const item = media.find((candidate) => candidate.mediaId === id && !picked.includes(candidate));
    if (item) picked.push(item);
  }
  return [...picked, ...media.filter((item) => !picked.includes(item))].slice(0, 36);
}

/** 该场景所属媒体（场景阶段用；SCAN/SETTLE/ENDING 无媒体）。 */
export function mediaOfCinemaScene(plan: CinemaPlan, scene: CinemaScene): PocMedia | null {
  return scene.mediaId === undefined ? null : plan.mediaIndex.get(scene.mediaId) ?? null;
}

/**
 * 片单卡/落款用的数字文案。
 *
 * 用户 2026-09-20 定稿：开场那行只留「部数 · 年份」——集数（与片段数）不再出现：
 * 观众要的是「这期推了哪些、什么年份」，不是统计表。每部的集数仍在资料卡 `Facts` 里（那里保留）。
 */
export function cinemaStatLines(plan: CinemaPlan): string[] {
  const { stats } = plan;
  return [
    stats.yearFrom && stats.yearTo
      ? (stats.yearFrom === stats.yearTo ? `${stats.yearFrom}` : `${stats.yearFrom} – ${stats.yearTo}`)
      : '',
  ].filter(Boolean);
}
