'use strict';

/**
 * Video Tagger —— Animeko 现场打标 · 全局热键托盘（独立常驻，无主界面）
 *
 * 用途：不依赖桌面主壳/浏览器页面，双击 tag-tray.bat 后在系统托盘常驻，
 * 全局按 Ctrl+Alt+T 弹出 Animeko 打标浮层（后端须已在运行，默认 127.0.0.1:8080）。
 *
 * 配置（环境变量）：VT_BACKEND_PORT（默认 8080）、VT_TAG_HOTKEY（默认 CommandOrControl+Alt+T）
 * 退出：托盘图标左键=弹打标窗；右键菜单=退出。
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, dialog, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const zlib = require('zlib');

const BACKEND_PORT = process.env.VT_BACKEND_PORT || '8080';
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const HOTKEY = process.env.VT_TAG_HOTKEY || 'CommandOrControl+Alt+T';

let tray = null;
let tagWindow = null;
let shuttingDown = false;

/** 生成 16x16 紫色圆点托盘 PNG（纯 node，无资源依赖）。 */
function makeTrayIcon() {
  const W = 16, H = 16;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const rowStart = y * (W * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      const dx = x - 7.5, dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = rowStart + 1 + x * 4;
      if (dist <= 6.5) {                 // 圆内：渐变紫
        const t = dist / 7;
        raw[i] = Math.round(167 - t * 60);        // R
        raw[i + 1] = Math.round(139 - t * 60);    // G
        raw[i + 2] = Math.round(246);             // B
        raw[i + 3] = 255;                         // A
      } else {
        raw[i + 3] = 0; // 透明
      }
    }
  }
  // PNG 组装
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function backendReady() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${BACKEND_URL}/api/animeko/watch/status`, { signal: controller.signal });
    clearTimeout(timer);
    return resp.ok;
  } catch (_) {
    return false;
  }
}

function openTagWindow() {
  if (tagWindow && !tagWindow.isDestroyed()) {
    if (tagWindow.isMinimized()) tagWindow.restore();
    if (!tagWindow.isVisible()) tagWindow.show();
    tagWindow.show();
    tagWindow.focus();
    return;
  }
  tagWindow = new BrowserWindow({
    width: 400,
    height: 620,
    minWidth: 340,
    minHeight: 420,
    show: false,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a15',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  tagWindow.setAlwaysOnTop(true, 'floating');
  // 每次打开加随机 query 绕过 Electron 页面缓存（保证拿到最新 UI）
  tagWindow.loadURL(`${BACKEND_URL}/animeko-tag.html?_ts=${Date.now()}`);
  tagWindow.once('ready-to-show', () => tagWindow.show());
  tagWindow.on('closed', () => { tagWindow = null; });
}

// 窗控 IPC：主壳 preload 发 win:minimize/win:close（无边框浮层用）；收起=hide（热键/托盘再唤出）
ipcMain.on('win:minimize', (e) => { BrowserWindow.fromWebContents(e.sender)?.hide(); });
ipcMain.on('win:close', (e) => { BrowserWindow.fromWebContents(e.sender)?.close(); });

// M2 封面兜底：截主显示器当前画面（含 Animeko 播放窗口）→ JPEG base64（主进程 desktopCapturer 无需授权框）
ipcMain.handle('tag:capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    // 优先主显示器；thumbnail 为空则回退任意
    const src = sources.find(s => s.display_id === '0') || sources[0] || null;
    if (!src || src.thumbnail.isEmpty()) throw new Error('未捕获到屏幕画面');
    const jpg = src.thumbnail.toJPEG(88);   // Buffer
    return { ok: true, dataUrl: jpg.toString('base64') };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
});

// M2 封面兜底：列出当前可见窗口（供用户挑选 Animeko/播放器窗口）
ipcMain.handle('tag:list-windows', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['window'] });
    return {
      ok: true,
      windows: sources
        .filter(s => !s.thumbnail.isEmpty() && s.name && s.name.trim())
        .map(s => ({ id: s.id, name: s.name.trim() })),
    };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
});

// M2 封面兜底：按窗口 id 截图（用户选定的播放器窗口）→ JPEG base64
ipcMain.handle('tag:capture-window', async (_e, windowId) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    const src = sources.find(s => s.id === windowId) || null;
    if (!src || src.thumbnail.isEmpty()) throw new Error('窗口不可捕获（可能已最小化/关闭），已回退整屏');
    const jpg = src.thumbnail.toJPEG(88);
    return { ok: true, dataUrl: jpg.toString('base64') };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
});

async function handleHotkey() {
  if (shuttingDown) return;
  if (!(await backendReady())) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'Video Tagger · Animeko 打标',
      message: `后端未在 ${BACKEND_URL} 响应。\n请先启动 video-tagger 后端，再按 ${HOTKEY}。`,
    });
    return;
  }
  openTagWindow();
}

function rebuildTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: `Animeko 打标（${HOTKEY.replace('CommandOrControl', 'Ctrl')}）`, click: handleHotkey },
    { label: `后端：${BACKEND_URL}`, enabled: false },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

// 单实例锁：重复启动只唤起已常驻的实例
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => handleHotkey());

  app.whenReady().then(() => {
    tray = new Tray(nativeImage.createFromBuffer(makeTrayIcon()));
    tray.setToolTip(`Video Tagger · Animeko 打标（${HOTKEY.replace('CommandOrControl', 'Ctrl')}）`);
    rebuildTrayMenu();
    tray.on('click', () => handleHotkey());

    const ok = globalShortcut.register(HOTKEY, handleHotkey);
    if (!ok) {
      console.warn(`[tag-tray] 热键 ${HOTKEY} 注册失败（可能被占用/与桌面主壳重复）`);
      dialog.showMessageBox({
        type: 'warning',
        title: 'Video Tagger · Animeko 打标托盘',
        message: `全局热键 ${HOTKEY} 注册失败：可能已被占用，或桌面主壳已在运行（与主壳热键重复）。\n可用 VT_TAG_HOTKEY 环境变量换键（如 'Control+Alt+K'）。`,
      });
    } else {
      console.log(`[tag-tray] 常驻就绪：${HOTKEY} → ${BACKEND_URL}/animeko-tag.html（托盘退出）`);
    }
  });
}

app.on('will-quit', () => {
  shuttingDown = true;
  globalShortcut.unregisterAll();
});
