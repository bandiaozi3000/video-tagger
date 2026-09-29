/**
 * 画布结构单测（2026-09-29）：不测视觉，只测"每套版式到底生成了几个图格、文字在不在"。
 *
 * 为什么要它：版式是**唯一真源**（预览与导出共用这棵 DOM），少一个格子或漏了文字块，
 * 单测能当场抓到，不用等出图才发现。视觉验收另走"真渲染 20 张"（见 worklog）。
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { CoverCanvas } from './CoverCanvas';
import { defaultCoverConfig, LAYOUTS, type CoverConfig, type CoverFrame } from './cover-model';

const frames = (count: number): CoverFrame[] => Array.from({ length: count }, (_, i) => ({
  clipId: 100 + i,
  mediaId: 1,
  mediaTitle: '某番',
  clipTitle: `片段 ${i + 1}`,
  url: `/covers/clip/${100 + i}.jpg`,
}));

const config = (over: Partial<CoverConfig> = {}): CoverConfig => ({
  ...defaultCoverConfig(),
  title: '那些让人起鸡皮疙瘩的\n动漫浪漫名场面',
  subtitle: '浪漫至死不渝',
  frames: frames(9).map((f) => f.clipId),
  ...over,
});

const markup = (over: Partial<CoverConfig> = {}, count = 9) =>
  renderToStaticMarkup(<CoverCanvas config={config(over)} frames={frames(count)} />);

describe('画布结构', () => {
  it('每套版式都用到 expected 张素材，并渲染出标题', () => {
    for (const layout of LAYOUTS) {
      const html = markup({ layout: layout.id }, layout.needs);
      const srcs = new Set(html.match(/\/covers\/clip\/\d+\.jpg/g) ?? []);
      expect(srcs.size, `${layout.id} ${layout.name} 用到的素材张数`).toBe(layout.needs);
      expect(html, `${layout.id} 缺标题`).toContain('那些让人起鸡皮疙瘩的');
      expect(html, `${layout.id} 缺副标题`).toContain('浪漫至死不渝');
    }
  });

  it('网格系版式：图格数 = 张数；定制的几套走自己的容器', () => {
    const custom: Record<string, string> = {
      T08: 'cv-panel', T09: 'cv-rows', T13: 'cv-l-T13', T15: 'cv-typo-strip', T16: 'cv-viewfinder',
      T17: 'cv-exposure', T18: 'cv-circle', T20: 'cv-print',
    };
    for (const layout of LAYOUTS) {
      const html = markup({ layout: layout.id }, layout.needs);
      if (custom[layout.id]) {
        expect(html, `${layout.id} 缺容器 ${custom[layout.id]}`).toContain(custom[layout.id]);
      } else {
        expect(html.split('class="cv-cell"').length - 1, `${layout.id} 图格数`).toBe(layout.needs);
      }
    }
  });

  it('张数不够时自动降级：不会出现"空"格', () => {
    const html = markup({ layout: 'T07' }, 2);   // 九宫格但只有 2 张
    expect(html).not.toContain('cv-missing');
    expect(html).toContain('cv-l-T12');          // 降到二联
  });

  it('一张都没有时画“去勾片段”的提示，不留空画布', () => {
    const html = markup({ layout: 'T01', frames: [] }, 0);
    expect(html).toContain('cv-missing');
    expect(html).toContain('勾选片段封面');
  });

  it('R8 双层重影：标题画两遍（本体 + 错位重影）', () => {
    const html = markup({ effect: 'r8', ghostOffset: 4 });
    expect(html.split('cv-t-title').length - 1).toBe(2);
    expect(html).toContain('cv-t-ghost');
    expect(html).toContain('translate(4px, 4px)');
  });

  it('重影偏移 0 = 关掉重影，只画一遍', () => {
    const html = markup({ effect: 'r8', ghostOffset: 0 });
    expect(html).not.toContain('cv-t-ghost');
  });

  it('位置九宫 + 对齐 + 微调都进 DOM', () => {
    const html = markup({ anchor: 'top-right', align: 'right', offsetX: 30, offsetY: -40 });
    expect(html).toContain('cv-a-top-right');
    expect(html).toContain('cv-al-right');
    expect(html).toContain('--cv-x:30px');
    expect(html).toContain('--cv-y:-40px');
  });

  it('上下夹字把标题与副标题拆到两端', () => {
    const html = markup({ layout: 'T10', anchor: 'top-left' }, 1);
    expect(html).toContain('cv-a-top-left');
    expect(html).toContain('cv-a-bottom-left');
  });

  it('强调色写进 CSS 变量（纯色栏与重影都用它）', () => {
    expect(markup({ accent: '#2F2673' })).toContain('--cv-accent:#2F2673');
  });
});
