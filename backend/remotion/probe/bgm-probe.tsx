/**
 * 一次性诊断探针：BGM 在 Remotion Player 里是否被反复回跳（用户症状：音乐像「12 12 23 23」）。
 * 不是门禁，验证完即删。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { RecommendComposition } from '../src/RecommendComposition';
import { buildScenePlan } from '../src/scene-plan';
import type { MultiMediaPocInput } from '../src/types';

const ASSET_BASE_URL = new URLSearchParams(location.search).get('assets') ?? '';

function makeInput(durationSec: number | undefined): MultiMediaPocInput {
  return {
    template: 'MULTI_MEDIA_RECOMMEND',
    style: 'chapter',
    title: 'BGM probe',
    assetBaseUrl: ASSET_BASE_URL,
    media: [1, 2, 3].map((n) => ({
      mediaId: n,
      order: n,
      mode: 'INFO_ONLY' as const,
      title: `M${n}`,
      tags: [],
      clips: [],
    })),
    params: {
      durations: { opening: 10, intro: 5, group: 5, detail: 10, ending: 5, title: 2 },
      groupBy: 'none',
      perScreen: 1,
      bgmTracks: [{ name: 'probe-bgm', assetPath: 'bgm-0.flac', durationSec }],
    },
  };
}

declare global {
  interface Window {
    __bgm?: Record<string, unknown>;
  }
}

/** 监控 <audio> 元素的新增（Remotion 把音频元素挂在 body 下）。 */
const created: { at: number; src: string; loop: boolean }[] = [];
function watchAudio(): void {
  const seen = new WeakSet<Node>();
  const scan = () => {
    document.querySelectorAll('audio').forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      created.push({ at: performance.now(), src: (el as HTMLAudioElement).src, loop: (el as HTMLAudioElement).loop });
    });
  };
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
}

const CHURN_MS = Number(new URLSearchParams(location.search).get('churn') ?? 0);
/** stable=1：还原候选修复——`inputProps` 用 useMemo 稳定引用（父组件照旧每帧重渲染）。 */
const STABLE = new URLSearchParams(location.search).get('stable') === '1';

function App() {
  const ref = useRef<PlayerRef>(null);
  const [durationSec, setDurationSec] = useState<number | undefined>(272.9);
  const [input, setInput] = useState<MultiMediaPocInput>(() => makeInput(272.9));
  const [, setTick] = useState(0);
  const plan = useMemo(() => buildScenePlan(input), [input]);
  const inputProps = useMemo(() => ({ input }), [input]);

  // 模拟编辑器的 inputProps 抖动：父组件每帧重渲染 → `{ input }` 每次都是新对象字面量
  useEffect(() => {
    if (!CHURN_MS) return;
    const id = window.setInterval(() => setTick((t) => t + 1), CHURN_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    window.__bgm = {
      ready: true,
      play: () => ref.current?.play(),
      pause: () => ref.current?.pause(),
      frame: () => ref.current?.getCurrentFrame() ?? -1,
      plan: { durationInFrames: plan.durationInFrames, fps: plan.fps },
      created: () => created.slice(),
      /** 重新赋值 inputProps（模拟编辑器每帧/每次 patch 的新对象）。 */
      poke: () => setInput((prev) => ({ ...prev, params: { ...prev.params } })),
      setDuration: (sec: number | undefined) => { setDurationSec(sec); setInput((prev) => ({ ...prev, params: { ...prev.params, bgmTracks: [{ name: 'probe-bgm', assetPath: 'bgm-0.flac', durationSec: sec }] } })); },
      elements: () => Array.from(document.querySelectorAll('audio')).map((el) => ({ src: el.src.slice(-24), t: el.currentTime, dur: el.duration, loop: el.loop, paused: el.paused })),
    };
  }, [plan.durationInFrames, plan.fps, durationSec]);

  return (
    <Player
      ref={ref}
      component={RecommendComposition}
      inputProps={STABLE ? inputProps : { input }}
      durationInFrames={plan.durationInFrames}
      fps={plan.fps}
      compositionWidth={plan.width}
      compositionHeight={plan.height}
      initialFrame={0}
      style={{ width: 640, height: 360 }}
      controls
    />
  );
}

watchAudio();
createRoot(document.getElementById('root')!).render(<App />);
