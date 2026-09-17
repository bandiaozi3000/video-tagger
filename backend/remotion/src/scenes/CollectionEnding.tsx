import React from 'react';
import { Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset-url';
import type { RenderParams } from '../params';
import type { MultiMediaPocInput } from '../types';

/** 结尾屏：旧模板 `.ending` + `.en-wall`（无分组时走 en-wall 分支）。 */
export function CollectionEnding({ input, params, assetBaseUrl, beatFrames }: {
  input: MultiMediaPocInput;
  params: RenderParams;
  assetBaseUrl: string;
  beatFrames: number;
}) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, beatFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const covers = input.media.filter((media) => media.coverAssetPath);
  return (
    <section className="ending in-view" style={{ opacity: enter }}>
      <div className="en-kicker">THE END</div>
      <h2>{params.endingTitle.trim() || `这一季的 ${input.media.length} 部`}</h2>
      <p className="en-text">{params.endingText.trim() || '谢谢观看 · 期待下季'}</p>
      <div className="en-wall">
        {covers.map((media, index) => (
          <Img
            key={media.mediaId}
            src={assetUrl(media.coverAssetPath!, assetBaseUrl)}
            alt=""
            style={{ ['--i' as string]: String(index % 12) }}
          />
        ))}
      </div>
    </section>
  );
}
