import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset-url';
import { hasBackdrop, chapterBgFilter, type RenderParams } from '../params';

/**
 * 全片背景层（旧模板 `.bg-image-layer`）：
 * bgColor / bgImages / bgRotationSec / bgOpacity / bgBlur / bgBrightness 六项参数。
 * 旧模板用 setInterval 每 N 秒淡出换图；这里索引与透明度都由帧决定（确定性、可复现）。
 */
export function Backdrop({ params, assetBaseUrl, fps }: { params: RenderParams; assetBaseUrl: string; fps: number }) {
  const frame = useCurrentFrame();
  const images = params.bgImages;
  const rotationFrames = Math.max(1, Math.round(params.bgRotationSec * fps));
  const index = images.length > 0 ? Math.floor(frame / rotationFrames) % images.length : -1;
  const src = index >= 0 ? assetUrl(images[index], assetBaseUrl) : null;
  return (
    <AbsoluteFill style={{ backgroundColor: params.bgColor || 'transparent', zIndex: 0 }}>
      {src ? (
        <Img
          src={src}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: params.bgOpacity / 100, filter: chapterBgFilter(params) || undefined }}
        />
      ) : null}
    </AbsoluteFill>
  );
}
