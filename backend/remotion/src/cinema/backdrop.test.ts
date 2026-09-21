import { describe, expect, it } from 'vitest';
import { needsBlurBackdrop } from './backdrop';

describe('片段模糊背景是否必要', () => {
  it('与画幅同比（16:9 片段 + 16:9 画幅）→ 不渲染（省 ~40% 片段帧耗时）', () => {
    expect(needsBlurBackdrop({ assetWidth: 1920, assetHeight: 1080 }, 1280, 720)).toBe(false);
    expect(needsBlurBackdrop({ assetWidth: 3840, assetHeight: 2160 }, 3840, 2160)).toBe(false);
  });

  it('非同比（4:3 老番 / 竖屏）→ 渲染（contain 会留边，需要糊底）', () => {
    expect(needsBlurBackdrop({ assetWidth: 1440, assetHeight: 1080 }, 1920, 1080)).toBe(true);
    expect(needsBlurBackdrop({ assetWidth: 1080, assetHeight: 1920 }, 1920, 1080)).toBe(true);
  });

  it('尺寸未知 → 保守渲染（宁多花时间也别露黑边）', () => {
    expect(needsBlurBackdrop({}, 1920, 1080)).toBe(true);
    expect(needsBlurBackdrop({ assetWidth: 0, assetHeight: 0 }, 1920, 1080)).toBe(true);
  });
});
