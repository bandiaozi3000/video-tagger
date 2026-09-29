import React from 'react';
import { Audio, Sequence } from 'remotion';
import { assetUrl } from './asset-url';
import { bgmSlotGainAt, bgmStartFromFrames, bgmTimeline, stingGainAt, stingTimeline } from './bgm';
import type { RenderParams } from './params';
import type { ScenePlan } from './types';

/**
 * BGM 音频（Remotion 内建，设计规格 §7）。
 *
 * - 多曲按真实曲长顺序排布，单曲循环铺满自己的时段；
 * - 音量按帧计算：默认 `bgmGain`，落在「有片段原声」的帧区间内压到 `bgmDuckTo`（带淡入淡出）；
 * - 片段原声由 `<OffthreadVideo muted={!hasAudio}>` 提供（见 `scenes/ClipStage.tsx`）。
 *
 * 由此 Java 侧不再需要 BGM concat / `amix` 混流 / 无音轨回退。
 */
export function BgmAudio({ params, plan, assetBaseUrl }: { params: RenderParams; plan: ScenePlan; assetBaseUrl: string }) {  const slots = bgmTimeline(params, plan).filter((slot) => slot.assetPath);
  if (slots.length === 0) return null;
  return (
    <>
      {slots.map((slot, index) => {
        const remaining = plan.durationInFrames - slot.fromFrame;
        if (remaining <= 0) return null;
        const duration = Math.max(1, Math.min(slot.durationInFrames, remaining));
        return (
          <Sequence key={`${slot.name}-${index}`} from={slot.fromFrame} durationInFrames={duration} name={`BGM · ${slot.name}`}>
            <Audio
              src={assetUrl(slot.assetPath!, assetBaseUrl)}
              loop
              // 结尾段从曲子后半段起放（用户选「乙」）；缺省 0 = 从头。
              // ⚠️ Remotion 的 `startFrom`（现名 `trimBefore`）单位是**帧**，我们存的是秒 → 必须 ×fps
              // （2026-09-26 修：以前直接传秒，结尾“后半段”实际只前进到第 3.7 秒）
              startFrom={bgmStartFromFrames(slot, plan.fps)}
              // volume 回调拿到的是**本 Sequence 内**的帧，故需加回起始偏移换算成全局帧
              volume={(localFrame) => bgmSlotGainAt(slot.fromFrame + localFrame, slot, params, plan)}
            />
          </Sequence>
        );
      })}
    </>
  );
}

/**
 * 转场音乐（片名卡专用，用户 2026-09-20 方案「甲」）。
 *
 * 与 BGM 是**两层**：BGM 范围选什么都不影响它；它响的时候会把 BGM 压低（`bgmGainAt` 里统一的 ducking）。
 * 不 `loop` —— 转场音重复会很怪；长度超卡片就靠 Sequence 自动截断。
 */
export function StingAudio({ params, plan, assetBaseUrl }: { params: RenderParams; plan: ScenePlan; assetBaseUrl: string }) {
  if (!params.stingPath) return null;
  const slots = stingTimeline(params, plan);
  if (slots.length === 0) return null;
  return (
    <>
      {slots.map((slot, index) => (
        <Sequence key={`sting-${index}`} from={slot.fromFrame} durationInFrames={slot.durationInFrames} name={`转场音 · 片名卡 ${index + 1}`}>
          <Audio
            src={assetUrl(params.stingPath, assetBaseUrl)}
            volume={(localFrame) => stingGainAt(slot.fromFrame + localFrame, slot, params, plan)}
          />
        </Sequence>
      ))}
    </>
  );
}
