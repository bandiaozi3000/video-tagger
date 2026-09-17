import React from 'react';
import { Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset-url';
import { glowOf, type RenderParams } from '../params';
import type { PocMedia, PocClip } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/** 详情卡（旧模板 `.story-card`，不含片段滚筒）。 */
export function MediaInfoScene({ media, params, assetBaseUrl, beatFrames }: {
  media: PocMedia;
  params: RenderParams;
  assetBaseUrl: string;
  beatFrames: number;
}) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, beatFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <StoryCardShell media={media} params={params} assetBaseUrl={assetBaseUrl} glow={glowOf(media.order - 1)}>
      <div className="sc-info" style={{ opacity: enter }}>
        <span className="kicker">PICK NO.{pad(media.order)}</span>
        <h2>{media.title}</h2>
        {params.detailShow.note && media.description ? <p className="note">{media.description}</p> : null}
        {params.detailShow.tag && media.tags.length > 0 ? (
          <div className="tags">{media.tags.slice(0, 6).map((tag) => <span key={tag} className="chip">{tag}</span>)}</div>
        ) : null}
        {params.detailShow.status ? (
          <div className="chip">{media.clips.length > 0 ? `${media.clips.length} 个精选片段` : '资料推荐 · 本次未选片段'}</div>
        ) : null}
      </div>
    </StoryCardShell>
  );
}

/** 故事卡外壳：`.story-card` + `.sc-no` + `.sc-poster`（片段屏复用同一外壳）。 */
export function StoryCardShell({ media, params, assetBaseUrl, glow, children }: {
  media: PocMedia;
  params: RenderParams;
  assetBaseUrl: string;
  glow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="story-card in-view" style={{ ['--cg' as string]: glow }}>
      <span className="sc-no">{pad(media.order)}</span>
      <div className="sc-poster">
        {params.detailShow.status ? <span className="flag">{media.clips.length > 0 ? '片段推荐' : '资料推荐'}</span> : null}
        {media.coverAssetPath ? <Img src={assetUrl(media.coverAssetPath!, assetBaseUrl)} alt={media.title} /> : null}
      </div>
      {children}
    </section>
  );
}

/** 片段滚筒（旧模板 `.clip-reel`）：舞台 + 标签 + 计数 + 进度 + 轨道按钮。 */
export function ClipReel({ media, clips, activeIndex, assetBaseUrl, progress }: {
  media: PocMedia;
  clips: PocClip[];
  activeIndex: number;
  assetBaseUrl: string;
  progress: number;
}) {
  const clip = clips[activeIndex];
  const label = [media.title, clip.title, `#${activeIndex + 1}`, clip.note].filter(Boolean).join(' · ');
  return (
    <div className="clip-reel" data-clip-reel>
      <div className="clip-reel-stage">
        <VideoLayer assetBaseUrl={assetBaseUrl} clip={clip} />
        <div className="clip-reel-label">
          <div className="clip-reel-caption">
            <b>★ {label}</b>
            <small>REAL CLIP · {clip.sourceStartMs == null ? '自然结束' : '时间段'}</small>
          </div>
          <span className="clip-reel-count">{pad(activeIndex + 1)} / {pad(clips.length)}</span>
        </div>
        <div className="clip-reel-progress"><i style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
      </div>
      <div className="clip-reel-rail">
        {clips.map((item, index) => (
          <button key={item.clipId} type="button" className={index === activeIndex ? 'active' : ''}>
            <span className="n">{pad(index + 1)}</span>
            {item.title || '未命名片段'}
          </button>
        ))}
      </div>
    </div>
  );
}

// 独立出来避免循环依赖（MediaClipScene 与 MediaInfoScene 共用外壳）
import { OffthreadVideo } from 'remotion';
function VideoLayer({ clip, assetBaseUrl }: { clip: PocClip; assetBaseUrl: string }) {
  return (
    <OffthreadVideo
      src={assetUrl(clip.assetPath, assetBaseUrl)}
      muted={!clip.hasAudio}
      style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
    />
  );
}
