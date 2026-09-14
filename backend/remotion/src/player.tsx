import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { RecommendComposition } from './RecommendComposition';
import { buildScenePlan } from './scene-plan';
import type { MultiMediaPocInput } from './types';

function App() {
  const [input, setInput] = useState<MultiMediaPocInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/input.json')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((value: MultiMediaPocInput) => setInput({ ...value, assetBaseUrl: window.location.origin }))
      .catch((reason: Error) => setError(reason.message));
  }, []);

  if (error) return <main style={styles.error}>POC 输入读取失败：{error}</main>;
  if (!input) return <main style={styles.loading}>正在加载 Remotion POC…</main>;
  const plan = buildScenePlan(input);
  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <Player
          component={RecommendComposition}
          inputProps={{ input }}
          durationInFrames={plan.durationInFrames}
          fps={plan.fps}
          compositionWidth={plan.width}
          compositionHeight={plan.height}
          controls
          loop={false}
          style={styles.player}
        />
        <div style={styles.caption}>Remotion multi-media recommendation POC · {input.media.length} media · {plan.durationInFrames} frames</div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0b0c0e', color: '#f6f2eb', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Arial, sans-serif' },
  shell: { width: 'min(1280px, 100%)' },
  player: { width: '100%', aspectRatio: '16 / 9', boxShadow: '0 20px 80px rgba(0,0,0,.45)' },
  caption: { color: '#87918d', fontSize: 13, letterSpacing: 1, marginTop: 14 },
  loading: { color: '#d5a85d', padding: 40 },
  error: { color: '#f08b79', padding: 40 },
};

createRoot(document.getElementById('root')!).render(<App />);
