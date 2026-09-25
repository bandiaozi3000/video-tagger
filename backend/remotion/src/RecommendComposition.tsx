import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { BgmAudio } from './audio';
import { Backdrop, BgmBadge, Clouds, Stars, TopLine, Topbar, Trackbar } from './chrome';
import { resolveTheme, speedToFrames } from './params';
import { buildScenePlan, mediaForScene, mediaOfGroup, sceneLabel } from './scene-plan';
import { ClipScene, GridScreen, MediaInfo } from './scenes/Cards';
import { Ending } from './scenes/Ending';
import { GroupIntro } from './scenes/GroupIntro';
import { Intro } from './scenes/Intro';
import { Opening } from './scenes/Opening';
import type { RenderParams } from './params';
import type { Theme } from './theme';
import type { MultiMediaPocInput, Scene } from './types';

export const DEFAULT_ASSET_BASE_URL = 'http://127.0.0.1:18126/assets';

/**
 * 推荐视频合成根 —— 所有场景都是**帧时间轴上的图层**。
 *
 * 结构（设计规格 §6）：`buildScenePlan()` 是唯一时长权威；每帧只挂载当前与预挂载的场景，
 * 常驻装饰层与 BGM 由帧驱动；不存在滚动容器、不存在交互控件、不存在 CSS 过渡/关键帧。
 *
 * 性能约定（v0.28 §2-24）：`plan` 只算一次，且**参数、媒体索引、分组都已在计划里**——
 * 组件不再二次 `resolveParams`，也不在每帧对媒体全表线性查找。
 */
export function RecommendComposition({ input }: { input: MultiMediaPocInput }) {
  const plan = useMemo(() => buildScenePlan(input), [input]);
  const params = plan.params;
  const theme = useMemo(() => resolveTheme(input), [input]);
  const assetBaseUrl = input.assetBaseUrl || DEFAULT_ASSET_BASE_URL;
  const frame = useCurrentFrame();
  const active = plan.scenes.find((scene) => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames);

  return (
    <AbsoluteFill style={{ fontFamily: theme.font.body, color: theme.colors.ink }}>
      <Backdrop params={params} theme={theme} assetBaseUrl={assetBaseUrl} plan={plan} />
      <Stars theme={theme} />
      <Clouds theme={theme} />
      <TopLine theme={theme} />
      <Topbar params={params} theme={theme} />
      {plan.scenes.map((scene, index) => (
        <Sequence
          key={sceneKey(scene, index)}
          from={scene.fromFrame}
          durationInFrames={scene.durationInFrames}
          premountFor={scene.type === 'MEDIA_CLIP' ? 90 : 15}
          name={scene.type}
        >
          <SceneView scene={scene} input={input} params={params} theme={theme} assetBaseUrl={assetBaseUrl} plan={plan} />
        </Sequence>
      ))}
      <Trackbar label={sceneLabel(plan, active, input.media.length)} theme={theme} plan={plan} />
      <BgmBadge params={params} theme={theme} plan={plan} />
      <BgmAudio params={params} plan={plan} assetBaseUrl={assetBaseUrl} />
    </AbsoluteFill>
  );
}

/** React key：场景在计划里位置唯一即可（带 index 保证不会因同名同参而碰撞）。 */
function sceneKey(scene: Scene, index: number): string {
  return `${index}:${scene.type}:${scene.fromFrame}`;
}

function SceneView({ scene, input, params, theme, assetBaseUrl, plan }: {
  scene: Scene;
  input: MultiMediaPocInput;
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
  plan: ReturnType<typeof buildScenePlan>;
}) {
  const openingBeat = speedToFrames(params.openingSpeed, plan.fps);
  const endingBeat = speedToFrames(params.endingScrollSpeed, plan.fps);

  if (scene.type === 'COLLECTION_OPENING') {
    return <Opening input={input} params={params} theme={theme} assetBaseUrl={assetBaseUrl} beatFrames={openingBeat} />;
  }
  if (scene.type === 'COLLECTION_INTRO') {
    return <Intro params={params} theme={theme} />;
  }
  if (scene.type === 'COLLECTION_ENDING') {
    return <Ending input={input} params={params} theme={theme} assetBaseUrl={assetBaseUrl} beatFrames={endingBeat} />;
  }
  if (scene.type === 'GROUP_INTRO') {
    const media = mediaOfGroup(plan, scene.groupName);
    return <GroupIntro name={scene.groupName ?? ''} index={scene.groupIndex ?? 0} media={media} theme={theme} assetBaseUrl={assetBaseUrl} />;
  }
  if (scene.type === 'MEDIA_GRID') {
    const media = (scene.mediaIds ?? []).map((id) => plan.mediaIndex.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    return <GridScreen media={media} params={params} theme={theme} assetBaseUrl={assetBaseUrl} numberFrom={scene.numberFrom} kicker={scene.kicker} />;
  }
  const media = mediaForScene(plan, scene);
  if (!media) throw new Error(`场景媒体不存在: ${scene.mediaId}`);
  if (scene.type === 'MEDIA_INFO') {
    return <MediaInfo media={media} params={params} theme={theme} assetBaseUrl={assetBaseUrl} number={scene.numberFrom} kicker={scene.kicker} />;
  }
  const clip = media.clips.find((item) => item.clipId === scene.clipId);
  if (!clip) throw new Error(`场景 Clip 不存在: ${scene.clipId}`);
  return <ClipScene media={media} clip={clip} params={params} theme={theme} assetBaseUrl={assetBaseUrl} />;
}
