/**
 * 段 → 可调时长类别（编辑器里拖拽把手的唯一依据）。
 *
 * 背景：`RenderParams.durations` 是**类级**参数（开场/序言/章节/资料/结尾各一个数），plan 每次按它们重算所有段。
 * 所以"拖第一张资料卡"和"拖另一张资料卡"改的是**同一个数**，UI 必须明确提示"×N 段一起变"，
 * 而不是假装逐段可调（逐段覆盖是另一套契约，见 worklog 的"方案 B"）。
 *
 * 个别类别是**派生**的，不是直接等于那个数：
 *   · cinema 的 SCAN/SETTLE = 开场 × 55% / 45%（`plan.ts` 里硬切）；
 *   · cinema 的 TITLE（片名卡） = **自己的数** `durations.title`（1-5s，2026-09-20 起）；COVER（封面镜头）= 资料 − 片名卡。
 * 拖这些段的把手 = 改它所属的那个数，行为仍然可预期。
 * 片段（MEDIA_CLIP / CLIP）时长由**素材决定**，不可调 → `null`。
 */
export type DurationKey = 'opening' | 'intro' | 'group' | 'detail' | 'title' | 'ending';

/** 各类别的秒数区间：与 `src/params.ts` 的 `resolveParams` 钳位保持一致（两侧不得给出两套区间）。 */
export const DURATION_LIMITS: Record<DurationKey, readonly [number, number]> = {
  opening: [2, 20],
  intro: [1, 10],
  group: [1, 10],
  detail: [3, 15],
  title: [1, 5],
  ending: [1, 10],
};

export const DURATION_LABEL: Record<DurationKey, string> = {
  opening: '开场',
  intro: '序言',
  group: '章节',
  detail: '资料卡',
  title: '片名卡',
  ending: '结尾',
};

/** 编辑器配置里的字段名（拖拽时写回它）。 */
export const DURATION_FIELD: Record<DurationKey, 'openingSec' | 'introSec' | 'groupSec' | 'detailSec' | 'titleSec' | 'endingSec'> = {
  opening: 'openingSec',
  intro: 'introSec',
  group: 'groupSec',
  detail: 'detailSec',
  title: 'titleSec',
  ending: 'endingSec',
};

/** 段类型 → 类别；`null` = 不可调（片段素材决定 / 未知类型）。 */
export function durationKeyOfScene(scene: { type: string }): DurationKey | null {
  switch (scene.type) {
    case 'COLLECTION_OPENING':
    case 'SCAN':
    case 'SETTLE':
      return 'opening';
    case 'COLLECTION_INTRO':
      return 'intro';
    case 'GROUP_INTRO':
      return 'group';
    case 'TITLE':
      // 片名卡：**自己的数**（2026-09-20 之前归在 detail 下 → 拖它反而改资料时长）
      return 'title';
    case 'MEDIA_INFO':
    case 'MEDIA_GRID':
    case 'COVER':
      return 'detail';
    case 'COLLECTION_ENDING':
    case 'ENDING':
      return 'ending';
    default:
      // MEDIA_CLIP / CLIP：素材长度决定，拖不动
      return null;
  }
}

/** 每个类别这轮 plan 里覆盖了多少段（提示"×N 段一起变"）。 */
export function countByKey(scenes: { type: string }[]): Record<DurationKey, number> {
  const counts: Record<DurationKey, number> = { opening: 0, intro: 0, group: 0, detail: 0, title: 0, ending: 0 };
  for (const scene of scenes) {
    const key = durationKeyOfScene(scene);
    if (key) counts[key] += 1;
  }
  return counts;
}

/** 按钳位区间取整到 0.5s（拖拽的手感粒度）。 */
export function clampSeconds(key: DurationKey, seconds: number): number {
  const [min, max] = DURATION_LIMITS[key];
  const rounded = Math.round(seconds * 2) / 2;
  return Math.max(min, Math.min(max, rounded));
}
