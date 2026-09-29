import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { riseIn, useEnter } from '../animation';
import { fitIntroSize, INTRO_LAYOUT, parseRichText, plainLength, RichInline, type RichBlock, type Tone } from '../rich-text';
import type { RenderParams } from '../params';
import type { Theme } from '../theme';
import { GradientTitle } from './parts';

/** 一个块的渲染样式：标题更大更紧，条目就是一行（金色圆点 + 正文色）。 */
function blockStyle(block: RichBlock, size: number, theme: Theme): React.CSSProperties {
  const base: React.CSSProperties = {
    margin: 0,
    fontFamily: theme.font.body,
    whiteSpace: 'pre-line',
    overflow: 'hidden',
  };
  if (block.kind === 'h') {
    return {
      ...base,
      fontSize: Math.round(size * INTRO_LAYOUT.headingScale),
      fontWeight: 900,
      lineHeight: INTRO_LAYOUT.headingLineHeight,
      color: theme.colors.gold,
      letterSpacing: 1,
    };
  }
  return {
    ...base,
    fontSize: size,
    lineHeight: INTRO_LAYOUT.lineHeight,
    color: theme.colors.muted,
    ...(block.kind === 'li' ? { paddingLeft: Math.round(size * 1.1), textIndent: -Math.round(size * 1.1) } : null),
  };
}

/** 序言屏：kicker / 标题 / 正文。正文超长时**按预算自动收字号**（旧模板靠滚动页容纳，画幅下必须收口）。 */
export function Intro({ params, theme }: { params: RenderParams; theme: Theme }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const titleIn = useEnter(0, theme);
  const textIn = useEnter(Math.round(fps * 0.25), theme);

  // 语义富文本：`## 小标题` / `- 条目` / 空行分段 / `**加粗**` / `==重点==` / `!!提醒!!` / `++信息++`（见 `src/rich-text.tsx`）。
  const blocks = parseRichText(params.intro);
  const base = Math.round(height * theme.layout.bodyRatio * 1.15);
  // 字号按**预算反推**：放得下就用基准号，放不下阶梯收到下限（下限仍不够时编辑器会先报警）
  const size = fitIntroSize(
    blocks,
    base,
    Math.round(width * INTRO_LAYOUT.maxWidthRatio),
    Math.round(height * INTRO_LAYOUT.maxHeightRatio),
  );
  const tones: Partial<Record<Tone, string>> = { accent: theme.colors.gold, info: theme.colors.sky };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: `${Math.round(height * 0.1)}px ${Math.round(width * 0.12)}px` }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(${Math.round(width * 0.55)}px ${Math.round(height * 0.58)}px at 50% 55%, rgba(79,195,247,.14), transparent 70%)`,
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', fontFamily: theme.font.mono, fontSize: Math.round(height * 0.019), letterSpacing: 10, color: theme.colors.sky, fontWeight: 600, marginBottom: Math.round(height * 0.03), opacity: titleIn }}>
        PROLOGUE
      </div>
      <div style={{ position: 'relative', ...riseIn(titleIn, height * 0.05) }}>
        <GradientTitle text={params.prologueTitle.trim() || params.title} theme={theme} size={Math.round(height * 0.085)} />
      </div>
      {/* 正文：一块一框（标题/条目/正文各有自己的字号与行高），间距由布局常量给（与预算条同一份）*/}
      <div
        style={{
          position: 'relative',
          maxWidth: width * INTRO_LAYOUT.maxWidthRatio,
          marginTop: Math.round(height * 0.045),
          ...riseIn(textIn, height * 0.04),
          display: 'flex',
          flexDirection: 'column',
          maxHeight: Math.round(height * INTRO_LAYOUT.maxHeightRatio),
          overflow: 'hidden',
        }}
      >
        {blocks.map((block, index) => {
          const tight = index > 0 && block.kind === 'li' && blocks[index - 1].kind === 'li';
          const gap = index === 0 ? 0 : Math.round(size * (tight ? INTRO_LAYOUT.itemGap : INTRO_LAYOUT.blockGap));
          return (
            <div key={index} style={{ marginTop: gap, ...blockStyle(block, size, theme) }}>
              {block.kind === 'li' ? <span style={{ color: theme.colors.gold }}>· </span> : null}
              <RichInline spans={block.spans} tones={tones} boldColor={theme.colors.ink} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'relative',
          marginTop: Math.round(height * 0.055),
          fontFamily: theme.font.body,
          fontSize: Math.round(height * 0.019),
          letterSpacing: 6,
          color: theme.colors.gold,
          opacity: interpolate(Math.sin((frame / fps / 2) * Math.PI * 2), [-1, 1], [0.45, 1]),
        }}
      >
        ✦ 本期片单 ✦
      </div>
    </div>
  );
}
