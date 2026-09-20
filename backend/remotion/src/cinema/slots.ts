/**
 * 掠影段（`Scan`）中景卡的**摆位**规则：Hero 固定 + 其余卡由种子驱动的**真随机**摆位（带拒绝采样）。
 *
 * 演进（每一条都是用户在看片时提的）：
 *   1. 「中景只能显示 5 张吗？」→ 张数按时长自动（`heroCardCount`，方案 B）；
 *   2. 「即使勾选多部，当时显示会被遮挡」→ 陪衬卡原先落进 hero 的盒子里（几何实测），改到空带；
 *   3. 「槽位是固定的，不能真随机吗？」→ 除 Hero 外**全部随机摆位**，种子存在草稿里（编辑器「🎲 重排」）。
 *
 * 三条硬约束（有单测钉死）：
 *   · **Hero 不动**：位置/尺度恒等于 `HERO_SLOT`，不参与随机；
 *   · **Hero 不被遮挡**：随机候选一律做**盒相交检测**，碰到 hero 盒（含余量）直接重摇；
 *   · **确定性**：同一 `seed` 必须得到同一份布局 —— Remotion 逐帧并行渲染，`Math.random()` 会让
 *     同一帧在不同 chunk / 重渲时摆到不同位置（`src/animation.ts` 里也记着这条规矩）。
 */

/** 每张飘落卡的间隔（秒）——与 `Scan` 的拍点一致。 */
export const RAID_STEP_SEC = 0.26;
/** 落位(0.46) + 标题淡入(+0.12) + 幽灵卡(+0.75) + 横扫(0.6) 之后，开场还要留出的尾巴（秒）。 */
export const RAID_TAIL_SEC = 0.46 + 0.12 + 0.75 + 0.6;
/** 布局上限 9（= Hero + 8 张随机卡）。再多卡片会小到看不清（尺度按 0.88 递减）。 */
export const MAX_HERO_CARDS = 9;

/** Hero 的固定落位（画幅比例）——用户 2026-09-20：「确保 Hero 不变不被遮挡」。 */
export const HERO_SLOT = { x: 0.3, y: 0.52, s: 1.0, rot: -3 };

/** 卡片基准尺寸（画幅比例）：`baseH = 0.56h`、`baseW = 0.75·baseH`（与 `RaidCard` 一致，用于盒相交判定）。 */
const CARD_H = 0.56;
const CARD_W = CARD_H * 0.75;

/** Hero 盒周围的额外余量（画幅比例）：别让随机卡贴着 Hero 边缘。 */
const HERO_MARGIN = 0.02;

/**
 * 随机摆位的**空带**（画幅比例）：只在这里摇。
 * 依据是 Hero 盒（x 0.18~0.42 / y 0.24~0.80）与左下标题区（x<0.5 且 y>0.72）之外的空隙。
 */
const ZONES: { x0: number; x1: number; y0: number; y1: number }[] = [
  { x0: 0.28, x1: 0.94, y0: 0.06, y1: 0.20 },   // 顶部带
  { x0: 0.56, x1: 0.97, y0: 0.24, y1: 0.78 },   // 右侧带
  { x0: 0.50, x1: 0.95, y0: 0.80, y1: 0.94 },   // 底部带（避开左下标题）
  { x0: 0.04, x1: 0.15, y0: 0.06, y1: 0.40 },   // 左侧竖带
];

/**
 * 中景卡张数 = `min(想要的张数, 时间放得下的张数, 布局上限)`，至少 1 张。
 *
 * @param seconds 掠影段可用时长（秒）
 * @param wanted  想要的张数（勾了开场秀 = 勾选里在本片单中的数量；没勾 = 全片单）
 */
export function heroCardCount(seconds: number, wanted: number): number {
  const maxByTime = Math.floor((seconds - RAID_TAIL_SEC) / RAID_STEP_SEC) + 1;
  return Math.max(1, Math.min(MAX_HERO_CARDS, wanted, maxByTime));
}

/** 确定性伪随机 → [0, 1)。同一 (seed, salt) 永远同一个值，不依赖渲染顺序。 */
export function hash01(seed: number, salt: number): number {
  let h = Math.imul(((seed | 0) ^ 0x9e3779b9) + Math.imul(salt + 1, 0x27d4eb2d), 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export interface CardSlot {
  x: number;
  y: number;
  s: number;
  rot: number;
}

/** 摆位盒（像素）：x/y 为卡中心，返回四边。 */
function boxOf(slot: CardSlot): { x0: number; x1: number; y0: number; y1: number } {
  const w = CARD_W * slot.s;
  const h = CARD_H * slot.s;
  return { x0: slot.x - w / 2, x1: slot.x + w / 2, y0: slot.y - h / 2, y1: slot.y + h / 2 };
}

function intersects(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>, margin = 0): boolean {
  return !(a.x1 + margin < b.x0 || b.x1 + margin < a.x0 || a.y1 + margin < b.y0 || b.y1 + margin < a.y0);
}

/**
 * 一份布局（`count` 张，index 0 恒为 Hero）。
 *
 * 第 `i` 张（i≥1）：从空带里摇一个候选 → 若碰到 Hero 盒、或自己的中心落在已摆好的卡里 → 重摇，
 * 最多 60 次；60 次都失败就取"离已摆卡最远"的那个候选（保证一定能出图）。
 * 尺度上限按 0.88 递减（`0.74·0.88^(i-1)`，再在 0.72~1.0 之间摇）→ **越靠前越大**、Hero 永远最大。
 */
export function cinemaLayout(count: number, seed: number): CardSlot[] {
  const slots: CardSlot[] = [HERO_SLOT];
  const heroBox = boxOf(HERO_SLOT);
  const rand = (index: number, salt: number) => hash01(Math.imul(seed, 0x9e3779b1) + index * 7919, salt);
  for (let i = 1; i < Math.max(1, count); i++) {
    const cap = 0.74 * Math.pow(0.88, i - 1);
    let best: CardSlot | null = null;
    let bestScore = -1;
    for (let attempt = 0; attempt < 60; attempt++) {
      const salt = 100 + attempt * 17;
      const zone = ZONES[Math.floor(rand(i, salt) * ZONES.length) % ZONES.length];
      const candidate: CardSlot = {
        x: zone.x0 + rand(i, salt + 1) * (zone.x1 - zone.x0),
        y: zone.y0 + rand(i, salt + 2) * (zone.y1 - zone.y0),
        s: cap * (0.72 + rand(i, salt + 3) * 0.28),
        rot: -6 + rand(i, salt + 4) * 12,
      };
      const box = boxOf(candidate);
      if (intersects(box, heroBox, HERO_MARGIN)) continue;   // Hero 硬保护：碰到就重摇
      // 中心别落进已摆好的卡里（否则会被压住看不见）
      const buried = slots.some((placed) => {
        const placedBox = boxOf(placed);
        return candidate.x > placedBox.x0 && candidate.x < placedBox.x1
          && candidate.y > placedBox.y0 && candidate.y < placedBox.y1;
      });
      if (!buried) {
        best = candidate;
        break;
      }
      // 记下"离已摆卡最远"的候选，作为 60 次都失败时的兜底
      const score = Math.min(...slots.map((placed) => {
        const placedBox = boxOf(placed);
        return Math.max(placedBox.x0 - candidate.x, candidate.x - placedBox.x1, placedBox.y0 - candidate.y, candidate.y - placedBox.y1);
      }));
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    slots.push(best ?? { x: 0.5, y: 0.5, s: cap, rot: 0 });
  }
  return slots;
}

/** 同 `(count, seed)` 的布局缓存（逐帧都会问一次，重算 9 张 × 60 次没必要反复做）。 */
const LAYOUT_CACHE = new Map<string, CardSlot[]>();

export function cinemaLayoutCached(count: number, seed: number): CardSlot[] {
  const key = `${count}:${seed}`;
  let layout = LAYOUT_CACHE.get(key);
  if (!layout) {
    layout = cinemaLayout(count, seed);
    if (LAYOUT_CACHE.size > 64) LAYOUT_CACHE.clear();
    LAYOUT_CACHE.set(key, layout);
  }
  return layout;
}
