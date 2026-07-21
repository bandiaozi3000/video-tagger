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

  function showOverlay(info) {
    document.getElementById('vt-overlay-root')?.remove();

    const root = document.createElement('div');
    root.id = 'vt-overlay-root';
    root.style.cssText = 'position:fixed;top:24px;right:24px;z-index:2147483647;' +
      'background:#1e1e2e;color:#cdd6f4;border-radius:12px;padding:16px;width:320px;' +
      'font:14px "Microsoft YaHei UI",sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.5);' +
      'border:1px solid #45475a;';

    root.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px;color:#cba6f7">标记片段</div>
      <div style="font-size:12px;color:#7f849c;margin-bottom:8px;word-break:break-all" id="vt-meta"></div>
      <input id="vt-tag" placeholder="标签，如：高燃战斗" style="width:100%;box-sizing:border-box;
        background:#313244;border:1px solid #45475a;border-radius:8px;color:#cdd6f4;
        padding:8px 10px;margin-bottom:8px;outline:none">
      <input id="vt-note" placeholder="备注（可选）" style="width:100%;box-sizing:border-box;
        background:#313244;border:1px solid #45475a;border-radius:8px;color:#cdd6f4;
        padding:8px 10px;margin-bottom:10px;outline:none">
      <div style="text-align:right">
        <button id="vt-cancel" style="background:transparent;border:1px solid #45475a;color:#cdd6f4;
          border-radius:8px;padding:6px 14px;margin-right:8px;cursor:pointer">取消</button>
        <button id="vt-save" style="background:#cba6f7;border:none;color:#1e1e2e;font-weight:600;
          border-radius:8px;padding:6px 14px;cursor:pointer">保存</button>
      </div>`;

    root.querySelector('#vt-meta').textContent =
      `${info.title} · ${Math.floor(info.timestampSec / 60)}:${String(Math.floor(info.timestampSec % 60)).padStart(2, '0')}`;
    document.body.appendChild(root);

    const tagInput = root.querySelector('#vt-tag');
    tagInput.focus();

    function close() { root.remove(); }

    async function save() {
      const tag = tagInput.value.trim();
      if (!tag) { tagInput.style.borderColor = '#f38ba8'; return; }
      const resp = await chrome.runtime.sendMessage({
        type: 'save-clip',
        payload: {
          title: info.title,
          url: info.url,
          timestampSec: info.timestampSec,
          tag,
          note: root.querySelector('#vt-note').value.trim()
        }
      });
      if (resp && resp.ok) close();
    }

    root.querySelector('#vt-save').addEventListener('click', save);
    root.querySelector('#vt-cancel').addEventListener('click', close);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') close();
      e.stopPropagation();
    });
  }
})();
