import { describe, expect, it } from 'vitest';
import { RECOMMEND_TIERS, cycleTier, tierLook, toggleTier } from './tier';

const FOUR = ['强推', '推荐', '值得一看', '一般'];
const THREE = ['强推', '推荐', '还行'];

describe('tierLook', () => {
  it('未定档 = 最低档 = 默认卡片（不出装饰）', () => {
    const look = tierLook(undefined, THREE);
    expect(look.decorated).toBe(false);
    expect(look.rank).toBe(2);
    expect(look.name).toBe('还行');
  });

  it('最低档永远是默认卡片（即便它在中间）', () => {
    expect(tierLook(3, FOUR).decorated).toBe(false);
    expect(tierLook(3, FOUR).name).toBe('一般');
  });

  it('名次 → 视觉：0 彩虹 / 1 金 / 2 青', () => {
    expect(tierLook(0, FOUR).rainbow).toBe(true);
    expect(tierLook(1, FOUR).rainbow).toBe(false);
    expect(tierLook(1, FOUR).accent).toBe('#ffd166');
    expect(tierLook(2, FOUR).accent).toBe('#4fc3f7');
  });

  it('三档时中间档是金（青档不出现）', () => {
    expect(tierLook(0, THREE).rainbow).toBe(true);
    expect(tierLook(1, THREE).accent).toBe('#ffd166');
    expect(tierLook(1, THREE).decorated).toBe(true);
  });

  it('越界名次收敛到范围内', () => {
    expect(tierLook(9, FOUR).rank).toBe(3);
    expect(tierLook(-3, FOUR).rank).toBe(0);
  });

  it('名字缺失时给兜底文案，不显示空白胶囊', () => {
    expect(tierLook(0, ['']).name).toBe('第 1 档');
    expect(tierLook(undefined, []).name).toBe('未定档');
  });
});

describe('等级可取消（用户 2026-09-26：「推荐等级只能勾选，不能取消」）', () => {
  it('候选卡循环把「未标」留在链上：未标 → 0 → 1 → 2 → 3 → 未标', () => {
    expect(cycleTier(undefined)).toBe(0);
    expect(cycleTier(0)).toBe(1);
    expect(cycleTier(1)).toBe(2);
    expect(cycleTier(2)).toBe(3);
    expect(cycleTier(3)).toBeUndefined();
    // 转一圈必须回到起点（4 档时点 5 下：未标 + 4 档）
    let cursor: number | undefined = undefined;
    for (let i = 0; i < RECOMMEND_TIERS.length + 1; i += 1) cursor = cycleTier(cursor);
    expect(cursor).toBeUndefined();
  });

  it('面板按钮点同一档 = 取消，点别的档 = 切换', () => {
    expect(toggleTier(undefined, 1)).toBe(1);
    expect(toggleTier(1, 1)).toBeUndefined();
    expect(toggleTier(1, 3)).toBe(3);
  });
});
