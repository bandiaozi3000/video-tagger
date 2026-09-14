import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import type { MultiMediaPocInput } from '../types';

export function CollectionEnding({ input, assetBaseUrl }: { input: MultiMediaPocInput; assetBaseUrl: string }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const withClip = input.media.filter((media) => media.clips.length > 0).length;
  const clipCount = input.media.reduce((sum, media) => sum + media.clips.length, 0);
  return (
    <AbsoluteFill style={{ background: '#101214', color: '#f6f2eb', fontFamily: 'Arial, sans-serif', padding: '56px 72px', opacity }}>
      <div style={{ color: '#d5a85d', fontSize: 17, letterSpacing: 3, fontWeight: 700 }}>END OF SELECTION</div>
      <div style={{ marginTop: 24, fontSize: 56, fontWeight: 800 }}>留在片单里</div>
      <div style={{ marginTop: 18, color: '#b5c0bb', fontSize: 23 }}>{input.title}</div>
      <div style={{ display: 'flex', gap: 34, marginTop: 32, color: '#d9dfda', fontSize: 18 }}>
        <span><b style={{ color: '#f6f2eb', fontSize: 30 }}>{input.media.length}</b> 部作品</span>
        <span><b style={{ color: '#f6f2eb', fontSize: 30 }}>{withClip}</b> 部片段推荐</span>
        <span><b style={{ color: '#f6f2eb', fontSize: 30 }}>{clipCount}</b> 个高光</span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 52, height: 220, alignItems: 'stretch' }}>
        {input.media.map((media) => media.coverAssetPath ? <Img key={media.mediaId} src={`${assetBaseUrl}/${media.coverAssetPath}`} style={{ minWidth: 120, flex: 1, objectFit: 'cover', opacity: 0.82 }} /> : <div key={media.mediaId} style={{ minWidth: 120, flex: 1, background: '#2a3131' }} />)}
      </div>
      <div style={{ marginTop: 'auto', color: '#87918d', fontSize: 16, letterSpacing: 2 }}>A CURATED WATCHLIST BY VIDEO TAGGER</div>
    </AbsoluteFill>
  );
}
