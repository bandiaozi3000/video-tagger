'use strict';

/**
 * 在线更新核心逻辑（纯 Node，无 electron 依赖，便于 node 直接测试）。
 * main.js 负责 UI 交互（dialog）、目录解析、触发时机；本模块只管「数据」。
 *
 * 更新模式：清单驱动增量。更新服务器放 latest.json + backend.jar，
 * 客户端只替换后端 jar（业务/前端静态资源全在 jar 里），data/ 不动。
 * jar 正被 Java 进程占用时不能覆盖 → 下载并校验后写 pending 标记，
 * 下次启动（旧 Java 未拉起前）由 main.js 调 applyPendingUpdate 就位。
 */

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

/** 语义化版本比较：a 是否比 b 新（"0.1.10" > "0.1.9"，缺失段按 0）。 */
function isNewer(a, b) {
  const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** GET 远端 JSON（http/https 统一，超时 + 1MB 上限防异常响应）。 */
function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(new Error('无效更新地址: ' + url)); }
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.get(u, { headers: { 'User-Agent': 'video-tagger-updater' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('清单 HTTP ' + res.statusCode)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => {
        body += d;
        if (body.length > 1024 * 1024) { res.destroy(); reject(new Error('清单响应过大')); }
      });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('清单非 JSON: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('请求超时')); });
  });
}

/** 流式下载文件，可选 SHA-256 校验（失败清理残留并抛错）。目标目录自动创建。 */
function download(url, destPath, expectedSha256, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(new Error('无效下载地址: ' + url)); }
    const mod = u.protocol === 'https:' ? https : http;
    const hash = expectedSha256 ? crypto.createHash('sha256') : null;
    try { fs.mkdirSync(path.dirname(destPath), { recursive: true }); } catch (_) {}
    const req = mod.get(u, { headers: { 'User-Agent': 'video-tagger-updater' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('下载 HTTP ' + res.statusCode)); }
      const tmp = destPath + '.part';
      const out = fs.createWriteStream(tmp);
      res.on('data', chunk => { if (hash) hash.update(chunk); });
      res.pipe(out);
      out.on('finish', () => {
        out.close(() => {
          if (hash) {
            const got = hash.digest('hex').toLowerCase();
            const want = String(expectedSha256).toLowerCase();
            if (got !== want) {
              try { fs.unlinkSync(tmp); } catch (_) {}
              return reject(new Error('SHA-256 校验失败'));
            }
          }
          try { fs.renameSync(tmp, destPath); } catch (e) { return reject(e); }
          resolve(destPath);
        });
      });
      out.on('error', err => { try { fs.unlinkSync(tmp); } catch (_) {} reject(err); });
    });
    req.on('error', err => { try { fs.unlinkSync(destPath + '.part'); } catch (_) {} reject(err); });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('下载超时')); });
  });
}

// ---------- pending 标记（待下次启动应用） ----------
function pendingFile(dataDir) {
  return path.join(dataDir, 'updates', 'pending.json');
}

function writePending(dataDir, data) {
  const f = pendingFile(dataDir);
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data)); } catch (_) {}
}

function readPending(dataDir) {
  try { return JSON.parse(fs.readFileSync(pendingFile(dataDir), 'utf8')); } catch (_) { return null; }
}

function clearPending(dataDir) {
  try { fs.unlinkSync(pendingFile(dataDir)); } catch (_) {}
}

/**
 * 应用待更新：把下载好的新 jar 就位。必须在旧 Java 未拉起（启动早期）调用，
 * 否则目标 jar 被进程占用无法覆盖。先备份旧 jar → 复制新 jar → 清标记。
 * @returns {{applied:boolean, toVersion:string} | null}
 */
function applyPendingUpdate(dataDir, targetJar) {
  const pending = readPending(dataDir);
  if (!pending || !pending.jarPath || !pending.targetJar) return null;
  if (pending.targetJar !== targetJar) return null; // 目标路径不匹配（开发/打包切换），跳过并清理
  if (!fs.existsSync(pending.jarPath)) { clearPending(dataDir); return null; }
  try {
    if (pending.backupPath && fs.existsSync(pending.backupPath)) fs.unlinkSync(pending.backupPath);
    fs.copyFileSync(targetJar, pending.backupPath);   // 备份旧 jar
    fs.copyFileSync(pending.jarPath, targetJar);       // 新 jar 就位
    clearPending(dataDir);
    return { applied: true, toVersion: pending.toVersion };
  } catch (e) {
    clearPending(dataDir);
    return null;
  }
}

/** 回滚到备份版本（新 jar 启动失败时）。成功返回 true。 */
function rollbackUpdate(targetJar, backupPath) {
  if (!backupPath || !fs.existsSync(backupPath)) return false;
  try { fs.copyFileSync(backupPath, targetJar); fs.unlinkSync(backupPath); return true; } catch (_) { return false; }
}

module.exports = {
  isNewer, fetchJson, download,
  pendingFile, writePending, readPending, clearPending,
  applyPendingUpdate, rollbackUpdate,
};
