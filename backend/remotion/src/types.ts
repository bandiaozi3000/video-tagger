import type { RenderParams } from './params';
import type { TemplateStyle } from './theme';
export type MediaMode = 'CLIPS_SELECTED' | 'INFO_ONLY';
export type SceneType =
  | 'COLLECTION_OPENING'
  | 'COLLECTION_INTRO'
  | 'GROUP_INTRO'
  | 'MEDIA_INFO'
  | 'MEDIA_GRID'
  | 'MEDIA_CLIP'
  | 'COLLECTION_ENDING';

export interface PocClip {
  clipId: number;
  episodeNo?: number;
  episodeTitle?: string;
  title: string;
  /** 片段备注，由 `detailShow.note` 控制显示。 */
  note?: string;
  /**
   * 跨媒体借来的片段才有：来源媒体标题（如「草莓棉花糖 OVA 第2期」）。
   * 本体片段不带这个字段（设计规格 §6）。
   */
  sourceTitle?: string;
  /** 片段标签（用户写的短标签，如「可爱小猫」「高甜」）——片段屏的主文案。 */
  tag?: string;  assetPath: string;
  /** 素材像素尺寸（后端探测；0/缺省 = 未知 → 保守渲染糊背景）。 */
  assetWidth?: number;
  assetHeight?: number;
  durationMs: number;
  sourceStartMs?: number;
  hasAudio: boolean;
}

export interface PocMedia {
  mediaId: number;
  order: number;
  mode: MediaMode;
  title: string;
  originalTitle?: string;
  year?: number;
  season?: number;
  coverAssetPath?: string;
  description?: string;
  tags: string[];
  /** Bangumi 剧情简介（`external_work.description`）；与用户手写的 {@link description} 并存。 */
  synopsis?: string;
  /** Bangumi 类型/制作公司/播出季度/关键词数组（`external_work.genres_json`）。 */
  genres?: string[];
  /** 总集数（`external_work.episode_count`，缺省时由 episode 行数兜底）。 */
  episodeCount?: number;
  /** 分类文案（番剧 / 电影 / 电视剧…）。 */
  subcategory?: string;
  /** 分组名（由 Java 侧按 `groupBy` 计算，含"未分组/未知年份"等兜底文案）；无分组时缺省。 */
  group?: string;
  /**
   * 重点项（用户在编辑器里手动 ★ 勾选；Java 侧按 `featuredIds` 置位）。
   *
   * 语义（2026-09-26 用户拍板「A+C+D」）：
   *   - 组内群像网格上带 ★ 角标与强调描边（A）；
   *   - 本组网格放完后，**逐部**补一幕资料卡（C，复用 MEDIA_INFO）；
   *   - 全片结尾前再把各组的重点汇总成「全片重点回顾」章节（D）。
   * 组内数量**不设上限**（用户要自由选），但每部会吃掉 `durations.detail` 秒。
   */
  featured?: boolean;
  /** 从封面实测提取的主色（`CoverService.accentColorForPath`，「银幕式」模板的"每部一色"）。 */
  accentColor?: string;
  clips: PocClip[];
}

/** 模板标识：`MULTI_MEDIA_REMOTION_POC` 为沙盒输入，`MULTI_MEDIA_RECOMMEND` 为生产输入。 */
export const TEMPLATE_IDS = ['MULTI_MEDIA_REMOTION_POC', 'MULTI_MEDIA_RECOMMEND'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface MultiMediaPocInput {
  template: TemplateId;
  /** 模板形态：`chapter` 章节叙事 / `clip` 片段优先 / `cinema` 银幕式（v0.29 期间新增）。缺省 `chapter`。 */
  style?: TemplateStyle | 'cinema';
  title: string;
  subtitle?: string;
  intro?: string;
  /** 素材基址（渲染时为本机资源服务，预览时为 `/recommend-previews/{token}`）。 */
  assetBaseUrl?: string;
  media: PocMedia[];
  params?: Partial<RenderParams>;
}

export interface Scene {
  type: SceneType;
  mediaId?: number;
  /** MEDIA_GRID 用：本屏展示的媒体。 */
  mediaIds?: number[];
  clipId?: number;
  /** GROUP_INTRO 用：组名与组序（强调色轮转依据）。 */
  groupName?: string;
  groupIndex?: number;
  /**
   * MEDIA_GRID / MEDIA_INFO 用：**本地序号起点**（1 基）。
   *
   * ⚠️ 不用 `PocMedia.order`（那是 Java 侧按请求顺序编的**全局**序号，1..N）：
   * 画面是按分组重排的，两者不同源 —— 全局号在第二组起就是 88…159，
   * 重点回顾里更是 03/128/402 乱跳（用户 2026-09-26 报「数量排一会 500 一会几十」）。
   * 现在按**组内**从 1 数；重点回顾按回顾顺序从 1 数。
   */
  numberFrom?: number;
  /** MEDIA_GRID 用：本屏的题头（如「本组核心」）；缺省用组名行。 */
  kicker?: string;
  fromFrame: number;
  durationInFrames: number;
}

/** 一组推荐媒体（分组维度由 Java 侧计算；排序与兼底在 scene-plan）。 */
export interface GroupPlan {
  /** 组名；无分组时为空串。 */
  name: string;
  /** 组序（强调色轮转依据）；无分组 -1。 */
  index: number;
  media: PocMedia[];
}

export interface ScenePlan {
  style: TemplateStyle | 'cinema';
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  scenes: Scene[];
  /** 有原声的片段场景区间（供 BGM ducking 按帧查询）。 */
  audioWindows: { fromFrame: number; toFrame: number }[];
  /** 已解析参数（缺省值 + 钳位后）——组件直接用它，避免每帧二次 `resolveParams`。 */
  params: RenderParams;
  /** 媒体 id → 媒体（每帧查找从 O(n) 降为 O(1)）。 */
  mediaIndex: Map<number, PocMedia>;
  /** 分组结果（章节页按组名取成员，避免每帧 filter 全表）。 */
  groups: GroupPlan[];
}
