import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { RenderParams } from '../params';

/** 与旧模板一致的确定性伪随机（固定种子，不用 Math.random，保证两次渲染一致）。 */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 星空：#stars 在旧模板里是 canvas 逐帧绘制；这里改为确定性 DOM 星点 + 帧驱动闪烁。 */
export function Stars() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const points = React.useMemo(() => {
    const rand = seeded(20260917);
    return Array.from({ length: 70 }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      r: rand() * 1.3 + 0.4,
      tw: rand() * Math.PI * 2,
      tws: rand() * 0.02 + 0.008,
      hue: [200, 218, 262][Math.floor(rand() * 3)],
    }));
  }, []);
  void width;
  void height;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {points.map((point, index) => (
        <span
          key={index}
          style={{
            position: 'absolute',
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: point.r * 2,
            height: point.r * 2,
            borderRadius: '50%',
            background: `hsla(${point.hue},80%,78%,${0.35 + Math.sin(point.tw + frame * point.tws) * 0.25})`,
          }}
        />
      ))}
    </div>
  );
}

/** 云层：旧模板用 #clouds + .cloud 纯 CSS 漂浮，这里保留同一结构（数量固定，位置确定性）。 */
export function Clouds() {
  const rand = seeded(7717);
  const clouds = React.useMemo(
    () => Array.from({ length: 6 }, () => ({ top: rand() * 80, scale: 0.7 + rand() * 1.1, delay: rand() * 40, dur: 90 + rand() * 70 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <div id="clouds">
      {clouds.map((cloud, index) => (
        <div
          key={index}
          className="cloud"
          style={{
            top: `${cloud.top}%`,
            transform: `scale(${cloud.scale})`,
            animationDelay: `${cloud.delay}s`,
            animationDuration: `${cloud.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 顶栏：.topbar / .brand / .logo。 */
export function Topbar({ params }: { params: RenderParams }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">✦</span>
        <span>{params.brandTitle.trim() || params.title}</span>
      </div>
    </header>
  );
}

/** 底部进度条：.trackbar + .tb-progress（旧模板由自动导览更新，这里按帧推进）。 */
export function Trackbar({ label }: { label: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(100, (frame / Math.max(1, durationInFrames - 1)) * 100);
  return (
    <div className="trackbar show auto">
      <span>{label}</span>
      <div className="tb-progress">
        <i style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/** 章节风外壳：星场 + 云层 + 顶栏 + 场景内容 + 进度条。 */
export function ChapterShell({ params, label, children }: { params: RenderParams; label: string; children: React.ReactNode }) {
  return (
    <AbsoluteFill className="vt-chapter-root">
      <Stars />
      <Clouds />
      <div className="content">
        <Topbar params={params} />
        <main className="story">{children}</main>
        <Trackbar label={label} />
      </div>
    </AbsoluteFill>
  );
}
