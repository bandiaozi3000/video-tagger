const DEFAULT_BACKEND = 'http://localhost:8080';

async function getBackendBase() {
  const { backendBaseUrl } = await chrome.storage.sync.get('backendBaseUrl');
  return backendBaseUrl || DEFAULT_BACKEND;
}

function notify(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'Video Tagger',
    message
  });
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'tag-clip') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const info = await chrome.tabs.sendMessage(tab.id, { type: 'grab-video' });
    if (!info || info.error) {
      notify(info && info.error === 'no-video' ? '当前页面没有找到视频' : '该页面不支持抓取');
      return;
    }
    await chrome.tabs.sendMessage(tab.id, { type: 'show-overlay', info });
  } catch (e) {
    notify('该页面不支持打标签（无法注入脚本）');
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'save-clip') {
    (async () => {
      const base = await getBackendBase();
      try {
        const resp = await fetch(`${base}/api/clips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        sendResponse({ ok: true });
      } catch (e) {
        notify('保存失败：后端未启动？请先执行 docker compose up -d');
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true; // 异步 sendResponse
  }
  if (msg.type === 'notify') {
    notify(msg.message);
    return false;
  }
});
