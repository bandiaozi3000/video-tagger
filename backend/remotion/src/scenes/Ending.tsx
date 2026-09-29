import React from 'react';
import { Img, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import { riseIn, staggerFrames, useEnter } from '../animation';
import type { RenderParams } from '../params';
import type { Theme } from '../theme';
import type { MultiMediaPocInput, PocMedia } from '../types';
import { endingWallCount, endingWallCovers } from '../scene-plan';
import { GradientTitle } from './parts';

/** 结尾：THE END + 标题 + 文案 + 封面墙（封面逐个上浮，替代旧模板的 `transition-delay: i*45ms`）。 */
export function Ending({ input, params, theme, assetBaseUrl, beatFrames }: {
  input: MultiMediaPocInput;
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
  /** 结尾动效档位换算出的帧步长（封面墙逐个上浮的间隔）。 */
  beatFrames: number;
}) {
  const { width, height, fps } = useVideoConfig();
  // 封面墙：**封顶**（见 `endingWallCount`）+ **第 1 档优先、同档内按草稿 seed 洗牌**（见 `endingWallCovers`）
  const covers = endingWallCovers(
    input.media.filter((media) => media.coverAssetPath),
    { count: endingWallCount({ width, height, wallRatio: theme.layout.wallRatio }), seed: params.seed },
  );
  const kickerIn = useEnter(0, theme);
  const titleIn = useEnter(staggerFrames(theme, 1, fps), theme);
  const textIn = useEnter(staggerFrames(theme, 2, fps), theme);
  const size = { title: Math.round(height * 0.072), body: Math.round(height * 0.022) };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(${Math.round(width * 0.55)}px ${Math.round(height * 0.58)}px at 50% 55%, rgba(255,143,184,.13), transparent 70%)`,
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', ...riseIn(kickerIn, height * 0.03), fontFamily: theme.font.mono, fontSize: Math.round(height * 0.019), letterSpacing: 10, color: theme.colors.pink, fontWeight: 600, marginBottom: Math.round(height * 0.026) }}>
        THE END
      </div>
      <div style={{ position: 'relative', ...riseIn(titleIn, height * 0.04) }}>
        <GradientTitle text={params.endingTitle.trim() || `这一季的 ${input.media.length} 部`} theme={theme} size={size.title} />
      </div>
      <p style={{ position: 'relative', ...riseIn(textIn, height * 0.03), margin: `${Math.round(height * 0.024)}px 0 0`, fontFamily: theme.font.body, fontSize: size.body, letterSpacing: 2, color: theme.colors.muted }}>
        {params.endingText.trim() || '谢谢观看 · 期待下季'}
      </p>
      <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: Math.round(width * 0.011), marginTop: Math.round(height * 0.06), maxWidth: width * 0.78 }}>
        {covers.map((media, index) => (
          <WallCover key={media.mediaId} media={media} index={index} theme={theme} assetBaseUrl={assetBaseUrl} beatFrames={beatFrames} />
        ))}
      </div>
    </div>
  );
}

function WallCover({ media, index, theme, assetBaseUrl, beatFrames }: { media: PocMedia; index: number; theme: Theme; assetBaseUrl: string; beatFrames: number }) {
  const { height } = useVideoConfig();
  const appear = useEnter(index * Math.max(2, Math.round(beatFrames / 2)), theme);
  const imageHeight = Math.round(height * theme.layout.wallRatio);
  return (
    <div style={{ ...riseIn(appear, imageHeight * 0.16) }}>
      <Img
        src={assetUrl(media.coverAssetPath!, assetBaseUrl)}
        style={{
          width: Math.round(imageHeight * 0.7),
          height: imageHeight,
          objectFit: 'cover',
          borderRadius: Math.round(imageHeight * 0.08),
          border: '1px solid rgba(255,255,255,.14)',
          boxShadow: '0 10px 26px rgba(0,0,0,.45)',
        }}
      />
    </div>
  );
}
