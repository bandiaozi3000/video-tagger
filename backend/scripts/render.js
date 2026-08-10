/**
 * 渲染推荐番剧 HTML → MP4 视频。
 *
 * 原理：puppeteer-core 连系统 Chrome（headless），以 CDP `Page.startScreencast`
 * 按浏览器真实合成节奏抓 JPEG 帧（每帧带时间戳），页面以 ?record=1 进入录制模式
 * （忽略交互打断、自动导览全程播放），录满指定时长后 stop，用 ffmpeg 按每帧真实
 * 时间戳（concat demuxer）合成 H.264 MP4。帧率无需手工指定——按时间戳还原真实节奏。
 *
 * 用法：
 *   node render.js --html <file.html> --out <out.mp4> --width <w> --height <h>
 *                  --duration <seconds> --chrome <chromePath> --ffmpeg <ffmpegPath>
 *
 * 退出码：0 成功；非 0 失败（stderr 含原因摘要）。
 */
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function fail(msg) {
  console.error('[render] ' + msg);
  process.exit(1);
}

const htmlPath = arg('--html');
const outPath = arg('--out');
const width = arg('--width');
const height = arg('--height');
const duration = parseFloat(arg('--duration'));
const format = (arg('--format') || 'mp4').toLowerCase();
const chromePath = arg('--chrome');
const ffmpegPath = arg('--ffmpeg');
// 抓帧 JPEG 质量：82 在 1080P 下编码偏慢拖低推帧率（实测 54.7fps 且负载高时掉到 38），
// 降到 70 加快编码换取更稳的帧率，画面由后续编码器保证（原图即内容，JPEG 只是中间帧）
const quality = parseInt(arg('--quality') || '70', 10);
const bgmPath = arg('--bgm'); // 可选：背景音乐文件（循环混入音轨，-stream_loop -1）

if (!htmlPath || !outPath || !width || !height || !(duration > 0) || !chromePath || !ffmpegPath) {
  fail('参数缺失：--html/--out/--width/--height/--duration/--chrome/--ffmpeg');
}
if (format !== 'mp4' && format !== 'webm') {
  fail('未知格式：' + format + '（可选 mp4/webm）');
}

/**
 * 渲染分辨率降档：headless Chrome 直接渲染 + 抓帧超大分辨率（如 3840×2160）时，
 * 合成 + JPEG 编码开销太大，实测推帧率掉到 ~19fps（视频卡顿）。视口与抓帧统一
 * 降到 ≤1920 宽（推帧率回到 ~55fps），再由 ffmpeg 放大到输出分辨率。
 * 模板按 vw 等比布局，视口降低仅影响像素密度、不影响画面比例。
 */
const outW = parseInt(width, 10);
const CAPTURE_MAX_W = 1920;
let captureW = outW, captureH = parseInt(height, 10);
let upscale = false;
if (outW > CAPTURE_MAX_W) {
  const k = CAPTURE_MAX_W / outW;
  captureW = CAPTURE_MAX_W;
  captureH = Math.round(parseInt(height, 10) * k);
  upscale = true;
}

/** 按输出格式选 ffmpeg 编码参数（mp4=h264，webm=vp9 恒定画质）。 */
function encodeArgs(fmt, out) {
  if (fmt === 'webm') {
    // crf 28 比 32 码率高约 40%，快速运动（轨道自转）少块状伪影，播放观感更顺
    return ['-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', '-row-mt', '1', '-cpu-used', '2'];
  }
  // crf 20（默认 23 上提一档）：霓虹渐变 + 模糊背景低码率易糊，提档保画质
  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart'];
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-render-'));
let exitCode = 0;

(async () => {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // 不能加 --disable-gpu：Windows 软件合成会把超大 viewport 宽高按 0.75 压缩
        // （1920→1440），必须走 GPU/系统合成才能原尺寸输出
        '--mute-audio',
        '--hide-scrollbars',
        '--force-color-profile=srgb',
        '--force-device-scale-factor=1',
        '--window-size=' + captureW + ',' + captureH,
        '--disable-dev-shm-usage',
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: captureW, height: captureH, deviceScaleFactor: 1 });
    await page.setDefaultNavigationTimeout(60 * 1000);

    const cdp = await page.createCDPSession();
    await cdp.send('Page.enable');

    // 流式写帧：边收边写盘，内存 O(1)。原实现把全部帧 base64 缓存内存数组、
    // 最后才写盘——素材多/视频长时（上百万字节/帧 × 上万帧）会撑爆 node 堆（退出码 134 OOM）。
    const base = path.join(tmpDir, 'f');
    let frameCount = 0;
    let firstTs = null, lastTs = null;
    cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
      try {
        if (firstTs === null) firstTs = metadata.timestamp;
        lastTs = metadata.timestamp;
        fs.writeFileSync(base + '-' + String(frameCount).padStart(5, '0') + '.jpg',
          Buffer.from(data, 'base64'));
        frameCount++;
      } catch (e) {
        // 单帧写盘失败不致命：继续收帧，最后帧数不足会报错
      }
      // ack 尽快，避免 Chrome 暂停推帧
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });

    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality,
      maxWidth: captureW,
      maxHeight: captureH,
      everyNthFrame: 1,
    });

    await page.goto('file://' + htmlPath.replace(/\\/g, '/') + '?record=1', {
      waitUntil: 'load',
      timeout: 60 * 1000,
    });

    // 等首帧（页面开始合成）再计时长
    const t0 = Date.now();
    while (frameCount === 0 && Date.now() - t0 < 30 * 1000) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (frameCount === 0) {
      throw new Error('未捕获到任何页面帧（30s 超时）');
    }

    // 录制：以模板导览真正结束为准（模板 finishAuto 设 data-tour-ended 标记），
    // duration+120s 仅作兜底上限（防模板异常卡死）。结尾为分组连续滚动（耗时随组数自适应，后端无法精确算），
    // 故兜底放宽到 120s；正常由 data-tour-ended（滚到底 + ENDING_SEC）提前停止。
    const startedAt = firstTs;
    const deadline = Date.now() + (duration + 120) * 1000;
    while (Date.now() < deadline) {
      if (frameCount > 0) {
        const done = await page.evaluate(
          () => document.documentElement.dataset.tourEnded === '1').catch(() => false);
        if (done) break;
      }
      await new Promise(r => setTimeout(r, 150));
    }
    await cdp.send('Page.stopScreencast');
    await new Promise(r => setTimeout(r, 200));

    if (frameCount < 2) {
      throw new Error('有效帧不足: ' + frameCount);
    }

    // 帧已流式写盘，固定帧率合成（CFR）：fps = 帧数 / 实际录制时长（含闪回动画），总时长精确匹配导览。
    // 不用 concat demuxer——其 duration 语义对末帧处理不可控，帧稀疏时会拉长总时长。
    const fps = frameCount / Math.max(0.1, (lastTs - firstTs)); // 还原录制真实帧率（约 60fps）

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    // 抓帧降档时放大回输出分辨率（bicubic 平滑）；同尺寸直接 yuv420p
    const vf = upscale
      ? 'scale=' + outW + ':' + height + ':flags=bicubic,format=yuv420p'
      : 'format=yuv420p';

    const ffmpegArgs = [
      '-y',
      '-framerate', fps.toFixed(4),
      '-start_number', '0',
      '-i', base + '-%05d.jpg',
    ];
    if (bgmPath) {
      // BGM 循环到结束（-stream_loop -1 为输入选项，须紧跟输入）；mp4 用 aac、webm 用 libopus
      ffmpegArgs.push('-stream_loop', '-1', '-i', bgmPath);
    }
    ffmpegArgs.push('-vf', vf, ...encodeArgs(format, outPath));
    if (bgmPath) {
      ffmpegArgs.push('-c:a', format === 'webm' ? 'libopus' : 'aac', '-shortest');
    }
    ffmpegArgs.push('-threads', '0', outPath);

    execFileSync(ffmpegPath, ffmpegArgs, { stdio: 'pipe' });

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 1024) {
      throw new Error('ffmpeg 产物为空: ' + outPath);
    }
    console.log('[render] 成功: ' + path.basename(outPath) +
      ' 帧数=' + frameCount + ' 时长≈' + (lastTs - firstTs).toFixed(1) + 's' +
      ' fps=' + fps.toFixed(1) + (upscale ? ' (' + captureW + '→' + outW + ' 放大)' : ''));
  } catch (e) {
    exitCode = 1;
    console.error('[render] 失败: ' + (e && e.message ? e.message : String(e)));
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) { /* 忽略清理失败 */ }
    if (browser) {
      try { await browser.close(); } catch (e) { /* 忽略 */ }
    }
    process.exit(exitCode);
  }
})();
