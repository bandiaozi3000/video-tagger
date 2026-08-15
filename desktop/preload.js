'use strict';

/**
 * Video Tagger 桌面版 —— preload 安全桥
 *
 * 现有前端是 vanilla JS，通过 HTTP 调本地 Spring Boot API，不需要 Node API。
 * 这里通过 contextBridge 暴露少量桌面能力：
 *   - window.vtDesktop.platform       当前平台
 *   - window.vtDesktop.minimize()     最小化窗口
 *   - window.vtDesktop.maximize()     最大化/还原窗口
 *   - window.vtDesktop.close()        关闭窗口
 *   - window.vtDesktop.onMaximize(cb) 监听最大化状态（切换最大化按钮图标）
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vtDesktop', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  onMaximize: (cb) => ipcRenderer.on('win:maximized-changed', (_e, isMax) => cb(isMax)),
});
