import { describe, expect, it } from 'vitest';
import { bgmBadgeState, bgmGainAt, bgmSlotGainAt, bgmSlotIndexAt, bgmStartFromFrames, bgmTimeline, stingGainAt, stingTimeline } from './bgm';
import { resolveParams } from './params';
import type { ScenePlan } from './types';

/** 30fps、10 秒开场、5 秒落款、总长 60 秒的假计划（BGM 只用到这几个字段）。 */
function plan(): ScenePlan {
  return { fps: 30, durationInFrames: 1800, audioWindows: [] } as unknown as ScenePlan;
}

function params(range: string, durationSec = 20) {
  return resolveParams({
    title: 't',
    durations: { opening: 10, intro: 5, group: 5, detail: 10, ending: 5 },
    bgmTracks: [{ name: 'a.mp3', durationSec, assetPath: 'bgm/a.mp3' }],
    bgmRange: range,
  } as never);
}

describe('BGM 播放范围（用户 2026-09-20：只在开头和结尾放）', () => {
  it('全程：从 0 **轮流铺满全片**（曲目跑完接着从头来），且不加段边淡入淡出', () => {
    // 60s 计划 + 单首 20s 曲 → 铺 3 遍（2026-09-26 修：以前只铺一遍 → 40s 后就静音）
    const slots = bgmTimeline(params('all'), plan());
    expect(slots).toHaveLength(3);
    expect(slots.map((s) => [s.fromFrame, s.durationInFrames])).toEqual([[0, 600], [600, 600], [1200, 600]]);
    expect(slots.every((s) => s.edgeFadeSec === 0)).toBe(true);
    expect(slots.every((s) => s.startFromSec === undefined)).toBe(true);   // 每遍都从头放
  });

  it('全程：曲目列表轮流铺（两首 20s 曲 = 一遍 40s）→ 最后一首超出片尾', () => {
    const slots = bgmTimeline(params('all'), plan());
    const two = bgmTimeline(resolveParams({
      title: 't',
      durations: { opening: 10, intro: 5, group: 5, detail: 10, ending: 5 },
      bgmTracks: [{ name: 'a.mp3', durationSec: 20 }, { name: 'b.mp3', durationSec: 20 }],
      bgmRange: 'all',
    } as never), plan());
    expect(two.map((s) => s.name)).toEqual(['a.mp3', 'b.mp3', 'a.mp3']);   // 60s 计划：a(0-20) b(20-40) a(40-60)
    expect(two.map((s) => s.fromFrame)).toEqual([0, 600, 1200]);
    expect(slots.length).toBeGreaterThan(1);
  });

  it('仅开场：只覆盖开场窗口（10s = 300 帧），窗口外不生成序列', () => {
    const slots = bgmTimeline(params('opening'), plan());
    expect(slots).toHaveLength(1);
    expect([slots[0].fromFrame, slots[0].durationInFrames]).toEqual([0, 300]);
    expect(slots[0].edgeFadeSec).toBeGreaterThan(0);
  });

  it('仅结尾：窗口 = 末 5s，且用曲子**后半段**（乙）', () => {
    const slots = bgmTimeline(params('ending', 20), plan());
    expect(slots).toHaveLength(1);
    expect(slots[0].fromFrame).toBe(1650);
    expect(slots[0].durationInFrames).toBe(150);
    expect(slots[0].startFromSec).toBe(10);          // 曲长 20s → 后半段从 10s 起
  });

  it('开场+结尾：两段，中间没有任何 slot（自然静音）', () => {
    const slots = bgmTimeline(params('opening,ending'), plan());
    expect(slots).toHaveLength(2);
    const covered = slots.flatMap((s) => [s.fromFrame, s.fromFrame + s.durationInFrames]);
    expect(covered).toEqual([0, 300, 1650, 1800]);
  });

  it('曲子比窗口长 → 裁到窗口时长，起点仍从 0 开始', () => {
    const slots = bgmTimeline(params('opening', 600), plan());
    expect([slots[0].fromFrame, slots[0].durationInFrames, slots[0].startFromSec]).toEqual([0, 300, 0]);
  });
});

describe('段边淡入淡出（不铺满全片时必须有）', () => {
  it('段首从 0 起、段尾落回 0，中间保持基准增益', () => {
    const p = params('opening');
    const plan1 = plan();
    const slot = bgmTimeline(p, plan1)[0];
    expect(bgmSlotGainAt(slot.fromFrame, slot, p, plan1)).toBe(0);
    // 淡入 = bgmFadeSec（0.6s = 18 帧）：中点应为半量，满 18 帧后才到基准
    expect(bgmSlotGainAt(slot.fromFrame + 9, slot, p, plan1)).toBeCloseTo(p.bgmGain / 2, 2);
    expect(bgmSlotGainAt(slot.fromFrame + 19, slot, p, plan1)).toBeCloseTo(p.bgmGain, 3);
    expect(bgmSlotGainAt(slot.fromFrame + slot.durationInFrames - 1, slot, p, plan1)).toBeLessThan(p.bgmGain);
    // 淡出同样是 18 帧（bgmFadeSec）：起点仍是满量，中点半量，最后一帧接近零
    expect(bgmSlotGainAt(slot.fromFrame + slot.durationInFrames - 18, slot, p, plan1)).toBeCloseTo(p.bgmGain, 3);
    expect(bgmSlotGainAt(slot.fromFrame + slot.durationInFrames - 9, slot, p, plan1)).toBeCloseTo(p.bgmGain / 2, 2);
    expect(bgmSlotGainAt(slot.fromFrame + slot.durationInFrames - 1, slot, p, plan1)).toBeLessThan(p.bgmGain * 0.2);
  });

  it('「全程」不加段边淡入淡出（避免片头第一拍被吃）', () => {
    const p = params('all');
    const plan1 = plan();
    const slot = bgmTimeline(p, plan1)[0];
    expect(bgmSlotGainAt(slot.fromFrame, slot, p, plan1)).toBeCloseTo(p.bgmGain, 3);
  });
});

/** 带片名卡场景的计划：SCAN(0+300) / TITLE(300+60) / CLIP(360+300) / TITLE(660+60) / ENDING(1650+150)。 */
function planWithCards(): ScenePlan {
  return {
    fps: 30,
    durationInFrames: 1800,
    audioWindows: [],
    scenes: [
      { type: 'SCAN', fromFrame: 0, durationInFrames: 300 },
      { type: 'TITLE', fromFrame: 300, durationInFrames: 60 },
      { type: 'CLIP', fromFrame: 360, durationInFrames: 300 },
      { type: 'TITLE', fromFrame: 660, durationInFrames: 60 },
      { type: 'ENDING', fromFrame: 1650, durationInFrames: 150 },
    ],
  } as unknown as ScenePlan;
}

describe('多选集合（用户 2026-09-20：「多选」）', () => {
  it('全不勾 = none → 一个 slot 都不生成（全片不放 BGM）', () => {
    expect(bgmTimeline(params('none'), plan())).toEqual([]);
  });

  it('未知值当 all（不会因为漏传 / 脏值突然静音）', () => {
    expect(bgmTimeline(params(''), plan()).length).toBeGreaterThan(1);   // all = 铺满全片（多遍）
    expect(bgmTimeline(params('nonsense'), plan())[0].fromFrame).toBe(0);
    expect(bgmTimeline(params('nonsense'), plan()).at(-1)!.fromFrame).toBe(1200);   // 最后一槽落在 40s 处，铺到片尾
  });

  it('片名卡：每张卡一个 slot，且**逐张往下接**（每条起点都在前一条之后）', () => {
    const slots = bgmTimeline(params('cards'), planWithCards());
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => [s.fromFrame, s.durationInFrames])).toEqual([[300, 60], [660, 60]]);
    // 起点跟**全片时间**走（按曲长 20s 取模）：300 帧 = 10s；660 帧 = 22s → 22 % 20 = 2s
    expect(slots[0].startFromSec).toBe(10);
    expect(slots[1].startFromSec).toBe(2);
  });

  it('片名卡段自带头尾淡入淡出（缓入缓出）', () => {
    const p = params('cards');
    const slots = bgmTimeline(p, planWithCards());
    expect(slots[0].edgeFadeSec).toBe(p.bgmFadeSec);
    expect(bgmSlotGainAt(slots[0].fromFrame, slots[0], p, planWithCards())).toBe(0);
    expect(bgmSlotGainAt(slots[0].fromFrame + slots[0].durationInFrames - 1, slots[0], p, planWithCards())).toBeLessThan(p.bgmGain);
  });

  it('开场 + 片名卡 + 结尾：三类窗口并存，片段段仍然静音', () => {
    const slots = bgmTimeline(params('opening,cards,ending'), planWithCards());
    const spans = slots.map((s) => s.fromFrame);
    expect(spans[0]).toBe(0);                        // 开场
    expect(spans).toContain(300);                    // 片名卡 1
    expect(spans).toContain(660);                    // 片名卡 2
    expect(spans[spans.length - 1]).toBe(1650);      // 结尾
    // 片段段（360~660）里没有 slot 起点
    expect(spans.includes(360)).toBe(false);
  });
});

describe('转场音乐（甲：只在片名卡响一次）', () => {
  const sting = (over: Record<string, unknown> = {}) => resolveParams({
    title: 't',
    durations: { opening: 10, intro: 5, group: 5, detail: 10, ending: 5, title: 3 },
    stingPath: 'sting-0.mp3',
    stingVolume: 60,
    bgmTracks: [{ name: 'a.mp3', durationSec: 30, assetPath: 'bgm/a.mp3' }],
    bgmRange: 'all',
    ...over,
  } as never);

  it('每张片名卡一个窗口，长度不超过卡片（自动截断）', () => {
    const p = sting();
    const slots = stingTimeline(p, planWithCards());
    expect(slots).toEqual([{ fromFrame: 300, durationInFrames: 60 }, { fromFrame: 660, durationInFrames: 60 }]);
  });

  it('没选转场音 → 一个窗口都没有', () => {
    expect(stingTimeline(sting({ stingPath: '' }), planWithCards())).toEqual([]);
  });

  it('音量 60% → 起手淡入到 0.6，卡片末尾淡出', () => {
    const p = sting();
    const plan1 = planWithCards();
    const slot = stingTimeline(p, plan1)[0];
    expect(stingGainAt(slot.fromFrame, slot, p, plan1)).toBe(0);          // 起手 0.12s 淡入
    expect(stingGainAt(slot.fromFrame + 10, slot, p, plan1)).toBeCloseTo(0.6, 2);
    expect(stingGainAt(slot.fromFrame + slot.durationInFrames - 1, slot, p, plan1)).toBeLessThan(0.6);
  });

  it('转场音期间把 BGM 压低（用户：「压」）', () => {
    const p = sting();
    const plan1 = planWithCards();
    // BGM 走全程：片名卡那一帧应已被压到 bgmDuckTo，开场那一帧仍是基准
    expect(bgmGainAt(0, p, plan1)).toBeCloseTo(p.bgmGain, 3);
    expect(bgmGainAt(320, p, plan1)).toBeCloseTo(p.bgmDuckTo, 3);
  });
});

describe('BGM 条显示 = 曲子自身的位置/进度（用户 2026-09-26：「显示的是视频进度」）', () => {
  const slot = (over: Partial<import('./bgm').BgmSlot> = {}) => ({
    name: 'a.mp3', fromFrame: 0, durationInFrames: 6000, durationSec: 200, edgeFadeSec: 0, ...over,
  });

  it('进度与时间都按**曲长**算（不是窗口长、不是全片时间）', () => {
    // 30fps：第 1500 帧 = 窗口内 50s；曲长 200s
    expect(bgmBadgeState(1500, slot(), 30)).toEqual({ progress: 0.25, positionSec: 50, totalSec: 200, loops: 0 });
  });

  it('结尾那种“从后半段起放”：位置从 startFromSec 开始算', () => {
    const state = bgmBadgeState(0, slot({ fromFrame: 1650, durationInFrames: 150, startFromSec: 100 }), 30);
    expect(state.positionSec).toBe(100);
    expect(state.progress).toBe(0.5);
  });

  it('窗口比曲子长 → 按循环取模并标 ↻（不是停在 100%）', () => {
    // 曲长 10s、窗口 20s：第 450 帧(15s) → 第二遍的第 5s
    const state = bgmBadgeState(450, slot({ durationSec: 10, durationInFrames: 600 }), 30);
    expect(state).toEqual({ progress: 0.5, positionSec: 5, totalSec: 10, loops: 1 });
  });

  it('曲子还没轮到 → 显示起播位置而不是负数 / 全片时间', () => {
    const state = bgmBadgeState(0, slot({ fromFrame: 300 }), 30);
    expect(state.positionSec).toBe(0);
    expect(state.progress).toBe(0);
  });

  it('曲长探不到（ffprobe 失败 / 旧草稿）→ 退回窗口口径，不会崩、不会显示成 NaN', () => {
    const state = bgmBadgeState(300, slot({ durationSec: undefined, durationInFrames: 600 }), 30);
    expect(state).toEqual({ progress: 0.5, positionSec: 10, totalSec: 20, loops: 0 });
  });

  it('`<Audio startFrom>` 的单位是**帧**：秒 → 帧由 bgmStartFromFrames 统一换算', () => {
    // 结尾“后半段”曲长 200s（30fps 下共 6000 帧）→ 从第 100s 起 = 第 3000 帧
    expect(bgmStartFromFrames({ name: 'a', fromFrame: 1650, durationInFrames: 150, startFromSec: 100, durationSec: 200, edgeFadeSec: 0 }, 30)).toBe(3000);
    expect(bgmStartFromFrames({ name: 'a', fromFrame: 0, durationInFrames: 150, edgeFadeSec: 0 }, 30)).toBe(0);
  });
});

describe('BGM 条只在有音乐时出现（静音段不挂条）', () => {
  const slots = [
    { name: 'a.mp3', fromFrame: 0, durationInFrames: 300, durationSec: 10, edgeFadeSec: 0 },
    { name: 'b.mp3', fromFrame: 1500, durationInFrames: 300, durationSec: 10, edgeFadeSec: 0 },
  ];

  it('窗口内 → 指向对应那首', () => {
    expect(bgmSlotIndexAt(0, slots)).toBe(0);
    expect(bgmSlotIndexAt(299, slots)).toBe(0);
    expect(bgmSlotIndexAt(1500, slots)).toBe(1);
    expect(bgmSlotIndexAt(1799, slots)).toBe(1);
  });

  it('两窗口之间（10~50s）与片尾之后 → -1（旧代码会挂上第一条并显示假位置）', () => {
    expect(bgmSlotIndexAt(600, slots)).toBe(-1);
    expect(bgmSlotIndexAt(1800, slots)).toBe(-1);
  });

  it('一条都没有 → -1', () => {
    expect(bgmSlotIndexAt(0, [])).toBe(-1);
  });
});
