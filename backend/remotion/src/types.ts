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
  assetPath: string;
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
  /** 分组名（由 Java 侧按 `groupBy` 计算，含"未分组/未知年份"等兜底文案）；无分组时缺省。 */
  group?: string;
  clips: PocClip[];
}

/** 模板标识：`MULTI_MEDIA_REMOTION_POC` 为沙盒输入，`MULTI_MEDIA_RECOMMEND` 为生产输入。 */
export const TEMPLATE_IDS = ['MULTI_MEDIA_REMOTION_POC', 'MULTI_MEDIA_RECOMMEND'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface MultiMediaPocInput {
  template: TemplateId;
  /** 模板形态：`chapter` 章节叙事 / `clip` 片段优先。缺省 `chapter`。 */
  style?: TemplateStyle;
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
  style: TemplateStyle;
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
