/**
 * 探针驱动：跑 `probe/fps-probe.tsx`，回答「编辑器预览到底满不满帧」。
 *
 * 用法（在 backend/remotion 下）：
 *   npm run probe:fps                      # 无头 Chrome，自动播 12 秒后打印结论
 *   PROBE_HEADED=1 npm run probe:fps       # 开真窗口自己看（会多留 20 秒）
 *   PROBE_SECONDS=20 PROBE_WIDTH=3840 PROBE_HEIGHT=2160 npm run probe:fps   # 换分辨率/时长
 *
 * 判据（脚本会直接给结论）：
 *   · raf ≈ 目标帧率   → 预览真满帧 → 导出慢只能归因于"物理实现差异"（满像素光栅/软件渲染/逐帧抽帧/编码）
 *   · raf 远低于目标   → 预览在丢帧（看着流畅是假象）→ 用户"我看得完"的前提不成立
 */
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'vite';
import { startAssetServer } from '../scripts/asset-server';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const requireFromScripts = createRequire(path.join(repoRoot, 'backend', 'scripts', 'package.json'));
const puppeteer = requireFromScripts('puppeteer-core') as {
  launch: (options: Record<string, unknown>) => Promise<{
    newPage: () => Promise<any>;
    close: () => Promise<void>;
  }>;
};
const CHROME = process.env.RENDER_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const HEADED = process.env.PROBE_HEADED === '1';
const SECONDS = Number(process.env.PROBE_SECONDS ?? '12');
const WIDTH = Number(process.env.PROBE_WIDTH ?? '1280');
const HEIGHT = Number(process.env.PROBE_HEIGHT ?? '720');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface FpsReport {
  seconds: number;
  rafTicks: number;
  rafFps: number;
  compRenders: number;
  compRendersPerSecond: number;
  cursorFrom: number;
  cursorTo: number;
  cursorFps: number;
  targetFps: number;
  coverage: number;
  longTasks: number;
  longTaskMs: number;
  gpuRenderer: string;
}

async function main(): Promise<void> {
  const outDir = path.join(os.tmpdir(), 'vt-fps-probe-dist');
  await build({ configFile: path.resolve(import.meta.dirname, 'vite.fps.config.ts') });
  await fs.access(path.join(outDir, 'probe', 'fps.html'));

  const assetServer = await startAssetServer(path.resolve(import.meta.dirname, '..', 'poc'));
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const file = path.join(outDir, url.pathname);
    try {
      const body = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  // 有头模式：不传 --disable-gpu，并显式打开 GPU 光栅（要测的就是"真实绘制"这条路径）
  // 自动播放策略：不再依赖"点一下播放器"的手势（视口一变点击坐标就可能点空 → 测出 0 帧的假数据）
  const args = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
  if (HEADED) {
    args.push('--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-gpu', '--window-size=1600,1000');
  }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: !HEADED, args });
  try {
    const tab = await browser.newPage();
    // 视口可调：把预览按 1:1 显示（例如 4K 合成 + 3840 视口）→ 用来验证“光栅像素数决定成本”
    const viewport = (process.env.PROBE_VIEWPORT ?? "1280x820").split("x").map(Number);
    await tab.setViewport({ width: viewport[0] ?? 1280, height: viewport[1] ?? 820 });
    const errors: string[] = [];
    tab.on('pageerror', (error: Error) => errors.push(`pageerror: ${error.message}`));

    const query = `?assets=${encodeURIComponent(assetServer.baseUrl)}&width=${WIDTH}&height=${HEIGHT}&seconds=${SECONDS}`;
    await tab.goto(`${base}/probe/fps.html${query}`, { waitUntil: 'load' });
    await tab.waitForFunction('window.__fpsProbe && window.__fpsProbe.ready === true', { timeout: 30000 });

    await tab.evaluate('window.__fpsProbe.seek(0)');
    await sleep(200);
    await tab.evaluate('window.__fpsProbe.start()');
    // 起播自检：没起来就直接判失败，绝不让"0 帧"冒充测量结果
    await sleep(1500);
    const started = (await tab.evaluate('window.__fpsProbe.report()')) as FpsReport;
    if (started.cursorFps < 1) {
      throw new Error(`播放没起来（1.5s 内光标只走了 ${started.cursorFps} 帧/秒）→ 测量无效，检查自动播放策略`);
    }

    // 滚动打印，便于无头模式观察
    const ticks = Math.max(1, Math.floor(SECONDS / 3));
    for (let i = 1; i <= ticks; i++) {
      await sleep((SECONDS * 1000) / ticks);
      const partial = (await tab.evaluate('window.__fpsProbe.report()')) as FpsReport;
      console.log(
        `  ${partial.seconds.toFixed(1)}s  raf ${partial.rafFps}/s · 合成渲染 ${partial.compRendersPerSecond}/s · 光标 ${partial.cursorFps}/s`,
      );
    }
    const report = (await tab.evaluate('window.__fpsProbe.report()')) as FpsReport;

    console.log('\n=== 预览帧率探针 ===');
    console.log(JSON.stringify({ 分辨率: `${WIDTH}x${HEIGHT}`, ...report }, null, 2));

    const coverage = report.coverage;
    const verdict =
      coverage >= 0.9
        ? `预览基本满帧（达成 ${(coverage * 100).toFixed(0)}%）→ 导出慢应归因于物理实现差异（满像素光栅/软件渲染/逐帧抽帧/编码）`
        : `预览在丢帧（只达成 ${(coverage * 100).toFixed(0)}% 的 ${report.targetFps}fps）→ "看得完"是浏览器丢帧造成的假象`;
    console.log(`\n判定：${verdict}`);
    console.log(`raf 实测 ${report.rafFps}/s（这是"真能画"的上限；合成渲染 ${report.compRendersPerSecond}/s）`);
    console.log(`长任务 ${report.longTasks} 次 / 累计 ${report.longTaskMs}ms` + (report.longTasks === 0 ? "（= 主线程几乎没被阻塞；无头环境常见，说明没真在画）" : "（= 真的在做重活）"));
    console.log(`GPU 渲染器：${report.gpuRenderer}`);
    if (errors.length > 0) {
      console.log(`页面错误：${errors.slice(0, 3).join(' | ')}`);
    }
    if (HEADED) {
      console.log('\n（开了窗口：20 秒后自动关闭，页面上也有一行实时数字可看）');
      await sleep(20000);
    }
  } finally {
    await browser.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await assetServer.close();
  }
}

main().catch((error: unknown) => {
  console.error('探针失败:', error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
