import React from 'react';
import { Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetUrl } from '../asset-url';
import { riseIn, useEnter } from '../animation';
import type { RenderParams } from '../params';
import {
  recapEntranceSeconds, recapGeometry, recapHoldSeconds, recapPageAt, recapPages,
  RECAP_BOTTOM_RATIO, RECAP_LABEL_RATIO, RECAP_META_RATIO, RECAP_PAD_RATIO, RECAP_TITLE_LINE_HEIGHT, RECAP_TITLE_RATIO,
} from '../recap';
import { tierLook } from '../tier';
import type { Theme } from '../theme';
import type { PocMedia } from '../types';

/**
 * 结尾「全片回顾」= **分页小卡墙**（用户 2026-09-26 第二轮：「不要后面的背景框，直接展示。按年份左右往后直接铺开，
 * 完整展示。若本页展示不下，展示完毕后停留 5S，展示下一页。小卡片带标题、日期、集数」）。
 *
 * 与第一版滚动清单的区别：**不滚**，一页铺满（12 × 3 = 36 张）→ 错峰入场 → 停留（`endingScrollSpeed` 当节奏档）→ 下一页。
 * 卡片**不加外层背景框**，直接落在画布上（卡面本身就是卡片）；`groupBy=year` 的年份印在卡上（`年份 · 集数`），
 * 不再插年份小节头 —— 一行一张的名单读感「不太舒服」，改成一眼扫图的卡墙。
 *
 * 规矩与其他场景一致：**帧驱动**（错峰/翻页都由帧算出，不用 CSS 动效/定时器），不读 `Math.random`。
 * 一页最多 36 张卡，所以**不需要切片渲染**（不像上一版要按视窗裁行）。
 */
export function RecapList({ media, params, theme, assetBaseUrl, groupName }: {
  media: PocMedia[];
  params: RenderParams;
  theme: Theme;
  assetBaseUrl: string;
  /** 固定档名行（如「全片回顾 · 强推」，与其前的题头页同文案）。 */
  groupName?: string;
}) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const speed = params.endingScrollSpeed;
  const pages = recapPages(media);
  const { index: pageIndex, local } = recapPageAt(pages, speed, frame / fps);
  const page = pages[pageIndex] ?? [];
  const entrance = recapEntranceSeconds(page.length);
  const hold = recapHoldSeconds(speed);
  // 页尾 0.25s 淡出（下一页的卡片紧接着错峰入场）；页首 0.3s 淡入档名行与整块
  const pageOut = interpolate(local, [Math.max(0.3, entrance + hold - 0.25), entrance + hold], [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headIn = interpolate(local, [0, Math.min(0.3, entrance)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const look = tierLook(media[0]?.tier, params.tiers);
  const g = recapGeometry(width, height);
  const titleSize = Math.round(height * RECAP_TITLE_RATIO);
  const metaSize = Math.round(height * RECAP_META_RATIO);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: `${Math.round(height * RECAP_PAD_RATIO)}px 0 ${Math.round(height * RECAP_BOTTOM_RATIO)}px` }}>
      {/* 档名行（无背景框，只有字与一条档色细线） */}
      <div style={{ width: Math.round(g.contentW), height: Math.round(height * RECAP_LABEL_RATIO), flex: 'none', display: 'flex', alignItems: 'center',
                    gap: Math.round(width * 0.012), padding: `0 ${Math.round(width * 0.016)}px`, opacity: headIn,
                    fontFamily: theme.font.mono, fontSize: Math.round(height * 0.017), letterSpacing: 6, color: theme.colors.sky }}>
        <span style={{ whiteSpace: 'nowrap' }}>{groupName || '全片回顾'} · 共 {media.length} 部</span>
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${look.accent}88, transparent)` }} />
        {pages.length > 1
          ? <span style={{ flex: 'none', color: theme.colors.faint, letterSpacing: 3 }}>第 {pageIndex + 1} / {pages.length} 页</span>
          : null}
      </div>
      {/* 卡墙：按列切片（不交给 flex-wrap —— 卡片比列宽窄时会一行塞进更多张，`gridRows` 那条教训） */}
      <div style={{ width: Math.round(g.contentW), flex: 'none', opacity: pageOut }}>
        {Array.from({ length: Math.ceil(page.length / g.columns) }, (_, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex', gap: g.gap, marginBottom: g.rowGap }}>
            {page.slice(rowIndex * g.columns, (rowIndex + 1) * g.columns).map((item, columnIndex) => (
              <RecapCard key={item.mediaId} item={item} index={rowIndex * g.columns + columnIndex} fps={fps}
                         theme={theme} params={params} assetBaseUrl={assetBaseUrl} g={g} titleSize={titleSize} metaSize={metaSize} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 一张小卡：封面（3:4）+ 标题（最多两行）+ `年份 · 集数`；档色只用于顶部发丝线（名次→视觉仍只认 `tier.tsx`）。 */
function RecapCard({ item, index, fps, theme, params, assetBaseUrl, g, titleSize, metaSize }: {
  item: PocMedia;
  index: number;
  fps: number;
  theme: Theme;
  params: RenderParams;
  assetBaseUrl: string;
  g: ReturnType<typeof recapGeometry>;
  titleSize: number;
  metaSize: number;
}) {
  // 错峰 0.025s/张（与 `recapEntranceSeconds` 同一口径），入场用全片统一的 spring 手感
  const enter = useEnter(Math.round(index * 0.025 * fps), theme);
  const look = tierLook(item.tier, params.tiers);
  // 日期只能给到**年份**（库里 `media.season` 是“系列第几季”，不是播出季度，别当月份用）
  const meta = [item.year ? String(item.year) : '', item.episodeCount ? `${item.episodeCount}集` : ''].filter(Boolean).join(' · ');
  return (
    <div style={{ width: g.cardW, height: g.cardH, flex: 'none', position: 'relative', overflow: 'hidden',
                  borderRadius: Math.round(g.cardW * 0.12), background: 'linear-gradient(180deg, rgba(30,28,52,.92), rgba(14,13,24,.96))',
                  border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 12px 30px rgba(0,0,0,.5)', ...riseIn(enter, 22) }}>
      <span style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, zIndex: 3,
                     background: look.rainbow ? 'linear-gradient(90deg,#ff6b6b,#ffd166,#4ade80,#4fc3f7,#a78bfa)'
                       : `linear-gradient(90deg, ${look.accent}, ${look.accent}44 60%, transparent)` }} />
      <div style={{ height: g.coverH, overflow: 'hidden', background: 'linear-gradient(160deg,#221a3a,#0d0a18)' }}>
        {item.coverAssetPath
          ? <Img src={assetUrl(item.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : null}
      </div>
      <div style={{ height: g.textH, padding: `${Math.round(g.textH * 0.12)}px ${Math.round(g.textH * 0.11)}px 0`, boxSizing: 'border-box' }}>
        <div style={{ fontFamily: theme.font.body, fontSize: titleSize, lineHeight: RECAP_TITLE_LINE_HEIGHT, fontWeight: 600, color: theme.colors.ink,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.title}
        </div>
        {/* 集数那一行必须能**装下**：mono 字体是全宽字（一个 ASCII 字符≈0.6em），在 115px 内放不下「2000 年 · 167 集」
             → 年份不带「年」、「集」前不留空格、去 letterSpacing；实测「2000 · 167集」≈103px */}
        <div style={{ marginTop: Math.round(g.textH * 0.05), fontFamily: theme.font.mono, fontSize: metaSize,
                      color: theme.colors.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {meta}
        </div>
      </div>
    </div>
  );
}
