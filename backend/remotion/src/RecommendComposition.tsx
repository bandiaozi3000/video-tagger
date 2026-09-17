import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { CHAPTER_CSS } from './chapter/chapter-css';
import { CHAPTER_GEOMETRY_CSS } from './chapter/geometry';
import { Clouds, Stars, Topbar, Trackbar } from './chapter/chrome';
import { resolveParams, speedToFrames } from './params';
import { buildScenePlan, mediaForScene } from './scene-plan';
import { Backdrop } from './scenes/Backdrop';
import { BgmBar } from './scenes/BgmBar';
import { CollectionEnding } from './scenes/CollectionEnding';
import { CollectionIntro } from './scenes/CollectionIntro';
import { CollectionOpening } from './scenes/CollectionOpening';
import { MediaClipScene } from './scenes/MediaClipScene';
import { MediaInfoScene } from './scenes/MediaInfoScene';
import type { RenderParams } from './params';
import type { MultiMediaPocInput, Scene } from './types';

export const DEFAULT_ASSET_BASE_URL = 'http://127.0.0.1:18126/assets';

export function RecommendComposition({ input }: { input: MultiMediaPocInput }) {
  const plan = buildScenePlan(input);
  const params = resolveParams(input.params, input);
  const assetBaseUrl = input.assetBaseUrl || DEFAULT_ASSET_BASE_URL;
  const frame = useCurrentFrame();
  const active = plan.scenes.find((scene) => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames);

  return (
    <AbsoluteFill className="vt-chapter-root">
      <style>{CHAPTER_CSS}{CHAPTER_GEOMETRY_CSS}</style>
      {/* 全片背景层：bgColor / bgImages / bgRotationSec / bgOpacity / bgBlur / bgBrightness */}
      <Backdrop params={params} assetBaseUrl={assetBaseUrl} fps={plan.fps} />
      <Stars />
      <Clouds />
      <div className="content">
        <Topbar params={params} />
        <main className="story">
          {plan.scenes.map((scene) => (
            <Sequence
              key={`${scene.type}-${scene.mediaId ?? 'collection'}-${scene.clipId ?? ''}`}
              from={scene.fromFrame}
              durationInFrames={scene.durationInFrames}
              premountFor={15}
            >
              <SceneView scene={scene} input={input} params={params} assetBaseUrl={assetBaseUrl} />
            </Sequence>
          ))}
        </main>
        <Trackbar label={labelOf(active, input)} />
      </div>
      {/* BGM 条 UI：bgmTracks / bgmScale / bgmX / bgmY（音频由 Java FFmpeg 混流） */}
      <BgmBar params={params} />
    </AbsoluteFill>
  );
}

/** 底部进度条文案：与旧模板一致地显示当前段落名。 */
function labelOf(scene: Scene | undefined, input: MultiMediaPocInput): string {
  if (!scene) return '—';
  if (scene.type === 'COLLECTION_OPENING') return '开场';
  if (scene.type === 'COLLECTION_INTRO') return '序言';
  if (scene.type === 'COLLECTION_ENDING') return '结尾';
  const media = input.media.find((item) => item.mediaId === scene.mediaId);
  if (!media) return '—';
  return scene.type === 'MEDIA_CLIP' ? `${media.title} · 片段` : `${media.title}`;
}

function SceneView({ scene, input, params, assetBaseUrl }: {
  scene: Scene;
  input: MultiMediaPocInput;
  params: RenderParams;
  assetBaseUrl: string;
}) {
  // 动效速度 → 动画帧数（旧模板为实时滚动像素/秒，帧模型下重定义为帧数）
  const openingBeat = speedToFrames(params.openingSpeed, params.fps);
  const endingBeat = speedToFrames(params.endingScrollSpeed, params.fps);
  const detailBeat = Math.max(6, Math.round(params.fps * 0.6));

  if (scene.type === 'COLLECTION_OPENING') {
    return <CollectionOpening input={input} params={params} assetBaseUrl={assetBaseUrl} beatFrames={openingBeat} />;
  }
  if (scene.type === 'COLLECTION_INTRO') {
    return <CollectionIntro params={params} beatFrames={detailBeat} />;
  }
  if (scene.type === 'COLLECTION_ENDING') {
    return <CollectionEnding input={input} params={params} assetBaseUrl={assetBaseUrl} beatFrames={endingBeat} />;
  }
  const media = mediaForScene(input, scene);
  if (!media) throw new Error(`场景媒体不存在: ${scene.mediaId}`);
  if (scene.type === 'MEDIA_INFO') {
    return <MediaInfoScene media={media} params={params} assetBaseUrl={assetBaseUrl} beatFrames={detailBeat} />;
  }
  const clip = media.clips.find((item) => item.clipId === scene.clipId);
  if (!clip) throw new Error(`场景 Clip 不存在: ${scene.clipId}`);
  return <MediaClipScene media={media} clip={clip} params={params} assetBaseUrl={assetBaseUrl} />;
}
