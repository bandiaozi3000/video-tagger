import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { BgmAudio, StingAudio } from '../audio';
import type { MultiMediaPocInput, ScenePlan } from '../types';
import { CINEMA_COLOR, CINEMA_FONT, buildCinemaPlan } from './plan';
import { useCinemaFonts } from './fonts';
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
  useCinemaFonts();
  const plan = useMemo(() => buildCinemaPlan(input), [input]);
  const params = plan.params;
  const assetBaseUrl = input.assetBaseUrl || '';
  // BGM / ducking 复用旧模板实现：它用到 fps / durationInFrames / audioWindows，
  // 再加 `scenes`（2026-09-20：BGM 能在**片名卡段**播放，窗口靠场景表定位）。
  const bgmPlan = useMemo(
    () => ({
      fps: plan.fps,
      durationInFrames: plan.durationInFrames,
      audioWindows: plan.audioWindows,
      scenes: plan.scenes.map((scene) => ({ type: scene.type, fromFrame: scene.fromFrame, durationInFrames: scene.durationInFrames })),
    }) as unknown as ScenePlan,
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
          // 片段幕提前 ~3s 挂载（用户 2026-09-20：预览里跳进片段偶尔“模糊且无声”，再点一下才好）。
          // 机制推断：Player 里 OffthreadVideo 就是 <video>，跳转是即时 seek → 刚建的元素还在 load+seek，
          // 只剩背景那层 blur 铺底。premountFor 让它提前挂载缓冲。代价：同时挂载的视频更多。
          premountFor={scene.type === 'CLIP' ? 90 : 10}
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
      <StingAudio params={params} plan={bgmPlan} assetBaseUrl={assetBaseUrl} />
    </AbsoluteFill>
  );
}
