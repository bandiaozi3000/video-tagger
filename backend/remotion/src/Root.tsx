import React from 'react';
import { Composition } from 'remotion';
import { RecommendComposition } from './RecommendComposition';
import { CinemaComposition } from './cinema';
import { buildCinemaPlan } from './cinema/plan';
import { buildScenePlan } from './scene-plan';
import { MediaTrendComposition } from './trend/MediaTrendComposition';
import { TREND_FPS, TREND_HEIGHT, TREND_WIDTH, totalFrames, type TrendVideoInput } from './trend/params';
import type { MultiMediaPocInput } from './types';
import { defaultPocInput } from './sample-input';

/** 统计视频的默认输入（studio 里能直接预览；生产由 Java 传 inputProps）。 */
export const defaultTrendInput: TrendVideoInput = {
  title: '媒体趋势 · 异世界',
  chartType: 'line',
  secPerYear: 1.5,
  holdSec: 3,
  years: [2019, 2020, 2021, 2022],
  lines: [{ name: '异世界', color: '#cba6f7', points: [{ year: 2019, count: 25 }, { year: 2020, count: 29 }, { year: 2021, count: 37 }, { year: 2022, count: 44 }] }],
  refs: [],
};

/**
 * 三个 composition 并存：
 *   · `MultiMediaRecommendPoc`   —— 旧模板（chapter / clip），**一行未改**；
 *   · `MultiMediaRecommendCinema` —— v0.29 期间新增的「银幕式」，由 `input.style === 'cinema'` 选中；
 *   · `MediaTrend`               —— v0.32 统计视频（独立输入契约，走 `src/trend/`）。
 *
 * 渲染入口（`scripts/render-recommend.ts` / `scripts/render-trend.ts`）分别选它们的 id。
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
    <Composition
      id="MediaTrend"
      component={MediaTrendComposition}
      durationInFrames={totalFrames(defaultTrendInput)}
      fps={TREND_FPS}
      width={TREND_WIDTH}
      height={TREND_HEIGHT}
      defaultProps={defaultTrendInput}
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFrames(props as TrendVideoInput),
        fps: TREND_FPS,
        width: TREND_WIDTH,
        height: TREND_HEIGHT,
      })}
    />
  </>
);
