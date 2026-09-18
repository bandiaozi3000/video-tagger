/**
 * 推荐工作台编辑器的后端接口封装（同源 REST）。
 *
 * 与 Java 侧的对齐点：请求体结构 = `RecommendController.RecommendExportRequest`，
 * 响应 = `{token, input, missing}`。
 */
import type { MultiMediaPocInput } from '../src/types';

export interface ClipBadge {
  mediaTitle?: boolean;
  clipTitle?: boolean;
  index?: boolean;
  note?: boolean;
  custom?: string;
}

export interface MediaClips {
  order: number[];
  badge?: ClipBadge | null;
}

export interface BgmTrackInput {
  name: string;
  /** base64（无 data: 前缀）；由本地文件读取，仅用于随请求上传。 */
  base64?: string;
}

export interface EditorConfig {
  ids: number[];
  title: string;
  brandTitle: string;
  subtitle: string;
  intro: string;
  prologueTitle: string;
  endingTitle: string;
  endingText: string;
  groupBy: string;
  groupStyle: string;
  groupSort: string;
  perScreen: number;
  /** 0-100；后端为字符串（沿用旧契约） */
  coverSize: string;
  openingSpeed: number;
  endingScrollSpeed: number;
  openingSec: number;
  introSec: number;
  groupSec: number;
  detailSec: number;
  endingSec: number;
  detailShow: { status: boolean; note: boolean; tag: boolean };
  bgColor: string;
  bgImages: string[];
  bgRotationSec: number;
  bgOpacity: number;
  bgBlur: number;
  bgBrightness: number;
  bgmTracks: BgmTrackInput[];
  bgmScale: number;
  bgmX: number;
  bgmY: number;
  openingIds: number[];
  openingCustom: boolean;
  format: string;
  resolution: string;
  mediaClips: Record<string, MediaClips>;
}

export interface MissingClip {
  mediaId: number;
  clipId: number;
  title: string;
  reason: string;
}

export interface SessionResponse {
  token: string;
  input: MultiMediaPocInput;
  missing: MissingClip[];
}

export interface MediaBrief {
  id: number;
  title: string;
  coverPath?: string | null;
  fallbackCoverPath?: string | null;
  externalCoverUrl?: string | null;
  year?: number | null;
  mediaFormat?: string | null;
  source?: string | null;
  collectionCount?: number | null;
}

export interface ClipBrief {
  id: number;
  title?: string | null;
  note?: string | null;
  timestampSec?: number | null;
  endSec?: number | null;
}

export interface ExportTask {
  id: number;
  title: string;
  mediaCount: number;
  status: string;
  message?: string | null;
  filePath?: string | null;
  format?: string | null;
  createdAt: number;
  finishedAt: number;
}

/** 统一的 JSON 请求（非 2xx → 抛带中文原因的错误）。 */
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      detail = body.message || body.error || '';
    } catch {
      detail = await response.text().catch(() => '');
    }
    throw new Error(detail || `请求失败 (${response.status})`);
  }
  return (await response.json()) as T;
}

const postJson = <T,>(url: string, body: unknown): Promise<T> =>
  json<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const api = {
  createSession: (config: EditorConfig) => postJson<SessionResponse>('/api/recommend/session', config),
  renderInput: (token: string, config: EditorConfig) =>
    postJson<SessionResponse>(`/api/recommend/session/${token}/render-input`, config),
  deleteSession: (token: string) =>
    fetch(`/api/recommend/session/${token}`, { method: 'DELETE' }).then(() => undefined),

  media: (query: { limit: number; offset: number; collectionId?: number | null; tagId?: number | null; year?: string }) => {
    const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) });
    if (query.collectionId) params.set('collectionId', String(query.collectionId));
    if (query.tagId) params.set('tagId', String(query.tagId));
    if (query.year) params.set('year', query.year);
    return json<MediaBrief[]>(`/api/media?${params.toString()}`);
  },
  mediaCount: (query: { collectionId?: number | null; tagId?: number | null; year?: string }) => {
    const params = new URLSearchParams();
    if (query.collectionId) params.set('collectionId', String(query.collectionId));
    if (query.tagId) params.set('tagId', String(query.tagId));
    if (query.year) params.set('year', query.year);
    return json<number>(`/api/media/count${params.toString() ? '?' + params.toString() : ''}`);
  },
  years: () => json<number[]>('/api/media/years'),
  collections: () => json<{ id: number; name: string }[]>('/api/collections'),
  resolveTagId: async (name: string): Promise<number | null> => {
    const page = await json<{ items?: { id: number; name: string }[] }>(
      `/api/tags/manage?q=${encodeURIComponent(name)}&size=50`,
    );
    return (page.items || []).find((tag) => tag.name === name)?.id ?? null;
  },
  clips: (mediaId: number) => json<ClipBrief[]>(`/api/clips/media/${mediaId}`),

  draft: () => json<{ config: string | null; updatedAt: number | null }>('/api/recommend/draft'),
  saveDraft: (config: string) => json<void>('/api/recommend/draft', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  }),

  exportVideo: (config: EditorConfig) => postJson<{ taskId: number; status: string }>('/api/recommend/video', config),
  tasks: () => json<ExportTask[]>('/api/recommend/video/tasks'),
  deleteTask: (id: number) => fetch(`/api/recommend/video/tasks/${id}`, { method: 'DELETE' }).then(() => undefined),
  openTask: (id: number, folder: boolean) =>
    fetch(`/api/recommend/video/tasks/${id}/open${folder ? '?folder=true' : ''}`, { method: 'POST' }).then(() => undefined),
};
