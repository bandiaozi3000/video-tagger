import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { RenderParams } from '../params';

/** 序言屏：旧模板 `.prologue` 结构（kicker / h2 / pl-text / pl-cta）。 */
export function CollectionIntro({ params, beatFrames }: { params: RenderParams; beatFrames: number }) {
  const frame = useCurrentFrame();
  const inFrames = Math.max(3, Math.round(beatFrames / 2));
  const enter = interpolate(frame, [0, inFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <section className="prologue">
      <div className="pl-kicker">PROLOGUE</div>
      <h2>{params.prologueTitle.trim() || params.title}</h2>
      <p className="pl-text" style={{ opacity: enter }}>{params.intro}</p>
      <div className="pl-cta">✦ 向下进入 ✦</div>
    </section>
  );
}
