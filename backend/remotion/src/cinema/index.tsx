import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { BgmAudio } from '../audio';
import type { MultiMediaPocInput, ScenePlan } from '../types';
import { CINEMA_COLOR, CINEMA_FONT, buildCinemaPlan } from './plan';
import { CinemaBackdrop } from './parts';
import { CinemaEnding, ClipShot, CoverShot, Scan, Settle, TitleCard } from './scenes';

/**
 * 「银幕式」推荐模板（v0.29 期间新增）——**与旧 chapter / clip 并存，旧模板一行未改**。
 *
 * 结构：钩子 → 片单卡 → (片名卡 → 封面镜头 | 片段…) × N → 落款。
 * 刻意不渲染旧模板的常驻 chrome（Topbar / Trackbar / BgmBadge / 星空装饰）：
 * 用户 2026-09-19 决策"常驻 chrome 全砍"，全片只保留三处文字位（片名卡 / lower-third / 落款）。
 * 用户配置的背景层与 BGM 仍然生效——那是内容，不是装饰。
 */
export function CinemaComposition({ input }: { input: MultiMediaPocInput }) {
  const plan = useMemo(() => buildCinemaPlan(input), [input]);
  const params = plan.params;
  const assetBaseUrl = input.assetBaseUrl || '';
  // BGM / ducking 复用旧模板实现（旧文件一行未改）：它只用到 fps / durationInFrames / audioWindows。
  const bgmPlan = useMemo(
    () => ({ fps: plan.fps, durationInFrames: plan.durationInFrames, audioWindows: plan.audioWindows }) as unknown as ScenePlan,
    [plan],
  );

  return (
    <AbsoluteFill style={{ background: CINEMA_COLOR.canvas, color: CINEMA_COLOR.ink, fontFamily: CINEMA_FONT.body }}>
      <CinemaBackdrop params={params} assetBaseUrl={assetBaseUrl} />
      {plan.scenes.map((scene, index) => (
        <Sequence
          key={`${index}:${scene.type}:${scene.fromFrame}`}
          from={scene.fromFrame}
          durationInFrames={scene.durationInFrames}
          premountFor={scene.type === 'CLIP' ? 30 : 10}
          name={`CINEMA_${scene.type}`}
        >
          {scene.type === 'SCAN' ? <Scan scene={scene} plan={plan} assetBaseUrl={assetBaseUrl} /> : null}
          {scene.type === 'SETTLE' ? <Settle scene={scene} plan={plan} assetBaseUrl={assetBaseUrl} /> : null}
          {scene.type === 'TITLE' ? <TitleCard scene={scene} plan={plan} assetBaseUrl={assetBaseUrl} /> : null}
          {scene.type === 'COVER' ? <CoverShot scene={scene} plan={plan} assetBaseUrl={assetBaseUrl} /> : null}
          {scene.type === 'CLIP' ? <ClipShot scene={scene} plan={plan} assetBaseUrl={assetBaseUrl} /> : null}
          {scene.type === 'ENDING' ? <CinemaEnding scene={scene} plan={plan} assetBaseUrl={assetBaseUrl} /> : null}
        </Sequence>
      ))}
      <BgmAudio params={params} plan={bgmPlan} assetBaseUrl={assetBaseUrl} />
    </AbsoluteFill>
  );
}
