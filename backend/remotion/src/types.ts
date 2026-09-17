import type { RenderParams } from './params';

export type MediaMode = 'CLIPS_SELECTED' | 'INFO_ONLY';

export type SceneType =
  | 'COLLECTION_OPENING'
  | 'COLLECTION_INTRO'
  | 'MEDIA_INFO'
  | 'MEDIA_CLIP'
  | 'COLLECTION_ENDING';

export interface PocClip {
  clipId: number;
  episodeNo?: number;
  episodeTitle?: string;
  title: string;
  /** 片段备注（旧模板 clip.note），由 detailShow.note 控制显示。 */
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
  clips: PocClip[];
}

/** 支持两种模板标识：POC 沙盒输入与生产（Java）输入。 */
export const TEMPLATE_IDS = ['MULTI_MEDIA_REMOTION_POC', 'MULTI_MEDIA_RECOMMEND'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export interface MultiMediaPocInput {
  template: TemplateId;
  title: string;
  subtitle?: string;
  intro?: string;
  assetBaseUrl?: string;
  media: PocMedia[];
  /** 推荐模板参数（对应 Java 29 个占位符）。缺省 → Java 默认值。 */
  params?: Partial<RenderParams>;
}

export interface Scene {
  type: SceneType;
  mediaId?: number;
  clipId?: number;
  fromFrame: number;
  durationInFrames: number;
}

export interface ScenePlan {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  scenes: Scene[];
}
