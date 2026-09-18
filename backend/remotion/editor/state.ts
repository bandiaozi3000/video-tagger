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
    endingSec: 5,
    detailShow: { status: true, note: true, tag: true },
    bgColor: '',
    bgImages: [],
    bgRotationSec: 8,
    bgOpacity: 100,
    bgBlur: 0,
    bgBrightness: 50,
    bgmTracks: [],
    bgmScale: 100,
    bgmX: 1,
    bgmY: 8,
    openingIds: [],
    openingCustom: false,
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
 * 会话同步签名：只有这些字段变化才需要重新问后端（媒体集 / 片段挂载 / 分组名 / BGM 素材）。
 * 其余参数走 {@link applyLocalParams} 本地补丁。
 */
export function sessionSignature(config: EditorConfig): string {
  return JSON.stringify({
    ids: config.ids,
    clips: config.mediaClips,
    groupBy: config.groupBy,
    bgm: config.bgmTracks.map((t) => `${t.name}:${t.base64?.length ?? 0}`),
  });
}

/** 纯参数补丁：字段名与 `RenderParams` 对齐，钳位交给 Remotion 侧 `resolveParams`。 */
export function applyLocalParams(input: MultiMediaPocInput, config: EditorConfig, mediaCount?: number): MultiMediaPocInput {
  const openingIds = config.openingCustom ? config.openingIds : [];
  // `openingIds` 里可能有已不在媒体集里的残留 id → 过滤，避免开场显影空转
  const validOpening = mediaCount === undefined
    ? openingIds
    : openingIds.filter((id) => input.media.some((media) => media.mediaId === id));
  return {
    ...input,
    style: config.groupStyle === 'clip' ? 'clip' : 'chapter',
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
      openingSpeed: config.openingSpeed,
      endingScrollSpeed: config.endingScrollSpeed,
      durations: {
        opening: config.openingSec,
        intro: config.introSec,
        group: config.groupSec,
        detail: config.detailSec,
        ending: config.endingSec,
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
  return { collectionId: null, year: '', tagId: null, tagName: '' };
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
    config: { ...config, bgmTracks: [] },
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
