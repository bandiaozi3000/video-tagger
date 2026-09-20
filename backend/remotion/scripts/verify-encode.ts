/**
 * 编码与色彩门禁（v0.28 新增）：产物的像素格式 / 色彩范围 / 色彩矩阵必须符合预期。
 *
 * 为什么要有这一条：v0.27 之前的导出实测是 `yuvj420p(pc, bt470bg/unknown/unknown)`——
 * **全范围且无标注**，与自家素材（`yuv420p(tv, bt709)`）不一致，分享出去容易被播放器解读成偏暗偏灰。
 * 根因是 Remotion 4.x 的 `colorSpace` 默认 `"default"`（= 全范围）；只写 `pixelFormat` 解决不了 range。
 *
 * 做法：只渲 15 帧（无需素材的合成输入）→ 用 ffmpeg/ffprobe 读出流信息 → 断言。
 * 用法：cd backend/remotion && npm run verify:encode
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import type { MultiMediaPocInput } from '../src/types';

const projectRoot = path.resolve(import.meta.dirname, '..');
const COMPOSITION_ID = 'MultiMediaRecommendPoc';

/** 零素材输入：只量编码参数，不牵封面/片段，避免把素材问题混进来。 */
const input: MultiMediaPocInput = {
  template: 'MULTI_MEDIA_RECOMMEND',
  style: 'chapter',
  title: 'encode-gate',
  media: [1, 2].map((n) => ({
    mediaId: n,
    order: n,
    mode: 'INFO_ONLY' as const,
    title: `M${n}`,
    tags: [],
    clips: [],
  })),
  params: { durations: { opening: 2, intro: 1, group: 1, detail: 1, ending: 1, title: 2 }, bgmTracks: [] },
};

function ffmpegPath(): string {
  const candidates = [
    process.env.RENDER_FFMPEG_PATH,
    path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.local', 'ffmpeg', 'bin', 'ffmpeg.exe'),
    'ffmpeg',
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-version'], { encoding: 'utf8' });
    if (probe.status === 0) return candidate;
  }
  throw new Error('找不到 ffmpeg（可用 RENDER_FFMPEG_PATH 指定）');
}

async function main(): Promise<void> {
  const outDir = path.join(os.tmpdir(), 'vt-encode-gate');
  await fs.mkdir(outDir, { recursive: true });
  const output = path.join(outDir, 'encode-gate.mp4');

  const serveUrl = await bundle({ entryPoint: path.join(projectRoot, 'src', 'index.ts') });
  const browser = await openBrowser('chrome', { logLevel: 'error' });
  try {
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: { input }, puppeteerInstance: browser });
    await renderMedia({
      composition,
      serveUrl,
      inputProps: { input },
      codec: 'h264',
      outputLocation: output,
      frameRange: [0, 14],
      pixelFormat: 'yuv420p',
      colorSpace: 'bt709',
      crf: 18,
      x264Preset: 'veryfast',
      audioCodec: 'aac',
      audioBitrate: '192k',
      puppeteerInstance: browser,
      overwrite: true,
    });
  } finally {
    // @remotion/renderer 的 openBrowser 返回内部包装对象，close() 可能挂住 → 不阻塞门禁退出
    await Promise.race([
      Promise.resolve((browser as unknown as { close: () => Promise<unknown> }).close()).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }

  const info = spawnSync(ffmpegPath(), ['-hide_banner', '-i', output], { encoding: 'utf8' });
  const text = `${info.stderr ?? ''}${info.stdout ?? ''}`;
  const stream = text.split(/\R/).find((line) => line.includes('Video:')) ?? '';
  console.log(`· 产物流信息: ${stream.trim()}`);

  const checks: [string, boolean, string][] = [
    ['像素格式 yuv420p（非 yuvj420p 全范围）', /Video:\s*h264[^(]*\(?.*\byuv420p\b/.test(stream) && !/yuvj420p/.test(stream), 'pixelFormat + colorSpace 需同时生效'],
    ['色彩范围 limited（tv）', /\btv\b/.test(stream), 'colorSpace: bt709 应产出 limited range'],
    ['色彩矩阵 bt709', /bt709/.test(stream), 'colorSpace: bt709 应标注 bt709'],
  ];
  let failed = 0;
  for (const [name, ok, hint] of checks) {
    console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ` —— ${hint}`}`);
    if (!ok) failed += 1;
  }
  console.log(JSON.stringify({ 检查项: checks.length, 失败: failed, 产物: output }));
  // 显式退出：渲染器遗留的句柄会让事件循环不归零（见 finally 注释）
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error('编码门禁失败:', error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
