/**
 * 探针 ① 驱动：构建探针页 → 本地静态服务 → 无头 Chrome 打开 → 逐步驱动 → 打印结论。
 *
 * 用法（在 backend/remotion 下）：npm run verify:player
 *
 * 同时是**保帧回归门禁**（v0.28 阶段 3 固化）：下面断言失败即非 0 退出——
 * 「热更新 inputProps 不重置帧/不打断播放」是编辑器即时生效的全部地基，换预览实现时必须拦住。
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

  console.log('\n=== 保帧 / 热更新门禁 ===');
  console.log(JSON.stringify(results, null, 2));

  const r = results as Record<string, number>;
  const checks: [string, boolean, string][] = [
    ['seekTo 生效（帧 = 90）', r.afterSeek90 === 90, 'PlayerRef.seekTo 应精确落帧'],
    ['热更新保帧（时长不变）', r.sameDuration_frame === 90, '热更新 inputProps 不得重置当前帧'],
    ['热更新保帧（时长变长）', r.longer_frame === 90, '总长变化也不得重置帧'],
    ['缩短时长后不越界', r.shorter_frame >= 0 && r.shorter_frame <= r.shorter_duration - 1, '当前帧超出新总长时必须钳位'],
    ['播放中热更新不打断', r.playing1 === 1 && r.playing2 === 1, '热更新期间 isPlaying 应保持 true'],
    ['播放中热更新帧继续前进', r.playAdvanced === 1, '热更新后帧必须继续走'],
  ];
  let failed = 0;
  for (const [name, ok, hint] of checks) {
    console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ' —— ' + hint}`);
    if (!ok) failed += 1;
  }
  console.log(JSON.stringify({ 检查项: checks.length, 失败: failed }));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error('门禁失败:', error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
