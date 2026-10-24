/**
 * 统计视频页内预览入口（v0.32 第二部分收尾）。
 *
 * 作用：让用户**改参数前先看效果**，而不是每次都等一遍完整渲染（44 年 × 1.5s/年 ≈ 2070 帧，本机 4~8 分钟）。
 *
 * 契约（宿主 `stats-trend.js` ↔ 这里）：
 *   `window.VTTrendPreview.mount(el, inputProps)`  首次挂载
 *   `window.VTTrendPreview.update(inputProps)`     改参数后重挂（同一份 DOM，不重建 root）
 *   `window.VTTrendPreview.unmount()`              关弹层时卸载（回收 React root）
 *
 * 数据来自前端已有的线数据（`trendState.lines`）→ **预览零后端新增**；代表作沿用现成的 `refs` 接口。
 * 预览用的是 `@remotion/player`（浏览器逐帧实时渲染，跟正式渲染**同一份 composition**），
 * 所以「预览里看到什么，渲染出来就是什么」——只有分辨率/码率不同。
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Player } from '@remotion/player';
import { MediaTrendComposition } from '../src/trend/MediaTrendComposition';
import { TREND_FPS, TREND_HEIGHT, TREND_WIDTH, totalFrames, type TrendVideoInput } from '../src/trend/params';

let root: Root | null = null;

function Preview(props: TrendVideoInput) {
  return (
    <Player
      component={MediaTrendComposition}
      inputProps={props}
      durationInFrames={totalFrames(props)}
      compositionWidth={TREND_WIDTH}
      compositionHeight={TREND_HEIGHT}
      fps={TREND_FPS}
      style={{ width: '100%', maxHeight: '70vh' }}
      controls
      loop
      doubleClickToFullscreen
    />
  );
}

declare global {
  interface Window {
    VTTrendPreview?: {
      mount: (el: HTMLElement, props: TrendVideoInput) => void;
      update: (props: TrendVideoInput) => void;
      unmount: () => void;
      built: true;
    };
  }
}

window.VTTrendPreview = {
  mount(el: HTMLElement, props: TrendVideoInput) {
    if (root) {
      root.unmount();
      root = null;
    }
    root = createRoot(el);
    root.render(<Preview {...props} />);
  },
  update(props: TrendVideoInput) {
    if (!root) return;
    root.render(<Preview {...props} />);
  },
  unmount() {
    if (root) {
      root.unmount();
      root = null;
    }
  },
  built: true,
};
