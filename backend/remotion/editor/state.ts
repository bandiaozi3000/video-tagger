/**
 * 编辑器配置默认值与**本地参数补丁**。
 *
 * 为什么能在本地改参数：Remotion 侧 `resolveParams`（`src/params.ts`）是参数语义的最终裁判
 * （缺省值 + 钳位都在那里）。服务端只负责"媒体/片段/BGM 这些需要 DB 与素材的部分"，
 * 纯参数改动直接补进 `input.params` → 即时生效，不走网络（设计规格 §6.1）。
 */
import type { CandidateFilter, CoverConfig, EditorConfig, MediaMark, PresetPayload, Variant } from './api';
import type { MultiMediaPocInput } from '../src/types';
import { mergeCoverConfig } from './cover/cover-model';

const STORAGE_KEY = 'vt-recommend-editor-config';

export function defaultConfig(): EditorConfig {
  return {
    ids: [],
    title: '',
    brandTitle: '',
    subtitle: '',
    intro: '',
    prologueTitle: '',
    endingTitle: '',
    endingText: '',
    groupBy: 'none',
    /** 一级分组内再按推荐等级分群（用户 2026-09-26：「按年份分组后再支持按推荐等级接着分组」）。 */
    tierGroup: true,
    groupStyle: 'chapter',
    groupSort: 'date-desc',
    perScreen: 1,
    coverSize: '50',
    openingSpeed: 50,
    endingScrollSpeed: 50,
    openingSec: 10,
    introSec: 5,
    groupSec: 5,
    detailSec: 10,
    titleSec: 2,
    endingSec: 5,
    detailShow: { status: true, note: true, tag: true, endingWall: true, endingPaging: false, endingList: true, endingIndex: true, endingYear: true, endingStats: false },
    bgColor: '',
    bgImages: [],
    bgRotationSec: 8,
    bgOpacity: 100,
    bgBlur: 0,
    bgBrightness: 50,
    bgmTracks: [],
    stingTracks: [],
    stingVolume: 60,
    bgmScale: 100,
    bgmX: 1,
    bgmY: 8,
    bgmRange: 'all',
    openingIds: [],
    mediaMarks: {},
    clipVolume: 100,
    seed: rollSeed(),
    preset: 'starlit',
    format: 'MP4',
    resolution: '720P',
    mediaClips: {},
  };
}

/** 读取本地暂存的配置（阶段 1 的草稿桥接：不落库，避免编辑期丢工作）。 */
export function loadConfig(): EditorConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    return { ...defaultConfig(), ...(JSON.parse(raw) as Partial<EditorConfig>) };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: EditorConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // 配额/隐私模式失败可忽略：编辑本身不依赖它
  }
}

/**
 * 编辑器 UI 偏好（纯视图状态，**不进草稿/模板**）。
 *
 * 目前只存「右栏分组开关」：用户把哪些组打开/收起，换对象、切 tab、刷新后都要保持。
 */
const UI_STATE_KEY = 'vt-recommend-editor-ui';

export function loadGroupOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) as { groups?: Record<string, boolean> } : null;
    return parsed?.groups && typeof parsed.groups === 'object' ? parsed.groups : {};
  } catch {
    return {};
  }
}

export function saveGroupOpen(groups: Record<string, boolean>): void {
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify({ groups }));
  } catch {
    // 同上：失败不影响编辑
  }
}

/**
 * 会话同步签名：只有这些字段变化才需要重新问后端（媒体集 / 片段挂载 / 分组名 / BGM 素材 / 转场音素材）。
 * 其余参数走 {@link applyLocalParams} 本地补丁。
 *
 * 2026-09-20 补上 `sting`：转场音的**素材**是后端落到会话目录再回传相对路径的，
 * 不进签名就会出现“选了转场音但预览里永远不生效”（导出走的是另一条路，所以成片反而正常）。
 */
export function sessionSignature(config: EditorConfig): string {
  return JSON.stringify({
    ids: config.ids,
    // ⚠️ `clips`（`config.mediaClips`）**故意不在签名里**（用户 2026-09-26：「片段更改信息仍是直接渲染，一并归入手动渲染」）：
    //    改片段只改 config，点「应用并渲染」时才重建会话（片段素材必须后端重新准备，
    //    见 `main.tsx` 的 `appliedClipsKeyRef` 比对 + `setReloadTick`）。
    groupBy: config.groupBy,
    // ⚠️ `groupStyle` 必须在内：**主色（accentColor）只有银幕式才由后端计算**（2026-09-26 起），
    // 且它就在渲染输入里 —— 不把模板形态并进签名，chapter ↔ cinema 互切时不会重取输入，
    // 银幕式会拿不到主色而退到兜底色。
    groupStyle: config.groupStyle,
    // `mediaMarks` 也在内：推荐等级第 1 档会**改变场景结构**（组首核心区 + 结尾全片回顾），
    // 后端得重算 scene-plan。
    marks: config.mediaMarks,
    bgm: config.bgmTracks.map((t) => `${t.name}:${t.base64?.length ?? 0}`),
    sting: config.stingTracks.map((t) => `${t.name}:${t.base64?.length ?? 0}`),
  });
}

/**🎲 重排：换一个摆位种子（必须整数，hash 里按位运算）。 */
export function rollSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** 纯参数补丁：字段名与 `RenderParams` 对齐，钳位交给 Remotion 侧 `resolveParams`。 */
export function applyLocalParams(input: MultiMediaPocInput, config: EditorConfig, mediaCount?: number): MultiMediaPocInput {
  // 开场秀：有内容就用这个顺序（第一个 = Hero）；一个都没放 → 按推荐顺序（plan 会用片单顺序）
  const openingIds = config.openingIds;
  // `openingIds` 里可能有已不在媒体集里的残留 id → 过滤，避免开场显影空转
  const validOpening = mediaCount === undefined
    ? openingIds
    : openingIds.filter((id) => input.media.some((media) => media.mediaId === id));
  return {
    ...input,
    style: config.groupStyle === 'clip' ? 'clip' : config.groupStyle === 'cinema' ? 'cinema' : 'chapter',
    params: {
      ...input.params,
      title: config.title,
      brandTitle: config.brandTitle,
      subtitle: config.subtitle,
      intro: config.intro,
      prologueTitle: config.prologueTitle,
      endingTitle: config.endingTitle,
      endingText: config.endingText,
      coverSize: Number(config.coverSize) || 50,
      detailShow: { ...config.detailShow },
      bgColor: config.bgColor,
      bgImages: config.bgImages,
      bgRotationSec: config.bgRotationSec,
      bgOpacity: config.bgOpacity,
      bgBlur: config.bgBlur,
      bgBrightness: config.bgBrightness,
      bgmScale: config.bgmScale,
      bgmX: config.bgmX,
      bgmY: config.bgmY,
      bgmRange: config.bgmRange,
      stingVolume: config.stingVolume,
      clipVolume: config.clipVolume,
      seed: config.seed,
      openingSpeed: config.openingSpeed,
      endingScrollSpeed: config.endingScrollSpeed,
      durations: {
        opening: config.openingSec,
        intro: config.introSec,
        group: config.groupSec,
        detail: config.detailSec,
        ending: config.endingSec,
        title: config.titleSec,
      },
      groupBy: config.groupBy,
      tierGroup: config.tierGroup,
      groupSort: config.groupSort,
      perScreen: config.perScreen,
      openingIds: validOpening,
      preset: config.preset,
    },
  };
}

export function defaultFilter(): CandidateFilter {
  return {
    q: '', collectionIds: [], years: [], genres: [], season: [],
    tagIds: [], tagNames: [], statuses: [],
    // 默认模式与媒体页**逐字一致**（题材 OR / 标签 AND / 收藏夹 OR）
    mode: { tagIds: 'AND', collectionIds: 'OR', genres: 'OR' },
  };
}

/** 默认变体：短版 + 完整版（用户拍板的「同配置多版本」最小形态）。 */
export function defaultVariants(): Variant[] {
  return [];
}

/**
 * 旧载荷迁移（能就地搬的就搬，缺的用默认值补全 —— 不让老草稿/模板的筛选条件静默丢失）：
 * - v0.31 之前：标签是单值 `tagId/tagName` → 搬成 `tagIds/tagNames`；
 * - 与媒体页对齐（2026-10-02）：`collectionId` / `year` / `status` 单值 → 搬成多选数组，
 *   `tagMode` → `mode.tagIds`（`mode` 其余键缺省补全）。
 */
function normalizeFilter(raw: unknown): CandidateFilter {
  type Legacy = Partial<CandidateFilter> & {
    tagId?: number | null; tagName?: string;
    collectionId?: number | null; year?: string; status?: string; tagMode?: 'AND' | 'OR';
    /** 已删掉的筛选维度（格式/子分类/档案）——旧载荷里可能有，**直接丢弃** */
    format?: string; subcategoryId?: number | null; confirmed?: number | null;
  };
  const legacy = (raw ?? {}) as Legacy;
  const merged = { ...defaultFilter(), ...legacy } as CandidateFilter & Legacy;
  if (!Array.isArray(merged.collectionIds)) merged.collectionIds = [];
  if (!Array.isArray(merged.years)) merged.years = [];
  if (!Array.isArray(merged.genres)) merged.genres = [];
  if (!Array.isArray(merged.season)) merged.season = [];
  if (!Array.isArray(merged.statuses)) merged.statuses = [];
  if (!Array.isArray(merged.tagIds)) merged.tagIds = [];
  if (!Array.isArray(merged.tagNames)) merged.tagNames = [];
  if (merged.tagIds.length === 0 && legacy.tagId != null) {
    merged.tagIds = [legacy.tagId];
    merged.tagNames = [legacy.tagName || `标签 #${legacy.tagId}`];
  }
  if (merged.collectionIds.length === 0 && legacy.collectionId != null) {
    merged.collectionIds = [legacy.collectionId];
  }
  if (merged.years.length === 0 && legacy.year) merged.years = [legacy.year];
  if (merged.statuses.length === 0 && legacy.status) merged.statuses = [legacy.status];
  const mode = { ...defaultFilter().mode, ...(merged.mode ?? {}) };
  if (legacy.tagMode === 'AND' || legacy.tagMode === 'OR') mode.tagIds = legacy.tagMode;
  if (mode.tagIds !== 'OR') mode.tagIds = 'AND';
  if (mode.collectionIds !== 'AND') mode.collectionIds = 'OR';
  if (mode.genres !== 'AND') mode.genres = 'OR';
  merged.mode = mode;
  // ⚠️ 删的是 **merged** 上的旧键（不是 legacy）—— 展开后 merged 已经自带一份拷贝，
  // 删 legacy 等于没删，旧字段会一直跟着草稿/模板存下去（2026-10-02 测试拓出来的真 bug）。
  delete merged.tagId;
  delete merged.tagName;
  delete merged.collectionId;
  delete merged.year;
  delete merged.status;
  delete merged.tagMode;
  // 已删维度：旧载荷里带着也丢掉，不让它跟着草稿一直存下去
  delete (merged as Legacy).format;
  delete (merged as Legacy).subcategoryId;
  delete (merged as Legacy).confirmed;
  return merged;
}

/** 组装草稿/模板载荷（version=2）。 */
export function buildPayload(config: EditorConfig, filter: CandidateFilter, variants: Variant[]): PresetPayload {
  return {
    version: 2,
    // 草稿/模板不带 BGM（base64 体积大；与旧行为一致）
    // 草稿/模板不带 BGM 与转场音（base64 体积大）
    config: { ...config, bgmTracks: [], stingTracks: [] },
    filter,
    variants,
  };
}

/** 解析载荷；结构不符（或旧版 v1 快照）→ null，由调用方给出「不兼容」提示。 */
export function parsePayload(json: string | null | undefined): PresetPayload | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Partial<PresetPayload> & { ids?: unknown };
    if (!value || typeof value !== 'object') return null;
    if (value.version !== 2 || !value.config) return null;   // 旧结构（v0.28 之前）不兼容
    const stored = value.config as EditorConfig & { featuredIds?: unknown };
    const config: EditorConfig = { ...defaultConfig(), ...stored };
    /**
     * 迁移（2026-09-26「等级取代 ★」）：老草稿/模板里的 `featuredIds`（★ 重点）语义与「第 1 档」等价
     * → 搬成 `mediaMarks[id].tier = 0`，然后**丢掉旧字段**（否则会跟着草稿一直存下去）。
     * 只在没有新数据时搬（新数据优先）；搬完就是普通草稿，不需再跑一次。
     */
    const legacy = Array.isArray(stored.featuredIds) ? stored.featuredIds.map(Number).filter(Number.isFinite) : [];
    if (legacy.length > 0 && Object.keys(config.mediaMarks ?? {}).length === 0) {
      const marks: Record<string, MediaMark> = { ...(config.mediaMarks ?? {}) };
      for (const id of legacy) marks[String(id)] = { ...marks[String(id)], tier: 0 };
      config.mediaMarks = marks;
    }
    delete (config as { featuredIds?: unknown }).featuredIds;
    // 封面参数：**对象必须逐键合并**（整个替换会让新版加的字段全丢）；老草稿没有这个键 → 保持稀疏
    if (config.cover) {
      config.cover = mergeCoverConfig(config.cover as Partial<CoverConfig>);
    }
    return {
      version: 2,
      config,
      filter: normalizeFilter(value.filter),
      variants: Array.isArray(value.variants) ? value.variants : [],
    };
  } catch {
    return null;
  }
}

/** 读本地文件为 base64（去掉 data URI 前缀）。 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * 读本地文件为 **data URI**（保留前缀）。
 *
 * 背景图用这个而不是 {@link fileToBase64}：成片里背景图走 `assetUrl()`，只有 `http(s)`/`data:`/`/`
 * 三种值会被原样透传，裸 base64 会被当成相对路径拼成 `${assetBaseUrl}/<base64>` → 图永远加载不出来。
 *
 * ponytail: data URI 会随请求与草稿一起传（大图会撑大 localStorage 与草稿 JSON）；
 * 要到「大图也不占载荷」时，再像 BGM 一样落盘到会话目录并回传相对路径（需同时兼顾导出侧素材根）。
 */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** 毫秒 → 可读时长（导出用：秒级足够，别塞毫秒）。 */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} 秒`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return total % 60 === 0 ? `${minutes} 分` : `${minutes} 分 ${total % 60} 秒`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${String(minutes % 60).padStart(2, '0')} 分`;
}

/**
 * 任务进度文案（导出面板用）。
 *
 * ETA = 已用 × (1 - p) / p —— 渲染速度大致恒定（实测 4K ≈ 555ms/帧、1080p ≈ 158ms/帧），
 * 所以线性外推够用；进度 < 2% 时先不说预计（早期百分比抖动会把估算带偏）。
 */
export function taskProgressLabel(
  task: { status: string; progress?: number; createdAt: number; finishedAt?: number },
  now: number,
): string {
  const elapsed = (task.status === 'RUNNING' ? now : task.finishedAt || now) - task.createdAt;
  const pct = Math.max(0, Math.min(100, Math.round(task.progress ?? 0)));
  if (task.status !== 'RUNNING') return `共 ${formatElapsed(elapsed)}`;
  const parts = [`已用 ${formatElapsed(elapsed)}`, `${pct}%`];
  if (pct >= 2 && pct < 100) parts.push(`预计还需 ${formatElapsed((elapsed * (100 - pct)) / pct)}`);
  return parts.join(' · ');
}

/**
 * 常驻自定义题材（与媒体页**同一份 localStorage**，2026-10-02 用户要求两侧一致）。
 *
 * ⚠️ key 必须与 `app.js` 的 `CUSTOM_GENRES_KEY` 逐字相同 —— 编辑器与媒体页是**同源同页**，
 * 共用这一份就是「推荐侧和媒体保持一致」：一边加的词，另一边打开就看得见。
 */
const CUSTOM_GENRES_KEY = 'vt-media-genres';

/** 读常驻题材（localStorage 不可用/内容坏了都当空，不抛）。 */
export function readCustomGenres(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_GENRES_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [];
  } catch {
    return [];
  }
}

/** 写常驻题材：去空、去重后落盘，返回落盘后的列表。 */
export function saveCustomGenres(list: string[]): string[] {
  const uniq = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
  try { localStorage.setItem(CUSTOM_GENRES_KEY, JSON.stringify(uniq)); } catch { /* 隐私模式等写不进去，不炸 */ }
  return uniq;
}
