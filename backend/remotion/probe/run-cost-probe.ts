/**
 * 地基探针 ②：渲染成本基线 —— bundle / 浏览器启动 / 热 still 各要多久？
 *
 * 用途：决定「时间轴缩略图」是否可行、以及「每次导出都重新 bundle」值不值得优化。
 * 输入刻意用**零素材**的合成输入（不碰封面/片段），只量框架自身开销。
 *
 * 用法（在 backend/remotion 下）：npx tsx probe/run-cost-probe.ts
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import type { MultiMediaPocInput } from '../src/types';

const projectRoot = path.resolve(import.meta.dirname, '..');
const COMPOSITION_ID = 'MultiMediaRecommendPoc';
const outDir = path.join(os.tmpdir(), 'vt-cost-probe');

const input: MultiMediaPocInput = {
  template: 'MULTI_MEDIA_RECOMMEND',
  style: 'chapter',
  title: 'cost-probe',
  media: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    mediaId: n,
    order: n,
    mode: 'INFO_ONLY' as const,
    title: `M${n}`,
    tags: ['a', 'b'],
    clips: [],
  })),
  params: { durations: { opening: 4, intro: 3, group: 3, detail: 4, ending: 3 }, bgmTracks: [] },
};

const ms = (from: number) => Math.round(performance.now() - from);

async function main(): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
  const marks: Record<string, unknown> = {};

  let t = performance.now();
  const serveUrl = await bundle({ entryPoint: path.join(projectRoot, 'src', 'index.ts') });
  marks.bundleMs = ms(t);

  t = performance.now();
  const browser = await openBrowser('chrome', { logLevel: 'error' });
  marks.browserLaunchMs = ms(t);

  try {
    t = performance.now();
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: { input }, puppeteerInstance: browser });
    marks.selectCompositionMs = ms(t);

    const stills: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const started = performance.now();
      await renderStill({
        composition,
        serveUrl,
        output: path.join(outDir, `still-${i}.png`),
        inputProps: { input },
        frame: 60,
        imageFormat: 'png',
        overwrite: true,
        puppeteerInstance: browser,
      });
      stills.push(ms(started));
    }
    marks.stillMs = stills;
    marks.stillWarmAvgMs = Math.round(stills.slice(1).reduce((a, b) => a + b, 0) / Math.max(1, stills.length - 1));
    marks.durationInFrames = composition.durationInFrames;

    // 已 bundle 的场景下再开一个浏览器要多久（对比"常驻 vs 每次重开"）
    t = performance.now();
    const second = await openBrowser('chrome', { logLevel: 'error' });
    marks.browserLaunch2Ms = ms(t);
    // renderer 的 openBrowser 返回内部包装对象，直接 close() 会抛（缺少内部选项）→ 探针里忽略
    const closable = second as unknown as { close: () => Promise<unknown> };
    await Promise.resolve(closable.close()).catch(() => undefined);
  } finally {
    const closable = browser as unknown as { close: () => Promise<unknown> };
    await Promise.resolve(closable.close()).catch(() => undefined);
  }

  console.log('\n=== 探针 ② 结果 ===');
  console.log(JSON.stringify(marks, null, 2));
}

main().catch((error: unknown) => {
  console.error('探针失败:', error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
