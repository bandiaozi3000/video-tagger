/**
 * 编辑器配置默认值与**本地参数补丁**。
 *
 * 为什么能在本地改参数：Remotion 侧 `resolveParams`（`src/params.ts`）是参数语义的最终裁判
 * （缺省值 + 钳位都在那里）。服务端只负责"媒体/片段/BGM 这些需要 DB 与素材的部分"，
 * 纯参数改动直接补进 `input.params` → 即时生效，不走网络（设计规格 §6.1）。
 */
import type { CandidateFilter, EditorConfig, PresetPayload, Variant } from './api';
import type { MultiMediaPocInput } from '../src/types';

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
    featuredIds: [],
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
    clips: config.mediaClips,
    groupBy: config.groupBy,
    // ⚠️ `groupStyle` 必须在内：**主色（accentColor）只有银幕式才由后端计算**（2026-09-26 起），
    // 且它就在渲染输入里 —— 不把模板形态并进签名，chapter ↔ cinema 互切时不会重取输入，
    // 银幕式会拿不到主色而退到兜底色。
    groupStyle: config.groupStyle,
    // `featuredIds` 也在内：★ 重点会**改变场景结构**（组内补资料卡 + 结尾重点回顾），
    // 后端得重算 scene-plan。
    featured: config.featuredIds,
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
      groupSort: config.groupSort,
      perScreen: config.perScreen,
      openingIds: validOpening,
      preset: config.preset,
    },
  };
}

export function defaultFilter(): CandidateFilter {
  return { q: '', collectionId: null, year: '', format: '', subcategoryId: null, tagId: null, tagName: '', status: '', confirmed: null };
}

/** 默认变体：短版 + 完整版（用户拍板的「同配置多版本」最小形态）。 */
export function defaultVariants(): Variant[] {
  return [];
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
    return {
      version: 2,
      config: { ...defaultConfig(), ...(value.config as EditorConfig) },
      filter: { ...defaultFilter(), ...(value.filter ?? {}) },
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
