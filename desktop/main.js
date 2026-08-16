'use strict';

/**
 * Video Tagger 桌面版 —— Electron 主进程
 *
 * 职责（纯壳，不含业务逻辑）：
 *   1. 单实例锁：防开两个窗口抢端口
 *   2. 探测本地可用端口（默认 9010 起，避开 Windows 保留段 8080-8090）
 *   3. 定位 backend jar + Java 运行时（打包后取 resources/app、resources/jre；开发取 backend/target 最新 jar + 系统 java）
 *   4. spawn `java -jar` 拉起 Spring Boot 子进程（绑定 127.0.0.1）
 *   5. 轮询 /actuator/health 就绪后开 BrowserWindow 加载本地页面
 *   6. 退出时优雅关闭子进程 + PID 兜底 kill，防进程残留
 */

const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

// ---------- 配置 ----------
const PREFERRED_PORT = 9010;          // 避开 Windows 保留段 8080-8090
const HEALTH_PATH = '/actuator/health';
const HEALTH_TIMEOUT_MS = 90_000;     // 后端冷启动最坏 90s
const HEALTH_POLL_MS = 500;
const JAR_FILE_NAME = 'video-tagger-backend.jar';   // 打包后统一名
const DEV_JAR_GLOB = 'video-tagger-backend-*.jar';  // 开发：取 backend/target 最新

// ---------- 单实例锁 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ---------- 路径解析 ----------
/** 打包后：resources/app/video-tagger-backend.jar；resources/jre/bin/java.exe */
function resolvePaths() {
  const isPacked = app.isPackaged;
  const base = isPacked
    ? path.join(process.resourcesPath)
    : path.resolve(__dirname, '..');

  let jarPath = null;
  let javaPath = 'java'; // 默认系统 PATH 里的 java（开发模式）

  if (isPacked) {
    jarPath = path.join(base, 'app', JAR_FILE_NAME);
    const jreJava = path.join(base, 'jre', 'bin', 'java.exe');
    if (fs.existsSync(jreJava)) javaPath = jreJava;
  } else {
    // 开发：从 backend/target 取最新构建的 jar
    const targetDir = path.join(base, 'backend', 'target');
    if (fs.existsSync(targetDir)) {
      const jars = fs.readdirSync(targetDir)
        .filter(f => /^video-tagger-backend-.*\.jar$/.test(f) && !f.endsWith('-sources.jar') && !f.endsWith('-javadoc.jar'))
        .sort()
        .reverse(); // 文件名带版本号，字典序倒序≈最新
      if (jars.length) jarPath = path.join(targetDir, jars[0]);
    }
  }

  return { jarPath, javaPath, isPacked };
}

/** 桌面版数据目录：项目根 data/（与 Web 版共用，封面/背景图/导出/日志统一）。VT_DATA_DIR 环境变量可覆盖（测试/特殊部署用）。 */
function resolveDataDir() {
  // VT_DATA_DIR 显式指定优先（测试/特殊部署用）
  if (process.env.VT_DATA_DIR) return process.env.VT_DATA_DIR;
  if (app.isPackaged) {
    // 打包版（便携 zip）：数据存 exe 同目录 data/——解压即用，整个文件夹可搬走，数据跟着走
    // exe 在 <解压根>/Video Tagger.exe，resources 在 <解压根>/resources；数据放 <解压根>/data
    const dir = path.join(path.dirname(app.getPath('exe')), 'data');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* 忽略，后端会再尝试 */ }
    return dir;
  }
  // 开发模式：数据存项目根 data/（与 Web 版共用，封面/背景图/导出统一）
  // 壳在 <项目根>/desktop/，项目根 = 上一级
  const projectRoot = path.resolve(__dirname, '..');
  const devData = path.join(projectRoot, 'data');
  try { fs.mkdirSync(devData, { recursive: true }); } catch (e) { /* 忽略，后端会再尝试 */ }
  return devData;
}

/** 打包后 scripts 目录（render.js 所在）：resources/scripts；开发模式用 backend/scripts。 */
function resolveScriptsDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'scripts');
  return path.resolve(__dirname, '..', 'backend', 'scripts');
}

/** node 可执行：打包版优先用内嵌运行时（resources/node），开发模式依赖系统 PATH。 */
function findNodePath() {
  if (process.env.RENDER_NODE_PATH) return process.env.RENDER_NODE_PATH;
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'node', 'node.exe');
    try { if (fs.existsSync(bundled)) return bundled; } catch (_) {}
  }
  return 'node'; // 开发模式：依赖系统 PATH（Windows 安装 node 后可用）
}

/** 注册表 App Paths 查可执行文件（Chrome/Edge 标准安装必写，比猜路径可靠）；找不到返回 null。 */
function queryAppPath(name) {
  const roots = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + name,
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + name,
  ];
  for (const key of roots) {
    try {
      // reg query 默认值输出本地化（中文系统“(默认)”），不能按列名匹配，取 REG_SZ 类型后的路径
      const out = execSync(`reg query "${key}" /ve`, { encoding: 'utf8', timeout: 3000, windowsHide: true });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/REG_SZ\s+(.+)$/);
        if (m) {
          const p = m[1].trim();
          if (p.endsWith(name) && fs.existsSync(p)) return p;
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Chrome 可执行：注册表 App Paths + 常见安装路径探测。
 * 找不到 Chrome 时回退到 Edge（Win10/11 预装，Chromium 内核可当 Chrome 用）——
 * 视频导出/omofuna 同步的 puppeteer 只需 Chromium 内核，不必非要 Chrome。
 */
function findChromePath() {
  if (process.env.RENDER_CHROME_PATH) return process.env.RENDER_CHROME_PATH;
  // 1) 注册表 App Paths（标准安装最可靠）
  const regChrome = queryAppPath('chrome.exe');
  if (regChrome) return regChrome;
  // 2) 常见安装路径
  const chromeCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ];
  for (const c of chromeCandidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  // 3) Edge 回退（Win10/11 预装，Chromium 内核）
  const regEdge = queryAppPath('msedge.exe');
  if (regEdge) return regEdge;
  const edgeCandidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Edge/Application/msedge.exe'),
  ];
  for (const c of edgeCandidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return 'C:/Program Files/Google/Chrome/Application/chrome.exe'; // 默认，缺失时后端会提示
}

/** ffmpeg 可执行：打包版优先内嵌（resources/ffmpeg.exe）；开发模式用户本地 ~/.local/ffmpeg，否则系统 PATH。 */
function findFfmpegPath() {
  if (process.env.RENDER_FFMPEG_PATH) return process.env.RENDER_FFMPEG_PATH;
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, 'ffmpeg.exe');
    try { if (fs.existsSync(bundled)) return bundled; } catch (_) {}
  }
  const local = path.join(process.env.USERPROFILE || '', '.local', 'ffmpeg', 'bin', 'ffmpeg.exe');
  try { if (fs.existsSync(local)) return local; } catch (_) {}
  return 'ffmpeg';
}

// ---------- 端口探测 ----------
function isPortFree(port) {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function findFreePort() {
  for (let p = PREFERRED_PORT; p < PREFERRED_PORT + 50; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(`找不到可用端口（${PREFERRED_PORT}~${PREFERRED_PORT + 49} 全被占用）`);
}

// ---------- 健康检查 ----------
function checkHealth(port) {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: HEALTH_PATH, timeout: 3000 }, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve(res.statusCode === 200 && /"status":"UP"/.test(body)));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ---------- 拉起/关闭后端子进程 ----------
let backendProc = null;

function startBackend(javaPath, jarPath, port) {
  // 子进程工作目录设为 jar 所在目录：render 配置里的相对路径（backend/scripts、data/...）以此为基准
  const cwd = path.dirname(jarPath);
  const args = [
    // 显式固定 UTF-8：JVM 默认 file.encoding 随系统区域（中文 Windows=GBK），
    // 会把 UTF-8 的 schema 种子/日志读乱。不依赖目标机 Windows 区域设置。
    '-Dfile.encoding=UTF-8',
    '-jar', jarPath,
    `--server.port=${port}`,
    '--server.address=127.0.0.1',
  ];
  // 桌面版数据目录注入：后端 SQLite 库/封面/导出统一落到用户数据目录（可写，不受安装目录只读限制）
  const dataDir = resolveDataDir();
  const env = {
    ...process.env,
    VT_DATA_DIR: dataDir,
    // 视频导出工具链（D4）：复用系统 node + Chrome + 本地 ffmpeg；缺则后端渲染不可用
    RENDER_SCRIPTS_DIR: resolveScriptsDir(),
    RENDER_NODE_PATH: findNodePath(),
    RENDER_CHROME_PATH: findChromePath(),
    RENDER_FFMPEG_PATH: findFfmpegPath(),
  };
  backendProc = spawn(javaPath, args, {
    cwd,
    windowsHide: true,
    env,
  });
  // 后端输出落盘到 data/logs/desktop.log（显式 append，不依赖 console 拦截）
  const deskLog = path.join(dataDir, 'logs', 'desktop.log');
  try { fs.mkdirSync(path.dirname(deskLog), { recursive: true }); } catch (_) {}
  const append = line => { try { fs.appendFileSync(deskLog, line + '\n'); } catch (_) {} };
  backendProc.stdout.on('data', d => { const l = String(d).trimEnd(); if (l) { console.log('[backend] ' + l); append('[backend] ' + l); } });
  backendProc.stderr.on('data', d => { const l = String(d).trimEnd(); if (l) { console.error('[backend] ' + l); append('[backend] ' + l); } });
  backendProc.on('exit', (code, sig) => {
    const msg = `[backend] 子进程退出 code=${code} sig=${sig}`;
    console.log(msg); append(msg);
    backendProc = null;
  });
  return backendProc;
}

let backendPort = null;

function postShutdown(port) {
  return new Promise(resolve => {
    const options = {
      host: '127.0.0.1',
      port,
      path: '/actuator/shutdown',
      method: 'POST',
      timeout: 4000,
    };
    const r = http.request(options, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode === 200));
    });
    r.on('error', () => resolve(false));
    r.on('timeout', () => { r.destroy(); resolve(false); });
    r.end();
  });
}

function waitProcExit(proc, ms) {
  return new Promise(resolve => {
    if (!proc || proc.exitCode !== null) return resolve(true);
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(false); } }, ms);
    proc.once('exit', () => { if (!done) { done = true; clearTimeout(timer); resolve(true); } });
  });
}

async function shutdownBackend() {
  if (!backendProc && !backendPort) return;
  const proc = backendProc;
  backendProc = null;

  // ① 优先优雅关闭：POST /actuator/shutdown（若后端暴露该端点）
  let exited = false;
  if (backendPort) {
    exited = await postShutdown(backendPort);
    if (exited) exited = await waitProcExit(proc, 6000);
  }

  // ② 未退出：taskkill 不带 /F（发送进程退出请求，Spring Boot 可接 SIGTERM 优雅清理）
  if (!exited && proc) {
    try { execSync(`taskkill /PID ${proc.pid} /T`, { stdio: 'ignore' }); } catch (_) {}
    exited = await waitProcExit(proc, 4000);
  }

  // ③ 仍退出失败：兜底强杀
  if (!exited && proc) {
    try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch (_) {}
    await waitProcExit(proc, 2000);
  }
}

// ---------- 窗口 ----------
function createMainWindow(port) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: false,          // 无边框：自定义标题栏（拖拽 + 窗控按钮）
    autoHideMenuBar: true,
    backgroundColor: '#14141a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    // 外部链接用系统浏览器打开，禁止应用内新窗
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 下载接管：导出 HTML/视频等浏览器下载 → 弹「另存为」对话框，用户选保存位置
  win.webContents.session.on('will-download', (event, item) => {
    const defaultName = item.getFilename();
    const savePath = dialog.showSaveDialogSync(win, {
      title: '保存文件',
      defaultPath: path.join(app.getPath('downloads'), defaultName),
    });
    if (savePath) {
      item.setSavePath(savePath);
      // 完成后打开所在文件夹，让用户看得到结果
      item.once('done', (e, state) => {
        if (state === 'completed') {
          shell.showItemInFolder(savePath);
        }
      });
    } else {
      item.cancel(); // 用户取消保存
    }
  });

  win.webContents.on('did-finish-load', () => {
    win.show();
    // 调试/验收：VT_SCREENSHOT 指定路径时，加载完成后截图（验证 CSS 渲染用）
    if (process.env.VT_SCREENSHOT) {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(process.env.VT_SCREENSHOT, img.toPNG());
          console.log('[shot] 已保存截图: ' + process.env.VT_SCREENSHOT);
          // DOM 验证：确认应用界面真实渲染
          const dom = await win.webContents.executeJavaScript(`(() => {
            const q = s => document.querySelectorAll(s).length;
            const bg = getComputedStyle(document.body);
            const views = [...document.querySelectorAll('.view')].filter(v => !v.hidden).map(v => v.id);
            const firstCard = document.querySelector('.media-card .media-card-title');
            const sidebar = document.querySelector('.sidebar');
            const titlebar = document.querySelector('.titlebar');
            const statusbar = document.querySelector('.statusbar');
            const sbNav = document.querySelector('.sidebar .nav');
            return JSON.stringify({
              title: document.title,
              totalEls: q('*'),
              mediaCards: q('.media-card'),
              visibleViews: views,
              bodyBg: bg.backgroundColor,
              hasSidebar: !!sidebar && sidebar.offsetWidth > 0,
              sidebarTabs: sbNav ? q('.sidebar .tab') : 0,
              hasTitlebar: !!titlebar && titlebar.offsetHeight > 0,
              titlebarBtns: titlebar ? q('.titlebar .tb-btn') : 0,
              hasStatusbar: !!statusbar && statusbar.offsetHeight > 0,
              desktopMode: document.body.classList.contains('desktop-mode'),
              firstCardTitle: firstCard ? firstCard.textContent.trim().slice(0, 30) : null,
            });
          })()`);
          console.log('[dom] ' + dom);
          // 验收用：VT_QUIT_AFTER_SHOT 置 1 时，验证完自动退出（走正常退出路径，验证子进程清理）
          if (process.env.VT_QUIT_AFTER_SHOT === '1') {
            console.log('[shot] 验证完成，自动退出');
            app.quit();
          }
        } catch (e) { console.error('[shot] 截图失败: ' + e.message); }
      }, 3000);
    }
  });

  win.on('closed', () => {});

  win.loadURL(`http://127.0.0.1:${port}/`);

  // 开发调试：F12 开 DevTools
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  return win;
}

// ---------- 启动流程 ----------
async function boot() {
  let { jarPath, javaPath, isPacked } = resolvePaths();

  if (!jarPath || !fs.existsSync(jarPath)) {
    dialog.showErrorBox('Video Tagger 启动失败',
      `找不到后端 jar：\n${jarPath || '(未解析到路径)'}\n\n请先构建 backend（mvn package），或确认安装包完整。`);
    app.quit();
    return;
  }

  const port = await findFreePort();
  backendPort = port; // 供退出时优雅关闭用
  console.log(`[boot] 端口 = ${port}, jar = ${jarPath}, java = ${javaPath}`);
  // 默认空库开始：无 db 时后端启动自动建 schema（spring.sql.init），不弹迁移引导

  // 先开一个最小启动窗（splash），健康检查就绪后切主界面
  const splash = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    resizable: false,
    backgroundColor: '#14141a',
  });
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html><body style="margin:0;background:#14141a;color:#f5f5f5;font-family:Segoe UI,sans-serif;
display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:14px">
<div style="font-size:20px;letter-spacing:2px">Video Tagger</div>
<div style="font-size:12px;color:#888">正在启动本地服务…</div>
</body></html>`)}`);

  startBackend(javaPath, jarPath, port);

  // 轮询健康检查
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < HEALTH_TIMEOUT_MS) {
    if (await checkHealth(port)) { ready = true; break; }
    await new Promise(r => setTimeout(r, HEALTH_POLL_MS));
  }

  if (!ready) {
    dialog.showErrorBox('Video Tagger 启动失败',
      `本地服务在 ${HEALTH_TIMEOUT_MS / 1000}s 内未就绪。请查看日志确认后端是否正常启动。`);
    app.quit();
    return;
  }

  console.log('[boot] 后端就绪，打开主窗口');
  splash.close();
  createMainWindow(port);
}

app.whenReady().then(boot);

// ---------- 窗控 IPC（自定义标题栏按钮） ----------
ipcMain.on('win:minimize', (e) => { BrowserWindow.fromWebContents(e.sender)?.minimize(); });
ipcMain.on('win:maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize(); else win.maximize();
});
ipcMain.on('win:close', (e) => { BrowserWindow.fromWebContents(e.sender)?.close(); });
// 通知渲染进程最大化状态变化（切换最大化/还原图标）
app.on('browser-window-created', (_e, win) => {
  win.on('maximize', () => win.webContents.send('win:maximized-changed', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized-changed', false));
});

app.on('window-all-closed', () => {
  // 所有窗口关闭 → 退出应用
  app.quit();
});

let shuttingDown = false;

// 退出前清理子进程，防 Java 进程残留。
// 注意：will-quit 不等待 async handler——必须用 before-quit + preventDefault 阻塞，
// 等 shutdownBackend 完整执行完（含全部 await）再 app.exit()。
app.on('before-quit', (e) => {
  if (shuttingDown) return;
  shuttingDown = true;
  e.preventDefault();
  shutdownBackend().finally(() => {
    // app.exit() 不再触发 before-quit，直接终止主进程
    app.exit(0);
  });
});
