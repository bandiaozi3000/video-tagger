const backendInput = document.getElementById('backend');
const status = document.getElementById('status');
const slotsEl = document.getElementById('slots');
const silentCheckbox = document.getElementById('quick-silent');
const watchEndCheckbox = document.getElementById('watch-end');

const STORAGE_KEY = 'videoTaggerPrefs';
const DEFAULTS = { backendBaseUrl: 'http://localhost:8080', quickTags: {}, quickSilent: false, watchEndPrompt: false };

// 渲染 9 个快捷标签槽位
for (let i = 1; i <= 9; i++) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="slot-label">Ctrl+Shift+${i}</div>
    <input id="slot-${i}" placeholder="如：高燃" autocomplete="off">
  `;
  slotsEl.appendChild(wrap);
}

chrome.storage.sync.get(STORAGE_KEY, (data) => {
  const prefs = { ...DEFAULTS, ...(data[STORAGE_KEY] || {}) };
  backendInput.value = prefs.backendBaseUrl;
  silentCheckbox.checked = prefs.quickSilent;
  watchEndCheckbox.checked = !!prefs.watchEndPrompt;
  for (let i = 1; i <= 9; i++) {
    document.getElementById(`slot-${i}`).value = (prefs.quickTags && prefs.quickTags[i]) || '';
  }
});

document.getElementById('save').addEventListener('click', () => {
  const quickTags = {};
  for (let i = 1; i <= 9; i++) {
    quickTags[i] = document.getElementById(`slot-${i}`).value.trim();
  }
  chrome.storage.sync.set({
    [STORAGE_KEY]: {
      backendBaseUrl: backendInput.value.trim() || DEFAULTS.backendBaseUrl,
      quickTags,
      quickSilent: silentCheckbox.checked,
      watchEndPrompt: watchEndCheckbox.checked
    }
  }, () => {
    status.textContent = '已保存';
    setTimeout(() => { status.textContent = ''; }, 1500);
  });
});
