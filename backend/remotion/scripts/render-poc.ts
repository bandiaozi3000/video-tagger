import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { MultiMediaPocInput } from '../src/types';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pocRoot = path.join(projectRoot, 'poc');
const inputPath = path.resolve(argument('--input') || path.join(pocRoot, 'real-input.json'));
const outputPath = path.resolve(argument('--output') || path.join(pocRoot, 'output', 'multi-media-recommend-poc.mp4'));
const input = JSON.parse(await fs.readFile(inputPath, 'utf8')) as MultiMediaPocInput;
validateInput(input, pocRoot);
const assetServer = await startAssetServer(pocRoot);
const renderInput = { ...input, assetBaseUrl: assetServer.baseUrl };
const startedAt = Date.now();
try {
  const serveUrl = await bundle({ entryPoint: path.join(projectRoot, 'src', 'index.ts') });
  const composition = await selectComposition({ serveUrl, id: 'MultiMediaRecommendPoc', inputProps: { input: renderInput } });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { input: renderInput },
    concurrency: 1,
    onProgress: ({ progress }) => process.stdout.write(`\r[remotion] ${Math.round(progress * 100)}%`),
  });
  process.stdout.write('\n');
  const report = {
    input: inputPath,
    output: outputPath,
    elapsedMs: Date.now() - startedAt,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
    durationInFrames: composition.durationInFrames,
    scenes: input.media.flatMap((media) => media.clips.map((clip) => ({ mediaId: media.mediaId, clipId: clip.clipId, durationMs: clip.durationMs }))),
    mediaCount: input.media.length,
    infoOnlyCount: input.media.filter((media) => media.clips.length === 0).length,
  };
  await fs.writeFile(outputPath.replace(/\.mp4$/i, '.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await assetServer.close();
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function validateInput(input: MultiMediaPocInput, root: string): void {
  if (input.template !== 'MULTI_MEDIA_REMOTION_POC') throw new Error('POC 模板类型无效');
  const mediaIds = new Set<number>();
  const clipIds = new Set<number>();
  for (const media of input.media) {
    if (mediaIds.has(media.mediaId)) throw new Error(`媒体 ID 重复: ${media.mediaId}`);
    mediaIds.add(media.mediaId);
    if (media.mode === 'INFO_ONLY' && media.clips.length > 0) throw new Error(`INFO_ONLY 媒体包含 Clip: ${media.mediaId}`);
    for (const clip of media.clips) {
      if (clipIds.has(clip.clipId)) throw new Error(`Clip ID 重复: ${clip.clipId}`);
      clipIds.add(clip.clipId);
      if (!safePath(root, clip.assetPath)) throw new Error(`Clip 素材路径无效: ${clip.assetPath}`);
    }
    if (media.coverAssetPath) {
      const file = safePath(root, media.coverAssetPath);
      if (!file) throw new Error(`封面路径越界: ${media.coverAssetPath}`);
    }
  }
}

function safePath(root: string, relative: string): string | null {
  if (!relative || path.isAbsolute(relative)) return null;
  const file = path.resolve(root, relative);
  return file.startsWith(`${root}${path.sep}`) ? file : null;
}

async function startAssetServer(root: string): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    const relative = decodeURIComponent((request.url || '').replace(/^\/assets\/?/, ''));
    const file = safePath(root, relative);
    if (!file) { response.statusCode = 400; response.end('invalid asset path'); return; }
    try {
      const body = await fs.readFile(file);
      response.setHeader('Content-Type', contentType(file));
      response.end(body);
    } catch { response.statusCode = 404; response.end('asset not found'); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法启动 POC 资源服务');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/assets`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

function contentType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' } as Record<string, string>)[ext] || 'application/octet-stream';
}
