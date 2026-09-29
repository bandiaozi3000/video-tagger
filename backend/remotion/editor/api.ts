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
  /**
   * 跨媒体借片段的来源（clipId → 来源 mediaId），可选：
   * 缺省 = 本体片段（旧草稿行为不变）。设计规格 §4。
   */
  sources?: Record<string, number>;
}

/** 同系列条目（跨媒体借片段的候选来源）。 */
export interface RelatedMedia {
  mediaId: number;
  title: string;
  year?: number | null;
  relationType: string;
  clipCount: number;
}

export interface BgmTrackInput {
  name: string;
  /** base64（无 data: 前缀）；由本地文件读取，仅用于随请求上传。 */
  base64?: string;
}

/**
 * 每部媒体的**用户标注**：推荐等级名次 + 推荐理由。
 * 稀疏存（缺键 = 最低档 / 无理由），所以老草稿/模板/导出 payload 零迁移。
 * 等级名单写死在 `src/tier.tsx` 的 `RECOMMEND_TIERS`，**不做配置**（2026-09-26 用户拍板）。
 */
export interface MediaMark {
  tier?: number;
  reason?: string;
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
  /** 一级分组内再按推荐等级分群（默认开；关掉=旧结构）。 */
  tierGroup: boolean;
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
  /** 片名卡时长（秒，1-5，默认 2）——独立可调，拖片名卡只改它（2026-09-20）。 */
  titleSec: number;
  endingSec: number;
  detailShow: { status: boolean; note: boolean; tag: boolean; endingWall?: boolean; endingPaging?: boolean; endingList?: boolean; endingIndex?: boolean; endingYear?: boolean; endingStats?: boolean;
    /** 片名卡（银幕式）备注：省略 = 跟随 `note`（老草稿零变化）。 */
    titleNote?: boolean;
    /** 片名卡显示「推荐理由」（每部手写那句）：省略 = 不显示。 */
    titleReason?: boolean };
  bgColor: string;
  bgImages: string[];
  bgRotationSec: number;
  bgOpacity: number;
  bgBlur: number;
  bgBrightness: number;
  bgmTracks: BgmTrackInput[];
  /** 转场音乐（片名卡专用，0 或 1 条）——与 BGM 独立的一层（2026-09-20 方案「甲」）。 */
  stingTracks: BgmTrackInput[];
  /** 转场音乐音量（0-100，默认 60）。 */
  stingVolume: number;
  bgmScale: number;
  bgmX: number;
  bgmY: number;
  /** BGM 播放范围：全程 / 仅开场 / 仅结尾 / 开场+结尾（2026-09-20）。 */
  bgmRange: string;
  openingIds: number[];
  /**
   * 手动 ★ 重点（2026-09-26 用户拍板 A+C+D）：组内群像后逐部补一幕资料卡，
   * 结尾再汇总成「全片重点回顾」；组内数量**不设上限**（自由选）。
   */
  /** 每部媒体的推荐等级 + 推荐理由（键 = mediaId 字符串；与 `mediaClips` 同构）。 */
  mediaMarks: Record<string, MediaMark>;
  /** 片段原声音量（0 = 全静音；默认 100 保持现状）。 */
  clipVolume: number;
  /** 中景摆位随机种子（🎲 重排 写入；同一份草稿预览与成片一致）。 */
  seed: number;
  /** 视觉主题预设 id（theme.ts 的 THEME_PRESETS）。 */
  preset: string;
  format: string;
  resolution: string;
  mediaClips: Record<string, MediaClips>;
  /**
   * 封面工坊参数（2026-09-29）：**稀疏存**（老草稿没这个键），随草稿保存 → 下次打开弹窗回填上次选择。
   * 它**不参与视频渲染**：只进 `EditorConfig` 的持久化，渲染侧与 Java 侧都不会读。
   */
  cover?: CoverConfig | null;
}

export interface MissingClip {
  mediaId: number;
  clipId: number;
  title: string;
  reason: string;
  /**
   * 旧草稿的跨媒体悬空引用：片段其实在同系列的 OVA 那边。
   * 后端认出后给出建议，编辑器就能一键把它改成「借片段」而不是删掉。
   */
  suggestedSourceMediaId?: number | null;
  suggestedSourceTitle?: string | null;
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

/** 清单导出的一行（后端 /api/media/list-export）。 */
export interface MediaExportRow {
  id: number;
  title: string;
  year?: number | null;
  subcategory?: string | null;
  mediaFormat?: string | null;
  source?: string | null;
  episodeCount?: number | null;
  clipCount?: number | null;
  /** 逗号分隔的标签串。 */
  tags?: string | null;
  /** 同系列**本体** id（后端 `SeriesDedupe` 算好）：本条是 OVA/第二季等派生条目时非空，见导出清单「去重」。 */
  seriesBaseId?: number | null;
}

export interface ClipBrief {
  id: number;
  title?: string | null;
  note?: string | null;
  timestampSec?: number | null;
  endSec?: number | null;
  /** 片段封面（`/covers/clip/{id}.jpg`；`/api/clips/media/{id}` 返回完整 Clip，带回这个字段）。 */
  coverPath?: string | null;
}

/** 候选筛选条件（系列化：可随模板保存，套用时重算候选媒体）。
 *
 * 每个维度单值；空值（`''` / `null`）表示该维度不筛。旧草稿/模板缺字段时由 `parsePayload` 合并
 * `defaultFilter()` 补全 → 行为与升级前一致。
 */
export interface CandidateFilter {
  /** 标题关键词（空白串 = 不筛） */
  q: string;
  collectionId: number | null;
  /** 首播年（精确；`''` = 不筛） */
  year: string;
  /** 格式 code（`''` = 不筛） */
  format: string;
  subcategoryId: number | null;
  tagId: number | null;
  tagName: string;
  /** WANT / WATCHING / DONE / PAUSED / DROPPED（`''` = 不筛） */
  status: string;
  /** `null` = 全部 / `1` = 已确认 / `0` = 待确认 —— 0 必须照发，不能用真值判断 */
  confirmed: number | null;
}

/** 候选筛选 → `/api/media` 与 `/api/media/count` 的共用查询参数。 */
export function filterParams(filter: CandidateFilter): URLSearchParams {
  const params = new URLSearchParams();
  const q = filter.q.trim();
  if (q) params.set('q', q);
  if (filter.collectionId != null) params.set('collectionId', String(filter.collectionId));
  if (filter.year) params.set('year', filter.year);
  if (filter.format) params.set('format', filter.format);
  if (filter.subcategoryId != null) params.set('subcategoryId', String(filter.subcategoryId));
  if (filter.tagId != null) params.set('tagId', String(filter.tagId));
  if (filter.status) params.set('status', filter.status);
  if (filter.confirmed != null) params.set('confirmed', String(filter.confirmed));
  return params;
}

/** 格式字典（`/api/media-formats`）：子分类自带 `parentId` 与全局 mediaCount。 */
export interface MediaFormatBrief {
  id: number;
  code: string;
  name: string;
  hasChildren?: number | null;
  subcategories?: { id: number; parentId: number | null; name: string; mediaCount?: number | null }[];
}

/** 导出变体：在基础配置上做具名覆盖（时长档/画幅/形态/每屏）。 */
export interface Variant {
  id: string;
  name: string;
  overrides: {
    resolution?: string;
    format?: string;
    groupStyle?: string;
    perScreen?: number;
    openingSec?: number;
    introSec?: number;
    groupSec?: number;
    detailSec?: number;
    endingSec?: number;
  };
}

/** 草稿/模板载荷（version=2）。 */
export interface PresetPayload {
  version: 2;
  config: EditorConfig;
  filter: CandidateFilter;
  variants: Variant[];
}

export interface TemplateSummary {
  id: number;
  name: string;
  createdAt: number;
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
  /** 渲染进度 0-100（渲染脚本每 ~4s 上报一次；老任务没有 → 0）。 */
  progress: number;
  /** 已完成 / 总块数（分块渲染；0/0 = 还没进分块阶段）。 */
  chunksDone?: number;
  chunksTotal?: number;
  /** 实时状态文案（准备素材 3/11 / 渲染第 3/16 块 / 拼接收尾）。 */
  stageText?: string | null;
  /** 段边界帧 JSON（如 `[0,165,300,…]`）：局部重渲前的安全校验基准。 */
  boundaryFrames?: string | null;
  /** 此刻**真的占着串行渲染线程**的是不是它（2026-09-27）。
   *  暂停只在块边界生效 → PAUSED 也可能还在渲当前块并把后面的 PENDING 堵住，UI 靠这个说清“谁在占”。 */
  active?: boolean;
}

/** 封面工坊的参数（**类型单一真源在 `editor/cover/cover-model.ts`**，那边带钳位与安全区校验）。 */
export type { CoverConfig } from './cover/cover-model';
import type { CoverConfig } from './cover/cover-model';

/** 常用模板（`/api/cover/templates`）。 */
export interface CoverTemplate {
  id: number;
  name: string;
  config: string;
  createdAt: number;
  updatedAt: number;
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

  media: (query: { limit: number; offset: number; filter: CandidateFilter; ids?: number[]; sort?: string; order?: string }) => {
    const params = filterParams(query.filter);
    params.set('limit', String(query.limit));
    params.set('offset', String(query.offset));
    // 排序与筛选分开：分组要看年份连续，得单独要 `sort=year`（不放进 CandidateFilter ——
    // 那个会随模板保存、还会影响导出清单的顺序）
    if (query.sort) params.set('sort', query.sort);
    if (query.order) params.set('order', query.order);
    if (query.ids && query.ids.length > 0) params.set('ids', query.ids.join(','));
    return json<MediaBrief[]>(`/api/media?${params.toString()}`);
  },
  /** 清单导出：候选走当前筛选，已选走 ids（与媒体列表同一套筛选参数）。 */
  listExport: (filter: CandidateFilter, ids?: number[]) => {
    const params = filterParams(filter);
    if (ids && ids.length > 0) params.set('ids', ids.join(','));
    return json<MediaExportRow[]>(`/api/media/list-export${params.toString() ? '?' + params.toString() : ''}`);
  },
  mediaCount: (filter: CandidateFilter) => {
    const params = filterParams(filter);
    return json<number>(`/api/media/count${params.toString() ? '?' + params.toString() : ''}`);
  },
  years: () => json<number[]>('/api/media/years'),
  collections: () => json<{ id: number; name: string }[]>('/api/collections'),
  formats: () => json<MediaFormatBrief[]>('/api/media-formats'),
  /** 标签建议（筛选面板的搜索式选择器；只选既有标签，不创建）。 */
  tagSuggest: async (q: string): Promise<{ id: number; name: string }[]> => {
    const page = await json<{ items?: { id: number; name: string }[] }>(
      `/api/tags/manage?q=${encodeURIComponent(q)}&size=20`,
    );
    return (page.items || []).map((tag) => ({ id: tag.id, name: tag.name }));
  },
  clips: (mediaId: number) => json<ClipBrief[]>(`/api/clips/media/${mediaId}`),
  /** 同系列条目（本地有片段的视频类关联条目）→ 跨媒体借片段的来源列表。 */
  relatedMedia: (mediaId: number) => json<RelatedMedia[]>(`/api/media/${mediaId}/related`),

  draft: () => json<{ config: string | null; updatedAt: number | null }>('/api/recommend/draft'),
  templates: () => json<TemplateSummary[]>('/api/recommend/templates'),
  templateConfig: (id: number) => json<{ id: number; name: string; config: string | null }>(`/api/recommend/templates/${id}`),
  saveTemplate: (name: string, config: string) => postJson<{ id: number }>('/api/recommend/templates', { name, config }),
  deleteTemplate: (id: number) => fetch(`/api/recommend/templates/${id}`, { method: 'DELETE' }).then(() => undefined),
  saveDraft: (config: string) => json<void>('/api/recommend/draft', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  }),

  /** 素材信息指纹（A+B 的 B）：编辑器切回窗口时比对，变了就重建会话。 */
  metaFingerprint: (ids: number[]) =>
    json<{ fingerprint: string }>(`/api/recommend/meta-fingerprint?ids=${ids.join(",")}`),
  exportVideo: (config: EditorConfig) => postJson<{ taskId: number; status: string }>('/api/recommend/video', config),
  tasks: () => json<ExportTask[]>('/api/recommend/video/tasks'),
  pauseTask: (id: number) =>
    fetch(`/api/recommend/video/tasks/${id}/pause`, { method: 'POST' }).then(() => undefined),
  resumeTask: (id: number) =>
    fetch(`/api/recommend/video/tasks/${id}/resume`, { method: 'POST' }).then(() => undefined),
  rerenderChunk: (id: number, chunk: number) =>
    fetch(`/api/recommend/video/tasks/${id}/rerender?chunk=${chunk}`, { method: 'POST' }).then(() => undefined),
  cancelTask: (id: number) =>
    fetch(`/api/recommend/video/tasks/${id}/cancel`, { method: 'POST' }).then(() => undefined),
  deleteTask: (id: number) => fetch(`/api/recommend/video/tasks/${id}`, { method: 'DELETE' }).then(() => undefined),
  openTask: (id: number, folder: boolean) =>
    fetch(`/api/recommend/video/tasks/${id}/open${folder ? '?folder=true' : ''}`, { method: 'POST' }).then(() => undefined),

  /** 封面工坊：出图（后端用 Chrome headless 截图 → JPEG）。 */
  coverExport: (body: { html: string; css: string; name: string }) =>
    postJson<{ url: string; path: string; width: number; height: number; bytes: number }>('/api/cover/export', body),
  coverTemplates: () => json<CoverTemplate[]>('/api/cover/templates'),
  coverSaveTemplate: (name: string, config: string) => postJson<{ id: number }>('/api/cover/templates', { name, config }),
  coverDeleteTemplate: (id: number) =>
    fetch(`/api/cover/templates/${id}`, { method: 'DELETE' }).then(() => undefined),
};
