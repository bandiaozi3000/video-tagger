import React from 'react';
import { OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import { riseIn, staggerFrames, useEnter } from '../animation';
import type { RenderParams } from '../params';
import { glowOf, type Theme } from '../theme';
import type { PocClip, PocMedia } from '../types';
import { Chip, GradientTitle, OutlineNumber, Poster, PosterFlag, pad2 } from './parts';

/** 资料卡尺寸：海报宽取"内容区比例"与"画幅高上限"的较小者，任何画幅下都不溢出。 */
function posterBox(theme: Theme, width: number, height: number, heightRatio?: number) {
  const contentW = width * theme.layout.contentRatio;
  const maxH = height * (heightRatio ?? theme.layout.posterMaxHeightRatio);
  const byHeight = maxH * theme.layout.posterAspect;
  const w = Math.min(contentW * theme.layout.posterColumnRatio, byHeight);
  return { width: w, height: w / theme.layout.posterAspect, contentW };
}

/** 资料卡：封面 + PICK NO.xx + 标题 + 简介 + 标签 + 状态。 */
export function MediaInfo({ media, params, theme, assetBaseUrl }: {
  media: PocMedia;
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
}) {
  const { width, height, fps } = useVideoConfig();
  const glow = glowOf(theme, media.order - 1);
  const poster = posterBox(theme, width, height);
  const kickerIn = useEnter(0, theme);
  const titleIn = useEnter(staggerFrames(theme, 1, fps), theme);
  const noteIn = useEnter(staggerFrames(theme, 2, fps), theme);
  const tagsIn = useEnter(staggerFrames(theme, 3, fps), theme);
  const statusIn = useEnter(staggerFrames(theme, 4, fps), theme);
  const size = { title: Math.round(height * theme.layout.titleRatio), body: Math.round(height * theme.layout.bodyRatio), chip: Math.round(height * theme.layout.chipRatio) };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: width * theme.layout.gapRatio, padding: `0 ${(width - poster.contentW) / 2}px` }}>
      <div style={{ position: 'relative', width: poster.width, height: poster.height, flex: 'none' }}>
        {params.detailShow.status ? <PosterFlag text={media.clips.length > 0 ? '片段推荐' : '资料推荐'} theme={theme} size={size.chip} /> : null}
        <Poster src={media.coverAssetPath ? assetUrl(media.coverAssetPath, assetBaseUrl) : undefined} theme={theme} radius={Math.round(height * 0.026)} />
      </div>
      <div style={{ position: 'relative', width: poster.contentW * (1 - theme.layout.posterColumnRatio), display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ ...riseIn(kickerIn, height * 0.025), fontFamily: theme.font.mono, fontSize: size.chip, letterSpacing: 3, color: theme.colors.sky, fontWeight: 600, marginBottom: Math.round(height * 0.016) }}>
          PICK NO.{pad2(media.order)}
        </div>
        <div style={{ ...riseIn(titleIn, height * 0.03) }}>
          <GradientTitle text={media.title} theme={theme} size={size.title} />
        </div>
        {params.detailShow.note && media.description ? (
          <p
            style={{
              ...riseIn(noteIn, height * 0.03),
              margin: `${Math.round(height * 0.026)}px 0 0`,
              maxWidth: '56ch',
              fontFamily: theme.font.body,
              fontSize: size.body,
              lineHeight: 1.9,
              color: theme.colors.muted,
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {media.description}
          </p>
        ) : null}
        {params.detailShow.tag && media.tags.length > 0 ? (
          <div style={{ ...riseIn(tagsIn, height * 0.03), display: 'flex', flexWrap: 'wrap', gap: Math.round(height * 0.014), justifyContent: 'center', marginTop: Math.round(height * 0.03) }}>
            {media.tags.slice(0, 6).map((tag) => <Chip key={tag} text={tag} theme={theme} accent size={size.chip} />)}
          </div>
        ) : null}
        {params.detailShow.status ? (
          <div style={{ ...riseIn(statusIn, height * 0.02), marginTop: Math.round(height * 0.028) }}>
            <Chip text={media.clips.length > 0 ? `${media.clips.length} 个精选片段` : '资料推荐 · 本次未选片段'} theme={theme} size={size.chip} />
          </div>
        ) : null}
      </div>
      <OutlineNumber
        text={pad2(media.order)}
        theme={theme}
        size={height * theme.layout.numberRatio}
        style={{ position: 'absolute', right: width * 0.06, bottom: height * 0.06 }}
      />
      <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 120px ${glow}22`, pointerEvents: 'none' }} />
    </div>
  );
}

/** 一屏 N 部（`perScreen ≥ 2`）：卡片网格 + 组徽标。 */
export function GridScreen({ media, params, theme, assetBaseUrl }: {
  media: PocMedia[];
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
}) {
  const { width, height } = useVideoConfig();
  // 单张卡片不撑满整行（居中窄卡更好看）；≤4 一行、>4 两行
  const columns = media.length === 1 ? 1 : media.length <= 4 ? media.length : Math.ceil(media.length / 2);
  const gap = width * theme.layout.gridGapRatio;
  const contentW = width * theme.layout.contentRatio;
  const rawW = (contentW - gap * (columns - 1)) / columns;
  const cardW = Math.min(rawW, media.length === 1 ? contentW * 0.42 : rawW);
  // 卡片高度贴合内容（封面 + 信息），避免固定高度留下的下方空白
  const coverH = Math.min(height * 0.5, cardW * 1.12);
  const cardH = coverH + height * 0.24;
  const group = media[0]?.group;
  const size = { title: Math.round(height * 0.026), body: Math.round(height * 0.02), chip: Math.round(height * 0.017) };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: Math.round(height * 0.035) }}>
      {group ? (
        <div style={{ fontFamily: theme.font.mono, fontSize: size.chip, letterSpacing: 6, color: theme.colors.sky }}>
          {group} · 第 {media[0].order}-{media[media.length - 1].order} 部
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap, width: contentW }}>
        {media.map((item, index) => (
          <GridCard key={item.mediaId} item={item} index={index} params={params} theme={theme} assetBaseUrl={assetBaseUrl} width={cardW} height={cardH} coverH={coverH} size={size} />
        ))}
      </div>
    </div>
  );
}

function GridCard({ item, index, params, theme, assetBaseUrl, width, height, coverH, size }: {
  item: PocMedia;
  index: number;
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
  width: number;
  height: number;
  coverH: number;
  size: { title: number; body: number; chip: number };
}) {
  const { fps } = useVideoConfig();
  const appear = useEnter(staggerFrames(theme, index, fps), theme);
  return (
    <div
      style={{
        ...riseIn(appear, 30),
        width,
        height,
        borderRadius: Math.round(height * 0.05),
        overflow: 'hidden',
        background: theme.glass.background,
        border: theme.glass.border,
        boxShadow: theme.glass.shadow,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', height: coverH, flex: 'none' }}>
        {params.detailShow.status ? <PosterFlag text={item.clips.length > 0 ? '片段推荐' : '资料推荐'} theme={theme} size={size.chip} /> : null}
        <Poster src={item.coverAssetPath ? assetUrl(item.coverAssetPath, assetBaseUrl) : undefined} theme={theme} radius={0} contain />
      </div>
      <div style={{ flex: 1, justifyContent: 'center', padding: `${Math.round(height * 0.03)}px ${Math.round(height * 0.03)}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: Math.round(height * 0.014) }}>
        <div style={{ fontFamily: theme.font.display, fontSize: size.title, fontWeight: 700, color: theme.colors.ink, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.title}
        </div>
        {params.detailShow.note && item.description ? (
          <div style={{ fontFamily: theme.font.body, fontSize: size.body, lineHeight: 1.5, color: theme.colors.muted, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.description}
          </div>
        ) : null}
        {params.detailShow.tag && item.tags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(height * 0.012), justifyContent: 'center' }}>
            {item.tags.slice(0, 3).map((tag) => <Chip key={tag} text={tag} theme={theme} size={size.chip} />)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 片段屏：封面外壳 + 视频舞台（字幕条 / 计数 / 进度都由帧算，无轨道按钮）。 */
export function ClipScene({ media, clip, params, theme, assetBaseUrl }: {
  media: PocMedia;
  clip: PocClip;
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
}) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const poster = posterBox(theme, width, height, theme.layout.posterMaxHeightRatio * 0.82);
  const index = Math.max(0, media.clips.findIndex((item) => item.clipId === clip.clipId));
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  const stageW = poster.contentW - poster.width - width * theme.layout.gapRatio;
  const stageH = stageW * (9 / 16);
  const size = { title: Math.round(height * theme.layout.titleRatio * 0.72), body: Math.round(height * theme.layout.bodyRatio), chip: Math.round(height * theme.layout.chipRatio) };
  const labelIn = useEnter(0, theme);
  const glow = glowOf(theme, media.order - 1);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: width * theme.layout.gapRatio, padding: `0 ${(width - poster.contentW) / 2}px` }}>
      <div style={{ ...riseIn(labelIn, height * 0.03), position: 'relative', width: poster.width, height: poster.height, flex: 'none' }}>
        <Poster src={media.coverAssetPath ? assetUrl(media.coverAssetPath, assetBaseUrl) : undefined} theme={theme} radius={Math.round(height * 0.026)} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: Math.round(height * 0.03), textAlign: 'center', fontFamily: theme.font.body, fontSize: size.body, color: theme.colors.ink, letterSpacing: 2, textShadow: '0 2px 10px rgba(0,0,0,.75)' }}>
          {media.title}
        </div>
      </div>
      <div style={{ position: 'relative', width: stageW }}>
        <div
          style={{
            ...riseIn(labelIn, height * 0.03),
            position: 'relative',
            width: '100%',
            height: stageH,
            borderRadius: Math.round(height * 0.024),
            overflow: 'hidden',
            border: theme.glass.border,
            boxShadow: `0 24px 60px rgba(0,0,0,.6), 0 0 40px ${glow}33`,
            background: '#06060d',
          }}
        >
          <OffthreadVideo
            src={assetUrl(clip.assetPath, assetBaseUrl)}
            muted={!clip.hasAudio || params.clipVolume <= 0}
            volume={params.clipVolume / 100}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: Math.round(height * 0.02),
              padding: `${Math.round(height * 0.022)}px ${Math.round(height * 0.026)}px`,
              background: 'linear-gradient(180deg,transparent,rgba(5,8,30,.82))',
              fontFamily: theme.font.body,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(height * 0.016), color: theme.colors.ink, fontSize: size.body, textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>
              <b style={{ color: theme.colors.pink }}>★</b>
              <span>
                {[media.title, clip.title, clip.episodeTitle, params.detailShow.note ? clip.note : undefined]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            <span style={{ fontFamily: theme.font.mono, fontSize: size.chip, color: theme.colors.muted }}>
              {pad2(index + 1)} / {pad2(media.clips.length)}
            </span>
          </div>
        </div>
        <div style={{ marginTop: Math.round(height * 0.02), width: '100%', height: 3, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,.1)' }}>
          <span style={{ display: 'block', height: '100%', width: `${progress * 100}%`, background: `linear-gradient(90deg,${theme.colors.sky},${theme.colors.pink})` }} />
        </div>
        <div style={{ marginTop: Math.round(height * 0.016), fontFamily: theme.font.mono, fontSize: size.chip, letterSpacing: 2, color: theme.colors.faint }}>
          REAL CLIP · {clip.episodeTitle || clip.episodeNo ? `第 ${clip.episodeNo ?? '?'} 集` : '精彩片段'} · {(clip.durationMs / 1000).toFixed(1)}s
          {/* 跨媒体借来的片段才标来源（与银幕式同语义，设计规格 §6） */}
          {clip.sourceTitle ? ` · 来源：${clip.sourceTitle}` : ''}
        </div>
      </div>
      <OutlineNumber
        text={pad2(media.order)}
        theme={theme}
        size={height * theme.layout.numberRatio * 0.8}
        style={{ position: 'absolute', right: width * 0.05, bottom: height * 0.05 }}
      />
      <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 140px ${glow}1f`, pointerEvents: 'none' }} />
    </div>
  );
}
