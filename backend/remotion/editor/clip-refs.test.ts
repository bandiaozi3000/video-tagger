import { describe, expect, it } from 'vitest';
import { attachWithSource, clipsOf, dropAllMissing, withoutClip } from './clip-refs';
import type { EditorConfig } from './api';

const config = (mediaClips: EditorConfig['mediaClips']): EditorConfig['mediaClips'] => mediaClips;

describe('推荐草稿里的片段引用：移除（用户「要么补要么删无法操作」）', () => {
  it('拿掉一个片段，同媒体的其它片段保留顺序', () => {
    const next = withoutClip(config({ '7130': { order: [11, 12, 13] } }), 7130, 12);
    expect(next['7130'].order).toEqual([11, 13]);
  });

  it('拿掉最后一个片段 → 整条媒体记录消失（该媒体回到「资料推荐」）', () => {
    const next = withoutClip(config({ '7130': { order: [12] } }), 7130, 12);
    expect(next['7130']).toBeUndefined();
  });

  it('本来就没有这个片段 → 返回原对象（不制造无意义的新草稿状态）', () => {
    const before = config({ '7130': { order: [11] } });
    expect(withoutClip(before, 7130, 99)).toBe(before);
    expect(withoutClip(before, 9999, 11)).toBe(before);
  });

  it('只动目标媒体，别的媒体原样', () => {
    const before = config({ '7130': { order: [11, 12] }, '6917': { order: [21] } });
    const next = withoutClip(before, 7130, 11);
    expect(next['6917']).toEqual({ order: [21] });
  });

  it('清理全部失效：一次拿掉所有缺失项（含同一媒体多条）', () => {
    const before = config({ '7130': { order: [11, 12, 13] }, '6917': { order: [21] } });
    const next = dropAllMissing(before, [
      { mediaId: 7130, clipId: 12, title: 'a', reason: 'r' },
      { mediaId: 7130, clipId: 13, title: 'b', reason: 'r' },
      { mediaId: 6917, clipId: 21, title: 'c', reason: 'r' },
    ]);
    expect(next['7130'].order).toEqual([11]);
    expect(next['6917']).toBeUndefined();
  });

  it('clipsOf 对没有记录的媒体给空壳（不写回草稿）', () => {
    expect(clipsOf({}, 1)).toEqual({ order: [] });
  });
});

describe('借来的片段被移除时，来源映射一起清掉（否则 sources 留悬空键）', () => {
  it('移除借来的片段 → order 与 sources 同步更新', () => {
    const before = { '6917': { order: [11, 900], sources: { '900': 6648 } } };
    const next = withoutClip(before, 6917, 900);
    expect(next['6917'].order).toEqual([11]);
    expect(next['6917'].sources).toEqual({});
  });

  it('移除本体片段不影响其它片段的来源映射', () => {
    const before = { '6917': { order: [11, 12, 900], sources: { '900': 6648 } } };
    const next = withoutClip(before, 6917, 11);
    expect(next['6917'].order).toEqual([12, 900]);
    expect(next['6917'].sources).toEqual({ '900': 6648 });
  });

  it('清理全部失效时同样清掉来源键', () => {
    const before = { '6917': { order: [900], sources: { '900': 6648 } } };
    const next = dropAllMissing(before, [{ mediaId: 6917, clipId: 900, title: 'x', reason: 'r' }]);
    expect(next['6917']).toBeUndefined();
  });
});

describe('一键修好跨媒体悬空引用（不删，改成借片段）', () => {
  it('把片段按建议来源挂上：写进 sources 且保留已有片段', () => {
    const next = attachWithSource({ '6917': { order: [182], sources: {} } }, 6917, 182, 6648);
    expect(next['6917'].order).toEqual([182]);
    expect(next['6917'].sources).toEqual({ '182': 6648 });
  });

  it('片段不在顺序里时补进去（挂载即加入）', () => {
    const next = attachWithSource({ '6917': { order: [11] } }, 6917, 182, 6648);
    expect(next['6917'].order).toEqual([11, 182]);
    expect(next['6917'].sources).toEqual({ '182': 6648 });
  });

  it('没记录的媒体也能直接建', () => {
    const next = attachWithSource({}, 6917, 182, 6648);
    expect(next['6917']).toEqual({ order: [182], sources: { '182': 6648 } });
  });
});
