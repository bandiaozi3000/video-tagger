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
export function MediaInfo({ media, params, theme, assetBaseUrl, kicker, number }: {
  media: PocMedia;
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
  /** 题头（如「本组核心」）—— 核心 ≤2 部时走逐部满屏，靠它标出来源。 */
  kicker?: string;
  /** **本地序号**（组内从 1 数）；缺省退到 `media.order`（全局）。 */
  number?: number;
}) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const glow = glowOf(theme, media.order - 1);
  const poster = posterBox(theme, width, height);
  // 核心卡：封面慢推镜，让停留期间画面“活着”
  const push = interpolate(frame, [0, Math.max(1, durationInFrames)], [1, 1.05], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const kickerIn = useEnter(0, theme);
  const titleIn = useEnter(staggerFrames(theme, 1, fps), theme);
  const noteIn = useEnter(staggerFrames(theme, 2, fps), theme);
  const tagsIn = useEnter(staggerFrames(theme, 3, fps), theme);
  const statusIn = useEnter(staggerFrames(theme, 4, fps), theme);
  const size = { title: Math.round(height * theme.layout.titleRatio), body: Math.round(height * theme.layout.bodyRatio), chip: Math.round(height * theme.layout.chipRatio) };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: width * theme.layout.gapRatio, padding: `0 ${(width - poster.contentW) / 2}px` }}>
      <div style={{ position: 'relative', width: poster.width, height: poster.height, flex: 'none', transform: `scale(${push.toFixed(4)})` }}>
        {params.detailShow.status ? <PosterFlag text={media.clips.length > 0 ? '片段推荐' : '资料推荐'} theme={theme} size={size.chip} /> : null}
        <Poster src={media.coverAssetPath ? assetUrl(media.coverAssetPath, assetBaseUrl) : undefined} theme={theme} radius={Math.round(height * 0.026)} />
      </div>
      <div style={{ position: 'relative', width: poster.contentW * (1 - theme.layout.posterColumnRatio), display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ ...riseIn(kickerIn, height * 0.025), fontFamily: theme.font.mono, fontSize: size.chip, letterSpacing: 3, color: theme.colors.sky, fontWeight: 600, marginBottom: Math.round(height * 0.016) }}>
          PICK NO.{pad2(number ?? media.order)}
        </div>
        {kicker ? (
          <div style={{ ...riseIn(kickerIn, height * 0.025), marginBottom: Math.round(height * 0.014),
                        fontFamily: theme.font.display, fontSize: Math.round(size.chip * 1.25), fontWeight: 800, letterSpacing: 4,
                        background: `linear-gradient(90deg, ${theme.colors.gold}, ${theme.colors.pink})`,
                        WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ★ {kicker}
          </div>
        ) : null}
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

/**
 * 网格屏版式常量（均为画幅高的比例）。
 *
 * **为什么按预算反推，而不是"内容多高就多高"**：原来的 `cardH = coverH + height*0.24` 在 perScreen=10 时
 * 每卡 586px，两行加行距 = 1220px > 1080 → **第二行直接被画出画面外**（用户 2026-09-26 报「图片显示不全而且过大」）。
 * 现在先扣掉上下留白 / 组标签行 / 行间距，再把剩下的净高**按行数均分**。
 *
 * ⚠️ 另加三条（同日用户报「只有一两部时卡片特别大 / 特别窄」）：
 *   1. **列数优先单行**（`maxColumns`）：≤6 部就铺一行 —— 两行时列少 → 格子又宽又矮，
 *      海报会被 `contain` 缩到中间留两条虚边；单行 6 列时格子是竖的，正好贴合海报比例。
 *   2. **封面高有上限**（`maxCoverRatio`）：否则 1-2 部时净高 = 整幅画高，卡片顶满画面、上下空荡。
 *   3. **少部时卡片宽由封面比例反推**：不按列宽硬撑，避免 3 部时又高又窄。
 *   4. **底部单独留白**（`bottomPadRatio`）：画面底部有进度条 chrome，两行时最后一行会被它压住
 *      （居中留白不够用），所以下方给得比上方多。
 */
const GRID = { padRatio: 0.03, bottomPadRatio: 0.085, labelRatio: 0.055, textRatio: 0.1, maxCoverRatio: 0.62, maxColumns: 6 };

/** 网格屏几何。导出供单测断言「永不溢出画幅」与「卡片比例不极端」。 */
export function gridGeometry(theme: Theme, width: number, height: number, count: number) {
  const columns = count <= 1 ? 1 : count <= GRID.maxColumns ? count : Math.ceil(count / 2);
  const rows = Math.ceil(count / columns);
  const gap = width * theme.layout.gridGapRatio;
  const contentW = width * theme.layout.contentRatio;
  const pad = height * GRID.padRatio;
  const padBottom = height * GRID.bottomPadRatio;
  const labelH = height * GRID.labelRatio;
  // 纵向预算：扣上下留白 + 组标签行 + 行间距，再按行数均分
  const perCardH = (height - pad - padBottom - labelH - gap * (rows - 1)) / rows;
  const textH = height * GRID.textRatio;
  const byColumns = (contentW - gap * (columns - 1)) / columns;
  // 封面高 = min(按列宽守海报比例所需, 纵向预算扣掉文字区, 画幅高上限)
  const coverH = Math.max(height * 0.06,
    Math.min(byColumns / theme.layout.posterAspect, perCardH - textH, height * GRID.maxCoverRatio));
  // 卡片宽：少部时按封面比例反推（否则列宽会把卡片撑得又宽又扁）；不超过列宽
  const cardW = Math.min(byColumns, coverH * theme.layout.posterAspect);
  // 卡片高贴着内容（不由 perCardH 硬撑）—— 少部时上下留白居中，不再出现"巨大的空文字区"
  return { columns, rows, gap, contentW, cardW, cardH: coverH + textH, coverH, pad, padBottom, labelH };
}

/** 一屏 N 部（`perScreen ≥ 2`）：卡片网格 + 组徽标。 */
/**
 * 一屏 N 部（`perScreen ≥ 2`）：卡片网格 + 组徽标。
 *
 * **动效（2026-09-26 豪华版）**：金色扫光入场 → 大卡逐个 spring 弹入 → 封面显影（与开场「暗房显影」同一语言）
 * → ★ 弹性落位 → 驻留期慢推镜 + ★ 呼吸微光 → 退场整体缩小交给下一幕。
 * 全部**帧驱动** —— `animation.ts` 硬禁 CSS 过渡/keyframes：Remotion 逐帧渲染时帧会乱序或重复，
 * 靠浏览器实时时钟的动画会闪烁且不可复现。
 */
export function GridScreen({ media, params, theme, assetBaseUrl, numberFrom = 1, kicker }: {
  media: PocMedia[];
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
  /** **本地序号起点**（1 基）：组内从 1 数，重点回顾按回顾顺序数。 */
  numberFrom?: number;
  /** 题头（如「本组核心」）；给了就渲染成金色题头行（含金色扫光），不给则用组名行。 */
  kicker?: string;
}) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const g = gridGeometry(theme, width, height, media.length);
  const group = media[0]?.group;
  const featuredCount = media.filter((item) => item.featured).length;
  const size = { title: Math.round(height * 0.024), body: Math.round(height * 0.02), chip: Math.round(height * 0.017) };
  // 金色扫光：一条高光带 0 → 0.9s 从左扫到右（核心题头用）
  const sweep = interpolate(frame, [0, Math.round(fps * 0.9)], [-1, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // 退场：最后 0.4s 整体缩小，把画面“交”给下一幕（跨幕接力的前半段）
  const exitFrom = Math.max(1, durationInFrames - Math.round(fps * 0.4));
  const exit = interpolate(frame, [exitFrom, Math.max(exitFrom + 1, durationInFrames - 1)], [1, 0.94], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: `${g.pad}px 0 ${g.padBottom}px`, opacity: exit, transform: `scale(${exit.toFixed(4)})` }}>
      {kicker ? (
        <div style={{ position: 'relative', height: Math.round(g.labelH), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '0 12px' }}>
          <span style={{ position: 'relative', zIndex: 1, fontFamily: theme.font.display, fontSize: Math.round(size.chip * 1.3), fontWeight: 800, letterSpacing: 4,
                         background: `linear-gradient(90deg, ${theme.colors.gold}, ${theme.colors.pink})`,
                         WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ★ {kicker} · {media.length} 部
          </span>
          <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: `translateX(${(sweep * 100).toFixed(1)}%)`,
                         background: `linear-gradient(100deg, transparent 25%, ${theme.colors.gold}66 50%, transparent 75%)` }} />
        </div>
      ) : group ? (
        <div style={{ height: Math.round(g.labelH), display: 'flex', alignItems: 'center', gap: Math.round(width * 0.012), fontFamily: theme.font.mono, fontSize: size.chip, letterSpacing: 6, color: theme.colors.sky }}>
          {/* 序号已经是组内的，这里只报“共 N 部”——不再报全局区间（那时是 88-159 这类看不懂的数） */}
          <span>{group} · 共 {media.length} 部</span>
          {featuredCount > 0 ? (
            <span style={{ letterSpacing: 1, color: theme.colors.gold, border: `1px solid ${theme.colors.gold}66`, borderRadius: 999, padding: '1px 8px', fontSize: Math.round(size.chip * 0.92) }}>
              ★ 核心 {featuredCount}
            </span>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: g.gap, width: g.contentW }}>
        {media.map((item, index) => (
          <GridCard key={item.mediaId} item={item} index={index} number={numberFrom + index} params={params} theme={theme}
                    assetBaseUrl={assetBaseUrl} width={g.cardW} height={g.cardH} coverH={g.coverH} size={size} />
        ))}
      </div>
    </div>
  );
}

function GridCard({ item, index, number, params, theme, assetBaseUrl, width, height, coverH, size }: {
  item: PocMedia;
  index: number;
  /** **本地序号**（组内从 1 数）。 */
  number: number;
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
  width: number;
  height: number;
  coverH: number;
  size: { title: number; body: number; chip: number };
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const delay = staggerFrames(theme, index, fps);
  // 入场：spring（低阻尼自带回弹）→ 上浮 + 轻微放大
  const enter = useEnter(delay, theme);
  // 封面显影：与开场「暗房显影」同一视觉语言
  const develop = interpolate(frame, [delay, delay + Math.round(fps * 0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // ★ 弹性落位：更晚一拍 + 自身带反向旋转
  const star = useEnter(delay + Math.round(fps * 0.25), theme);
  // 驻留期慢推镜（银幕式封面镜头用的同一手法）
  const push = interpolate(frame, [0, Math.max(1, durationInFrames)], [1, 1.05], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // ★ 呼吸微光：sin 驱动（确定性；硬禁则里禁的是 Math.random）
  const breathe = 0.55 + 0.45 * Math.sin((frame / fps) * 2.2);
  const glowAlpha = Math.round(18 + breathe * 40).toString(16).padStart(2, '0');
  const meta = [item.year ? `${item.year} 年` : '', item.episodeCount ? `${item.episodeCount} 集` : ''].filter(Boolean).join(' · ');
  const pad = Math.round(Math.min(width, height) * 0.06);
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: Math.round(height * 0.055),
        overflow: 'hidden',
        // 底色用竖向渐变（比纯色“厚”），描边极低对比，外阴影把卡片从背景里抬起来；
        // A 方案：核心项换成品牌色描边 + **呼吸微光**，在群像里一眼可辨
        background: 'linear-gradient(180deg, rgba(30,28,52,.92), rgba(14,13,24,.96))',
        border: item.featured ? `1px solid ${theme.colors.pink}99` : '1px solid rgba(255,255,255,.10)',
        boxShadow: item.featured
          ? `0 18px 44px rgba(0,0,0,.55), 0 0 0 1px ${theme.colors.pink}55, 0 0 ${Math.round(22 + breathe * 20)}px ${theme.colors.pink}${glowAlpha}`
          : '0 18px 44px rgba(0,0,0,.55)',
        display: 'flex',
        flexDirection: 'column',
        opacity: enter,
        transform: `translateY(${((1 - enter) * 36).toFixed(1)}px) scale(${(0.94 + enter * 0.06).toFixed(4)})`,
      }}
    >
      {/* 顶部品牌色发丝线：一排卡片拉齐后像“整排精心排版”，而不是一堆图贴上去 */}
      <span style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(2, Math.round(height * 0.006)),
                     background: item.featured
                       ? `linear-gradient(90deg, ${theme.colors.gold}, ${theme.colors.pink})`
                       : `linear-gradient(90deg, ${theme.colors.sky}, ${theme.colors.pink} 60%, transparent)`, zIndex: 3 }} />
      <div style={{ position: 'relative', height: coverH, flex: 'none', overflow: 'hidden' }}>
        {/* 封面：显影（grayscale/blur/brightness）+ 慢推镜。blur 会吃掉边缘 → 同步放大一点补回来 */}
        <div style={{ position: 'absolute', inset: 0,
                      filter: `grayscale(${(1 - develop).toFixed(3)}) blur(${((1 - develop) * 10).toFixed(2)}px) brightness(${(0.72 + develop * 0.28).toFixed(3)})`,
                      transform: `scale(${((1.06 - develop * 0.06) * push).toFixed(4)})` }}>
          <Poster src={item.coverAssetPath ? assetUrl(item.coverAssetPath, assetBaseUrl) : undefined} theme={theme} radius={0} contain />
        </div>
        {params.detailShow.status ? <PosterFlag text={item.clips.length > 0 ? '片段推荐' : '资料推荐'} theme={theme} size={size.chip} /> : null}
        {/* 封面底部渐隐：与下方文字区自然衔接，不再是硬切一刀 */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.round(coverH * 0.26),
                      background: 'linear-gradient(180deg, transparent, rgba(10,9,18,.88))', pointerEvents: 'none' }} />
        {/* 序号胶囊：**组内**序号（盘点语境里“本组第 N 部”才是信息） */}
        <span style={{ position: 'absolute', right: pad * 0.6, bottom: pad * 0.5,
                       padding: `${Math.round(size.chip * 0.24)}px ${Math.round(size.chip * 0.72)}px`,
                       borderRadius: 999, fontFamily: theme.font.mono, fontSize: size.chip, fontWeight: 700,
                       letterSpacing: 1, color: theme.colors.ink,
                       background: 'rgba(8,8,16,.55)', border: '1px solid rgba(255,255,255,.16)', backdropFilter: 'blur(4px)' }}>
          {pad2(number)}
        </span>
        {/* A 方案：核心角标（左上已被“资料推荐/片段推荐”占用 → 放右上），弹性落位 */}
        {item.featured ? (
          <span style={{ position: 'absolute', right: pad * 0.55, top: pad * 0.5,
                         padding: `${Math.round(size.chip * 0.24)}px ${Math.round(size.chip * 0.7)}px`,
                         borderRadius: 999, fontFamily: theme.font.body, fontSize: size.chip, fontWeight: 800,
                         letterSpacing: 1, color: '#241226',
                         background: `linear-gradient(135deg, ${theme.colors.gold}, ${theme.colors.pink})`,
                         border: '1px solid rgba(255,255,255,.35)', boxShadow: `0 6px 18px ${theme.colors.pink}55`,
                         opacity: star, transform: `scale(${star.toFixed(3)}) rotate(${((1 - star) * -14).toFixed(2)}deg)` }}>
            ★ 核心
          </span>
        ) : null}
      </div>
      {/* 文字区：标题两行 + 一行元信息。
          网格屏**不放简介与标签** —— 它是「一眼扫过」的场景，长文归资料卡（MediaInfo）；
          之前塞 3 行简介 + 3 个标签把卡片撑到 586px/张，两行就溢出画幅了。 */}
      <div style={{ flex: 1, minHeight: 0, padding: `0 ${pad}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: Math.round(height * 0.018) }}>
        <div style={{ fontFamily: theme.font.display, fontSize: size.title, fontWeight: 700, color: theme.colors.ink, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.title}
        </div>
        {meta ? (
          <div style={{ fontFamily: theme.font.mono, fontSize: size.chip, letterSpacing: 1, color: theme.colors.muted }}>{meta}</div>
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
