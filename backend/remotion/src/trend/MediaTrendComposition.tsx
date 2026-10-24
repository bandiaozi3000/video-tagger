import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  TREND_LAYOUT, TREND_PALETTES, TREND_TOP_LABEL_H, barReveal, chartTypeOf, countOf, coverForYear,
  currentYearIndex, elapsedYearsAtFrame, isHoldPhase, maxCountOf, revealedPoints, themeOf, xAt, yAt, yearsOf,
  type TrendRefCard, type TrendVideoInput,
} from './params';

/**
 * v0.32 第二部分：统计视频的画面。
 *
 * 与网页图的关系（规格 V1b）：**共享数据契约，不共享绘图代码** —— 网页那套要交互（点选/悬浮/图例开关），
 * 这里要的是逐帧可控（线生长、柱升起、末尾定格），硬合两边都别扭。
 *
 * 画面风格（2026-10-04 用户：「我说的就是画面风格」）：默认 **light = 白底亮色**（番剧排行视频那种），
 * 元素映射：标题压顶 · **顶部横轴线 + 年份刻度** · 左侧竖排图例（名 + 当前值）· **右上大年份** ·
 * 数值等宽大字贴在线的头部 · 每年第一名贴**封面小头像**。`theme: 'dark'` 保留旧观感。
 *
 * ⚠️ 封面只吃 **data URI / http(s)**：远程图必须由 Java 先下载内联（headless Chrome 不吃系统代理，
 * 远程图超时会 delayRender 把整支片拖死，实测 28s 失败）。
 */
export const MediaTrendComposition: React.FC<TrendVideoInput> = (input) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const years = yearsOf(input);
  const lines = (input.lines || []).filter((l) => l && l.name);
  const theme = themeOf(input);
  const palette = TREND_PALETTES[theme.name];
  const colorOf = (i: number) => palette[i % palette.length];
  const max = Math.max(1, maxCountOf(input));
  const elapsed = elapsedYearsAtFrame(frame, input, fps);
  const yearIdx = currentYearIndex(elapsed, years.length);
  const chart = chartTypeOf(input);
  const currentYear = years.length ? years[Math.min(yearIdx, years.length - 1)] : null;

  const perYearFrames = Math.max(1, (input.secPerYear ?? 1.5) * fps);
  const holdStart = years.length * perYearFrames;
  const hold = isHoldPhase(frame, input, fps);
  const holdFade = hold ? Math.min(1, (frame - holdStart) / (fps * 0.5)) : 0;
  const lastYear = years.length ? years[years.length - 1] : null;
  const refs: TrendRefCard[] = (input.refs || []).slice(0, 5);

  const L = TREND_LAYOUT;
  const xOf = (i: number) => xAt(i, years.length);
  const yOf = (v: number) => yAt(v, max);

  /** 每年「第一名」= 当年计数最大的那条线（封面小头像只贴它）。 */
  const winnerIndexAt = (year: number): number => {
    let best = -1;
    let bestVal = -1;
    lines.forEach((line, i) => {
      const v = countOf(line, year);
      if (v > bestVal) { bestVal = v; best = i; }
    });
    return bestVal > 0 ? best : -1;
  };

  const drawCover = (url: string, cx: number, cy: number, key: string) => (
    <g key={key}>
      <clipPath id={`clip-${key}`}>
        <circle cx={cx} cy={cy} r={26} />
      </clipPath>
      <circle cx={cx} cy={cy} r={27} fill={theme.ring} />
      <image href={url} x={cx - 26} y={cy - 26} width={52} height={52} clipPath={`url(#clip-${key})`} preserveAspectRatio="xMidYMid slice" />
      <circle cx={cx} cy={cy} r={26} fill="none" stroke={theme.ring} strokeWidth={2} />
    </g>
  );

  return (
    <AbsoluteFill style={{ background: theme.bg, color: theme.text, fontFamily: 'system-ui, "Microsoft YaHei", sans-serif' }}>
      <div style={{ position: 'absolute', left: 90, top: 62 }}>
        <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: 1 }}>{input.title || '媒体趋势'}</div>
        <div style={{ fontSize: 21, color: theme.dim, marginTop: 8 }}>
          按首播年份统计{lines.length > 1 ? ` · ${lines.length} 条筛选对比` : ''}
        </div>
      </div>

      {/* 右上大年份（截图里时间戳的位置） */}
      <div style={{ position: 'absolute', right: 90, top: 44, textAlign: 'right' }}>
        <span style={{ fontSize: 96, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 2 }}>
          {currentYear ?? ''}
        </span>
        <span style={{ fontSize: 26, color: theme.dim, marginLeft: 10 }}>年</span>
      </div>

      {/* 左侧竖排图例：色块 + 线名 + 当前值（截图里条左侧「名字 + 数值」的位置） */}
      <div style={{ position: 'absolute', left: 90, top: 180, display: 'flex', flexDirection: 'column', gap: 22, width: 350 }}>
        {lines.map((line, i) => {
          const v = currentYear === null ? 0 : countOf(line, currentYear);
          return (
            <div key={line.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: colorOf(i), flex: '0 0 auto' }} />
              <span style={{ fontSize: 23, flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.name}</span>
              <span style={{ fontSize: 30, fontFamily: 'monospace', fontWeight: 800, color: colorOf(i) }}>{v}</span>
            </div>
          );
        })}
      </div>

      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        {/* 顶部横轴线 + 年份刻度（写在线之上）*/}
        <line x1={L.left - 30} x2={L.right + 30} y1={L.top} y2={L.top} stroke={theme.axis} strokeWidth={2} />
        {years.map((year, i) => {
          if (i % Math.max(1, Math.ceil(years.length / 15)) !== 0 && i !== years.length - 1) return null;
          return (
            <text key={`y${year}`} x={xOf(i)} y={L.top - 14} textAnchor="middle" fontSize={21}
                  fill={theme.dim} fontFamily="monospace">{year}</text>
          );
        })}

        {/* 网格 + 左侧数值（细、淡、无竖轴线） */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const y = yAt(max * r, max);
          return (
            <g key={`g${r}`}>
              <line x1={L.left - 30} x2={L.right + 30} y1={y} y2={y} stroke={theme.grid} strokeWidth={r === 0 ? 2 : 1} />
              <text x={L.left - 46} y={y + 7} textAnchor="end" fontSize={19} fill={theme.dim} fontFamily="monospace">{Math.round(max * r)}</text>
            </g>
          );
        })}

        {chart === 'line'
          ? lines.map((line, i) => {
            const pts = revealedPoints(line, years, elapsed)
              .map((p) => `${xOf(p.year - years[0])},${yOf(p.count)}`)
              .join(' ');
            // 线头上的数值标签**不画**：左侧图例列已经在每个线名旁边挂着当前值，
            // 再贴一个会跟右端的年份刻度撞在一起（2026-10-04 渲染实测）
            return (
              <polyline key={line.name} points={pts} fill="none" stroke={colorOf(i)} strokeWidth={6}
                        strokeLinejoin="round" strokeLinecap="round" />
            );
          })
          : years.map((year, i) => {
            const band = (L.right - L.left) / Math.max(1, years.length);
            const w = Math.max(3, band / Math.max(1, lines.length) - 5);
            return lines.map((line, j) => {
              const reveal = barReveal(elapsed, i);
              const value = countOf(line, year) * reveal;
              const y = yOf(value);
              return (
                <rect key={`${line.name}-${year}`} x={L.left + band * i + (band / Math.max(1, lines.length)) * j + 3}
                      y={y} width={w} height={Math.max(0, L.bottom - y)} rx={6} fill={colorOf(j)} />
              );
            });
          })}

        {/* 每年第一名的封面小头像（没有封面就不贴） */}
        {years.map((year, i) => {
          if (elapsed < i + 0.999) return null;
          const url = coverForYear(input, year);
          if (!url) return null;
          const wi = winnerIndexAt(year);
          if (wi < 0) return null;
          const v = countOf(lines[wi], year);
          const cy = chart === 'line' ? yOf(v) : yOf(v) + 30;
          return drawCover(url, xOf(i), Math.max(L.top + 30, cy), `cov-${year}`);
        })}
      </svg>

      {hold && refs.length > 0 ? (
        <AbsoluteFill style={{ background: theme.bg, opacity: holdFade, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 120px' }}>
          <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 30, color: theme.text }}>{lastYear} 年代表作</div>
          <div style={{ display: 'flex', gap: 28 }}>
            {refs.map((r) => (
              <div key={r.title} style={{ width: 268, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {r.coverUrl && /^(https?:|data:)/.test(r.coverUrl) ? (
                  <Img src={r.coverUrl} style={{ width: 268, height: 372, objectFit: 'cover', borderRadius: 14 }} />
                ) : (
                  <div style={{ width: 268, height: 372, borderRadius: 14, background: theme.name === 'light' ? '#e7e7ee' : '#1e1e2e' }} />
                )}
                <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, color: theme.text }}>{r.title}</div>
                <div style={{ fontSize: 21, color: theme.dim, fontFamily: 'monospace' }}>
                  {r.bgmScore && Number(r.bgmScore) > 0 ? `BGM ${Number(r.bgmScore).toFixed(1)}` : ''}
                  {r.personalRating != null ? ` 个人 ★${Number(r.personalRating)}` : ''}
                </div>
              </div>
            ))}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
