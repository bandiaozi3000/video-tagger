/**
 * v0.32 统计视频渲染入口（Java `StatsTrendVideoService` 调本脚本）。
 *
 * 契约（Java ↔ Node）：
 *   --input   <json>  TrendVideoInput（{title,chartType,secPerYear,holdSec,years,lines[],refs[]}）
 *   --output  <file>  产物路径（默认 mp4）
 *   --format  mp4|webm
 *   --concurrency <n> 默认 2
 *   --probe           只探合成信息（总帧数/fps/尺寸）并打印，不渲染
 *
 * 输出：stdout 逐行 JSON —— 探帧一行、渲染进度若干行、成功一行；失败非 0 退出，原因写 stderr。
 *
 * 与 render-recommend.ts 的差别（**刻意**）：统计视频**无音轨、无素材**（封面用 Bangumi 远程 URL），
 * 所以不起本地素材服务、不做分块/增量/块键 —— 那些是推荐视频导出队列才需要的复杂度。
 */
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { TREND_FPS, type TrendVideoInput } from '../src/trend/params';

const COMPOSITION_ID = 'MediaTrend';

/**
 * 要一个**真的空闲**的端口。
 *
 * 为什么必须显式传：Remotion 找不到 desiredPort 时会去扫 **3000–3100**，而本机（2026-10-04 实测）
 * `netsh interface ipv4 show excludedportrange protocol=tcp` 显示 **2952–3051 / 3052–3151 两段被
 * Windows 排除**（Hyper-V/WSL/Docker 预留）→ 该区间所有端口 `EACCES` → Remotion 直接抛
 * `No available ports found`，渲染一行都跑不起来。传一个区间外的端口就绕过了。
 */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const inputPath = argument('--input');
  const outputPath = argument('--output');
  const format = (argument('--format') ?? 'mp4').toLowerCase();
  const concurrency = Number(argument('--concurrency') ?? '2');
  const probeOnly = process.argv.includes('--probe');
  if (!inputPath || !outputPath) throw new Error('缺少参数：--input 与 --output 必填');
  if (!['mp4', 'webm'].includes(format)) throw new Error(`不支持的格式：${format}`);

  const input = JSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8')) as TrendVideoInput;
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const startedAt = Date.now();

  const serveUrl = await bundle({ entryPoint: path.join(projectRoot, 'src', 'index.ts') });
  const composition = await selectComposition({
    serveUrl, id: COMPOSITION_ID, inputProps: input as unknown as Record<string, unknown>,
    port: await freePort(),
  });
  console.log(JSON.stringify({
    composition: true,
    durationInFrames: composition.durationInFrames,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
    years: (input.years ?? []).length,
    lines: (input.lines ?? []).length,
  }));
  if (probeOnly) return;

  await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
  let lastProgressAt = 0;
  await renderMedia({
    composition,
    serveUrl,
    logLevel: 'warn',   // 关掉 Remotion 自带的回车进度条（会把我们的单行 JSON 挤成同一行）
    enforceAudioTrack: false,   // 统计视频没有音轨：不强塞空音轨
    onProgress: ({ progress, renderedFrames }) => {
      const now = Date.now();
      if (now - lastProgressAt < 4000) return;
      lastProgressAt = now;
      console.log(JSON.stringify({ progress: Math.round(progress * 1000) / 1000, frames: renderedFrames, ms: now - startedAt }));
    },
    codec: format === 'webm' ? 'vp8' : 'h264',
    outputLocation: path.resolve(outputPath),
    inputProps: input as unknown as Record<string, unknown>,
    port: await freePort(),
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 2,
    crf: format === 'webm' ? undefined : 18,
    pixelFormat: 'yuv420p',
    colorSpace: 'bt709',
    x264Preset: format === 'webm' ? undefined : 'veryfast',
    muted: true,
  });
  console.log(JSON.stringify({
    ok: true,
    output: path.resolve(outputPath),
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
    durationInFrames: composition.durationInFrames,
    fpsExpected: TREND_FPS,
    elapsedMs: Date.now() - startedAt,
  }));
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
