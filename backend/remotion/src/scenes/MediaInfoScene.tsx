import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import type { PocMedia } from '../types';

export function MediaInfoScene({ media, assetBaseUrl }: { media: PocMedia; assetBaseUrl: string }) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cover = media.coverAssetPath ? `${assetBaseUrl}/${media.coverAssetPath}` : null;
  const metadata = [media.year, media.season ? `第 ${media.season} 季` : null].filter(Boolean).join('  /  ');
  return (
    <AbsoluteFill style={{ background: '#141619', color: '#f6f2eb', fontFamily: 'Arial, sans-serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, #111416 0%, #232a2c 50%, #101113 100%)' }} />
      {cover ? <Img src={cover} style={{ position: 'absolute', inset: -40, width: 'calc(100% + 80px)', height: 'calc(100% + 80px)', objectFit: 'cover', filter: 'blur(28px)', opacity: 0.22 }} /> : null}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,11,13,.98) 0%, rgba(10,11,13,.80) 46%, rgba(10,11,13,.30) 100%)' }} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', gap: 54, padding: '56px 78px', opacity: enter, transform: `translateX(${(1 - enter) * -36}px)` }}>
        <div style={{ width: 270, height: 390, flex: '0 0 auto', background: '#272d2d', boxShadow: '0 24px 60px rgba(0,0,0,.42)', overflow: 'hidden' }}>
          {cover ? <Img src={cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c8784', fontSize: 22 }}>NO COVER</div>}
        </div>
        <div style={{ maxWidth: 770 }}>
          <div style={{ color: '#d5a85d', fontSize: 18, letterSpacing: 3, fontWeight: 700 }}>#{String(media.order).padStart(2, '0')}  FEATURED TITLE</div>
          <h1 style={{ margin: '18px 0 8px', fontSize: 64, lineHeight: 1.02, fontWeight: 800 }}>{media.title}</h1>
          {media.originalTitle ? <div style={{ color: '#aab4b1', fontSize: 22 }}>{media.originalTitle}</div> : null}
          {metadata ? <div style={{ marginTop: 22, color: '#e0c98f', fontSize: 21 }}>{metadata}</div> : null}
          {media.description ? <div style={{ marginTop: 28, color: '#d0d7d3', fontSize: 21, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{media.description}</div> : null}
          {media.tags.length > 0 ? <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>{media.tags.slice(0, 6).map((tag) => <span key={tag} style={{ border: '1px solid #68736f', color: '#c8d0cc', padding: '7px 13px', fontSize: 15 }}>{tag}</span>)}</div> : null}
          <div style={{ marginTop: 30, color: '#8f9b96', fontSize: 16, letterSpacing: 1 }}>{media.clips.length > 0 ? `${media.clips.length} 个精选片段` : '资料推荐 · 本次未选片段'}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
