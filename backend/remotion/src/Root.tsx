import React from 'react';
import { Composition } from 'remotion';
import { RecommendComposition } from './RecommendComposition';
import { CinemaComposition } from './cinema';
import { buildCinemaPlan } from './cinema/plan';
import { buildScenePlan } from './scene-plan';
import type { MultiMediaPocInput } from './types';
import { defaultPocInput } from './sample-input';

/**
 * 两个 composition 并存：
 *   · `MultiMediaRecommendPoc`   —— 旧模板（chapter / clip），**一行未改**；
 *   · `MultiMediaRecommendCinema` —— v0.29 期间新增的「银幕式」，由 `input.style === 'cinema'` 选中。
 *
 * 渲染入口（`scripts/render-recommend.ts`）按 `style` 二者选一，编辑器同理。
 */
export const Root = () => (
  <>
    <Composition
      id="MultiMediaRecommendPoc"
      component={RecommendComposition}
      durationInFrames={buildScenePlan(defaultPocInput).durationInFrames}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{ input: defaultPocInput }}
      calculateMetadata={({ props }) => {
        const input = (props as { input: MultiMediaPocInput }).input;
        const plan = buildScenePlan(input);
        return { durationInFrames: plan.durationInFrames, fps: plan.fps, width: plan.width, height: plan.height };
      }}
    />
    <Composition
      id="MultiMediaRecommendCinema"
      component={CinemaComposition}
      durationInFrames={buildCinemaPlan(defaultPocInput).durationInFrames}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{ input: { ...defaultPocInput, style: 'cinema' as const } }}
      calculateMetadata={({ props }) => {
        const input = (props as { input: MultiMediaPocInput }).input;
        const plan = buildCinemaPlan(input);
        return { durationInFrames: plan.durationInFrames, fps: plan.fps, width: plan.width, height: plan.height };
      }}
    />
  </>
);
