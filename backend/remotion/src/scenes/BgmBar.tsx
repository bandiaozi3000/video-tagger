import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { RenderParams } from '../params';

/**
 * BGM 条（旧模板 `.bgm-bar`）：bgmTracks / bgmScale / bgmX / bgmY 四项参数。
 * 只负责视觉——BGM 音频本身由 Java FFmpeg 与原声混合（设计规格 §8.3）。
 * 位置沿用旧模板语义：`left = bgmX%`、`bottom = bgmY%`、`transform = scale(bgmScale/100)`。
 */
export function BgmBar({ params }: { params: RenderParams }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const tracks = params.bgmTracks;
  if (tracks.length === 0) return null;

  const perTrackFrames = Math.max(1, Math.floor(durationInFrames / tracks.length));
  const index = Math.min(tracks.length - 1, Math.floor(frame / perTrackFrames));
  const track = tracks[index];
  const progress = Math.min(1, (frame - index * perTrackFrames) / perTrackFrames);
  const mmss = (ratio: number) => {
    const total = Math.round((durationInFrames / 30) * ratio);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  return (
    <div
      className="bgm-bar"
      style={{ left: `${params.bgmX}%`, bottom: `${params.bgmY}%`, transform: `scale(${params.bgmScale / 100})` }}
    >
      <button className="bgm-play" title="播放/暂停">▶</button>
      <span className="bgm-name">{track.name}</span>
      <div className="bgm-progress">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="bgm-time">{mmss((index + progress) / tracks.length)} / {mmss(1)}</span>
      <button className="bgm-mute" title="静音/取消静音">♪</button>
      {tracks.length > 1 && index + 1 < tracks.length ? (
        <span className="bgm-time">下一首 · {tracks[index + 1].name}</span>
      ) : null}
    </div>
  );
}
