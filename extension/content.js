(function () {
  if (window.__videoTaggerLoaded) return;
  window.__videoTaggerLoaded = true;

  const VT_DEFAULT_BACKEND = 'http://localhost:8080';

  function findVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    return videos.find(v => !v.paused) || videos[0];
  }

  function currentVideoDuration() {
    const v = findVideo();
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return null;
    return v.duration;
  }

  // 封面：读取页面 og:image（B站/YouTube 等主流站点均有），随保存上报供后端异步落盘
  function currentOgImage() {
    const meta = document.querySelector('meta[property="og:image"]')
        || document.querySelector('meta[property="og:image:url"]');
    return meta ? meta.content : null;
  }

  // 截帧：一次画两档——缩略图 320px JPEG 0.7 + 详情大图 min(videoWidth,1280) JPEG 0.75。
  // CORS canvas 污染 / DRM 黑帧 / 视频未加载 → 返回 null，降级无封面（不阻塞保存主链路）。
  function captureFrames(video) {
    try {
      if (!video || !Number.isFinite(video.videoWidth) || video.videoWidth <= 0) return null;
      const THUMB_W = 320;
      const DETAIL_W = Math.min(video.videoWidth, 1280);
      const make = (W, quality) => {
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = Math.max(1, Math.round(video.videoHeight * W / video.videoWidth));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', quality);
      };
      return { thumb: make(THUMB_W, 0.7), detail: make(DETAIL_W, 0.75) };
    } catch (e) {
      return null;
    }
  }

  async function getBackendBase() {
    const { videoTaggerPrefs } = await chrome.storage.sync.get('videoTaggerPrefs');
    return (videoTaggerPrefs && videoTaggerPrefs.backendBaseUrl) || VT_DEFAULT_BACKEND;
  }

  async function getPrefs() {
    const { videoTaggerPrefs } = await chrome.storage.sync.get('videoTaggerPrefs');
    return videoTaggerPrefs
      || { backendBaseUrl: VT_DEFAULT_BACKEND, quickTags: {}, quickSilent: false, watchEndPrompt: false };
  }

  // 轻提示（静默直存用，不阻塞看片）
  let toastEl = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'vt-floating-toast';
      toastEl.style.cssText =
        'position:fixed;top:24px;right:24px;z-index:2147483647;' +
        'background:linear-gradient(180deg,rgba(22,22,40,.96),rgba(15,15,28,.96));' +
        'color:#eceaf6;border-left:3px solid #ff4d8d;border-radius:12px;padding:11px 18px;' +
        'font:13px/1.5 "PingFang SC","Hiragino Sans GB","Microsoft YaHei UI",system-ui,sans-serif;' +
        'box-shadow:0 16px 50px rgba(0,0,0,.55);' +
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
      const frames = captureFrames(video); // 与时间戳同源：读 currentTime 的同一瞬间截帧
      sendResponse({
        title: document.title,
        url: location.href,
        timestampSec: video.currentTime,
        frameDataUrl: frames ? frames.thumb : null,
        detailFrameDataUrl: frames ? frames.detail : null
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
    const frames = captureFrames(video);
    const info = {
      title: document.title, url: location.href, timestampSec: video.currentTime,
      frameDataUrl: frames ? frames.thumb : null,
      detailFrameDataUrl: frames ? frames.detail : null
    };
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
        body: { ...info, tag, note: '', videoDuration: currentVideoDuration(), ogImage: currentOgImage(), coverDataUrl: info.frameDataUrl, detailCoverDataUrl: info.detailFrameDataUrl }
      });
      if (resp && resp.ok && resp.data && resp.data.deduped) {
        showToast(`「${tag}」该片段刚已保存`);
      } else if (resp && resp.ok) {
        showToast(resp.data && resp.data.animeTitle
          ? `已保存「${tag}」· 《${resp.data.animeTitle}》`
          : `已保存「${tag}」`);
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
      width: 352px; padding: 18px;
      border-radius: 18px;
      color: #eceaf6; font: 14px/1.5 "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", system-ui, sans-serif;
      background:
        linear-gradient(180deg, rgba(22, 22, 40, .94), rgba(15, 15, 28, .94)) padding-box,
        linear-gradient(135deg, rgba(255, 77, 141, .8), rgba(167, 139, 250, .8) 50%, rgba(53, 214, 242, .7)) border-box;
      border: 1px solid transparent;
      box-shadow: 0 24px 70px rgba(0, 0, 0, .6), 0 0 40px rgba(167, 139, 250, .12);
      animation: slideIn .2s cubic-bezier(.22, 1, .36, 1);
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(28px) scale(.96); }
      to { opacity: 1; transform: none; }
    }
    .card.closing { opacity: 0; transform: translateX(28px) scale(.96); transition: all .16s ease-in; }
    h3 {
      margin: 0 0 12px; font-size: 15px; font-weight: 800; color: #fff;
      display: flex; align-items: center; gap: 8px;
    }
    h3::before {
      content: ''; width: 8px; height: 8px; border-radius: 50%;
      background: linear-gradient(135deg, #ff4d8d, #a78bfa);
      box-shadow: 0 0 12px rgba(255, 77, 141, .8);
    }
    .count {
      font-size: 11px; color: #9d9bb8; font-weight: 500; margin-left: auto;
      background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .1);
      border-radius: 99px; padding: 2px 10px;
    }
    .meta { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .badge {
      font-size: 12px; background: rgba(255, 255, 255, .05); border: 1px solid rgba(255, 255, 255, .12);
      border-radius: 8px; padding: 4px 10px; color: #9d9bb8;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      cursor: text; transition: border-color .15s;
    }
    .badge:hover { border-color: rgba(255, 77, 141, .4); }
    .badge.time {
      color: #35d6f2; font-variant-numeric: tabular-nums;
      font-family: "Cascadia Code", ui-monospace, Consolas, monospace;
    }
    .input-wrap { position: relative; }
    input {
      width: 100%; box-sizing: border-box; margin-bottom: 10px;
      background: rgba(8, 8, 16, .6); border: 1px solid rgba(255, 255, 255, .14);
      border-radius: 10px; color: #eceaf6; padding: 10px 13px; font-size: 14px;
      outline: none; font-family: inherit;
      transition: border-color .15s, box-shadow .15s;
    }
    input:focus { border-color: #ff4d8d; box-shadow: 0 0 0 3px rgba(255, 77, 141, .16); }
    input.error { border-color: #fb7185; box-shadow: 0 0 0 3px rgba(251, 113, 133, .16); }
    .ac-list {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 5;
      background: rgba(24, 24, 44, .98); border: 1px solid rgba(255, 255, 255, .14);
      border-radius: 10px; margin-top: 4px; max-height: 180px; overflow: auto;
      box-shadow: 0 16px 40px rgba(0, 0, 0, .5);
      animation: acIn .12s ease-out;
    }
    @keyframes acIn { from { opacity: 0; transform: translateY(-4px); } }
    .ac-item { padding: 9px 13px; cursor: pointer; font-size: 13px; color: #eceaf6; transition: background .1s; }
    .ac-item:hover, .ac-item.on { background: rgba(255, 77, 141, .12); color: #ffb3cb; }
    .dup-hint {
      margin-bottom: 10px; padding: 9px 12px; border-radius: 10px;
      background: rgba(251, 191, 36, .08); border: 1px solid rgba(251, 191, 36, .3);
      font-size: 12px; color: #fbbf24;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .dup-hint button {
      background: rgba(251, 191, 36, .1); border: 1px solid rgba(251, 191, 36, .4);
      border-radius: 8px; color: #fbbf24; font-size: 11px; padding: 3px 10px;
      cursor: pointer; font-family: inherit; transition: background .12s;
    }
    .dup-hint button:hover { background: rgba(251, 191, 36, .2); }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
    button {
      border-radius: 10px; padding: 8px 16px; font-size: 13px;
      cursor: pointer; font-family: inherit; font-weight: 600;
      transition: all .13s;
    }
    .cancel { background: rgba(255, 255, 255, .05); border: 1px solid rgba(255, 255, 255, .14); color: #eceaf6; }
    .cancel:hover { background: rgba(255, 255, 255, .1); }
    .toggle { background: rgba(255, 255, 255, .05); border: 1px solid rgba(255, 255, 255, .14); color: #9d9bb8; }
    .toggle:hover { background: rgba(255, 255, 255, .1); color: #eceaf6; }
    .toggle.on { background: rgba(74, 222, 128, .14); border-color: rgba(74, 222, 128, .5); color: #4ade80; box-shadow: 0 0 16px rgba(74, 222, 128, .18); }
    .save {
      background: linear-gradient(135deg, #ff4d8d, #a78bfa 60%, #35d6f2);
      border: none; color: #fff; font-weight: 800;
      box-shadow: 0 8px 22px rgba(255, 77, 141, .4);
    }
    .save:hover { filter: brightness(1.08); transform: translateY(-1px); }
    .save:active { transform: translateY(0) scale(.98); }
    .toast { margin-top: 10px; font-size: 12px; color: #4ade80; text-align: right; opacity: 0; transition: opacity .2s; font-weight: 600; }
    .toast.show { opacity: 1; }
    .anime-hint {
      margin-top: 10px; padding: 8px 12px; border-radius: 10px;
      background: rgba(167, 139, 250, .1); border: 1px solid rgba(167, 139, 250, .3);
      font-size: 12px; color: #b7a1f7;
    }
    [hidden] { display: none !important; }
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
        <div class="anime-hint" id="vt-anime" hidden></div>
        <div class="toast" id="vt-toast">已保存</div>
      </div>`;

    const titleEl = shadow.getElementById('vt-title');
    const timeEl = shadow.getElementById('vt-time');
    const tagInput = shadow.getElementById('vt-tag');
    const noteInput = shadow.getElementById('vt-note');
    const acList = shadow.getElementById('vt-ac');
    const dupHint = shadow.getElementById('vt-dup');
    const toast = shadow.getElementById('vt-toast');
    const animeHint = shadow.getElementById('vt-anime');
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
      // 时间戳同源截帧：普通模式用 Alt+S 按下瞬间的帧；连续模式每次保存时重截当前帧
      let coverDataUrl = info.frameDataUrl || null;
      let detailCoverDataUrl = info.detailFrameDataUrl || null;
      if (continuous) {
        const v = findVideo();
        if (v) {
          const frames = captureFrames(v);
          coverDataUrl = frames ? frames.thumb : coverDataUrl;
          detailCoverDataUrl = frames ? frames.detail : detailCoverDataUrl;
        }
      }
      const payload = {
        title: titleEl.textContent.trim() || info.title,
        url: info.url,
        timestampSec: Number.isFinite(editedSec) ? editedSec : info.timestampSec,
        tag,
        note: noteInput.value.trim(),
        videoDuration: currentVideoDuration(),
        ogImage: currentOgImage(),
        coverDataUrl,
        detailCoverDataUrl
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
        if (saveCount === 1 && resp.animeTitle) {
          animeHint.textContent = `识别到：${resp.animeTitle}${resp.episodeNo ? ` · 第${resp.episodeNo}集` : ''}`;
          animeHint.hidden = false;
        }
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
        if (resp.animeTitle) {
          // A 做轻：保存后浮层显示归属小字，稍作停留便于瞥一眼，不阻塞后续操作
          animeHint.textContent = `识别到：${resp.animeTitle}${resp.episodeNo ? ` · 第${resp.episodeNo}集` : ''}`;
          animeHint.hidden = false;
          setTimeout(close, 1600);
        } else {
          setTimeout(close, 400);
        }
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

  // ===== 看完自动弹（默认关，设置页开启）：进度 ≥95% 弹集级打标 =====

  function showWatchEndPrompt() {
    const video = findVideo();
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    let prompted = false;
    const onTime = () => {
      if (prompted) return;
      if (video.currentTime >= video.duration * 0.95) {
        prompted = true;
        video.removeEventListener('timeupdate', onTime);
        openWatchEndCard(video);
      }
    };
    video.addEventListener('timeupdate', onTime);
  }

  function openWatchEndCard(video) {
    document.getElementById('vt-watch-end')?.remove();
    const el = document.createElement('div');
    el.id = 'vt-watch-end';
    el.style.cssText = 'position:fixed;top:70px;right:24px;z-index:2147483646;' +
      'color:#eceaf6;width:292px;font:13px/1.5 "PingFang SC","Hiragino Sans GB","Microsoft YaHei UI",system-ui,sans-serif;' +
      'background:linear-gradient(180deg,rgba(22,22,40,.96),rgba(15,15,28,.96)) padding-box,' +
      'linear-gradient(135deg,rgba(255,77,141,.8),rgba(167,139,250,.8)) border-box;' +
      'border:1px solid transparent;border-radius:16px;padding:16px;' +
      'box-shadow:0 24px 70px rgba(0,0,0,.6);';
    el.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;color:#ffb3cb;font-size:14px;letter-spacing:.5px;">🎉 本集看完了</div>
      <div style="color:#9d9bb8;margin-bottom:12px;">给整集打个标签？如「神回」</div>
      <input id="vt-we-input" style="width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(8,8,16,.6);border:1px solid rgba(255,255,255,.14);border-radius:9px;color:#eceaf6;outline:none;font-family:inherit;" autocomplete="off">
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
        <button id="vt-we-close" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:#eceaf6;border-radius:9px;padding:6px 14px;cursor:pointer;font-family:inherit;">跳过</button>
        <button id="vt-we-save" style="background:linear-gradient(135deg,#ff4d8d,#a78bfa);border:none;color:#fff;border-radius:9px;padding:6px 16px;cursor:pointer;font-weight:700;font-family:inherit;box-shadow:0 6px 18px rgba(255,77,141,.35);">保存</button>
      </div>`;
    document.body.appendChild(el);
    const input = el.querySelector('#vt-we-input');
    const doSave = async () => {
      const tag = input.value.trim();
      if (!tag) { input.focus(); return; }
      const base = await getBackendBase();
      try {
        await fetch(`${base}/api/episodes/by-url/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: location.href, tag })
        });
        showToast(`已给本集添加标签「${tag}」`);
      } catch (e) {
        showToast('保存失败：后端未启动？');
      }
      el.remove();
    };
    el.querySelector('#vt-we-save').addEventListener('click', doSave);
    el.querySelector('#vt-we-close').addEventListener('click', () => el.remove());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
    input.focus();
  }

  getPrefs().then(prefs => {
    if (prefs && prefs.watchEndPrompt) {
      // 视频可能延迟出现：0s / 4s 各试一次绑定
      showWatchEndPrompt();
      setTimeout(showWatchEndPrompt, 4_000);
    }
  });
})();
