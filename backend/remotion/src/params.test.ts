import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, MAX_SEGMENT_SEC, resolveParams, resolveStyle, resolveTheme, speedToFrames } from '../src/params';

describe('resolveParams', () => {
  it('缺省时与 Java 默认值一致', () => {
    const p = resolveParams(undefined, undefined);
    expect(p.coverSize).toBe(50);
    expect(p.durations).toEqual({ opening: 10, intro: 5, group: 5, detail: 10, ending: 5, title: 2 });
    expect(p.fps).toBe(30);
    expect(p.width).toBe(1280);
    expect(p.height).toBe(720);
    expect(p.bgmGain).toBeCloseTo(0.45);
    expect(p.bgmDuckTo).toBeCloseTo(0.16);
    expect(p.perScreen).toBe(1);
  });

  it('clamp 区间与 Java 一致', () => {
    const p = resolveParams({ coverSize: 999, bgmScale: 10, durations: { opening: 99, intro: 0, detail: 1, group: 0, ending: 99 } as never });
    expect(p.coverSize).toBe(100);
    expect(p.bgmScale).toBe(50);
    // 显示时长**只留下限、上不封顶**（2026-09-26 用户：「无限制可自由发挥」）→ 只有手滑兑底 600s
    expect(p.durations.opening).toBe(99);
    expect(p.durations.intro).toBe(1);
    expect(p.durations.detail).toBe(3);
    expect(p.durations.ending).toBe(99);
    const big = resolveParams({ durations: { opening: 99999, ending: 99999 } as never });
    expect(big.durations.opening).toBe(MAX_SEGMENT_SEC);
    expect(big.durations.ending).toBe(MAX_SEGMENT_SEC);
  });

  it('文案回退到输入顶层字段', () => {
    const p = resolveParams({}, { title: '顶层标题', subtitle: '顶层副标题', intro: '顶层序言' });
    expect(p.title).toBe('顶层标题');
    expect(p.subtitle).toBe('顶层副标题');
    expect(p.intro).toBe('顶层序言');
  });

  it('params 文案优先于顶层', () => {
    const p = resolveParams({ title: '参数标题' }, { title: '顶层标题' });
    expect(p.title).toBe('参数标题');
  });

  it('BGM 曲目过滤无效项并保留时长/素材', () => {
    const p = resolveParams({
      bgmTracks: [
        { name: '有效', durationSec: 12.5, assetPath: 'media/a.mp3' },
        { name: '  ' },
        { name: '无时长', assetPath: '' },
      ] as never,
    });
    expect(p.bgmTracks).toHaveLength(2);
    expect(p.bgmTracks[0]).toEqual({ name: '有效', durationSec: 12.5, assetPath: 'media/a.mp3' });
    expect(p.bgmTracks[1]).toEqual({ name: '无时长', durationSec: undefined, assetPath: undefined });
  });
});

describe('speedToFrames', () => {
  it('0/50/100 档位 → 36/22/8 帧（30fps 基准）', () => {
    expect(speedToFrames(0, 30)).toBe(36);
    expect(speedToFrames(50, 30)).toBe(22);
    expect(speedToFrames(100, 30)).toBe(8);
  });

  it('按 fps 换算', () => {
    expect(speedToFrames(50, 60)).toBe(44);
  });
});

describe('模板形态', () => {
  it('缺省 chapter，显式 clip 生效', () => {
    expect(resolveStyle({ template: 'MULTI_MEDIA_RECOMMEND', title: '', media: [] })).toBe('chapter');
    expect(resolveStyle({ template: 'MULTI_MEDIA_RECOMMEND', title: '', media: [], style: 'clip' })).toBe('clip');
  });

  it('两套形态共用同一组令牌键，但值不同', () => {
    const chapter = resolveTheme({ template: 'MULTI_MEDIA_RECOMMEND', title: '', media: [] });
    const clip = resolveTheme({ template: 'MULTI_MEDIA_RECOMMEND', title: '', media: [], style: 'clip' });
    expect(Object.keys(chapter).sort()).toEqual(Object.keys(clip).sort());
    expect(chapter.decor.stars).not.toBe(clip.decor.stars);
  });
});

describe('DEFAULT_PARAMS', () => {
  it('分组/每屏相关参数默认值', () => {
    expect(DEFAULT_PARAMS.groupBy).toBe('');
    expect(DEFAULT_PARAMS.groupSort).toBe('date-desc');
    expect(DEFAULT_PARAMS.perScreen).toBe(1);
  });
});
