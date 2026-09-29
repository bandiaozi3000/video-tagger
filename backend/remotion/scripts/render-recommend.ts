/**
 * 生产渲染入口：Java `RecommendVideoService` 调这个脚本把推荐模板渲成**带原声与 BGM 的成品**。
 *
 * 契约（Java ↔ Node）：
 *   --input   <json>   RenderInput（{template,style,title,subtitle,intro,media[],params}）
 *   --output  <file>   产物路径（扩展名必须与 --format 匹配）
 *   --asset-root <dir> 素材根目录（media/*.mp4、封面、BGM；脚本内起本地 HTTP 服务，不向 Remotion 传 file://）
 *   --format  mp4|webm 默认 mp4
 *   --concurrency <n>  默认 2（导出队列本身单线程串行，机器不会被任务叠加打满）
 *   --frames <a-b>     只渲这一段（含两端；分块续渲用）
 *   --probe            只探合成信息（总帧数/fps/尺寸）并打印，不渲染（Java 用它规划分块）
 *
 * 输出：成功时 stdout 打印一行 JSON 摘要（Java 解析用），失败非 0 退出并把原因写到 stderr。
 * 音频：**不做静音处理**——素材原声由 `<OffthreadVideo>` 提供，BGM 由 `<Audio>` 在 Remotion 内混入，
 *       Java 侧不再需要 FFmpeg concat / amix 混流（设计规格 §7）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { MultiMediaPocInput } from '../src/types';
import { buildCinemaPlan } from '../src/cinema/plan';
import { buildScenePlan } from '../src/scene-plan';
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
  // 封面根（2026-09-27）：封面以根相对 `/covers/**` 出现在 props 里（与浏览器预览同一套路径），
  // 由本地素材服务托管。不传 = 不挂载（旧的 POC/单跑脚本仍可用）。
  const coversRoot = argument('--covers-root');
  const format = (argument('--format') ?? 'mp4').toLowerCase();
  const concurrency = Number(argument('--concurrency') ?? '2');
  const framesArg = argument('--frames');
  // 光栅后端（2026-09-21 实测）：Windows 上 angle(D3D11) 比默认 swiftshader 快约 17%
  // （交替 3 轮中位：175 → 146 ms/帧，方向每轮一致）。代价：光栅后端不同 → 像素有极小差异
  // （同帧 PSNR 43.7dB，视觉无感但**不是逐位一致**），介意就 RENDER_GL=swiftshader 退回。
  const gl = (process.env.RENDER_GL ?? 'angle') as 'angle' | 'egl' | 'swiftshader' | 'swangle';
  const probeOnly = process.argv.includes('--probe');

  if (!inputPath || !outputPath) throw new Error('缺少参数：--input 与 --output 必填');
  if (!assetRoot) throw new Error('缺少参数：--asset-root 必填');
  if (!['mp4', 'webm'].includes(format)) throw new Error(`不支持的格式：${format}`);

  const input = JSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8')) as MultiMediaPocInput;
  await fs.access(assetRoot);
  // props 体积看守（2026-09-27）：内联 base64 封面曾把 props 推到 119MB → Chrome 直接 Target closed，
  // 而报错里只有一句 CDP 异常、看不出真因。这行 warn 让下次一眼可见（正常 path 模式只有 1~2MB）。
  {
    const bytes = (await fs.stat(path.resolve(inputPath))).size;
    if (bytes > 32 * 1024 * 1024) {
      console.log(JSON.stringify({ warn: `inputProps 过大（${(bytes / 1048576).toFixed(1)}MB）—— 极可能撑死 Chrome（Target closed），检查封面是否又被内联成 base64` }));
    }
  }

  // 形态选合成：银幕式走新 composition，其余沿用旧 composition（旧链路不动）
  const compositionId = input.style === 'cinema' ? 'MultiMediaRecommendCinema' : COMPOSITION_ID;
  const assetServer = await startAssetServer(path.resolve(assetRoot), coversRoot ? path.resolve(coversRoot) : undefined);
  /**
   * 根相对封面（`/covers/**`）必须写成**素材服务的绝对地址**：Remotion 的页面挂在它**自己内部的 server** 上
   * （端口随机），`/covers/...` 会打到那个 server → 404。
   * 以前靠「封面内联 base64」绕开这个问题，代价是 props 膨胀到 119MB → Chrome 直接挂（2026-09-27）。
   */
  const assetOrigin = new URL(assetServer.baseUrl).origin;
  const renderInput: MultiMediaPocInput = {
    ...input,
    assetBaseUrl: assetServer.baseUrl,
    media: input.media.map((media) => (media.coverAssetPath && media.coverAssetPath.startsWith('/covers/')
      ? { ...media, coverAssetPath: assetOrigin + media.coverAssetPath }
      : media)),
  };
  const startedAt = Date.now();

  try {
    const serveUrl = await bundle({ entryPoint: path.join(projectRoot, 'src', 'index.ts') });
    const composition = await selectComposition({ serveUrl, id: compositionId, inputProps: { input: renderInput } });
  // 合成信息先打一行：Java 靠它规划分块（--probe 时只做这一步）
  const frameRange: [number, number] | undefined = framesArg
    ? (framesArg.split('-').map((v) => Number(v.trim())) as [number, number])
    : undefined;
  // 段边界帧：Java 按“段边界 + 目标块长”贪心切块，让切点落在转场处而不是片子中间。
  // 用与渲染同一份 plan（同一输入 → 时长确定，seed 只影响摆位不影响时长）→ 边界与成片一致。
  // 2026-09-27：**章节式也补上**（之前在只有银幕式分支 → 章节式只能按固定 2 分钟切，切点可能把一个章节/片段拦腰截断）。
  let boundaryFrames: number[] | null = null;
  const plan = input.style === 'cinema' ? buildCinemaPlan(renderInput) : buildScenePlan(renderInput);
  if (plan.durationInFrames !== composition.durationInFrames) {
    console.log(JSON.stringify({ warn: 'plan 与 composition 总帧数不一致', plan: plan.durationInFrames, composition: composition.durationInFrames }));
  }
  boundaryFrames = [0, ...plan.scenes.map((scene) => scene.fromFrame + scene.durationInFrames)];
  console.log(JSON.stringify({ composition: true, durationInFrames: composition.durationInFrames, fps: composition.fps, width: composition.width, height: composition.height, range: frameRange ?? null, boundaryFrames }));
  if (probeOnly) return;
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    // 进度上报（2026-09-20）：每 ~4s 一行 `[progress] {...}`，Java 解析后写进导出任务 → UI 能显示百分比与预计剩余。
    // 用短键 + 单行 JSON，纯正则即可解析（Java 侧不为此引入 JSON 依赖）。
    let lastProgressAt = 0;
    await renderMedia({
      composition,
      serveUrl,
      // enforceAudioTrack：**必须**。没有音频内容的块（例如全静音的开场）本来不会生成音轨，
      // 而 `-c copy` 拼接按流索引对齐 → 少一条音轨会让整段拼接丢音频（2026-09-21 spike 实测）。
      enforceAudioTrack: true,
      chromiumOptions: { gl },
      // 关掉 Remotion 自带的进度条：它用回车刷新、不带换行，会跟我们的上报行挤在同一行
      // （Java 把 stderr 也并进 stdout），导致进度解析不到（2026-09-20 实测踩到）。warn 级仍保留真正的问题日志。
      logLevel: 'warn',
      onProgress: ({ progress, renderedFrames, encodedFrames }) => {
        const now = Date.now();
        if (now - lastProgressAt < 4000) return;
        lastProgressAt = now;
        console.log(JSON.stringify({ progress: Math.round(progress * 1000) / 1000, frames: renderedFrames, encoded: encodedFrames, ms: now - startedAt }));
      },
      codec: format === 'webm' ? 'vp8' : 'h264',
      outputLocation: path.resolve(outputPath),
      inputProps: { input: renderInput },
      concurrency: Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 2,
      // 显式编码参数：默认值对 1080P 偏慢/偏大，这里固定成"质量够、体积稳"的组合
      crf: format === 'webm' ? undefined : 18,
      pixelFormat: 'yuv420p',
      // 显式 bt709：Remotion 4.x 的 colorSpace 默认 "default" = 全范围 yuvj420p，
      // 会被播放器/平台当成 limited 解读 → 偏暗偏灰（且与自家素材 bt709 不一致）。
      colorSpace: 'bt709',
      x264Preset: format === 'webm' ? undefined : 'veryfast',
      audioCodec: format === 'webm' ? 'opus' : 'aac',
      audioBitrate: '192k',
      frameRange,
      // 不传 muted：保留素材原声 + 内建 BGM
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
