(function () {
  if (window.__videoTaggerLoaded) return;
  window.__videoTaggerLoaded = true;

  function findVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    return videos.find(v => !v.paused) || videos[0];
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
    .meta { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .badge {
      font-size: 12px; background: #313244; border: 1px solid #45475a;
      border-radius: 6px; padding: 3px 8px; color: #a6adc8;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      cursor: text;
    }
    .badge.time { color: #cba6f7; font-variant-numeric: tabular-nums; }
    input {
      width: 100%; box-sizing: border-box; margin-bottom: 10px;
      background: #313244; border: 1px solid #45475a; border-radius: 8px;
      color: #cdd6f4; padding: 9px 12px; font-size: 14px; outline: none;
      font-family: inherit;
    }
    input:focus { border-color: #cba6f7; }
    input.error { border-color: #f38ba8; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
    button {
      border-radius: 8px; padding: 7px 16px; font-size: 13px; cursor: pointer;
      font-family: inherit;
    }
    .cancel { background: transparent; border: 1px solid #45475a; color: #cdd6f4; }
    .cancel:hover { background: #313244; }
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
        <h3>标记片段</h3>
        <div class="meta">
          <span class="badge" id="vt-title" contenteditable="true" title="点击可编辑"></span>
          <span class="badge time" id="vt-time" contenteditable="true" title="点击可编辑（秒）"></span>
        </div>
        <input id="vt-tag" placeholder="标签，如：高燃战斗" autocomplete="off">
        <input id="vt-note" placeholder="备注（可选）" autocomplete="off">
        <div class="actions">
          <button class="cancel" id="vt-cancel">取消</button>
          <button class="save" id="vt-save">保存 (Enter)</button>
        </div>
        <div class="toast" id="vt-toast">已保存</div>
      </div>`;

    const titleEl = shadow.getElementById('vt-title');
    const timeEl = shadow.getElementById('vt-time');
    titleEl.textContent = info.title;
    timeEl.textContent = String(Math.round(info.timestampSec));
    timeEl.title = `点击可编辑（秒）· 当前 ${fmtTime(info.timestampSec)}`;

    document.body.appendChild(host);

    const card = shadow.querySelector('.card');
    const tagInput = shadow.getElementById('vt-tag');
    const noteInput = shadow.getElementById('vt-note');
    tagInput.focus();

    function close() {
      card.classList.add('closing');
      setTimeout(() => host.remove(), 150);
    }

    async function save() {
      const tag = tagInput.value.trim();
      if (!tag) {
        tagInput.classList.add('error');
        tagInput.focus();
        return;
      }
      const editedSec = parseFloat(timeEl.textContent);
      const resp = await chrome.runtime.sendMessage({
        type: 'save-clip',
        payload: {
          title: titleEl.textContent.trim() || info.title,
          url: info.url,
          timestampSec: Number.isFinite(editedSec) ? editedSec : info.timestampSec,
          tag,
          note: noteInput.value.trim()
        }
      });
      if (resp && resp.ok) {
        shadow.getElementById('vt-toast').classList.add('show');
        setTimeout(close, 400);
      }
    }

    shadow.getElementById('vt-save').addEventListener('click', save);
    shadow.getElementById('vt-cancel').addEventListener('click', close);
    card.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && e.target.id !== 'vt-title') save();
      if (e.key === 'Escape') close();
    });
  }
})();
