import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { buildScenePlan, mediaForScene } from './scene-plan';
import type { MultiMediaPocInput, Scene } from './types';
import { CollectionOpening } from './scenes/CollectionOpening';
import { CollectionEnding } from './scenes/CollectionEnding';
import { MediaClipScene } from './scenes/MediaClipScene';
import { MediaInfoScene } from './scenes/MediaInfoScene';

export const DEFAULT_ASSET_BASE_URL = 'http://127.0.0.1:18126/assets';

export function RecommendComposition({ input }: { input: MultiMediaPocInput }) {
  const plan = buildScenePlan(input);
  const assetBaseUrl = input.assetBaseUrl || DEFAULT_ASSET_BASE_URL;
  return (
    <AbsoluteFill style={{ backgroundColor: '#101214' }}>
      {plan.scenes.map((scene) => (
        <Sequence
          key={`${scene.type}-${scene.mediaId ?? 'collection'}-${scene.clipId ?? ''}`}
          from={scene.fromFrame}
          durationInFrames={scene.durationInFrames}
          premountFor={15}
        >
          <SceneView scene={scene} input={input} assetBaseUrl={assetBaseUrl} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function SceneView({ scene, input, assetBaseUrl }: { scene: Scene; input: MultiMediaPocInput; assetBaseUrl: string }) {
  if (scene.type === 'COLLECTION_OPENING') return <CollectionOpening input={input} />;
  if (scene.type === 'COLLECTION_ENDING') return <CollectionEnding input={input} assetBaseUrl={assetBaseUrl} />;
  const media = mediaForScene(input, scene);
  if (!media) throw new Error(`场景媒体不存在: ${scene.mediaId}`);
  if (scene.type === 'MEDIA_INFO') return <MediaInfoScene media={media} assetBaseUrl={assetBaseUrl} />;
  const clip = media.clips.find((item) => item.clipId === scene.clipId);
  if (!clip) throw new Error(`场景 Clip 不存在: ${scene.clipId}`);
  return <MediaClipScene media={media} clip={clip} assetBaseUrl={assetBaseUrl} />;
}
