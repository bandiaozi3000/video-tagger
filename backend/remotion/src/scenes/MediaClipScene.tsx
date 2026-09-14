import React from 'react';
import { AbsoluteFill, OffthreadVideo, useCurrentFrame } from 'remotion';
import type { PocClip, PocMedia } from '../types';

export function MediaClipScene({ media, clip, assetBaseUrl }: { media: PocMedia; clip: PocClip; assetBaseUrl: string }) {
  const frame = useCurrentFrame();
  const src = `${assetBaseUrl}/${clip.assetPath}`;
  const label = [clip.episodeNo ? `第 ${clip.episodeNo} 集` : null, clip.episodeTitle, clip.title].filter(Boolean).join('  /  ');
  return (
    <AbsoluteFill style={{ background: '#090a0b', color: '#f6f2eb', fontFamily: 'Arial, sans-serif' }}>
      <OffthreadVideo src={src} muted={!clip.hasAudio} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.50), transparent 30%, transparent 70%, rgba(0,0,0,.72))' }} />
      <div style={{ position: 'absolute', left: 52, right: 52, top: 38, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#e0c98f', fontSize: 16, letterSpacing: 2 }}>#{String(media.order).padStart(2, '0')}  {media.title}</span>
        <span style={{ color: '#cbd1cc', fontSize: 14 }}>CLIP {clip.clipId}</span>
      </div>
      <div style={{ position: 'absolute', left: 52, bottom: 42, right: 52 }}>
        <div style={{ width: Math.min(260, Math.max(60, frame * 3)), height: 3, background: '#d5a85d', marginBottom: 14 }} />
        <div style={{ fontSize: 25, fontWeight: 700 }}>{label}</div>
      </div>
    </AbsoluteFill>
  );
}
