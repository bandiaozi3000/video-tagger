/**
 * 画布 CSS **注入**的回归测试（2026-09-29）。
 *
 * 为什么单独一个文件：这里要在导入模块**之前**放一个假的 `document`，验的是"模块加载时就把样式注入 head"。
 * 之前踩的坑正是「钩子写了没人调」→ 预览渲染成没样式的散架 DOM（导出却正常，因为导出单独把 CSS 发给了后端），
 * 用户看到的就是「封面预览显示有问题」。
 */
import { describe, expect, it } from 'vitest';

interface FakeStyle { id?: string; textContent?: string }

const appended: FakeStyle[] = [];
const fakeDocument = {
  head: { appendChild: (element: FakeStyle) => { appended.push(element); } },
  createElement: (): FakeStyle => ({}),
  getElementById: () => null,
};
(globalThis as unknown as { document: unknown }).document = fakeDocument;

describe('画布样式注入', () => {
  it('模块加载即把画布 CSS 注入 head（含版式与文字层选择器）', async () => {
    await import('./CoverCanvas');   // 模块级副作用：ensureCoverCss()

    expect(appended.length).toBe(1);
    expect(appended[0].id).toBe('cv-style');
    const css = appended[0].textContent ?? '';
    expect(css).toContain('.cv-l-T01');      // 版式
    expect(css).toContain('.cv-inner');      // 裁切
    expect(css).toContain('.cv-t-ghost');    // R8 重影
    expect(css).toContain('/fonts/');        // 字体走宿主 /fonts 映射
  });
});
