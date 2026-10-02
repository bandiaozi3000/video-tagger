/**
 * probe-browser.mjs — 不依赖 agent-browser 的真实浏览器探针（Chrome/Edge headless + CDP 直连）。
 *
 * 为什么存在：agent-browser 冷启动会卡满 30s 后报 os error 10060 起不来（见跨项目记忆 §七）。
 * 本脚本用系统已装的 Chrome + Node 22 自带 WebSocket，零依赖、约 10s 出结果，能拿：
 *   - Runtime.exceptionThrown（客户端异常原文 + 行号）← 排查「点了没反应／谎报后端未响应」的关键
 *   - console.error / warning
 *   - 点击后的 DOM 状态（状态栏文案、chips、卡片数、筛选状态）
 *
 * 用法：node scripts/probe-browser.mjs [url]        （默认 http://127.0.0.1:8080/）
 * 改「要走的点击路径」：编辑下面 STEP 表达式即可（示例走的是 媒体页 → ⚙筛选 → 标签维度 → 选第一个标签）。
 * 注意：顶层 let 的绑定（如 mediaFilter）不在 window 上，表达式里用裸标识符。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const APP_URL = process.argv[2] || 'http://127.0.0.1:8080/';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-probe-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', APP_URL,
], { stdio: 'ignore' });

let page = null;
for (let i = 0; i < 40 && !page; i++) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    page = list.find((t) => t.type === 'page' && t.url.startsWith('http'));
  } catch { /* 还没起来 */ }
}
if (!page) { console.log(JSON.stringify({ error: 'Chrome 页面没起来' })); chrome.kill(); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    events.push({ kind: 'exception', text: d.exception?.description || d.text, line: d.lineNumber, url: d.url });
  }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    events.push({ kind: 'console.' + m.params.type, text: (m.params.args || []).map((a) => a.value ?? a.description).join(' ') });
  }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((res) => {
  const id = ++seq;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r?.exceptionDetails) return { err: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return { value: r?.result?.value };
};
await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');

// 等应用就绪（注意：顶层 let 的绑定不在 window 上，这里用裸标识符）
const ready = await evaluate(`(async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 60; i++) {
    if (document.querySelector('#media-grid') && typeof mediaFilter === 'object') return 'ready';
    await w(250);
  }
  return 'timeout';
})()`);

const step = await evaluate(`(async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const nav = document.querySelector('[data-view="media"]');
  log.push('nav=' + (nav ? 'ok' : 'missing'));
  nav && nav.click();
  await w(900);
  const openBtn = document.getElementById('filter-open');
  openBtn.click();
  await w(1000);
  const tagDim = [...document.querySelectorAll('#fp-dims button')].find((b) => b.textContent.includes('标签'));
  log.push('tagDim=' + (tagDim ? 'ok' : 'missing'));
  tagDim && tagDim.click();
  await w(600);
  const vals = [...document.querySelectorAll('#fp-vals .fp-val')];
  log.push('options=' + vals.length);
  if (vals.length) vals[0].click();
  await w(3000);
  return JSON.stringify({
    log,
    chips: (document.getElementById('filter-chips') || {}).textContent,
    status: (document.getElementById('media-status') || {}).textContent,
    cards: document.querySelectorAll('#media-grid .media-card').length,
    tagIds: typeof mediaFilter === 'object' ? mediaFilter.tagIds : null,
  });
})()`);

console.log(JSON.stringify({ ready, step, events }, null, 2));
ws.close();
chrome.kill();
await sleep(500);
fs.rmSync(profile, { recursive: true, force: true });
