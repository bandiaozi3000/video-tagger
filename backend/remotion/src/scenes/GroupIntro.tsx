import React from 'react';
import { Img, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import { riseIn, staggerFrames, useEnter } from '../animation';
import type { Theme } from '../theme';
import { glowOf } from '../theme';
import type { PocMedia } from '../types';
import { GradientTitle, pad2 } from './parts';

/** 分组章节页：CHAPTER NN + 组名 + 部数 + 缩略图排 + 该组强调色（视觉语言来自旧模板 `.chapter`）。 */
export function GroupIntro({ name, index, media, theme, assetBaseUrl }: {
  name: string;
  index: number;
  media: PocMedia[];
  theme: Theme;
  assetBaseUrl: string;
}) {
  const { width, height, fps } = useVideoConfig();
  const glow = glowOf(theme, index);
  const kickerIn = useEnter(0, theme);
  const titleIn = useEnter(staggerFrames(theme, 1, fps), theme);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(${Math.round(width * 0.55)}px ${Math.round(height * 0.58)}px at 50% 55%, ${glow}, transparent 70%)`,
          opacity: 0.5,
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', ...riseIn(kickerIn, height * 0.03), fontFamily: theme.font.mono, fontSize: Math.round(height * 0.021), letterSpacing: 10, color: theme.colors.faint, fontWeight: 600, marginBottom: Math.round(height * 0.04) }}>
        CHAPTER {pad2(index + 1)}
      </div>
      <div style={{ position: 'relative', ...riseIn(titleIn, height * 0.05) }}>
        <GradientTitle text={name} theme={theme} size={Math.round(height * 0.13)} />
      </div>
      <div style={{ position: 'relative', ...riseIn(titleIn, height * 0.04), marginTop: Math.round(height * 0.03), fontFamily: theme.font.body, fontSize: Math.round(height * 0.024), letterSpacing: 3, color: theme.colors.muted }}>
        共 <b style={{ color: theme.colors.gold, fontWeight: 800 }}>{media.length}</b> 部
      </div>
      <div style={{ position: 'relative', display: 'flex', gap: Math.round(width * 0.012), marginTop: Math.round(height * 0.06) }}>
        {media
          .filter((item) => item.coverAssetPath)
          .slice(0, 8)
          .map((item, i) => (
            <Thumb key={item.mediaId} item={item} index={i + 2} theme={theme} assetBaseUrl={assetBaseUrl} />
          ))}
      </div>
    </div>
  );
}

/** 单张缩略图（独立组件——hook 不能写在 map 回调里）。 */
function Thumb({ item, index, theme, assetBaseUrl }: { item: PocMedia; index: number; theme: Theme; assetBaseUrl: string }) {
  const { height, fps } = useVideoConfig();
  const appear = useEnter(staggerFrames(theme, index, fps), theme);
  return (
    <div style={{ ...riseIn(appear, height * 0.03), opacity: appear * 0.95 }}>
      <Img
        src={assetUrl(item.coverAssetPath!, assetBaseUrl)}
        style={{
          width: Math.round(height * 0.12),
          height: Math.round(height * 0.17),
          objectFit: 'cover',
          borderRadius: Math.round(height * 0.014),
          border: '1px solid rgba(255,255,255,.16)',
          boxShadow: '0 12px 30px rgba(0,0,0,.5)',
        }}
      />
    </div>
  );
}
