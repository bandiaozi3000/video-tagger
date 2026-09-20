import { describe, expect, it } from 'vitest';
import {
  cinemaLayout, cinemaLayoutCached, hash01, heroCardCount, HERO_SLOT, MAX_HERO_CARDS, RAID_TAIL_SEC,
} from './slots';

const CARD_H = 0.56;
const CARD_W = CARD_H * 0.75;

function boxOf(slot: { x: number; y: number; s: number }) {
  return {
    x0: slot.x - (CARD_W * slot.s) / 2,
    x1: slot.x + (CARD_W * slot.s) / 2,
    y0: slot.y - (CARD_H * slot.s) / 2,
    y1: slot.y + (CARD_H * slot.s) / 2,
  };
}

function overlaps(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>): boolean {
  return !(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0);
}

const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);

describe('掠影中景卡：数量', () => {
  it('放得下就全放：10s 开场 → 掠影 5.5s，勾了 8 部 → 8 张', () => {
    expect(heroCardCount(5.5, 8)).toBe(8);
  });
  it('时长不够就按时长砍：2.2s 掠影只放得下 2 张', () => {
    expect(heroCardCount(2.2, 24)).toBe(2);
  });
  it('布局上限 9：时长再长也不超过', () => {
    expect(heroCardCount(60, 24)).toBe(MAX_HERO_CARDS);
  });
  it('短到放不下也至少 1 张（Hero 永远在）', () => {
    expect(heroCardCount(0.5, 24)).toBe(1);
    expect(heroCardCount(RAID_TAIL_SEC, 24)).toBe(1);
  });
  it('想要 0 张时取 1', () => {
    expect(heroCardCount(10, 0)).toBe(1);
  });
});

describe('掠影中景卡：Hero 硬保护（用户 2026-09-20「确保 Hero 不变不被遮挡」）', () => {
  it('Hero 的位置/尺度/旋转恒等于固定槽位，任何种子都一样', () => {
    for (const seed of SEEDS) {
      expect(cinemaLayout(9, seed)[0]).toEqual(HERO_SLOT);
    }
  });

  it('**任何种子**、任何张数下，没有一张卡碰到 Hero 的盒子（含余量）', () => {
    for (const seed of SEEDS) {
      for (const count of [2, 5, 9]) {
        const layout = cinemaLayout(count, seed);
        const heroBox = boxOf(layout[0]);
        layout.slice(1).forEach((slot, index) => {
          const box = boxOf(slot);
          // 用 ±0.02 的余量（与 slots.ts 的 HERO_MARGIN 一致）判定“贴边”也算不合规
          const tooClose = !(box.x1 + 0.02 < heroBox.x0 || heroBox.x1 + 0.02 < box.x0
            || box.y1 + 0.02 < heroBox.y0 || heroBox.y1 + 0.02 < box.y0);
          expect(tooClose, `seed=${seed} count=${count} 第 ${index + 1} 张贴上了 Hero`).toBe(false);
        });
      }
    }
  });

  it('Hero 永远是最大的那张', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const layout = cinemaLayout(9, seed);
      const rest = layout.slice(1).map((slot) => slot.s);
      expect(Math.max(...rest)).toBeLessThan(HERO_SLOT.s);
    }
  });
});

describe('掠影中景卡：真随机但确定性', () => {
  it('同一 seed → 完全同一份布局（Remotion 逐帧并行，不能用 Math.random）', () => {
    expect(cinemaLayout(9, 4242)).toEqual(cinemaLayout(9, 4242));
    expect(cinemaLayoutCached(9, 4242)).toEqual(cinemaLayout(9, 4242));
  });

  it('不同 seed → 布局确实不同（真的在随机，不是固定槽位）', () => {
    const signatures = new Set(SEEDS.map((seed) => JSON.stringify(cinemaLayout(9, seed))));
    expect(signatures.size).toBe(SEEDS.length);
  });

  it('每张卡的落点都有变化（不是“只有一次抖动”）', () => {
    // 同一张卡（index 1）在 60 个种子下至少要出现 30 种不同位置
    const xs = new Set(SEEDS.map((seed) => cinemaLayout(9, seed)[1].x.toFixed(4)));
    expect(xs.size).toBeGreaterThan(30);
  });

  it('尺度按 0.88 递减封顶（层次不被打乱、越后越小巧）', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const sizes = cinemaLayout(9, seed).map((slot) => slot.s);
      for (let i = 1; i < sizes.length; i++) {
        // 相邻两张的随机带上限允许轻微交叉（0.88/0.72 = 1.22），所以钉的是**封顶值**而不是两两对比
        const cap = 0.74 * Math.pow(0.88, i - 1);
        expect(sizes[i]).toBeLessThanOrEqual(cap + 1e-9);
      }
      expect(sizes[sizes.length - 1]).toBeLessThan(0.32);
    }
  });

  it('不出画：中心必须落在画幅内', () => {
    for (const seed of SEEDS) {
      for (const slot of cinemaLayout(9, seed)) {
        expect(slot.x).toBeGreaterThan(0);
        expect(slot.x).toBeLessThan(1);
        expect(slot.y).toBeGreaterThan(0);
        expect(slot.y).toBeLessThan(1);
      }
    }
  });

  it('卡不会被埋：自己的中心不落在别的卡盒子里', () => {
    for (const seed of SEEDS.slice(0, 25)) {
      const layout = cinemaLayout(9, seed);
      layout.forEach((slot, index) => {
        layout.forEach((other, otherIndex) => {
          if (index === otherIndex) return;
          const box = boxOf(other);
          const buried = slot.x > box.x0 && slot.x < box.x1 && slot.y > box.y0 && slot.y < box.y1;
          // Hero 之下允许（Hero 本来就在最上层盖别人），其余不允许
          if (otherIndex !== 0) expect(buried, `seed=${seed} #${index} 被 #${otherIndex} 埋住`).toBe(false);
        });
      });
    }
  });

  it('hash01 值域 [0,1) 且同参稳定', () => {
    for (let seed = 0; seed < 40; seed++) {
      const value = hash01(seed, 3);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(hash01(seed, 3)).toBe(value);
    }
  });
});
