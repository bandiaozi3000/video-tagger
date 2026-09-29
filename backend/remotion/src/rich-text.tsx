import React from 'react';

/**
 * 序言/简介的**语义富文本**（2026-09-26 用户拍板：「能分段、加粗、颜色标记」→ 二轮：「都改，颜色做个区分，红色是提醒的」）。
 *
 * 设计口径（**留语义、砍排版**）：
 *   · 留：这是标题 / 这是条目 / 这段要突出（且突出有**语义**：重点 ≠ 提醒 ≠ 补充）
 *   · 砍：字号、字体、对齐、缩进、表格、图片、链接、颜色自选器 —— 排版归模板，
 *         这一屏是「朗读节奏 + 画幅预算」驱动的画面，放开排版就守不住这两个约束。
 * 所以格式**还是纯字符串**（`config.intro` 不动）→ 草稿/模板/导出任务三层 payload 零迁移，解析只发生在渲染侧。
 *
 * 语法（唯一真源；编辑器按钮与 chapter 序言、银幕式简介共用）：
 *   块级（**行首**）：`## 小标题` ｜ `- 条目` ｜ 其余行 = 正文（同段多行保留换行）
 *   分块：空行分段；连续 `- ` 行算一组条目（段间距更紧）
 *   行内：`**加粗**` ｜ `==重点==`（金）｜ `!!提醒!!`（红）｜ `++信息++`（青）
 * 未闭合标记 / `****` **当普通文字**，不抛错、不吞字。
 */

/** 语义色：**语义固定**（重点永远是重点色），不随媒体/章节轮转；`warn` 按用户要求用红。 */
export type Tone = 'accent' | 'warn' | 'info';

export const TONES: Tone[] = ['accent', 'warn', 'info'];

/** 每个语义的按钮文案（编辑器用；顺序即按钮顺序）。 */
export const TONE_LABEL: Record<Tone, string> = { accent: '重点', warn: '提醒', info: '信息' };

/** 默认语义色（与 chapter 主题的 gold / sky 同值；顺序无关）：重点金 · 提醒红 · 信息青。 */
export const TONE_COLOR: Record<Tone, string> = { accent: '#ffd166', warn: '#ff7b7b', info: '#4fc3f7' };

/** 行内标记 → 样式（`bold` 之外都是语义色）。 */
export const INLINE_MARKERS: Record<'bold' | Tone, string> = { bold: '**', accent: '==', warn: '!!', info: '++' };

/** 块级标记（行首）→ 块种类。 */
export const LINE_MARKERS: Record<BlockKind, string> = { h: '## ', li: '- ', p: '' };

export type MarkupKind = 'bold' | Tone;
export type BlockKind = 'h' | 'li' | 'p';

export interface RichSpan {
  text: string;
  bold?: boolean;
  /** 语义色；`bold` 与 `tone` 可以同时有（`==**加粗**==` 反过来也行）。 */
  tone?: Tone;
}

export interface RichBlock {
  kind: BlockKind;
  /** 行内片段（正文块里的 `\n` 原样保留，靠 `pre-line` 换行）。 */
  spans: RichSpan[];
}

const INLINE_ORDER: MarkupKind[] = ['bold', 'accent', 'warn', 'info'];

function withBold(spans: RichSpan[]): RichSpan[] {
  return spans.map((span) => ({ ...span, bold: true }));
}

function withTone(spans: RichSpan[], tone: Tone): RichSpan[] {
  return spans.map((span) => ({ ...span, tone }));
}

function parseInline(text: string): RichSpan[] {
  const out: RichSpan[] = [];
  let buffer = '';
  let index = 0;
  const flush = () => {
    if (buffer) out.push({ text: buffer });
    buffer = '';
  };
  while (index < text.length) {
    const two = text.slice(index, index + 2);
    const kind = INLINE_ORDER.find((k) => INLINE_MARKERS[k] === two);
    const close = kind ? text.indexOf(INLINE_MARKERS[kind], index + 2) : -1;
    if (kind && close > index + 2) {
      flush();
      const inner = parseInline(text.slice(index + 2, close));
      out.push(...(kind === 'bold' ? withBold(inner) : withTone(inner, kind)));
      index = close + 2;
      continue;
    }
    buffer += text[index];
    index += 1;
  }
  flush();
  return out;
}

/**
 * 解析成块：空行分段；**行首** `## ` / `- ` 各起一块；同段里的普通行并进同一个正文块（保留 `\n`）。
 * 空输入 → `[]`（调用方据此判断"没有正文"）。
 */
export function parseRichText(input: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  for (const chunk of input.split(/\n{2,}/)) {
    if (chunk.trim() === '') continue;
    // 同一段里可能既有正文行又有 `- ` 行（用户不会去数空行）→ 逐行判块，正文行并进当前正文块
    let paragraph: RichSpan[] = [];
    const flushParagraph = () => {
      if (paragraph.length > 0) blocks.push({ kind: 'p', spans: paragraph });
      paragraph = [];
    };
    for (const raw of chunk.split('\n')) {
      const line = raw.replace(/\s+$/, '');
      if (line.trim() === '') continue;
      const heading = line.startsWith(LINE_MARKERS.h);
      const item = !heading && line.startsWith(LINE_MARKERS.li);
      if (!heading && !item) {
        if (paragraph.length > 0) paragraph.push({ text: '\n' });
        paragraph.push(...parseInline(line));
        continue;
      }
      const marker = heading ? LINE_MARKERS.h : LINE_MARKERS.li;
      flushParagraph();
      blocks.push({ kind: heading ? 'h' : 'li', spans: parseInline(line.slice(marker.length)) });
    }
    flushParagraph();
  }
  return blocks;
}

/** 去掉标记后的可见字数 —— 预算条与"易读字数"都按人看到的字数算。 */
export function plainLength(input: string): number {
  return parseRichText(input).reduce(
    (total, block) => total + block.spans.reduce((sum, span) => sum + span.text.length, 0),
    0,
  );
}

/**
 * 序言屏的**排版预算常量**：渲染（`scenes/Intro.tsx`）与编辑器预算条**共用这一份**，
 * 否则"约 N 行"会骗人。数值都是"相对正文字号"的倍数，画幅无关。
 */
export const INTRO_LAYOUT = {
  maxWidthRatio: 0.7,
  maxHeightRatio: 0.5,
  lineHeight: 2.05,
  headingScale: 1.3,
  headingLineHeight: 1.4,
  blockGap: 1.0,
  itemGap: 0.25,
  /** 估算留的余量：真实换行比理想模型早一点（字距/标点挤压），乘到可用宽度上。 */
  widthSafety: 0.97,
  /** 自动收字号的下限（再小就看不清了，宁可在编辑器里报"会被裁"）。 */
  minScale: 0.72,
} as const;

/** 一个字符占几个"字号宽"（CJK 全宽 1em，拉丁/数字约 0.55em）。 */
function charWidth(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x2e80) return 1;
  if (ch === ' ' || ch === '\t') return 0.3;
  if (/[0-9a-zA-Z]/.test(ch)) return 0.55;
  return 0.5;
}

function blockLines(block: RichBlock, size: number, maxWidth: number): number {
  const text = block.spans.map((span) => span.text).join('');
  const limit = maxWidth * INTRO_LAYOUT.widthSafety;
  let lines = 0;
  for (const line of text.split('\n')) {
    let width = 0;
    for (const ch of line) width += charWidth(ch) * size;
    lines += Math.max(1, Math.ceil(width / limit));
  }
  return Math.max(1, lines);
}

/** 估算整段正文的高度（px）。块间距：正文/标题 `blockGap`，条目挨条目用更紧的 `itemGap`。 */
export function estimateIntroHeight(blocks: RichBlock[], size: number, maxWidth: number): number {
  let height = 0;
  blocks.forEach((block, index) => {
    if (index > 0) {
      const tight = block.kind === 'li' && blocks[index - 1].kind === 'li';
      height += size * (tight ? INTRO_LAYOUT.itemGap : INTRO_LAYOUT.blockGap);
    }
    const big = block.kind === 'h';
    const fontSize = big ? size * INTRO_LAYOUT.headingScale : size;
    const lineHeight = big ? INTRO_LAYOUT.headingLineHeight : INTRO_LAYOUT.lineHeight;
    height += blockLines(block, fontSize, maxWidth) * fontSize * lineHeight;
  });
  return height;
}

/**
 * 自动收字号：在 `[base*minScale, base]` 里二分找"放得下"的最大字号（高度对字号单调递增）。
 * 连下限都放不下 → 返回下限，由调用方（编辑器预算条）负责报警"会被裁"。
 */
export function fitIntroSize(blocks: RichBlock[], base: number, maxWidth: number, budget: number): number {
  const min = Math.max(12, Math.round(base * INTRO_LAYOUT.minScale));
  if (estimateIntroHeight(blocks, base, maxWidth) <= budget) return base;
  let low = min;
  let high = base;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateIntroHeight(blocks, mid, maxWidth) <= budget) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** 工具栏插行内标记：包住选区；没有选区就插占位文字并选中它；返回值带**新选区**供 textarea 回填。 */
export function wrapInline(value: string, start: number, end: number, kind: MarkupKind): { value: string; start: number; end: number } {
  const token = INLINE_MARKERS[kind];
  const from = Math.max(0, Math.min(start, end));
  const to = Math.max(start, end);
  const label = kind === 'bold' ? '加粗文字' : `${TONE_LABEL[kind]}文字`;
  const selected = value.slice(from, to) || label;
  const next = `${value.slice(0, from)}${token}${selected}${token}${value.slice(to)}`;
  return { value: next, start: from + token.length, end: from + token.length + selected.length };
}

/** 工具栏给**当前行**加/去块级标记（`## ` / `- `）：已经有就摘掉（点第二次＝取消）。 */
export function toggleLinePrefix(value: string, caret: number, prefix: string): { value: string; start: number } {
  const at = Math.max(0, Math.min(caret, value.length));
  const lineStart = value.lastIndexOf('\n', Math.max(0, at - 1)) + 1;
  const lineEnd = value.indexOf('\n', at) < 0 ? value.length : value.indexOf('\n', at);
  const line = value.slice(lineStart, lineEnd);
  if (line.startsWith(prefix)) {
    const next = `${value.slice(0, lineStart)}${line.slice(prefix.length)}${value.slice(lineEnd)}`;
    return { value: next, start: Math.max(lineStart, at - prefix.length) };
  }
  const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
  return { value: next, start: at + prefix.length };
}

/** 内联片段渲染（两处场景共用）。`tones` 可按场景微调语义色（默认见 `TONE_COLOR`）。 */
export function RichInline({ spans, tones = TONE_COLOR, boldColor }: {
  spans: RichSpan[];
  tones?: Partial<Record<Tone, string>>;
  boldColor?: string;
}): React.ReactElement {
  return (
    <>
      {spans.map((span, index) => {
        const tone = span.tone ? tones[span.tone] ?? TONE_COLOR[span.tone] : undefined;
        const emphasized = Boolean(span.bold) || Boolean(tone);
        return (
          <span
            key={index}
            style={emphasized ? { fontWeight: 900, color: tone ?? boldColor } : undefined}
          >
            {span.text}
          </span>
        );
      })}
    </>
  );
}
