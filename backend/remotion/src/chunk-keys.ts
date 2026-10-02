import { mediaOfGroup, sceneLabel } from './scene-plan';
import type { MultiMediaPocInput, PocClip, PocMedia, Scene, ScenePlan } from './types';

/**
 * 「块键」——增量更新（按当前草稿只重渲变化块）的**唯一真源**（2026-10-01，设计规格 §4.1）。
 *
 * 为什么必须由渲染侧定义：**只有 plan 知道"哪些帧属于哪一段、这一段读了什么"**（段表在 TS 里，
 * `scene-plan.ts` / `cinema/plan.ts`；Java 只拿到 probe 输出的 `boundaryFrames`）。
 * Java 侧只负责把"全局键 + 本块各段键"拼起来算个 sha256 当块键（见 `ChunkKeys.assemble`），
 * 以及按键比对复用（`ChunkKeys.planReuse`）—— 分工：**TS 说"什么算内容"，Java 说"哪些块相等"**。
 *
 * 两层设计（保守口径，宁可多渲也不要误复用）：
 *  - **全局层** = 根节点每帧都画 / 影响全片时间轴的东西：画幅/fps/总帧数、`params`（除 `durations` ——
 *    它变了必然体现在总帧数与每段帧数上）、**每段 `sceneLabel` 序列**（底部 Trackbar 每帧都画，
 *    见 `RecommendComposition.tsx:40-55`）、BGM/sting/背景图素材指纹。
 *  - **段层** = 段类型 + 段时长 + 该段涉及的媒体/片段**全字段**（不做字段白名单 → 少一处漂移点）
 *    + 它们引用的素材指纹。
 *
 * ⚠️ **规范化（本项目最阴的坑）**：渲染脚本会把 `/covers/**` 改写成"本次素材服务"的绝对地址
 * （端口随机，每次运行都不同）。键若不剥离这一层，**同一份内容每轮算出的键都不同 → 永远全渲**。
 * 所以先过 {@link canonicalizePath}，且调用方传进来的必须是**改写前**的输入（脚本里就是磁盘上的 `input`）。
 *
 * ⚠️ **确定性红线**：只能用输入里的值（`seed` 属于输入）；禁止 `Date.now()` / `Math.random()` ——
 * 同一份草稿两轮算出的键必须逐字符相同，否则这个功能就成了随机全渲。
 */

/** 素材指纹表：`assetPath → "size-mtime"`（由调用方探测；本模块**不碰 fs**，浏览器侧也能安全 import）。 */
export interface KeyEnv {
  assetPrint: Record<string, string>;
}

/** 探不到素材指纹时的占位：**两轮都探不到**说明内容同样未知，仍可判定"没变"。 */
const NO_PRINT = 'missing';

/**
 * 绝对地址 → 根相对路径。只剥 `http(s)://<host>` 那一段（脚本改写的正是它）。
 * 相对路径原样返回（磁盘上的 `render-input.json` 存的就是 `/covers/...` 这种根相对形态）。
 */
export function canonicalizePath(path: string | undefined): string | undefined {
  if (!path) {
    return path;
  }
  const matched = /^https?:\/\/[^/]+(\/.*)$/.exec(path);
  return matched ? matched[1] : path;
}

/** FNV-1a 64 位（hex 16 字符）。纯 TS 实现：本模块会被 `src/` 的浏览器 bundle 收进去，不能用 `node:crypto`。 */
export function fnv1a64(text: string): string {
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i += 1) {
    // 逐 UTF-16 code unit：与文件编码/字节序无关 → 同内容在任何机器上都得到同一个键
    hash = ((hash ^ BigInt(text.charCodeAt(i))) & mask);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

function printOf(path: string | undefined, env: KeyEnv): string {
  const canonical = canonicalizePath(path);
  if (!canonical) {
    return '';
  }
  return env.assetPrint[canonical] ?? NO_PRINT;
}

function canonicalClip(clip: PocClip, env: KeyEnv): unknown {
  const assetPath = canonicalizePath(clip.assetPath);
  return { ...clip, assetPath, assetPrint: printOf(assetPath, env) };
}

function canonicalMedia(media: PocMedia, env: KeyEnv): unknown {
  return {
    ...media,
    coverAssetPath: canonicalizePath(media.coverAssetPath),
    coverPrint: printOf(media.coverAssetPath, env),
    clips: media.clips.map((clip) => canonicalClip(clip, env)),
  };
}

/** 全片媒体摘要（开场封面墙、落款封面墙用）：只有身份 + 封面指纹 + 标题年份，避免把整个 input 塞进去。 */
function mediaDigest(medias: readonly PocMedia[], env: KeyEnv): unknown[] {
  return medias.map((media) => [media.mediaId, media.title, media.year ?? null, canonicalizePath(media.coverAssetPath) ?? null, printOf(media.coverAssetPath, env)]);
}

/**
 * 全局层指纹。
 *
 * ⚠️ `durations` **刻意不入列**：它变了必然改 `durationInFrames` 或每段帧数，而这两者都在下面 ——
 * 单列一遍只会让"只改一个不影响总长的时长"这种不可能的情况也触发全渲。
 */
export function globalLayerKey(plan: ScenePlan, input: MultiMediaPocInput, env: KeyEnv): string {
  const params = plan.params;
  const { durations: _durations, bgmTracks, bgImages, ...rest } = params;
  /** 银幕式没有 Trackbar/Topbar（`cinema/index.tsx:35-59`）→ 它的画面不受"全局段标签序列"影响；
   *  章节式的底部 Trackbar 每帧都画（`RecommendComposition.tsx:40-55`）→ 必须带上。 */
  const templateStyle = String((plan as { style?: unknown }).style ?? '');
  return fnv1a64(JSON.stringify({
    fps: plan.fps,
    width: plan.width,
    height: plan.height,
    durationInFrames: plan.durationInFrames,
    templateStyle,
    params: {
      ...rest,
      bgImages: bgImages.map((path) => ({ path: canonicalizePath(path), print: printOf(path, env) })),
      bgmTracks: bgmTracks.map((track) => ({
        name: track.name,
        durationSec: track.durationSec ?? null,
        assetPath: canonicalizePath(track.assetPath) ?? null,
        assetPrint: printOf(track.assetPath, env),
      })),
      stingPrint: printOf(params.stingPath, env),
    },
    // 底部 Trackbar 每帧都画，读的就是这串标签（`sceneLabel`）+ 段位置
    scenes: templateStyle === 'cinema'
        ? null
        : plan.scenes.map((scene) => [scene.type, scene.fromFrame, scene.durationInFrames, sceneLabel(plan, scene, input.media.length)]),
  }));
}

/** 这一段渲染读了什么。`null` 段（媒体已被移出推荐）不参与。 */
function segmentPayload(scene: Scene, plan: ScenePlan, byId: Map<number, PocMedia>, env: KeyEnv): unknown {
  const base = {
    type: scene.type,
    durationInFrames: scene.durationInFrames,
    groupName: scene.groupName ?? null,
    groupIndex: scene.groupIndex ?? null,
    numberFrom: scene.numberFrom ?? null,
    groupSize: scene.groupSize ?? null,
    groupTopCount: scene.groupTopCount ?? null,
    kicker: scene.kicker ?? null,
  };
  const ids = scene.mediaIds ?? (scene.mediaId === undefined ? [] : [scene.mediaId]);
  const medias = ids.map((id) => byId.get(id)).filter((media): media is PocMedia => Boolean(media));
  const clip = scene.clipId === undefined || scene.mediaId === undefined
    ? null
    : byId.get(scene.mediaId)?.clips.find((item) => item.clipId === scene.clipId) ?? null;
  // 按 `string` 分支：银幕式的 `SCAN/SETTLE/…` 不在 `SceneType` 里，但这条通路两种模板共用
  //（脚本按形态调 `buildCinemaPlan` / `buildScenePlan`）
  switch (String(scene.type)) {
    // 封面墙 / 落款墙 / 开场速览：读的是"全片封面"，任何一部的封面或标题变了都得重渲这一块
    case 'COLLECTION_OPENING':
    case 'COLLECTION_ENDING':
    case 'SCAN':
    case 'SETTLE':
      return { ...base, digest: mediaDigest([...byId.values()].sort((a, b) => a.mediaId - b.mediaId), env), total: byId.size };
    // 章节页：标题行 + 该组成员的封面缩略图（`mediaOfGroup` 是它的取值口径）
    case 'GROUP_INTRO':
      return { ...base, medias: mediaOfGroup(plan, scene.groupName).map((media) => canonicalMedia(media, env)) };
    default:
      return {
        ...base,
        medias: medias.map((media) => canonicalMedia(media, env)),
        clip: clip ? canonicalClip(clip, env) : null,
      };
  }
}

/** 与 `plan.scenes` **一一对应**的段键（顺序即段序）。 */
export function segmentKeysOf(plan: ScenePlan, input: MultiMediaPocInput, env: KeyEnv): string[] {
  const byId = new Map(input.media.map((media) => [media.mediaId, media]));
  return plan.scenes.map((scene) => fnv1a64(JSON.stringify(segmentPayload(scene, plan, byId, env))));
}

/** 空环境（单测/不需要素材指纹时用）：所有素材指纹都是 `missing`。 */
export function emptyKeyEnv(): KeyEnv {
  return { assetPrint: {} };
}
