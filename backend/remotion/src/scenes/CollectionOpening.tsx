import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { MultiMediaPocInput } from '../types';

export function CollectionOpening({ input }: { input: MultiMediaPocInput }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15, 75, 90], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const withClip = input.media.filter((media) => media.clips.length > 0).length;
  const clipCount = input.media.reduce((sum, media) => sum + media.clips.length, 0);
  return (
    <AbsoluteFill style={{ background: '#101115', color: '#f5f1ea', opacity, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 20%, #39444a 0%, #17191d 45%, #0b0c0e 100%)' }} />
      <div style={{ position: 'absolute', left: 72, right: 72, top: 70, bottom: 64, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ color: '#d5a85d', fontSize: 18, letterSpacing: 4, fontWeight: 700 }}>VIDEO TAGGER / CURATED WATCHLIST</div>
        <div>
          <div style={{ fontSize: 72, lineHeight: 0.98, fontWeight: 800, maxWidth: 900 }}>{input.title}</div>
          {input.subtitle ? <div style={{ marginTop: 24, color: '#b9c1c0', fontSize: 28 }}>{input.subtitle}</div> : null}
          <div style={{ marginTop: 42, display: 'flex', gap: 36, color: '#d7ddda', fontSize: 20 }}>
            <Stat value={input.media.length} label="作品" />
            <Stat value={withClip} label="片段推荐" />
            <Stat value={clipCount} label="高光片段" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#87918f', fontSize: 16 }}>
          <span style={{ width: 42, height: 2, background: '#d5a85d' }} />
          A SELECTION OF THINGS WORTH WATCHING
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div><strong style={{ color: '#f5f1ea', fontSize: 34 }}>{value}</strong><span style={{ marginLeft: 8 }}>{label}</span></div>;
}
