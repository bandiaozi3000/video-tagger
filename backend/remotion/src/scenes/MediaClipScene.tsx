import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { glowOf, type RenderParams } from '../params';
import type { PocClip, PocMedia } from '../types';
import { ClipReel, StoryCardShell } from './MediaInfoScene';

/** 片段屏：同一张故事卡 + 滚筒播放指定片段（对应旧模板「详情屏内滚筒」的同屏语义）。 */
export function MediaClipScene({ media, clip, params, assetBaseUrl }: {
  media: PocMedia;
  clip: PocClip;
  params: RenderParams;
  assetBaseUrl: string;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const activeIndex = Math.max(0, media.clips.findIndex((item) => item.clipId === clip.clipId));
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  return (
    <StoryCardShell media={media} params={params} assetBaseUrl={assetBaseUrl} glow={glowOf(media.order - 1)}>
      <ClipReel media={media} clips={media.clips} activeIndex={activeIndex} assetBaseUrl={assetBaseUrl} progress={progress} />
    </StoryCardShell>
  );
}
