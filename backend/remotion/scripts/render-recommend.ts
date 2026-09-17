/**
 * 生产渲染入口：Java `RecommendVideoService` 调这个脚本把推荐模板渲成带原声的视频。
 *
 * 契约（Java ↔ Node）：
 *   --input   <json>   RenderInput（{template,title,subtitle,intro,media[],params}）
 *   --output  <file>   产物路径（扩展名必须与 --format 匹配）
 *   --asset-root <dir> 素材根目录（media/*.mp4、封面等；脚本内起本地 HTTP 服务，不向 Remotion 传 file://）
 *   --format  mp4|webm 默认 mp4
 *   --concurrency <n>  默认 1（POC 实测稳定值）
 *
 * 输出：成功时 stdout 打印一行 JSON 摘要（Java 解析用），失败非 0 退出并把原因写到 stderr。
 * 音频：**不做静音处理**（产物带素材原声），BGM 由 Java 侧 FFmpeg 混流。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { MultiMediaPocInput } from '../src/types';
import { startAssetServer } from './asset-server';

const projectRoot = path.resolve(import.meta.dirname, '..');
const COMPOSITION_ID = 'MultiMediaRecommendPoc';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const inputPath = argument('--input');
  const outputPath = argument('--output');
  const assetRoot = argument('--asset-root');
  const format = (argument('--format') ?? 'mp4').toLowerCase();
  const concurrency = Number(argument('--concurrency') ?? '1');

  if (!inputPath || !outputPath) throw new Error('缺少参数：--input 与 --output 必填');
  if (!assetRoot) throw new Error('缺少参数：--asset-root 必填');
  if (!['mp4', 'webm'].includes(format)) throw new Error(`不支持的格式：${format}`);

  const input = JSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8')) as MultiMediaPocInput;
  await fs.access(assetRoot);

  const assetServer = await startAssetServer(path.resolve(assetRoot));
  const renderInput: MultiMediaPocInput = { ...input, assetBaseUrl: assetServer.baseUrl };
  const startedAt = Date.now();

  try {
    const serveUrl = await bundle({ entryPoint: path.join(projectRoot, 'src', 'index.ts') });
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps: { input: renderInput } });
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await renderMedia({
      composition,
      serveUrl,
      codec: format === 'webm' ? 'vp8' : 'h264',
      outputLocation: path.resolve(outputPath),
      inputProps: { input: renderInput },
      concurrency: Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 1,
      // 不传 muted/audioCodec：保留素材原声（BGM 由 Java FFmpeg 混流）
    });
    console.log(JSON.stringify({
      ok: true,
      output: path.resolve(outputPath),
      fps: composition.fps,
      width: composition.width,
      height: composition.height,
      durationInFrames: composition.durationInFrames,
      elapsedMs: Date.now() - startedAt,
    }));
  } finally {
    await assetServer.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`渲染失败: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
