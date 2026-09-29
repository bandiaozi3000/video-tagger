import { hash01 } from './cinema/slots';
import { resolveParams, resolveStyle } from './params';
import { recapPages, recapSeconds } from './recap';
import { RECOMMEND_TIERS, tierRankOf } from './tier';
import type { GroupPlan, MultiMediaPocInput, PocMedia, Scene, ScenePlan } from './types';
import { TEMPLATE_IDS } from './types';

export type { GroupPlan };

/** 结尾「全片回顾 · X」题头的前缀（X = 档名；用户 2026-09-26：「结尾回顾按全局等级分组回顾」）。 */
export const RECAP_PREFIX = '全片回顾 · ';

/** 关掉等级二级分组时的旧结尾题头（只含第 1 档，一页一屏）。 */
export const FEATURED_RECAP_TITLE = '全片核心回顾';

/** 结尾回顾里「未标推荐等级」那一段的题头（用户 2026-09-26 拍板用词：**其它**，不用“未分类”）。 */
export const UNMARKED_RECAP_TITLE = '其它';

/**
 * 结尾（落款）封面墙**铺几行**。
 *
 * 为什么必须封顶：`Ending.tsx` 是纵向居中的 flex，封面墙是它的最后一个子元素 ——
 * 全量铺的时候，222 部的墙 ≈ 21 行 ≈ 3600px，把居中的「THE END / 结尾标题 / 文案」推到画面**上方 1300px 之外**，
 * 成片里就只剩一堆封面（用户 2026-09-26 报「最后结尾的感谢观看也没有」）。两行足够“铺满”，剩下的全在结尾回顾卡墙里。
 */
export const ENDING_WALL_ROWS = 2;

/** 结尾封面墙显示几张（按画幅宽算每行几张 × {@link ENDING_WALL_ROWS}）。 */
export function endingWallCount(options: { width: number; height: number; wallRatio: number }): number {
  const coverW = options.height * options.wallRatio * 0.7;      // 墙上是 0.7 宽高比的竖排封面
  const gap = options.width * 0.011;                            // 与 `Ending.tsx` 的 gap 同源
  const maxW = options.width * 0.78;                            // 墙的 maxWidth
  const perRow = Math.max(1, Math.floor((maxW + gap) / (coverW + gap)));
  return perRow * ENDING_WALL_ROWS;
}

/**
 * 结尾封面墙**摆哪几张**（用户 2026-09-26：「第一档然后随机展示就行」）。
 *
 * 规则：**先按推荐等级（第 1 档优先），同档内按草稿 `seed` 确定性洗牌**，取前 `count` 张。
 * 第 1 档不够（或没人标等级）时自然往下顶，不会空一半。
 *
 * 为什么不能真 `Math.random()`：Remotion 逐帧并行渲染，同一帧在不同 chunk/重渲时会摆成两样
 * （`src/animation.ts` / `cinema/slots.ts` 都记着这条）—— 同一 `seed` 必须完全一致。
 * 想换一批就改草稿 `seed`（编辑器里银幕式那侧的 **🎲 换个摆位**；章节式目前没这个按钮）。
 */
export function endingWallCovers<T extends { tier?: number }>(
  media: readonly T[], options: { count: number; seed: number },
): T[] {
  const unranked = RECOMMEND_TIERS.length;                      // 未标等级的排最后
  return media
    .map((item, index) => ({ item, rank: tierRankOf(item) ?? unranked, key: hash01(options.seed, index + 1) }))
    .sort((a, b) => a.rank - b.rank || a.key - b.key)           // 等级优先，同档内靠随机键排
    .slice(0, options.count)
    .map((entry) => entry.item);
}

/** 二级分组里「未标等级」那一群：**不加后缀**（用户 2026-09-26：「推荐显示未分级去掉」）—— 组名就用一级组名。 */

/**
 * 「本片核心」= **推荐等级第 1 档**（index 0）。背景：2026-09-26 用户拍板「等级取代 ★ 重点」
 * —— 同一张卡上不再有两套"重要度"，第 1 档就是原来的 ★：组内排最前 + 结尾全片回顾。
 *
 * ⚠️ 组首「本组核心」区已按用户 2026-09-26「这块去掉，通过分组展示即可」**整块删除**；
 * 现在第 1 档靠等级二级分组自成最前一群 + 卡片上的彩虹环/「强推」胶囊标识。
 */
export function isCore(media: { tier?: number }): boolean {
  return media.tier === 0;
}

/** 本组顺序：第 1 档（核心）排最前 —— 关掉等级二级分组时，组首讲完就直接进群像。 */
function coreFirst<T extends { tier?: number }>(list: T[]): T[] {
  return [...list.filter(isCore), ...list.filter((m) => !isCore(m))];
}

/** 组内第 1 档（名次 0）的部数：组标题行那枚「✦ 强推 N」胶囊读它（**整组**而不是当前屏）。 */
function groupTopCountOf(list: PocMedia[]): number {
  return list.filter(isCore).length;
}

/**
 * 二级分组：把一组切成若干「等级群」（用户 2026-09-26：「按年份分组后再支持按推荐等级接着分组」）。
 *
 * 三条口径：
 *  1. 档序 = `RECOMMEND_TIERS` 顺序；空档不生成。**未标等级的那群垫最后、不加后缀**
 *     （组名就用一级组名；用户 2026-09-26：「推荐显示未分级去掉」）。
 *  2. 整组**没有任何一部标了等级 → 不切**（组名/结构原样）—— 「没标等级的老草稿结构零变化」就靠这条。
 *  3. 子组名 = `一级组名 · 档名`（一级组名为空时只用档名）；只有**每个一级组的第一个子组**带 `firstOfParent`
 *     —— 章节页配一级组各一页（档与档之间插页只会把成片白白拉长）。
 */
function splitByTier(entry: { name: string; media: PocMedia[] }, tierGroup: boolean):
    { name: string; media: PocMedia[]; firstOfParent: boolean }[] {
  if (!tierGroup || !entry.media.some((media) => tierRankOf(media) !== null)) {
    return [{ name: entry.name, media: entry.media, firstOfParent: true }];
  }
  const label = (suffix: string): string => (entry.name ? `${entry.name} · ${suffix}` : suffix);
  const subs: { name: string; media: PocMedia[] }[] = [];
  RECOMMEND_TIERS.forEach((tierName, rank) => {
    const bucket = entry.media.filter((media) => tierRankOf(media) === rank);
    if (bucket.length > 0) subs.push({ name: label(tierName), media: bucket });
  });
  const unranked = entry.media.filter((media) => tierRankOf(media) === null);
  if (unranked.length > 0) subs.push({ name: entry.name, media: unranked });
  return subs.map((sub, index) => ({ ...sub, firstOfParent: index === 0 }));
}

/** 组首核心数量 ≤ 这个值 → 逐部满屏；否则一屏大卡。 */
const CORE_SOLO_MAX = 2;

/**
 * 帧级场景计划 —— **唯一时长权威**（设计规格 §6.1）。
 *
 * 秒 → 帧只在这里发生；Java 侧只保留"给用户看的预估时长"。
 * 分组、每屏几部、两套模板形态的差异全部在这里表达，组件不再自己判断结构。
 */

/** 秒 → 帧（舍入，至少 1 帧）。 */
const secToFrames = (seconds: number, fps: number): number => Math.max(1, Math.round(seconds * fps));

/** 分组名里的年份（用于 `groupBy=year` 的组排序）；解析不出 → null（排最后）。 */
function yearOfGroup(name: string): number | null {
  const matched = /(\d{2,4})/.exec(name);
  return matched ? Number(matched[1]) : null;
}

/**
 * 按 `groupBy` / `groupSort` 排出「组 → 媒体」结构，可选**再按推荐等级切一级**。
 *
 * 分组名由 Java 侧计算（`year` / `subcategory` / `collection` 需要 DB 查询，见
 * `RecommendService.groupOf`），这里只负责排序、二级切分与兜底文案。
 */
export function groupMedia(input: MultiMediaPocInput, groupBy: string, groupSort: string, tierGroup = false): GroupPlan[] {
  const useGroups = groupBy.trim() !== '' && groupBy !== 'none';
  const buckets = new Map<string, PocMedia[]>();
  const order: string[] = [];
  for (const media of input.media) {
    const name = useGroups ? (media.group?.trim() || '未分组') : '';
    if (!buckets.has(name)) {
      buckets.set(name, []);
      order.push(name);
    }
    buckets.get(name)!.push(media);
  }
  let names = order;
  if (useGroups && groupBy === 'year' && groupSort !== 'none') {
    const desc = groupSort !== 'date-asc';
    names = [...order].sort((a, b) => {
      const an = yearOfGroup(a);
      const bn = yearOfGroup(b);
      if (an === null && bn === null) return a.localeCompare(b);
      if (an === null) return 1;
      if (bn === null) return -1;
      return desc ? bn - an : an - bn;
    });
  }
  // ★→等级（2026-09-26）：第 1 档仍是「核心」（`isCore`）——
  //   ① 关掉等级二级分组时靠 `coreFirst` 把它提到组首（组首讲完直接进群像，叙事不跳）；
  //   ② 开着二级分组时它自成最前一群，`coreFirst` 退化成 no-op（无害，留着当兜底）。
  const groups: GroupPlan[] = [];
  names.forEach((name, index) => {
    for (const sub of splitByTier({ name, media: coreFirst(buckets.get(name)!) }, tierGroup)) {
      groups.push({
        name: sub.name,
        index: useGroups ? index : -1,
        media: sub.media,
        parentName: name,
        firstOfParent: sub.firstOfParent,
      });
    }
  });
  return groups;
}

export function buildScenePlan(input: MultiMediaPocInput): ScenePlan {
  validateInput(input);
  const params = resolveParams(input.params, input);
  const style = resolveStyle(input);
  const { fps, width, height, perScreen } = params;
  const scenes: Scene[] = [];
  let fromFrame = 0;
  const push = (scene: Omit<Scene, 'fromFrame' | 'durationInFrames'>, durationInFrames: number): Scene => {
    const full: Scene = { ...scene, fromFrame, durationInFrames };
    scenes.push(full);
    fromFrame += durationInFrames;
    return full;
  };

  push({ type: 'COLLECTION_OPENING' }, secToFrames(params.durations.opening, fps));
  // 序言屏：intro 文案为空则不产生；片段型形态跳过（形态差异，见设计规格 §6.2）
  if (params.intro.trim() && style === 'chapter') {
    push({ type: 'COLLECTION_INTRO' }, secToFrames(params.durations.intro, fps));
  }

  const groups = groupMedia(input, params.groupBy, params.groupSort, params.tierGroup);
  /** 成片里的"第几次露脸"序号：跨组连续（结尾回顾另起一套 ord）。 */
  let seq = 0;
  for (const group of groups) {
    // 分组章节页：只有章节叙事型且确实有分组时才出现。
    // 二级分组时标题用**一级组名**（年份），且**只在该级第一个子组前**插页 —— 每年仍一页。
    if (group.index >= 0 && group.firstOfParent !== false && style === 'chapter') {
      push({ type: 'GROUP_INTRO', groupName: group.parentName ?? group.name, groupIndex: group.index },
          secToFrames(params.durations.group, fps));
    }
    // 资料卡 / 每屏 N 部网格（序号按**推荐顺序**从 1 连续数：用户 2026-09-26「下面数量展示应该根据推荐顺序从1往后加」）
    const chunks: PocMedia[][] = [];
    for (let i = 0; i < group.media.length; i += perScreen) {
      chunks.push(group.media.slice(i, i + perScreen));
    }
    for (const chunk of chunks) {
      // `seq` 是**成片里第几次露脸**（跨组连续），不是 Java 的请求序号 —— 底部进度条与资料卡大号数字都读它
      const numberFrom = seq + 1;
      seq += chunk.length;
      if (chunk.length === 1 && perScreen === 1) {
        push({ type: 'MEDIA_INFO', mediaId: chunk[0].mediaId, numberFrom, groupSize: group.media.length,
               groupTopCount: groupTopCountOf(group.media) }, secToFrames(params.durations.detail, fps));
      } else {
        push({ type: 'MEDIA_GRID', mediaIds: chunk.map((m) => m.mediaId), numberFrom, groupName: group.name,
               groupSize: group.media.length, groupTopCount: groupTopCountOf(group.media) },
            secToFrames(params.durations.detail, fps));
      }
      // 片段屏：每个片段独占一个场景（时长来自素材本身，不由 durations 决定）
      for (const media of chunk) {
        for (const clip of media.clips) {
          push(
            { type: 'MEDIA_CLIP', mediaId: media.mediaId, clipId: clip.clipId },
            secToFrames(clip.durationMs / 1000, fps),
          );
        }
      }
    }
  }

  // 结尾「全片回顾」：**按推荐等级全局分组**（用户 2026-09-26：「结尾回顾按全局等级分组回顾」）。
  //   一档 = 一页题头（`GROUP_INTRO`，自带 `mediaIds` 才能报对「共 N 部」+ 缩略图排）
  //        + **一段分页小卡墙**（`RECAP_LIST`：一页 12×3 = 36 张，卡片带标题/年份/集数，页时长 = 错峰 + 停留）。
  //   旧版每档切若干屏网格、每屏按资料屏 7 秒放 —— 一部一屏地重播，实测占到全片 43%
  //   （用户：「结尾回顾太长了，几乎和整片一样了」），已改成卡墙；页时长由 `endingScrollSpeed` 当节奏档。
  //   **未标等级的也出一段**（用户 2026-09-26：「一般和未分类我没看到总结」，题头叫「其它」）：旧规则「未分级不进回顾」
  //   本是为了别把全片重播一遍，卡墙下来一部 0.17s，37 部才多两页 —— 不再成立。空档（如「一般」0 部）仍不生成页。
  //   关掉二级分组 → 退回旧的「全片核心回顾」（只第 1 档，同样改成卡墙）。
  if (style === 'chapter') {
    const groupFrames = secToFrames(params.durations.group, fps);
    // 档内顺序 = **年份序**：`groups` 本来就是「年份为主序」（`groupSort` 已排好），
    // 展平后按档过滤，天然得到「等级 → 年份」（不用再排一次、也不会与正文口径打架）。
    const ordered = groups.flatMap((group) => group.media);
    const recap = (title: string, media: PocMedia[], groupIndex: number): void => {
      const ids = media.map((item) => item.mediaId);
      push({ type: 'GROUP_INTRO', groupName: title, groupIndex, mediaIds: ids }, groupFrames);
      push({ type: 'RECAP_LIST', groupName: title, mediaIds: ids },
           secToFrames(recapSeconds(recapPages(media), params.endingScrollSpeed), fps));
    };
    if (params.tierGroup) {
      RECOMMEND_TIERS.forEach((tierName, rank) => {
        const list = ordered.filter((media) => tierRankOf(media) === rank);
        if (list.length > 0) recap(`${RECAP_PREFIX}${tierName}`, list, groups.length + rank);
      });
      const unmarked = ordered.filter((media) => tierRankOf(media) === null);
      if (unmarked.length > 0) recap(`${RECAP_PREFIX}${UNMARKED_RECAP_TITLE}`, unmarked, groups.length + RECOMMEND_TIERS.length);
    } else {
      const coreAll = ordered.filter(isCore);
      if (coreAll.length > 0) recap(FEATURED_RECAP_TITLE, coreAll, groups.length);
    }
  }

  push({ type: 'COLLECTION_ENDING' }, secToFrames(params.durations.ending, fps));

  const audioWindows = scenes
    .filter((scene) => {
      if (scene.type !== 'MEDIA_CLIP') return false;
      const media = input.media.find((m) => m.mediaId === scene.mediaId);
      const clip = media?.clips.find((c) => c.clipId === scene.clipId);
      return Boolean(clip?.hasAudio);
    })
    .map((scene) => ({ fromFrame: scene.fromFrame, toFrame: scene.fromFrame + scene.durationInFrames }));

  return {
    style,
    fps,
    width,
    height,
    durationInFrames: fromFrame,
    scenes,
    audioWindows,
    params,
    mediaIndex: new Map(input.media.map((media) => [media.mediaId, media])),
    groups,
  };
}

/** 某帧是否有片段原声（BGM ducking 依据）。 */
export function hasOriginalAudioAt(plan: ScenePlan, frame: number): boolean {
  return plan.audioWindows.some((w) => frame >= w.fromFrame && frame < w.toFrame);
}

function validateInput(input: MultiMediaPocInput): void {
  if (!input || !TEMPLATE_IDS.includes(input.template)) throw new Error('推荐模板类型无效');
  if (input.style !== undefined && input.style !== 'chapter' && input.style !== 'clip') throw new Error('模板形态无效');
  if (!Array.isArray(input.media) || input.media.length === 0) throw new Error('至少需要一个媒体');
  const mediaIds = new Set<number>();
  const clipIds = new Set<number>();
  for (const media of input.media) {
    validateMedia(media, mediaIds, clipIds);
  }
}

function validateMedia(media: PocMedia, mediaIds: Set<number>, clipIds: Set<number>): void {
  if (!Number.isInteger(media.mediaId) || media.mediaId <= 0) throw new Error('媒体 ID 无效');
  if (mediaIds.has(media.mediaId)) throw new Error('媒体 ID 重复');
  mediaIds.add(media.mediaId);
  if (!media.title?.trim()) throw new Error('媒体标题不能为空');
  if (!Array.isArray(media.tags)) throw new Error('媒体标签必须是数组');
  if (!Array.isArray(media.clips)) throw new Error('媒体 Clip 必须是数组');
  if (media.mode === 'INFO_ONLY' && media.clips.length > 0) throw new Error('INFO_ONLY 媒体不能包含 Clip');
  if (media.mode === 'CLIPS_SELECTED' && media.clips.length === 0) throw new Error('CLIPS_SELECTED 媒体必须包含 Clip');
  for (const clip of media.clips) {
    if (!Number.isInteger(clip.clipId) || clip.clipId <= 0) throw new Error('Clip ID 无效');
    if (clipIds.has(clip.clipId)) throw new Error('Clip ID 重复');
    clipIds.add(clip.clipId);
    if (!clip.title?.trim()) throw new Error('Clip 标题不能为空');
    if (!clip.assetPath?.trim()) throw new Error('Clip 素材路径不能为空');
    if (!Number.isFinite(clip.durationMs) || clip.durationMs <= 0) throw new Error('Clip 时长必须大于 0');
  }
}

export function mediaForScene(plan: ScenePlan, scene: Scene): PocMedia | undefined {
  return scene.mediaId === undefined ? undefined : plan.mediaIndex.get(scene.mediaId);
}

/**
 * 按组名取成员（章节页用；预先分组过，避免每帧扫全表）。
 *
 * 二级分组时按**一级组名**把子组合并 —— 未标等级那群现在也叫一级组名，所以**不能先做精确匹配**，
 * 否则章节页的「共 N 部」与缩略图只会数到未标等级那一批。
 */
export function mediaOfGroup(plan: ScenePlan, groupName: string | undefined): PocMedia[] {
  if (!groupName) return [];
  const children = plan.groups.filter((group) => (group.parentName ?? group.name) === groupName);
  if (children.length > 0) return children.flatMap((group) => group.media);
  return plan.groups.find((group) => group.name === groupName)?.media ?? [];
}

/** 底部进度条文案。 */
export function sceneLabel(plan: ScenePlan, scene: Scene | undefined, total: number): string {
  if (!scene) return '—';
  if (scene.type === 'COLLECTION_OPENING') return '开场';
  if (scene.type === 'COLLECTION_INTRO') return '序言';
  if (scene.type === 'COLLECTION_ENDING') return '结尾';
  if (scene.type === 'GROUP_INTRO') return `章节 · ${scene.groupName ?? ''}`;
  if (scene.type === 'RECAP_LIST') return `${scene.groupName ?? '全片回顾'} · ${scene.mediaIds?.length ?? 0} 部`;
  if (scene.type === 'MEDIA_GRID') {
    const first = scene.mediaIds?.[0];
    const from = scene.numberFrom ?? 1;
    const to = from + (scene.mediaIds?.length ?? 1) - 1;
    return first === undefined ? `— / ${total}` : `${from}-${to} / ${total}`;
  }
  const media = mediaForScene(plan, scene);
  if (!media) return '—';
  return scene.type === 'MEDIA_CLIP' ? `${media.title} · 片段` : `${media.title}`;
}
