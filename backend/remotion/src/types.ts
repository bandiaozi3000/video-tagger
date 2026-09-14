export type MediaMode = 'CLIPS_SELECTED' | 'INFO_ONLY';

export type SceneType =
  | 'COLLECTION_OPENING'
  | 'MEDIA_INFO'
  | 'MEDIA_CLIP'
  | 'COLLECTION_ENDING';

export interface PocClip {
  clipId: number;
  episodeNo?: number;
  episodeTitle?: string;
  title: string;
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

export interface MultiMediaPocInput {
  template: 'MULTI_MEDIA_REMOTION_POC';
  title: string;
  subtitle?: string;
  intro?: string;
  assetBaseUrl?: string;
  media: PocMedia[];
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
