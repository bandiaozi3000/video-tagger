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
  | 'RECAP_LIST'
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
   * 推荐等级名次（0 = 最强 = 「强推」；缺省 = 最低档 = 默认卡片）。卡片视觉见 `src/tier.tsx`。
   * **它接管了旧的 `featured`**：第 1 档 = 组首核心区 + 组内排最前 + 结尾全片回顾（见 `scene-plan.ts` 的 `isCore`）。
   */
  tier?: number;
  /** 推荐理由（用户手写一句；资料卡/网格卡上都作高亮条显示，clamp 防溢出）。 */
  reason?: string;
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
  /**
   * 推荐等级名单（**全局设置**里的有序数组，index 0 = 最强；由 Java 侧读站点设置塞进来）。
   * 缺省 = `['强推','推荐','还行']`；卡片视觉只按名次走（见 `src/tier.tsx`）。
   */
  tiers?: string[];
  /** 素材基址（渲染时为本机资源服务，预览时为 `/recommend-previews/{token}`）。 */
  assetBaseUrl?: string;
  media: PocMedia[];
  params?: Partial<RenderParams>;
}

export interface Scene {
  type: SceneType;
  mediaId?: number;
  /**
   * MEDIA_GRID 用：本屏展示的媒体；**GROUP_INTRO 用**：本页展示的媒体（结尾回顾页靠它报「共 N 部」+ 缩略图排）；
   * **RECAP_LIST 用**：这一档的**全部**成员（清单行序 = 数组序）。
   */
  mediaIds?: number[];
  clipId?: number;
  /** GROUP_INTRO / MEDIA_GRID 用：组名与组序（强调色轮转依据）。
   *  二级分组时 GROUP_INTRO 存**一级组名**（年份），MEDIA_GRID 存**子组名**（`2013 年 · 强推`）。 */
  groupName?: string;
  groupIndex?: number;
  /**
   * MEDIA_GRID / MEDIA_INFO 用：**推荐序号**（1 基，跨组连续，= 成片里第几次露脸）。
   *
   * ⚠️ 不用 `PocMedia.order`（那是 Java 侧按请求顺序编的**全局**序号，1..N）：
   * 画面是按分组重排的，两者不同源 —— 旧写法下底部进度条会显「88-95 / 226」这类看不懂的数
   * （用户 2026-09-26：「下面数量展示应该根据推荐顺序从1往后加」）。
   * 结尾回顾**不用**这个字段（`RECAP_LIST` 每行只报番剧名与集数，没有序号）。
   */
  numberFrom?: number;
  /** 组名行里的「共 N 部」= **整组**（子组）部数，不是当前屏的部数（用户 2026-09-26）。 */
  groupSize?: number;
  /** 组标题行那枚第 1 档胶囊里的数字 = **整组**里第 1 档的部数（0 = 不挂胶囊）。 */
  groupTopCount?: number;
  /** MEDIA_GRID 用：本屏的题头（如「本组核心」）；缺省用组名行。 */
  kicker?: string;
  fromFrame: number;
  durationInFrames: number;
}

/** 一组推荐媒体（分组维度由 Java 侧计算；排序、二级切分与兜底在 scene-plan）。 */
export interface GroupPlan {
  /** 组名（二级分组时形如 `2013 年 · 强推`）；无分组时为空串。 */
  name: string;
  /** 组序（强调色轮转依据）；无分组 -1。**二级子组沿用一级组的下标**（同一年共用一个强调色）。 */
  index: number;
  /** 一级组名（二级分组时 = 年份；未二级分组时与 `name` 相同）——章节页标题与整年取成员都用它。 */
  parentName?: string;
  /** 是否本一级组的**第一个**子组（章节页只在它前面插一页；未二级分组时恒为 true）。 */
  firstOfParent?: boolean;
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
