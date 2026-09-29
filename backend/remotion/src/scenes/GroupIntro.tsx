import React from 'react';
import { Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import { riseIn, staggerFrames, useEnter } from '../animation';
import type { Theme } from '../theme';
import { glowOf } from '../theme';
import type { PocMedia } from '../types';
import { GradientTitle, pad2 } from './parts';

/** 缩略图排最多显示 12 张后再开始滚（11 张刚好铺满内容区，多一张就“展示不下”）。 */
export const INTRO_THUMB_STAGGER_CAP = 11;

/**
 * 分组章节页：CHAPTER NN + 组名 + 部数 + 缩略图排 + 该组强调色（视觉语言来自旧模板 `.chapter`）。
 *
 * **缩略图排满了就横滚**（用户 2026-09-26：「章节下方的图片如果展示不下的话无滚动效果，添加滚动」）：
 * 旧实现是 `.slice(0, 8)` —— 第 9 张起**直接丢掉**（报「共 34 部」却只给 8 张图，看不出少的去哪了）。
 * 现在：能摆几张摆几张（按内容区宽算），多出来的撑开一条横向胶片条，**在本页时长内匀速滚完**
 * （末 0.6s 停住；场景时长是类级参数、不因图多而变，所以图越多滚得越快 —— 它是“让你看到还有多少”的过场，不是逐张细看）。
 */
export function GroupIntro({ name, index, media, theme, assetBaseUrl }: {
  name: string;
  index: number;
  media: PocMedia[];
  theme: Theme;
  assetBaseUrl: string;
}) {
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const glow = glowOf(theme, index);
  const kickerIn = useEnter(0, theme);
  const titleIn = useEnter(staggerFrames(theme, 1, fps), theme);
  /**
   * 大标题里的「2000 年」要把数字与单位之间的空格去掉（用户 2026-09-26："数字和年之间间隔有点大"）。
   * 原因不是空格本身：`GradientTitle` 带 `letterSpacing = size * 0.12`（720p 下约 11px/字），
   * 一个空格加上两侧字距就变成一个洞。**只改这一处显示**：小组名（网格标签/结尾列表）里的空格保留。
   */
  const title = name.replace(/(\d)\s+(?=[年季月日周])/g, '$1');
  // 缩略图排：能摆几张摆几张，摆不下就横滚（见上方注释）
  const thumbs = media.filter((item) => item.coverAssetPath);
  const gap = Math.round(width * 0.012);
  const thumbW = Math.round(height * 0.12);
  const contentW = Math.round(width * theme.layout.contentRatio);
  const fit = Math.max(1, Math.floor((contentW + gap) / (thumbW + gap)));
  const scrolling = thumbs.length > fit;
  const shown = scrolling ? thumbs : thumbs.slice(0, fit);
  const travel = scrolling ? Math.max(0, thumbs.length * (thumbW + gap) - gap - contentW) : 0;
  // 匀速滚完（起手 0.4s 不动，末 0.6s 停住，免得与下一幕硬切）
  const progress = interpolate(frame, [Math.round(fps * 0.4), Math.max(Math.round(fps * 0.5), durationInFrames - Math.round(fps * 0.6))], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const offset = travel * progress;

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
        <GradientTitle text={title} theme={theme} size={Math.round(height * 0.13)} />
      </div>
      <div style={{ position: 'relative', ...riseIn(titleIn, height * 0.04), marginTop: Math.round(height * 0.03), fontFamily: theme.font.body, fontSize: Math.round(height * 0.024), letterSpacing: 3, color: theme.colors.muted }}>
        共 <b style={{ color: theme.colors.gold, fontWeight: 800 }}>{media.length}</b> 部
      </div>
      <div style={{ position: 'relative', width: scrolling ? contentW : undefined, overflow: 'hidden', marginTop: Math.round(height * 0.06),
                    display: 'flex', justifyContent: scrolling ? 'flex-start' : 'center' }}>
        <div style={{ display: 'flex', gap, transform: `translateX(${(-offset).toFixed(1)}px)` }}>
          {shown.map((item, i) => (
            // 错峰封顶：横滚时若还按张数错峰，后面的图会在“已经在滚”的时候才显影
            <Thumb key={item.mediaId} item={item} index={2 + Math.min(i, INTRO_THUMB_STAGGER_CAP)} theme={theme} assetBaseUrl={assetBaseUrl} />
          ))}
        </div>
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
