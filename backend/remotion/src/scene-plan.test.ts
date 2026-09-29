import { describe, expect, it } from 'vitest';
import { bgmGainAt, bgmTimeline } from '../src/bgm';
import { ENDING_WALL_ROWS, FEATURED_RECAP_TITLE, RECAP_PREFIX, UNMARKED_RECAP_TITLE, buildScenePlan, endingWallCovers, endingWallCount, groupMedia, hasOriginalAudioAt, mediaOfGroup, sceneLabel } from '../src/scene-plan';
import type { MultiMediaPocInput, PocMedia } from '../src/types';
import { DEFAULT_PARAMS, resolveParams } from '../src/params';
import { recapPages, recapSeconds } from '../src/recap';

function media(id: number, order: number, year: number, clips = 0, group?: string): PocMedia {
  return {
    mediaId: id,
    order,
    mode: clips > 0 ? 'CLIPS_SELECTED' : 'INFO_ONLY',
    title: `作品 ${id}`,
    year,
    tags: [],
    group,
    clips: Array.from({ length: clips }, (_, i) => ({
      clipId: id * 100 + i,
      title: `片段 ${i + 1}`,
      assetPath: `media/clip-${id}-${i}.mp4`,
      durationMs: 4000,
      hasAudio: i % 2 === 0,
    })),
  };
}

function input(partial: Partial<MultiMediaPocInput> = {}): MultiMediaPocInput {
  return {
    template: 'MULTI_MEDIA_RECOMMEND',
    title: 'T',
    media: [media(1, 1, 2024, 2, '2024 年'), media(2, 2, 2020, 0, '2020 年')],
    ...partial,
  };
}

describe('groupMedia', () => {
  it('无分组 → 单组且 groupIndex 为 -1', () => {
    const groups = groupMedia(input(), '', 'date-desc');
    expect(groups).toHaveLength(1);
    expect(groups[0].index).toBe(-1);
    expect(groups[0].media).toHaveLength(2);
  });

  it('year 维度按年份降序（默认），组内保持原序', () => {
    const groups = groupMedia(input(), 'year', 'date-desc');
    expect(groups.map((g) => g.name)).toEqual(['2024 年', '2020 年']);
  });

  it('date-asc → 年份升序', () => {
    const groups = groupMedia(input(), 'year', 'date-asc');
    expect(groups.map((g) => g.name)).toEqual(['2020 年', '2024 年']);
  });

  it('groupSort=none 保持首次出现顺序', () => {
    const groups = groupMedia(input({ media: [media(1, 1, 2020, 0, '2020 年'), media(2, 2, 2024, 0, '2024 年')] }), 'year', 'none');
    expect(groups.map((g) => g.name)).toEqual(['2020 年', '2024 年']);
  });

  it('未知年份排最后', () => {
    const groups = groupMedia(input({ media: [media(1, 1, 2020, 0, '未知年份'), media(2, 2, 2024, 0, '2024 年')] }), 'year', 'date-desc');
    expect(groups.map((g) => g.name)).toEqual(['2024 年', '未知年份']);
  });
});

describe('buildScenePlan', () => {
  it('场景顺序：开场 →（序言）→ 章节页 → 资料卡 → 片段 → 结尾', () => {
    const plan = buildScenePlan(input({ intro: '序言文案', params: { groupBy: 'year' } }));
    expect(plan.scenes.map((s) => s.type)).toEqual([
      'COLLECTION_OPENING',
      'COLLECTION_INTRO',
      'GROUP_INTRO',
      'MEDIA_INFO',
      'MEDIA_CLIP',
      'MEDIA_CLIP',
      'GROUP_INTRO',
      'MEDIA_INFO',
      // 默认样例两部都没标等级 → 结尾回顾只出「其它」那一段（题头页 + 卡墙）
      'GROUP_INTRO',
      'RECAP_LIST',
      'COLLECTION_ENDING',
    ]);
    expect(plan.scenes[2].groupName).toBe('2024 年');
  });

  it('intro 为空则不产生序言屏；clip 形态跳过序言与章节页', () => {
    expect(buildScenePlan(input()).scenes.some((s) => s.type === 'COLLECTION_INTRO')).toBe(false);
    const clip = buildScenePlan(input({ style: 'clip', intro: '有文案也不出序言', params: { groupBy: 'year' } }));
    expect(clip.scenes.some((s) => s.type === 'COLLECTION_INTRO')).toBe(false);
    expect(clip.scenes.some((s) => s.type === 'GROUP_INTRO')).toBe(false);
  });

  it('perScreen ≥ 2 → 一屏 N 部网格，片段仍逐个成屏', () => {
    const plan = buildScenePlan(input({ params: { perScreen: 3 } }));
    const grid = plan.scenes.find((s) => s.type === 'MEDIA_GRID');
    expect(grid?.mediaIds).toEqual([1, 2]);
    expect(plan.scenes.filter((s) => s.type === 'MEDIA_CLIP')).toHaveLength(2);
  });

  it('时长 = 各场景之和，且片段时长来自素材', () => {
    const plan = buildScenePlan(input({ params: { durations: { opening: 2, intro: 1, group: 1, detail: 3, ending: 1, title: 2 } } }));
    const sum = plan.scenes.reduce((acc, s) => acc + s.durationInFrames, 0);
    expect(plan.durationInFrames).toBe(sum);
    // 2s 开场 + 3s 资料卡 + 两个 4s 片段 + 3s 资料卡 + 1s 结尾（30fps）
    // + 结尾回顾（本样例不分年份所以没有年份章节页）：1s 题头页 + 7s 卡墙（2 部一页 = 错峰 0.5s + 停留 6.5s）
    expect(plan.durationInFrames).toBe(60 + 90 + 120 + 120 + 90 + (30 + 210) + 30);
  });

  it('帧率/分辨率由参数驱动', () => {
    const plan = buildScenePlan(input({ params: { fps: 60, width: 1920, height: 1080 } }));
    expect(plan.fps).toBe(60);
    expect(plan.width).toBe(1920);
    expect(plan.height).toBe(1080);
  });

  it('audioWindows 只覆盖有原声的片段', () => {
    const plan = buildScenePlan(input());
    expect(plan.audioWindows).toHaveLength(1);
    const clipScenes = plan.scenes.filter((s) => s.type === 'MEDIA_CLIP' && s.mediaId === 1);
    expect(hasOriginalAudioAt(plan, clipScenes[0].fromFrame)).toBe(true);
    expect(hasOriginalAudioAt(plan, clipScenes[1].fromFrame)).toBe(false);
  });

  it('非法输入报错（重复 ID / INFO_ONLY 带片段 / 空媒体）', () => {
    expect(() => buildScenePlan(input({ media: [] }))).toThrow('至少需要一个媒体');
    const dup = input({ media: [media(1, 1, 2024, 0), media(1, 2, 2024, 0)] });
    expect(() => buildScenePlan(dup)).toThrow('媒体 ID 重复');
    const bad = input({ media: [{ ...media(1, 1, 2024, 0), mode: 'INFO_ONLY', clips: [{ clipId: 9, title: 'x', assetPath: 'a.mp4', durationMs: 1000, hasAudio: false }] }] });
    expect(() => buildScenePlan(bad)).toThrow('INFO_ONLY 媒体不能包含 Clip');
  });
});

describe('BGM 时间轴与 ducking', () => {
  const plan = buildScenePlan(input());

  it('按真实曲长顺排，缺省时均分', () => {
    const params = resolveParams({ bgmTracks: [{ name: 'A', durationSec: 2 }, { name: 'B', durationSec: 3 }] });
    const slots = bgmTimeline(params, plan);
    expect(slots[0].fromFrame).toBe(0);
    expect(slots[0].durationInFrames).toBe(60);
    expect(slots[1].fromFrame).toBe(60);
    expect(slots[1].durationInFrames).toBe(90);
  });

  it('无曲目时为空', () => {
    expect(bgmTimeline(resolveParams(undefined), plan)).toEqual([]);
  });

  it('有原声的片段区间内压低 BGM，其余回到基准', () => {
    const params = resolveParams({ bgmTracks: [{ name: 'A', durationSec: 60 }] });
    const clip = plan.scenes.find((s) => s.type === 'MEDIA_CLIP' && s.mediaId === 1)!;
    const mid = clip.fromFrame + Math.floor(clip.durationInFrames / 2);
    expect(bgmGainAt(mid, params, plan)).toBeCloseTo(params.bgmDuckTo, 3);
    expect(bgmGainAt(0, params, plan)).toBeCloseTo(params.bgmGain, 3);
    // 淡入淡出：进窗前半段应处于基准与压低声之间
    const ramp = bgmGainAt(clip.fromFrame - Math.round(params.bgmFadeSec * plan.fps) / 2, params, plan);
    expect(ramp).toBeLessThan(params.bgmGain);
    expect(ramp).toBeGreaterThan(params.bgmDuckTo);
  });

  it('默认参数下不会超过 1', () => {
    const params = { ...DEFAULT_PARAMS, bgmGain: 1 };
    expect(bgmGainAt(0, params, plan)).toBeLessThanOrEqual(1);
  });
});

describe('推荐等级二级分组 + 「本组核心」下线（2026-09-26 用户：「按推荐等级接着分组」「本组核心这块去掉」）', () => {
  const ranked = (id: number, tier: number | undefined, year = 2020): PocMedia =>
    ({ ...media(id, id, year, 0, `${year} 年`), tier });

  it('二级分组：同一年按 强推→推荐→值得一看→一般 切成子组，未标等级那群垫最后**不加后缀**，空档不生成', () => {
    const groups = groupMedia(input({ media: [ranked(1, 2), ranked(2, 0), ranked(3, 3), ranked(4, undefined)] }),
      'year', 'date-desc', true);
    expect(groups.map((g) => g.name)).toEqual(['2020 年 · 强推', '2020 年 · 值得一看', '2020 年 · 一般', '2020 年']);
    expect(groups.map((g) => g.media.map((m) => m.mediaId))).toEqual([[2], [1], [3], [4]]);
    // 子组沿用一级组下标（同一年共用一个强调色）；只有第一个子组带 firstOfParent（章节页只插一页）
    expect(groups.map((g) => g.index)).toEqual([0, 0, 0, 0]);
    expect(groups.map((g) => g.firstOfParent)).toEqual([true, false, false, false]);
    expect(groups.map((g) => g.parentName)).toEqual(['2020 年', '2020 年', '2020 年', '2020 年']);
  });

  it('整组没有任何等级标注 → 不切（老草稿结构零变化）', () => {
    const groups = groupMedia(input({ media: [ranked(1, undefined), ranked(2, undefined)] }), 'year', 'date-desc', true);
    expect(groups.map((g) => g.name)).toEqual(['2020 年']);
    expect(groups[0].firstOfParent).toBe(true);
  });

  it('关掉二级分组 → 不切，且第 1 档仍被 coreFirst 提到组内最前', () => {
    const groups = groupMedia(input({ media: [ranked(1, undefined), ranked(2, 0)] }), 'year', 'date-desc', false);
    expect(groups.map((g) => g.name)).toEqual(['2020 年']);
    expect(groups[0].media.map((m) => m.mediaId)).toEqual([2, 1]);
  });

  it('一级「不分组」时二级仍生效：组名就是档名', () => {
    const groups = groupMedia(input({ media: [ranked(1, 0), ranked(2, 1)] }), '', 'date-desc', true);
    expect(groups.map((g) => g.name)).toEqual(['强推', '推荐']);
    expect(groups.every((g) => g.index === -1)).toBe(true);
  });

  it('越界/小数脏数据归入未标等级那群（组名不加后缀），不新开档位', () => {
    const groups = groupMedia(input({ media: [ranked(1, 9), { ...ranked(2, 0.4) }] }), 'year', 'date-desc', true);
    expect(groups.map((g) => g.name)).toEqual(['2020 年 · 强推', '2020 年']);
  });

  it('未标等级那群虽然与一级组同名，章节页仍按**整年**取成员（不能只数到未标那批）', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, 0, 2020), ranked(2, undefined, 2020), ranked(3, undefined, 2020)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    const intro = plan.scenes.find((s) => s.type === 'GROUP_INTRO' && s.groupName === '2020 年')!;
    expect(mediaOfGroup(plan, intro.groupName).map((m) => m.mediaId)).toEqual([1, 2, 3]);
  });

  it('场景：每档连续成群、章节页仍每年一页（标题=年份）、不再有「本组核心」题头', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, 1, 2020), ranked(2, 0, 2020), ranked(3, 1, 2020), ranked(4, 0, 2019)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    expect(plan.scenes.filter((s) => s.type === 'GROUP_INTRO' && !s.groupName?.startsWith(RECAP_PREFIX)).map((s) => s.groupName)).toEqual(['2020 年', '2019 年']);
    expect(plan.scenes.some((s) => s.kicker !== undefined)).toBe(false);
    const grids = plan.scenes.filter((s) => s.type === 'MEDIA_GRID' && !s.groupName?.startsWith(RECAP_PREFIX));
    expect(grids.map((s) => s.mediaIds)).toEqual([[2], [1, 3], [4]]);
    expect(grids.map((s) => s.groupName)).toEqual(['2020 年 · 强推', '2020 年 · 推荐', '2019 年 · 强推']);
  });

  it('章节页按一级组名取**整年**成员（二级分组后仍能报「共 N 部」+ 缩略图）', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, 0, 2020), ranked(2, 1, 2020)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    const intro = plan.scenes.find((s) => s.type === 'GROUP_INTRO')!;
    expect(intro.groupName).toBe('2020 年');
    expect(mediaOfGroup(plan, intro.groupName).map((m) => m.mediaId)).toEqual([1, 2]);
  });

  it('结尾回顾：一档一页题头 + **一段分页卡墙**（不再按资料屏切片），最后一档是「其它」', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, 0, 2020), ranked(2, 1, 2019), ranked(3, 2, 2020), ranked(4, undefined, 2019)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    const recaps = plan.scenes.filter((s) => s.type === 'GROUP_INTRO' && s.groupName?.startsWith(RECAP_PREFIX));
    expect(recaps.map((s) => s.groupName)).toEqual([
      `${RECAP_PREFIX}强推`, `${RECAP_PREFIX}推荐`, `${RECAP_PREFIX}值得一看`, `${RECAP_PREFIX}${UNMARKED_RECAP_TITLE}`,
    ]);
    // 题头页自带本档媒体（不属任何分组，按组名查不到 → 靠 mediaIds 才能报对「共 N 部」）
    expect(recaps.map((s) => s.mediaIds)).toEqual([[1], [2], [3], [4]]);
    const lists = plan.scenes.filter((s) => s.type === 'RECAP_LIST');
    expect(lists.map((s) => s.mediaIds)).toEqual([[1], [2], [3], [4]]);
    // 清单紧跟在自己那页题头后面；回顾里**不再有网格屏**（用户：「结尾回顾太长了」）
    lists.forEach((list) => expect(plan.scenes[plan.scenes.indexOf(list) - 1].type).toBe('GROUP_INTRO'));
    expect(plan.scenes.filter((s) => s.type === 'MEDIA_GRID' && s.groupName?.startsWith(RECAP_PREFIX))).toEqual([]);
    expect(plan.scenes.findIndex((s) => s.type === 'COLLECTION_ENDING')).toBeGreaterThan(plan.scenes.indexOf(lists[lists.length - 1]));
  });

  it('清单**档内按年份**排（等级 → 年份）：展平「年份为主序」的 groups 再按档过滤', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, 0, 2020), ranked(2, 0, 2019), ranked(3, 1, 2019)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', groupSort: 'date-asc', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    const lists = plan.scenes.filter((s) => s.type === 'RECAP_LIST');
    expect(lists.map((s) => s.mediaIds)).toEqual([[2, 1], [3]]);
  });

  it('卡墙时长由**页数**决定（36 张/页），不再一部一屏 7 秒', () => {
    const list = [ranked(1, 0, 2019), ranked(2, 0, 2020), ranked(3, 0, 2020), ranked(4, 0, 2021)];
    const plan = buildScenePlan(input({
      media: list,
      params: { ...DEFAULT_PARAMS, groupBy: 'year', groupSort: 'date-asc', perScreen: 4 },
    } as Partial<MultiMediaPocInput>));
    const scene = plan.scenes.find((s) => s.type === 'RECAP_LIST')!;
    expect(scene.durationInFrames).toBe(Math.round(recapSeconds(recapPages(list), DEFAULT_PARAMS.endingScrollSpeed) * DEFAULT_PARAMS.fps));
    // 旧口径 = 每部按一屏资料 7 秒（`durations.detail`）→ 新口径必须显著更短，否则「结尾跟整片一样长」没修好
    expect(scene.durationInFrames).toBeLessThan(list.length * DEFAULT_PARAMS.durations.detail * DEFAULT_PARAMS.fps);
  });

  it('未标等级的也出一段「全片回顾 · 其它」（用户 2026-09-26：「其它」段没看到总结）；空档不生成页', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, 0, 2020), ranked(2, undefined, 2019), ranked(3, undefined, 2020)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    // 1/2 档没人 → 不出；其它那 2 部要出，且排在最后
    expect(plan.scenes.filter((s) => s.type === 'GROUP_INTRO' && s.groupName?.startsWith(RECAP_PREFIX)).map((s) => s.groupName))
      .toEqual([`${RECAP_PREFIX}强推`, `${RECAP_PREFIX}${UNMARKED_RECAP_TITLE}`]);
    expect(plan.scenes.filter((s) => s.type === 'RECAP_LIST').map((s) => s.mediaIds)).toEqual([[1], [3, 2]]);
  });

  it('一个等级都没标 → 现在**只有**其它那一段（不再是“不产生回顾页”）', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, undefined, 2020), ranked(2, undefined, 2019)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10 },
    } as Partial<MultiMediaPocInput>));
    expect(plan.scenes.filter((s) => s.type === 'RECAP_LIST').map((s) => s.mediaIds)).toEqual([[1, 2]]);
    expect(plan.scenes.some((s) => s.groupName === `${RECAP_PREFIX}${UNMARKED_RECAP_TITLE}`)).toBe(true);
  });

  it('关掉二级分组 → 结尾退回「全片核心回顾」**只收第 1 档**（其它不进）', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, 0, 2020), ranked(2, 1, 2020)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10, tierGroup: false },
    } as Partial<MultiMediaPocInput>));
    const recap = plan.scenes.find((s) => s.type === 'GROUP_INTRO' && s.groupName === FEATURED_RECAP_TITLE);
    expect(recap?.mediaIds).toEqual([1]);
    expect(plan.scenes.filter((s) => s.type === 'RECAP_LIST').map((s) => s.mediaIds)).toEqual([[1]]);
    expect(plan.scenes.some((s) => s.groupName?.startsWith(RECAP_PREFIX))).toBe(false);
  });

  it('关掉二级分组：只出第 1 档，其它那段也不出（那是二级分组形态下的东西）', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, 0, 2020), ranked(2, 1, 2020), ranked(3, undefined, 2020)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10, tierGroup: false },
    } as Partial<MultiMediaPocInput>));
    expect(plan.scenes.filter((s) => s.type === 'RECAP_LIST').map((s) => s.mediaIds)).toEqual([[1]]);
  });

  it('结尾封面墙封顶：全量铺会把标题/「感谢观看」挤出画面（222 部 = 21 行 ≈ 3600px）', () => {
    const width = 1920;
    const height = 1080;
    const wallRatio = 0.14;
    const count = endingWallCount({ width, height, wallRatio });
    const gap = width * 0.011;
    const perRow = Math.max(1, Math.floor((width * 0.78 + gap) / (height * wallRatio * 0.7 + gap)));
    const rows = Math.ceil(count / perRow);
    expect(rows).toBeLessThanOrEqual(ENDING_WALL_ROWS);
    // 墙高必须给画幅留出地方（标题/文案/THE END 都在它上面居中）
    expect(rows * (height * wallRatio + gap)).toBeLessThan(height * 0.5);
  });

  it('结尾封面墙选人：**第 1 档优先 + 同档内按 seed 洗牌**（用户 2026-09-26：「第一档然后随机展示就行」）', () => {
    // 第 1 档 5 部 + 第 2 档 7 部；取 4 张 → 应全是第 1 档
    const first = [1, 2, 3, 4, 5].map((id) => ranked(id, 0, 2020));
    const rest = [11, 12, 13, 14, 15, 16, 17].map((id) => ranked(id, 1, 2020));
    const pick = endingWallCovers([...first, ...rest], { count: 4, seed: 7 });
    expect(pick).toHaveLength(4);
    expect(pick.every((m) => m.tier === 0)).toBe(true);
    expect(new Set(pick.map((m) => m.mediaId)).size).toBe(4);            // 不重复
    // 确定性：同一 seed 两次一模一样；换 seed 会换一批（逐帧并行渲染，同一帧不能摆成两样）
    expect(endingWallCovers([...first, ...rest], { count: 4, seed: 7 }).map((m) => m.mediaId))
      .toEqual(pick.map((m) => m.mediaId));
    expect(endingWallCovers([...first, ...rest], { count: 4, seed: 99 }).map((m) => m.mediaId))
      .not.toEqual(pick.map((m) => m.mediaId));
    // 洗牌确实发生：不是原顺序的前 4 个
    expect(pick.map((m) => m.mediaId)).not.toEqual([1, 2, 3, 4]);
  });

  it('结尾封面墙选人：第 1 档不够就拿下一档补满（未标等级的垫最后）', () => {
    const pick = endingWallCovers(
      [ranked(1, 0, 2020), ranked(2, 0, 2020), ranked(3, 1, 2020), ranked(4, undefined, 2020)],
      { count: 4, seed: 3 },
    );
    expect(pick.map((m) => m.mediaId).slice(0, 2).sort()).toEqual([1, 2]); // 第 1 档占前排
    expect(pick.map((m) => m.mediaId)).toContain(3);                      // 第 2 档补位
    expect(pick[pick.length - 1].mediaId).toBe(4);                        // 未标等级的排最后
  });

  it('无第 1 档且不开二级分组 → 不产生多余资料卡', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, undefined, 2020), ranked(2, undefined, 2020)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 10, tierGroup: false },
    } as Partial<MultiMediaPocInput>));
    expect(plan.scenes.filter((s) => s.type === 'MEDIA_INFO')).toHaveLength(0);
  });
});

describe('推荐序号与组部数（用户 2026-09-26：「下面数量展示应该根据推荐顺序从1往后加」「只是当前页面而不是该组所有」）', () => {
  const ranked = (id: number, tier: number, year: number): PocMedia =>
    ({ ...media(id, id, year, 0, `${year} 年`), tier });

  it('底部序号 = 成片里的推荐顺序（跨组连续），不是 Java 的请求 order', () => {
    const plan = buildScenePlan(input({
      media: [ranked(1, 0, 2023), ranked(2, 0, 2023), ranked(3, 1, 2022)],
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 2, tierGroup: true },
    } as Partial<MultiMediaPocInput>));
    const grids = plan.scenes.filter((s) => s.type === 'MEDIA_GRID' && !s.groupName?.startsWith(RECAP_PREFIX));
    expect(grids.map((s) => s.numberFrom)).toEqual([1, 3]);        // 2023 强推两屏：1-2、3-3
    expect(sceneLabel(plan, grids[0], plan.mediaIndex.size)).toBe('1-2 / 3');
    expect(sceneLabel(plan, grids[1], plan.mediaIndex.size)).toBe('3-3 / 3');
  });

  it('组标题行报**整组**部数（当前屏只装了其中一部分）', () => {
    const media9 = Array.from({ length: 5 }, (_, i) => ranked(i + 1, 0, 2023));
    const plan = buildScenePlan(input({
      media: media9,
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 3, tierGroup: true },
    } as Partial<MultiMediaPocInput>));
    const grids = plan.scenes.filter((s) => s.type === 'MEDIA_GRID' && !s.groupName?.startsWith(RECAP_PREFIX));
    expect(grids.map((s) => s.mediaIds?.length)).toEqual([3, 2]);
    expect(grids.map((s) => s.groupSize)).toEqual([5, 5]);
    expect(grids.map((s) => s.groupTopCount)).toEqual([5, 5]);
    // 序号仍然连续（第二屏从 4 开始）
    expect(grids.map((s) => s.numberFrom)).toEqual([1, 4]);
  });

  it('关掉二级分组时，混合屏的组标题胶囊也报整组里第 1 档的数量', () => {
    const list = [ranked(1, 0, 2023), ranked(2, 0, 2023), ranked(3, 1, 2023), ranked(4, 2, 2023)];
    const plan = buildScenePlan(input({
      media: list,
      params: { ...DEFAULT_PARAMS, groupBy: 'year', perScreen: 2, tierGroup: false },
    } as Partial<MultiMediaPocInput>));
    const first = plan.scenes.find((s) => s.type === 'MEDIA_GRID')!;
    expect(first.mediaIds).toEqual([1, 2]);      // coreFirst 把第 1 档提到最前
    expect(first.groupSize).toBe(4);
    expect(first.groupTopCount).toBe(2);
  });
});
