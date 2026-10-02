import { describe, expect, it } from 'vitest';
import { canonicalizePath, fnv1a64, globalLayerKey, segmentKeysOf } from './chunk-keys';
import { buildScenePlan } from './scene-plan';
import type { MultiMediaPocInput, PocMedia } from './types';

/**
 * 块键的自检（2026-10-01 增量更新 P1）。四条红线：
 *   ① 同一输入必须算出**逐字符相同**的键（否则这功能就是随机全渲）；
 *   ② 绝对地址/端口不能让键变（脚本每轮都会改写 `/covers/**` 为随机端口 —— 这是最阴的坑）；
 *   ③ 只改局部内容 → 只有相关段键变（否则省不下来）；
 *   ④ 全局内容（标题/seed/总长）变 → 全局键变（否则会拼出前后不一致的片子）。
 */

const media = (id: number, clips = 0, description?: string): PocMedia => ({
  mediaId: id,
  order: id,
  mode: clips > 0 ? 'CLIPS_SELECTED' : 'INFO_ONLY',
  title: `作品 ${id}`,
  year: 2024,
  description,
  tags: [],
  group: '2024 年',
  coverAssetPath: `/covers/${id}.jpg`,
  clips: Array.from({ length: clips }, (_, i) => ({
    clipId: id * 100 + i,
    title: `片段 ${i + 1}`,
    assetPath: `clip-${id}-${i}.mp4`,
    durationMs: 3000,
    hasAudio: false,
  })),
});

function input(overrides: Partial<MultiMediaPocInput> = {}, params: Record<string, unknown> = {}): MultiMediaPocInput {
  return {
    template: 'MULTI_MEDIA_RECOMMEND',
    style: 'chapter',
    title: 'T',
    intro: '一句话简介',
    media: [media(1, 1), media(2), media(3)],
    params: { groupBy: 'year', ...params } as never,
    ...overrides,
  };
}

const keysOf = (value: MultiMediaPocInput, env = { assetPrint: {} }) => {
  const plan = buildScenePlan(value);
  return { global: globalLayerKey(plan, value, env), segments: segmentKeysOf(plan, value, env) };
};

describe('chunk-keys', () => {
  it('1) 同一输入两次结果完全一致，且段键与段数一一对应', () => {
    const value = input();
    const first = keysOf(value);
    const second = keysOf(value);
    expect(first.global).toBe(second.global);
    expect(first.segments).toEqual(second.segments);
    expect(first.segments).toHaveLength(buildScenePlan(value).scenes.length);
    expect(first.global).toMatch(/^[0-9a-f]{16}$/);
  });

  it('2) 封面被改写成 http://127.0.0.1:<随机端口>/covers/… 时键不变（规范化）', () => {
    const relative = input();
    const absolutized = input({
      assetBaseUrl: 'http://127.0.0.1:54321',
      media: [media(1, 1), media(2), media(3)].map((m) => ({
        ...m,
        coverAssetPath: `http://127.0.0.1:54321${m.coverAssetPath}`,
      })),
    });
    expect(keysOf(absolutized).global).toBe(keysOf(relative).global);
    expect(keysOf(absolutized).segments).toEqual(keysOf(relative).segments);
    expect(canonicalizePath('http://127.0.0.1:1/covers/a.jpg')).toBe('/covers/a.jpg');
    expect(canonicalizePath('/covers/a.jpg')).toBe('/covers/a.jpg');
  });

  it('3) 只改标题 / seed → 全局键变（chapter 下标题在 Topbar 每帧都画）', () => {
    const base = keysOf(input());
    expect(keysOf(input({ title: '换个标题' })).global).not.toBe(base.global);
    expect(keysOf(input({}, { seed: 12345 })).global).not.toBe(base.global);
  });

  it('4) 只改某媒体的备注 → 只有含它的段键变', () => {
    const base = keysOf(input());
    const changed = keysOf(input({ media: [media(1, 1), media(2, 0, '新备注'), media(3)] }));
    const diff = changed.segments.map((key, index) => (key === base.segments[index] ? 0 : 1));
    expect(diff.some((flag) => flag === 1)).toBe(true);
    // 只该影响含 作品2 的段；含 作品1/3 的段必须原样
    const plan = buildScenePlan(input());
    plan.scenes.forEach((scene, index) => {
      const touched = scene.mediaIds?.includes(2) || scene.mediaId === 2
        || (scene.type === 'GROUP_INTRO' && scene.groupName === '2024 年');   // 章节页含全组成员
      if (!touched && scene.type !== 'COLLECTION_OPENING' && scene.type !== 'COLLECTION_ENDING') {
        expect(diff[index], `段 ${index}（${scene.type}）不该变`).toBe(0);
      }
    });
  });

  it('5) 素材指纹变化（片段文件被换掉 / 封面被换）→ 相关段键变', () => {
    const value = input();
    const withPrint = { assetPrint: { 'clip-1-0.mp4': '1000-111', '/covers/1.jpg': '2000-222' } };
    const replaced = { assetPrint: { 'clip-1-0.mp4': '1000-999', '/covers/1.jpg': '2000-222' } };
    const before = keysOf(value, withPrint);
    const after = keysOf(value, replaced);
    expect(before.segments).not.toEqual(after.segments);
    // 封面墙（开场/落款）与章节页缩略图都是**段层**依赖 → 封面变了段键变、但**全局键不变**
    //（全局层只管 Topbar/Trackbar/BGM/主题/画幅这些根节点参数）
    expect(keysOf(value, { assetPrint: { ...withPrint.assetPrint, '/covers/1.jpg': '2000-333' } }).segments)
      .not.toEqual(before.segments);
    expect(keysOf(value, { assetPrint: { ...withPrint.assetPrint, '/covers/1.jpg': '2000-333' } }).global)
      .toBe(before.global);
  });

  it('6) 哈希稳定且区分大小写内容（防"随手改成大小写不敏感"）', () => {
    expect(fnv1a64('abc')).toBe(fnv1a64('abc'));
    expect(fnv1a64('abc')).not.toBe(fnv1a64('abC'));
    expect(fnv1a64('abc')).toHaveLength(16);
  });
});
