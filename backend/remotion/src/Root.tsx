import React from 'react';
import { Composition } from 'remotion';
import { RecommendComposition } from './RecommendComposition';
import { buildScenePlan } from './scene-plan';
import type { MultiMediaPocInput } from './types';
import { defaultPocInput } from './sample-input';

export const Root = () => (
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
);
