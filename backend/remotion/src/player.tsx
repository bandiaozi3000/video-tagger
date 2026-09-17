import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { buildScenePlan } from './scene-plan';
import { RecommendComposition } from './RecommendComposition';
import type { MultiMediaPocInput } from './types';

declare global {
  interface Window {
    /** 生产预览：Java 注入的渲染输入（与导出用的是同一份 RenderInput） */
    __VT_INPUT__?: MultiMediaPocInput;
    /** 生产预览：素材基址（如 /recommend-previews/<token>） */
    __VT_ASSET_BASE__?: string;
  }
}

/** 输入来源：生产预览用注入的 window.__VT_INPUT__；开发用 Vite 的 /input.json。 */
async function loadInput(): Promise<MultiMediaPocInput> {
  const injected = window.__VT_INPUT__;
  if (injected) {
    return { ...injected, assetBaseUrl: window.__VT_ASSET_BASE__ ?? '' };
  }
  const response = await fetch('/input.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const value = (await response.json()) as MultiMediaPocInput;
  return { ...value, assetBaseUrl: window.location.origin };
}

function App() {
  const [input, setInput] = useState<MultiMediaPocInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadInput()
      .then(setInput)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <main style={styles.message}>预览输入读取失败：{error}</main>;
  if (!input) return <main style={styles.message}>正在加载预览…</main>;
  const plan = buildScenePlan(input);
  // 起始帧：开场前 ~0.6s 是淡入（全黑），直接停在第 0 帧会让人以为坏了；
  // 可在地址栏加 ?frame=N 定位到指定帧（调试用）。
  const requested = Number(new URLSearchParams(window.location.search).get('frame'));
  const initialFrame = Number.isFinite(requested) && requested >= 0
    ? Math.min(requested, plan.durationInFrames - 1)
    : Math.min(30, plan.durationInFrames - 1);
  return (
    <main style={styles.page}>
      {/* 容器必须给定高：只给 flex:1/% 高会让 Player 内部包装层算成 0 高，绝对定位的画布被顶出视口 */}
      <section
        style={{
          ...styles.shell,
          aspectRatio: `${plan.width} / ${plan.height}`,
          maxHeight: '78vh',
          width: '100%',
        }}
      >
        <Player
          component={RecommendComposition}
          inputProps={{ input }}
          durationInFrames={plan.durationInFrames}
          fps={plan.fps}
          compositionWidth={plan.width}
          compositionHeight={plan.height}
          initialFrame={initialFrame}
          style={{ width: '100%', height: '100%' }}
          controls
          loop
          doubleClickToFullscreen
        />
      </section>
      <div style={styles.meta}>
        {plan.width}×{plan.height} · {plan.fps}fps · {plan.durationInFrames} 帧 · {input.media.length} 部作品 ·
        与导出成片同源（同一 Composition 与同一份 CSS）
      </div>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', margin: 0, padding: '18px 18px 26px', background: '#07060d', color: '#9d97b8', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 } as const,
  shell: { border: '1px solid rgba(255,255,255,.09)', borderRadius: 14, overflow: 'hidden', background: '#000' } as const,
  meta: { fontSize: 12, letterSpacing: 1, textAlign: 'center' } as const,
  message: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#07060d', color: '#9d97b8', fontFamily: 'system-ui, sans-serif' } as const,
};

createRoot(document.getElementById('root')!)
  .render(<React.StrictMode><App /></React.StrictMode>);
