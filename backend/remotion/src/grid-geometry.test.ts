import { describe, expect, it } from 'vitest';
import { gridGeometry } from './scenes/Cards';
import { openingCardSize } from './scenes/Opening';
import { CHAPTER_THEME, CLIP_THEME, type Theme } from './theme';

/**
 * 卡片几何回归门禁（2026-09-26）。
 *
 * 两个都是**真实踩过的坑**，都必须由测试锁住：
 *   1. 网格屏卡片高原来写成 `coverH + height*0.24` —— perScreen=10 时每卡 586px，
 *      两行加行距 1220px > 1080 → **第二行被画出画面外**（用户报「图片显示不全而且过大」）；
 *   2. 开场封面高原来写成 `cardWidth * cardAspect` —— `cardAspect` 是宽/高比（0.70），
 *      乘出来是横版卡，竖版封面被裁成一条横带（用户报「封面为什么是宽图」）。
 */

const FRAMES = [
  { name: '720P', w: 1280, h: 720 },
  { name: '1080P', w: 1920, h: 1080 },
  { name: '4K', w: 3840, h: 2160 },
];

const THEMES: [string, Theme][] = [['chapter', CHAPTER_THEME], ['clip', CLIP_THEME]];

describe('gridGeometry：任何 perScreen × 画幅都不溢出画幅', () => {
  for (const [label, theme] of THEMES) {
    for (const frame of FRAMES) {
      // perScreen 的可取范围是 1-10（`params.ts` 的 clamp）
      for (let count = 1; count <= 10; count += 1) {
        it(`${label} · ${frame.name} · 一屏 ${count} 部`, () => {
          const g = gridGeometry(theme, frame.w, frame.h, count);

          // ① 纵向总占用（上留白 + 组标签 + 卡片 + 行间距 + 底部留白）不得超出画幅
          const used = g.pad + g.padBottom + g.labelH + g.cardH * g.rows + g.gap * (g.rows - 1);
          expect(used).toBeLessThanOrEqual(frame.h + 0.01);

          // ② 横向总占用（卡片 + 列间距）不得超出内容区
          const usedW = g.cardW * g.columns + g.gap * (g.columns - 1);
          expect(usedW).toBeLessThanOrEqual(g.contentW + 0.01);

          // ③ 封面与文字区都是正高度，且相加正好等于卡片高（文字区用 flex:1 吃满剩余）
          expect(g.coverH).toBeGreaterThan(0);
          expect(g.cardH).toBeGreaterThan(g.coverH);
          expect(g.coverH + (g.cardH - g.coverH)).toBeCloseTo(g.cardH, 6);

          // ④ 行数 × 列数必须装得下这一屏
          expect(g.columns * g.rows).toBeGreaterThanOrEqual(count);

          // ⑤ 封面高有上限（0.62 画幅高）：否则 1-2 部时卡片顶满整幅，看着"巨大"
          expect(g.coverH).toBeLessThanOrEqual(frame.h * 0.62001);

          // ⑥ 卡片比例不得极端：既不能又高又瘦、也不能宽扁（用户 2026-09-26 报的"很大 / 很窄"）
          const ratio = g.cardW / g.cardH;
          expect(ratio).toBeGreaterThanOrEqual(0.4);
          expect(ratio).toBeLessThanOrEqual(1.0);

          // ⑦ ≤6 部铺一行（两行且列少 → 格子宽扁，海报会被 contain 缩到中间）
          if (count <= 6) expect(g.rows).toBe(1);
        });
      }
    }
  }
});

describe('openingCardSize：开场封面卡必须是竖版', () => {
  for (const [label, theme] of THEMES) {
    for (const frame of FRAMES) {
      for (const coverSize of [0, 41, 100]) {
        it(`${label} · ${frame.name} · coverSize=${coverSize}`, () => {
          const card = openingCardSize(theme, frame.h, coverSize);
          // 「宽图」那个 bug 的直接判据：高必须大于宽
          expect(card.height).toBeGreaterThan(card.width);
          // 卡片高/宽比应当等于 cardAspect 的倒数（守海报比例）
          expect(card.width / card.height).toBeCloseTo(theme.layout.cardAspect, 6);
        });
      }
    }
  }
});
