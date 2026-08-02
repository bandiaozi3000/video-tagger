(function () {
  if (window.__videoTaggerLoaded) return;
  window.__videoTaggerLoaded = true;

  const VT_DEFAULT_BACKEND = 'http://localhost:8080';

  function findVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    return videos.find(v => !v.paused) || videos[0];
  }

  async function getBackendBase() {
    const { videoTaggerPrefs } = await chrome.storage.sync.get('videoTaggerPrefs');
    return (videoTaggerPrefs && videoTaggerPrefs.backendBaseUrl) || VT_DEFAULT_BACKEND;
  }

  async function getPrefs() {
    const { videoTaggerPrefs } = await chrome.storage.sync.get('videoTaggerPrefs');
    return videoTaggerPrefs || { backendBaseUrl: VT_DEFAULT_BACKEND, quickTags: {}, quickSilent: false };
  }

  // 轻提示（静默直存用，不阻塞看片）
  let toastEl = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'vt-floating-toast';
      toastEl.style.cssText =
        'position:fixed;top:24px;right:24px;z-index:2147483647;' +
        'background:rgba(30,30,46,.92);color:#cdd6f4;border:1px solid #45475a;' +
        'border-radius:10px;padding:10px 16px;' +
        'font:13px "Microsoft YaHei UI",system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5);' +
        'transition:opacity .2s;opacity:0;pointer-events:none;';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toastEl.style.opacity = '0'; }, 1600);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'grab-video') {
      const video = findVideo();
      if (!video) {
        sendResponse({ error: 'no-video' });
        return false;
      }
      sendResponse({
        title: document.title,
        url: location.href,
        timestampSec: video.currentTime
      });
      return false;
    }
    if (msg.type === 'show-overlay') {
      showOverlay(msg.info);
      return false;
    }
  });

  // ===== 快捷标签位：Ctrl+Shift+1~9 =====
  document.addEventListener('keydown', async (e) => {
    if (!(e.ctrlKey && e.shiftKey && e.key >= '1' && e.key <= '9')) return;
    e.preventDefault();
    const slotIndex = Number(e.key);
    const prefs = await getPrefs();
    const tag = (prefs.quickTags && prefs.quickTags[slotIndex]) || '';
    const video = findVideo();
    if (!video) {
      showToast('当前页面没有找到视频');
      return;
    }
    const info = { title: document.title, url: location.href, timestampSec: video.currentTime };
    if (!tag) {
      showToast(`快捷标签位 ${slotIndex} 未配置，请到扩展设置页填写`);
      showOverlay(info);
      return;
    }
    if (prefs.quickSilent) {
      // 静默直存：直接 POST，不弹浮层
      const resp = await chrome.runtime.sendMessage({
        type: 'api',
        method: 'POST',
        path: '/api/clips',
        body: { ...info, tag, note: '' }
      });
      if (resp && resp.ok && resp.data && resp.data.deduped) {
        showToast(`「${tag}」该片段刚已保存`);
      } else if (resp && resp.ok) {
        showToast(`已保存「${tag}」`);
      } else {
        showToast('保存失败：后端未启动？');
      }
    } else {
      showOverlay({ ...info, presetTag: tag });
    }
  });

  // ===== 打标浮层 =====
  const OVERLAY_CSS = `
    :host { all: initial; }
    .card {
      position: fixed; top: 24px; right: 24px; z-index: 2147483647;
      width: 340px; padding: 18px;
      background: rgba(30, 30, 46, 0.92);
      backdrop-filter: blur(12px);
      border: 1px solid #45475a; border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
      color: #cdd6f4; font: 14px "Microsoft YaHei UI", system-ui, sans-serif;
      animation: slideIn .18s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .card.closing { opacity: 0; transform: translateX(20px); transition: all .15s ease-in; }
    h3 { margin: 0 0 10px; font-size: 15px; color: #cba6f7; font-weight: 600; }
    .count { font-size: 11px; color: #a6adc8; font-weight: 400; margin-left: 6px; }
    .meta { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .badge {
      font-size: 12px; background: #313244; border: 1px solid #45475a;
      border-radius: 6px; padding: 3px 8px; color: #a6adc8;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      cursor: text;
    }
    .badge.time { color: #cba6f7; font-variant-numeric: tabular-nums; }
    .input-wrap { position: relative; }
    input {
      width: 100%; box-sizing: border-box; margin-bottom: 10px;
      background: #313244; border: 1px solid #45475a; border-radius: 8px;
      color: #cdd6f4; padding: 9px 12px; font-size: 14px; outline: none;
      font-family: inherit;
    }
    input:focus { border-color: #cba6f7; }
    input.error { border-color: #f38ba8; }
    .ac-list {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 5;
      background: #313244; border: 1px solid #45475a; border-radius: 8px;
      margin-top: 2px; max-height: 180px; overflow: auto;
    }
    .ac-item { padding: 8px 12px; cursor: pointer; font-size: 13px; color: #cdd6f4; }
    .ac-item:hover, .ac-item.on { background: #45475a; color: #cba6f7; }
    .dup-hint {
      margin-bottom: 10px; padding: 8px 10px; border-radius: 8px;
      background: rgba(249, 226, 175, .08); border: 1px solid rgba(249, 226, 175, .25);
      font-size: 12px; color: #f9e2af;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .dup-hint button {
      background: transparent; border: 1px solid rgba(249, 226, 175, .4); border-radius: 6px;
      color: #f9e2af; font-size: 11px; padding: 2px 8px; cursor: pointer; font-family: inherit;
    }
    .dup-hint button:hover { background: rgba(249, 226, 175, .12); }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    button {
      border-radius: 8px; padding: 7px 16px; font-size: 13px; cursor: pointer;
      font-family: inherit;
    }
    .cancel { background: transparent; border: 1px solid #45475a; color: #cdd6f4; }
    .cancel:hover { background: #313244; }
    .toggle { background: transparent; border: 1px solid #45475a; color: #a6adc8; }
    .toggle:hover { background: #313244; }
    .toggle.on { background: rgba(166, 227, 161, .12); border-color: #a6e3a1; color: #a6e3a1; }
    .save { background: #cba6f7; border: none; color: #1e1e2e; font-weight: 600; }
    .save:hover { background: #b695e8; }
    .toast {
      margin-top: 10px; font-size: 12px; color: #a6e3a1; text-align: right;
      opacity: 0; transition: opacity .2s;
    }
    .toast.show { opacity: 1; }
  `;

  function fmtTime(sec) {
    const s = Math.floor(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function showOverlay(info) {
    document.getElementById('vt-overlay-host')?.remove();

    const host = document.createElement('div');
    host.id = 'vt-overlay-host';
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>${OVERLAY_CSS}</style>
      <div class="card">
        <h3>标记片段 <span class="count" id="vt-count"></span></h3>
        <div class="meta">
          <span class="badge" id="vt-title" contenteditable="true" title="点击可编辑"></span>
          <span class="badge time" id="vt-time" contenteditable="true" title="点击可编辑（秒）"></span>
        </div>
        <div class="input-wrap">
          <input id="vt-tag" placeholder="标签，如：高燃" autocomplete="off">
          <div class="ac-list" id="vt-ac" hidden></div>
        </div>
        <input id="vt-note" placeholder="备注（可选）" autocomplete="off">
        <div class="dup-hint" id="vt-dup" hidden></div>
        <div class="actions">
          <button class="cancel" id="vt-cancel">取消</button>
          <button class="toggle" id="vt-cont" title="连续打标：保存后浮层不关，时间戳跟随播放进度">连续</button>
          <button class="save" id="vt-save">保存 (Enter)</button>
        </div>
        <div class="toast" id="vt-toast">已保存</div>
      </div>`;

    const titleEl = shadow.getElementById('vt-title');
    const timeEl = shadow.getElementById('vt-time');
    const tagInput = shadow.getElementById('vt-tag');
    const noteInput = shadow.getElementById('vt-note');
    const acList = shadow.getElementById('vt-ac');
    const dupHint = shadow.getElementById('vt-dup');
    const toast = shadow.getElementById('vt-toast');
    const card = shadow.querySelector('.card');
    const contBtn = shadow.getElementById('vt-cont');
    const countEl = shadow.getElementById('vt-count');

    let continuous = false;
    let saveCount = 0;
    let duplicateChecked = false;
    let acItems = [];
    let acIndex = -1;
    let acTimer = null;
    let followTimer = null;

    titleEl.textContent = info.title;
    timeEl.textContent = String(Math.round(info.timestampSec));
    timeEl.title = `点击可编辑（秒）· 当前 ${fmtTime(info.timestampSec)}`;
    if (info.presetTag) tagInput.value = info.presetTag;
    document.body.appendChild(host);
    tagInput.focus();

    function close() {
      stopFollow();
      card.classList.add('closing');
      setTimeout(() => host.remove(), 150);
    }

    function startFollow() {
      stopFollow();
      followTimer = setInterval(() => {
        if (document.activeElement === timeEl) return; // 用户正在手动编辑时间戳
        const v = findVideo();
        if (v) {
          const rounded = Math.round(v.currentTime);
          timeEl.textContent = String(rounded);
          timeEl.title = `点击可编辑（秒）· 当前 ${fmtTime(v.currentTime)}`;
        }
      }, 500);
    }
    function stopFollow() {
      if (followTimer) { clearInterval(followTimer); followTimer = null; }
    }

    // 重复片段提示：同视频 ±10s 内已有标记
    async function checkDuplicate() {
      if (duplicateChecked) return;
      duplicateChecked = true;
      const resp = await chrome.runtime.sendMessage({
        type: 'api',
        method: 'GET',
        path: `/api/clips/near?url=${encodeURIComponent(info.url)}&timestampSec=${encodeURIComponent(info.timestampSec)}&window=10`
      });
      const clips = (resp && resp.ok && Array.isArray(resp.data)) ? resp.data : [];
      if (clips.length === 0) return;
      const c = clips[0];
      dupHint.hidden = false;
      dupHint.textContent = `${fmtTime(c.timestampSec)} 已存过「${c.tag}」`;
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = '追加标签';
      const newBtn = document.createElement('button');
      newBtn.type = 'button';
      newBtn.textContent = '仍然新增';
      dupHint.appendChild(addBtn);
      dupHint.appendChild(newBtn);

      addBtn.addEventListener('click', async () => {
        const tag = tagInput.value.trim();
        if (!tag) { tagInput.classList.add('error'); tagInput.focus(); return; }
        const resp = await chrome.runtime.sendMessage({
          type: 'api',
          method: 'PUT',
          path: `/api/clips/${c.id}?appendTag=true`,
          body: { title: c.title, url: c.url, timestampSec: c.timestampSec, tag, note: c.note || '' }
        });
        if (resp && resp.ok) {
          toast.textContent = `已追加到「${c.tag}」`;
          toast.classList.add('show');
          setTimeout(close, 600);
        } else {
          toast.textContent = '追加失败';
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 2000);
        }
      });
      newBtn.addEventListener('click', () => { dupHint.hidden = true; });
    }
    checkDuplicate();

    // 标签补全
    tagInput.addEventListener('input', () => {
      clearTimeout(acTimer);
      const v = tagInput.value.trim();
      if (!v) { hideAc(); return; }
      acTimer = setTimeout(async () => {
        const resp = await chrome.runtime.sendMessage({
          type: 'api',
          method: 'GET',
          path: `/api/tags?prefix=${encodeURIComponent(v)}&limit=8`
        });
        const tags = (resp && resp.ok && Array.isArray(resp.data)) ? resp.data : [];
        showAc(tags);
      }, 150);
    });
    tagInput.addEventListener('focus', () => {
      const v = tagInput.value.trim();
      if (v) tagInput.dispatchEvent(new Event('input'));
    });
    tagInput.addEventListener('blur', () => setTimeout(hideAc, 150));

    function showAc(tags) {
      acItems = tags.map(t => t.tag);
      acIndex = -1;
      if (acItems.length === 0) { hideAc(); return; }
      acList.innerHTML = '';
      acItems.forEach((t, i) => {
        const item = document.createElement('div');
        item.className = 'ac-item';
        item.textContent = t;
        item.addEventListener('mousedown', (e) => { e.preventDefault(); pickAc(i); });
        acList.appendChild(item);
      });
      acList.hidden = false;
    }
    function hideAc() { acList.hidden = true; acItems = []; acIndex = -1; }
    function pickAc(i) {
      if (i >= 0 && i < acItems.length) {
        tagInput.value = acItems[i];
        hideAc();
        tagInput.focus();
      }
    }
    function moveAc(dir) {
      if (acItems.length === 0) return;
      acIndex = (acIndex + dir + acItems.length) % acItems.length;
      [...acList.children].forEach((el, i) => el.classList.toggle('on', i === acIndex));
    }

    async function save() {
      const tag = tagInput.value.trim();
      if (!tag) {
        tagInput.classList.add('error');
        tagInput.focus();
        return;
      }
      const editedSec = parseFloat(timeEl.textContent);
      const payload = {
        title: titleEl.textContent.trim() || info.title,
        url: info.url,
        timestampSec: Number.isFinite(editedSec) ? editedSec : info.timestampSec,
        tag,
        note: noteInput.value.trim()
      };
      const resp = await chrome.runtime.sendMessage({ type: 'save-clip', payload });
      if (!resp || !resp.ok) {
        toast.textContent = '保存失败：后端未启动？';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
        return;
      }
      if (resp.deduped) {
        toast.textContent = '该片段刚已保存';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
        return;
      }
      if (continuous) {
        saveCount++;
        countEl.textContent = `已连续保存 ${saveCount} 条`;
        toast.textContent = `已保存 · 第 ${saveCount} 条`;
        toast.classList.add('show');
        noteInput.value = '';
        const v = findVideo();
        if (v) {
          timeEl.textContent = String(Math.round(v.currentTime));
          timeEl.title = `点击可编辑（秒）· 当前 ${fmtTime(v.currentTime)}`;
        }
        setTimeout(() => toast.classList.remove('show'), 1000);
        tagInput.focus();
      } else {
        toast.textContent = '已保存';
        toast.classList.add('show');
        setTimeout(close, 400);
      }
    }

    contBtn.addEventListener('click', () => {
      continuous = !continuous;
      contBtn.classList.toggle('on', continuous);
      if (continuous) {
        saveCount = 0;
        countEl.textContent = '';
        startFollow();
      } else {
        stopFollow();
      }
    });

    shadow.getElementById('vt-save').addEventListener('click', save);
    shadow.getElementById('vt-cancel').addEventListener('click', close);
    card.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'ArrowDown') { e.preventDefault(); moveAc(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveAc(-1); }
      else if (e.key === 'Enter') {
        if (e.target.id === 'vt-title' || e.target.id === 'vt-time') return;
        if (acItems.length > 0 && acIndex >= 0) { e.preventDefault(); pickAc(acIndex); }
        else { e.preventDefault(); save(); }
      }
      else if (e.key === 'Escape') {
        if (!acList.hidden) hideAc();
        else close();
      }
    });
  }

  // ===== 回看 seek：页面加载后轮询后端「待跳转」标记 =====

  /** 去掉 URL 中的时间参数，与后端待跳转队列的 key 对齐 */
  function normalizeUrl(url) {
    return url.replace(/([?&])t=\d+s?(&|$)/g, (m, p1, p2) => (p2 === '&' ? p1 : ''))
              .replace(/[?&]$/, '');
  }

  function seekWhenReady(video, timestampSec) {
    if (video.readyState >= 1) {
      video.currentTime = timestampSec;
    } else {
      video.addEventListener('loadedmetadata', () => { video.currentTime = timestampSec; }, { once: true });
    }
  }

  async function trySeek() {
    const video = findVideo();
    if (!video) return;
    try {
      const base = await getBackendBase();
      const url = normalizeUrl(location.href);
      const resp = await fetch(`${base}/api/jump/pending?url=${encodeURIComponent(url)}`);
      if (!resp.ok) return; // 204 或后端未启动
      const data = await resp.json();
      if (typeof data.timestampSec === 'number') {
        seekWhenReady(video, data.timestampSec);
      }
    } catch (e) { /* 后端未启动，静默 */ }
  }

  // 视频元素可能延迟出现：加载后 0s / 2s / 5s 各试一次
  trySeek();
  setTimeout(trySeek, 2_000);
  setTimeout(trySeek, 5_000);
})();
