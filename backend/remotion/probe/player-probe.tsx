/**
 * 地基探针 ①：热更新 `inputProps` 时，Player 是否保持当前帧 / 播放状态？
 *
 * 用途：验证「边拖边看」是否成立。结论写进 document.title（供 puppeteer 读取）。
 * 这是**一次性探针**，不属于生产链路。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { RecommendComposition } from '../src/RecommendComposition';
import { buildScenePlan } from '../src/scene-plan';
import type { MultiMediaPocInput } from '../src/types';

const base: MultiMediaPocInput = {
  template: 'MULTI_MEDIA_RECOMMEND',
  style: 'chapter',
  title: 'T',
  media: [1, 2, 3].map((n) => ({
    mediaId: n,
    order: n,
    mode: 'INFO_ONLY' as const,
    title: `M${n}`,
    tags: [],
    clips: [],
  })),
  params: { durations: { opening: 4, intro: 3, group: 3, detail: 4, ending: 3, title: 2 }, bgmTracks: [] },
};

type Variant = 'same-duration' | 'longer' | 'shorter';

function variantOf(kind: Variant): MultiMediaPocInput {
  const durations = { opening: 4, intro: 3, group: 3, detail: 4, ending: 3, title: 2 };
  if (kind === 'same-duration') return { ...base, title: 'T2', params: { ...base.params, durations } };
  if (kind === 'longer') return { ...base, params: { ...base.params, durations: { ...durations, detail: 8, title: 2 } } };
  return { ...base, params: { ...base.params, durations: { ...durations, detail: 3, title: 2 } } };
}

declare global {
  interface Window {
    __probe?: Record<string, unknown>;
  }
}

function App() {
  const ref = useRef<PlayerRef>(null);
  const [input, setInput] = useState<MultiMediaPocInput>(base);
  const plan = useMemo(() => buildScenePlan(input), [input]);
  const [mountedAt, setMountedAt] = useState(0);
  const mountCount = useRef(0);
  mountCount.current += 1;

  useEffect(() => {
    window.__probe = {
      ready: true,
      // 组件重挂载计数：>1 说明 inputProps 变更导致 remount（帧必然丢）
      renders: () => mountCount.current,
      duration: () => plan.durationInFrames,
      current: () => ref.current?.getCurrentFrame() ?? -1,
      playing: () => ref.current?.isPlaying() ?? false,
      seekTo: (frame: number) => ref.current?.seekTo(frame),
      play: () => ref.current?.play(),
      setVariant: (kind: Variant) => {
        setInput(variantOf(kind));
        setMountedAt(Date.now());
      },
      mountedAt: () => mountedAt,
    };
  });

  return (
    <div style={{ padding: 8, background: '#07060d' }}>
      <div id="probe-shell" style={{ width: 640, aspectRatio: `${plan.width} / ${plan.height}` }}>
        <Player
          ref={ref}
          component={RecommendComposition}
          inputProps={{ input }}
          durationInFrames={plan.durationInFrames}
          fps={plan.fps}
          compositionWidth={plan.width}
          compositionHeight={plan.height}
          initialFrame={0}
          style={{ width: '100%', height: '100%' }}
          controls
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
