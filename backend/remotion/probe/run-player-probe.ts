/**
 * 探针 ① 驱动：构建探针页 → 本地静态服务 → 无头 Chrome 打开 → 逐步驱动 → 打印结论。
 *
 * 用法（在 backend/remotion 下）：npx tsx probe/run-player-probe.ts
 */
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'vite';

/** 复用旧链路（backend/scripts）里已装好的 puppeteer；浏览器用系统 Chrome（application.yml 同款路径）。 */
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const requireFromScripts = createRequire(path.join(repoRoot, 'backend', 'scripts', 'package.json'));
const puppeteer = requireFromScripts('puppeteer-core') as {
  launch: (options: Record<string, unknown>) => Promise<{
    newPage: () => Promise<any>;
    close: () => Promise<void>;
  }>;
};
const CHROME = process.env.RENDER_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const outDir = path.join(os.tmpdir(), 'vt-probe-dist');
const configFile = path.resolve(import.meta.dirname, 'vite.probe.config.ts');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
};

const results: Record<string, unknown> = {};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  console.log('· 构建探针页…');
  await build({ configFile, logLevel: 'error' });
  const page = path.join(outDir, 'probe', 'player.html');
  await fs.access(page);

  const server = http.createServer(async (request, response) => {
    const rel = decodeURIComponent((request.url || '/').split('?')[0]);
    const file = path.join(outDir, rel === '/' ? '/probe/player.html' : rel);
    try {
      const body = await fs.readFile(file);
      response.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
      response.end(body);
    } catch {
      response.statusCode = 404;
      response.end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  try {
    const tab = await browser.newPage();
    const logs: string[] = [];
    tab.on('pageerror', (error: Error) => logs.push(`pageerror: ${error.message}`));
    tab.on('console', (message: { type: () => string; text: () => string }) => {
      if (message.type() === 'error') logs.push(`console: ${message.text()}`);
    });

    await tab.goto(`${base}/probe/player.html`, { waitUntil: 'load' });
    await tab.waitForFunction('window.__probe && window.__probe.ready === true', { timeout: 30000 });

    const read = (expression: string) => tab.evaluate(expression) as Promise<number>;

    // 1. seek 后是否停在目标帧
    await tab.evaluate('window.__probe.seekTo(90)');
    await sleep(250);
    results.afterSeek90 = await read('window.__probe.current()');
    results.durationBaseline = await read('window.__probe.duration()');

    // 2. 热更新 inputProps（时长不变）
    await tab.evaluate("window.__probe.setVariant('same-duration')");
    await sleep(400);
    results.sameDuration_frame = await read('window.__probe.current()');
    results.sameDuration_duration = await read('window.__probe.duration()');

    // 3. 热更新为更长时长
    await tab.evaluate("window.__probe.setVariant('longer')");
    await sleep(400);
    results.longer_frame = await read('window.__probe.current()');
    results.longer_duration = await read('window.__probe.duration()');

    // 4. 边界：先 seek 到接近末尾，再改成更短时长（当前帧超出新总长）
    await tab.evaluate("window.__probe.setVariant('longer')");
    await sleep(200);
    await tab.evaluate('window.__probe.seekTo(window.__probe.duration() - 5)');
    await sleep(250);
    results.nearEndBefore = await read('window.__probe.current()');
    await tab.evaluate("window.__probe.setVariant('shorter')");
    await sleep(400);
    results.shorter_frame = await read('window.__probe.current()');
    results.shorter_duration = await read('window.__probe.duration()');

    // 5. 播放中热更新：先给一次真实点击手势（autoplay 策略），再播放
    await tab.evaluate('window.__probe.seekTo(60)');
    await tab.mouse.click(320, 200);
    await sleep(300);
    await tab.evaluate('window.__probe.play()');
    await sleep(600);
    results.playing1 = await read('window.__probe.playing() ? 1 : 0');
    const frameDuringPlay = await read('window.__probe.current()');
    await tab.evaluate("window.__probe.setVariant('same-duration')");
    await sleep(600);
    results.playing2 = await read('window.__probe.playing() ? 1 : 0');
    const frameAfterHotSwap = await read('window.__probe.current()');
    results.playAdvanced = frameAfterHotSwap > frameDuringPlay ? 1 : 0;
    results.frameDuringPlay = frameDuringPlay;
    results.frameAfterHotSwap = frameAfterHotSwap;

    results.pageErrors = logs.slice(0, 5);
  } finally {
    await browser.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n=== 探针 ① 结果（current() = 当前帧号，-1 表示 ref 不可用）===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error: unknown) => {
  console.error('探针失败:', error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
