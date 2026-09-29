import { describe, expect, it } from 'vitest';
import {
  estimateIntroHeight, fitIntroSize, INLINE_MARKERS, INTRO_LAYOUT, parseRichText, plainLength, toggleLinePrefix, wrapInline,
  type RichBlock,
} from './rich-text';

/** 压成好断言的形状：`p:文字(bold|accent)`，块之间 ` / `。 */
const shape = (blocks: RichBlock[]): string =>
  blocks.map((block) => `${block.kind}:${block.spans.map((s) => `${s.text}${s.bold ? '^b' : ''}${s.tone ? `^${s.tone}` : ''}`).join('+')}`).join(' / ');

describe('parseRichText', () => {
  it('空 / 纯空白 → 没有正文', () => {
    expect(parseRichText('')).toEqual([]);
    expect(parseRichText('\n\n   \n\n')).toEqual([]);
  });

  it('单段纯文本原样保留', () => {
    expect(shape(parseRichText('这季挑了六部。'))).toEqual('p:这季挑了六部。');
  });

  it('空行分段，段内换行保留在同一个正文块里', () => {
    // 期望串里的 `\n` 是**真换行**（span 文本原样保留换行，靠 pre-line 换行）
    expect(shape(parseRichText('第一段\n换行仍在\n\n第二段'))).toEqual('p:第一段+\n+换行仍在 / p:第二段');
  });

  it('行首 ## 与 - 各起一块；连续条目各自成块（渲染侧再按相邻收紧）', () => {
    expect(shape(parseRichText('## 选片口径\n- 看得爽\n- 有记忆点\n\n收尾。')))
      .toEqual('h:选片口径 / li:看得爽 / li:有记忆点 / p:收尾。');
  });

  it('段内混排：正文行并入正文块，条目行打断它', () => {
    expect(shape(parseRichText('先说明：\n- 第一条\n继续说'))).toEqual('p:先说明： / li:第一条 / p:继续说');
  });

  it('行首标记里的行内标记照常解析', () => {
    expect(shape(parseRichText('- ==看得爽=='))).toEqual('li:看得爽^accent');
  });

  it('三种语义色 + 加粗', () => {
    expect(shape(parseRichText('==重点== !!提醒!! ++信息++ **加粗**')))
      .toEqual('p:重点^accent+ +提醒^warn+ +信息^info+ +加粗^b');
  });

  it('嵌套（语义色里再 **）两层都记上', () => {
    expect(shape(parseRichText('==重点里有**加粗**=='))).toEqual('p:重点里有^accent+加粗^b^accent');
  });

  it('未闭合 / 空标记当普通文字，不吞字', () => {
    expect(shape(parseRichText('半截 **标记'))).toEqual('p:半截 **标记');
    expect(shape(parseRichText('a == b'))).toEqual('p:a == b');
    expect(shape(parseRichText('**** 空'))).toEqual('p:**** 空');
    expect(shape(parseRichText('!!只有一个'))).toEqual('p:!!只有一个');
  });
});

describe('plainLength', () => {
  it('按人看到的字数算（标记不计入）', () => {
    expect(plainLength('**加粗**')).toBe(2);
    expect(plainLength('==重点==\n\n- 条目')).toBe(4); // 行首 `- ` 不算字
    expect(plainLength('')).toBe(0);
  });
});

describe('estimateIntroHeight / fitIntroSize', () => {
  const size = 20;
  const maxWidth = 900;

  it('单行 ≈ 一行高；每多一行按 lineHeight 叠加', () => {
    const one = estimateIntroHeight(parseRichText('短句'), size, maxWidth);
    expect(one).toBeCloseTo(size * INTRO_LAYOUT.lineHeight, 5);
    const four = estimateIntroHeight(parseRichText('短句\n短句\n短句\n短句'), size, maxWidth);
    expect(four).toBeCloseTo(size * INTRO_LAYOUT.lineHeight * 4, 5);
  });

  it('CJK 按 1em 估：45 字 / 900px / 20px ≈ 1 行刚好放不下 → 2 行', () => {
    const text = '字'.repeat(45); // 45*20 = 900，乘 widthSafety(0.97) 后超一行 → 2 行
    expect(estimateIntroHeight(parseRichText(text), size, maxWidth)).toBeCloseTo(size * INTRO_LAYOUT.lineHeight * 2, 5);
  });

  it('块间距：标题/正文 1 个字号，相邻条目 0.25 个字号', () => {
    const heading = estimateIntroHeight(parseRichText('## 标题\n正文'), size, maxWidth);
    const tight = estimateIntroHeight(parseRichText('- 一\n- 二'), size, maxWidth);
    const oneHeading = size * INTRO_LAYOUT.headingScale * INTRO_LAYOUT.headingLineHeight;
    expect(heading).toBeCloseTo(oneHeading + size * INTRO_LAYOUT.blockGap + size * INTRO_LAYOUT.lineHeight, 5);
    expect(tight).toBeCloseTo(size * INTRO_LAYOUT.itemGap + size * INTRO_LAYOUT.lineHeight * 2, 5);
  });

  it('放得下就不收字号；放不下才收', () => {
    const short = parseRichText('短句');
    expect(fitIntroSize(short, 40, maxWidth, 500)).toBe(40);

    // 100 字在 40px / 900px 下约 5 行（≈410px）→ 预算 500 时不用收
    const medium = parseRichText('字'.repeat(100));
    expect(estimateIntroHeight(medium, 40, maxWidth)).toBeLessThan(500);
    expect(fitIntroSize(medium, 40, maxWidth, 500)).toBe(40);
    // 同样的 100 字压到 300px → 必须收字号，且收完确实放得下
    const fitted = fitIntroSize(medium, 40, maxWidth, 300);
    expect(fitted).toBeLessThan(40);
    expect(fitted).toBeGreaterThanOrEqual(Math.round(40 * INTRO_LAYOUT.minScale));
    expect(estimateIntroHeight(medium, fitted, maxWidth)).toBeLessThanOrEqual(300);
  });

  it('连下限都放不下 → 返回下限（由预算条报警"会被裁"）', () => {
    const absurd = parseRichText('字'.repeat(4000));
    const floor = Math.round(40 * INTRO_LAYOUT.minScale);
    expect(fitIntroSize(absurd, 40, maxWidth, 200)).toBe(floor);
    expect(estimateIntroHeight(absurd, floor, maxWidth)).toBeGreaterThan(200);
  });
});

describe('工具栏编辑动作', () => {
  it('wrapInline 包住选区并回填内部选区', () => {
    const out = wrapInline('看这部', 1, 3, 'bold');
    expect(out.value).toBe(`看${INLINE_MARKERS.bold}这部${INLINE_MARKERS.bold}`);
    expect(out.value.slice(out.start, out.end)).toBe('这部');
  });

  it('wrapInline 没选区时插占位文字并选中', () => {
    const out = wrapInline('开头', 2, 2, 'warn');
    expect(out.value).toBe(`开头${INLINE_MARKERS.warn}提醒文字${INLINE_MARKERS.warn}`);
    expect(out.value.slice(out.start, out.end)).toBe('提醒文字');
  });

  it('toggleLinePrefix 给当前行加标记，再点一次摘掉', () => {
    const added = toggleLinePrefix('看得爽\n有记忆点', 1, '- ');
    expect(added.value).toBe('- 看得爽\n有记忆点');
    expect(added.start).toBe(3);
    const removed = toggleLinePrefix(added.value, added.start, '- ');
    expect(removed.value).toBe('看得爽\n有记忆点');
  });

  it('toggleLinePrefix 只动光标所在那一行', () => {
    const out = toggleLinePrefix('第一行\n第二行', 8, '## ');
    expect(out.value).toBe('第一行\n## 第二行');
  });
});
