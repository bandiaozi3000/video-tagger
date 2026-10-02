import type { DetailShow } from './params';

/**
 * 「结构化场景」的关闭机制（用户 2026-09-30）。
 *
 * 需求原话：「这些结构化的场景都能关闭。后续假如我新增这些结构也能做到关闭。直接在卡片上加X吧，不然后续越加越多」
 * ——所以**不做一组开关面板**，而是：时间轴胶片条的卡片上直接 ✕，关掉的是**这一整类**段
 * （开场/序言/章节页/全片回顾/结尾），语义与旁边那枚时长牌一致（那枚牌也是"拖一张 = 这一类全变"）。
 *
 * 新增一类结构化场景时只需要在这里补一行映射（外加 `params.ts` 的 `DetailShow` 开关键），
 * 编辑器那边的 ✕ 会自己长出来 —— 这就是「后续新增也能关」的落点。
 *
 * 内容页（资料卡/网格/片名卡/封面镜头/片段）**故意不可关**：关掉它们等于没内容可看，
 * 要拿掉某一部请用左栏「推荐顺序」的 ✕，要拿掉某个片段用片段卡自己的 ✕。
 */
export const SECTION_LABEL = {
  opening: '开场',
  intro: '序言',
  group: '章节页',
  recap: '全片回顾',
  ending: '结尾',
} as const;

export type SectionKey = keyof typeof SECTION_LABEL;

/**
 * 类别 → 开关名（`detailShow` 里的键）。
 *
 * ⚠️ 复用 `detailShow` 这张已有的「显示开关」表**是刻意的**：它已经贯通
 * 编辑器 → `RecommendController`/`RecommendVideoService` → `RecommendService.buildRenderInput` 的白名单，
 * 新增一个顶层参数要在 6 处方法签名里穿一遍（项目规则 §46 记过这个坑）。
 */
export const SECTION_SWITCH: Record<SectionKey, keyof DetailShow> = {
  opening: 'sectionOpening',
  intro: 'sectionIntro',
  group: 'sectionGroup',
  recap: 'sectionRecap',
  ending: 'sectionEnding',
};

/**
 * 场景 → 可关闭类别；`null` = 内容页，不给 ✕。
 *
 * `GROUP_INTRO` 有两种角色：章节页（无 `mediaIds`）和**结尾回顾的题头**（带 `mediaIds`，
 * 见 `scene-plan.ts` 的 `recap()`）——后者要跟 `RECAP_LIST` 一起关，否则关掉卡墙会剩一排空题头页。
 */
export function sectionKeyOfScene(scene: { type: string; mediaIds?: number[] }): SectionKey | null {
  switch (scene.type) {
    case 'COLLECTION_OPENING':
    case 'SCAN':            // 银幕式：掠影
    case 'SETTLE':          // 银幕式：落位（与 SCAN 同属「开场」）
      return 'opening';
    case 'COLLECTION_INTRO':
      return 'intro';
    case 'GROUP_INTRO':
      return scene.mediaIds && scene.mediaIds.length > 0 ? 'recap' : 'group';
    case 'RECAP_LIST':
      return 'recap';
    case 'COLLECTION_ENDING':
    case 'ENDING':          // 银幕式：落款
      return 'ending';
    default:
      return null;
  }
}

/**
 * 已关闭的类别（`sectionXxx === false`）。
 *
 * **省略 = 开**：老草稿没这些键 → 结构一字不变（与 `titleNote` 同一套兼容口径）。
 */
export function hiddenSectionsOf(show?: Partial<DetailShow> | null): SectionKey[] {
  const s = show ?? {};
  return (Object.keys(SECTION_LABEL) as SectionKey[]).filter((key) => s[SECTION_SWITCH[key]] === false);
}

/**
 * 拿掉已关闭的段，并**重排 `fromFrame`**（总长随之缩短）。
 *
 * 必须在 `audioWindows` / 返回值之前做：计划表是时间轴、进度条、导出分块的唯一依据，
 * 留下空洞会让后面所有段错位（画面与游标对不上）。
 */
export function withoutHiddenSections<T extends { type: string; mediaIds?: number[]; fromFrame: number; durationInFrames: number }>(
  scenes: readonly T[],
  hidden: readonly SectionKey[],
): T[] {
  if (hidden.length === 0) return [...scenes];
  let from = 0;
  const kept: T[] = [];
  for (const scene of scenes) {
    const key = sectionKeyOfScene(scene);
    if (key !== null && hidden.includes(key)) continue;
    kept.push({ ...scene, fromFrame: from });
    from += scene.durationInFrames;
  }
  return kept;
}

/** 计划表总帧数（过滤后重算用）。 */
export function totalFramesOf(scenes: readonly { durationInFrames: number }[]): number {
  return scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0);
}
