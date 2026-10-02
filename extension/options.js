const backendInput = document.getElementById('backend');
const status = document.getElementById('status');
const slotsEl = document.getElementById('slots');
const silentCheckbox = document.getElementById('quick-silent');
const watchEndCheckbox = document.getElementById('watch-end');

const STORAGE_KEY = 'videoTaggerPrefs';
const DEFAULTS = { backendBaseUrl: 'http://localhost:8080', quickTags: {}, quickTagIds: {}, quickSilent: false, watchEndPrompt: false };

/** 词表缓存：`{id, name}[]`（受控词表 —— 快捷位只能从这里选，v0.31）。 */
let lexicon = [];
/** 当前选中的 id（按槽位）：`{[slot]: id}` —— 保存时写回 quickTagIds。 */
const picked = {};
/** 旧配置里存的名字（tagId 还没解析出来时先占位显示）。 */
let legacyNames = {};

// 渲染 9 个快捷标签槽位（下拉选词条，不再自由输入）
for (let i = 1; i <= 9; i++) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="slot-label">Ctrl+Shift+${i}</div>
    <select id="slot-${i}"><option value="">— 不设置 —</option></select>
  `;
  slotsEl.appendChild(wrap);
}

function backendBase(prefs) {
  return (prefs.backendBaseUrl || DEFAULTS.backendBaseUrl).replace(/\/$/, '');
}

function fillSlotOptions() {
  for (let i = 1; i <= 9; i++) {
    const sel = document.getElementById(`slot-${i}`);
    sel.innerHTML = '<option value="">— 不设置 —</option>';
    for (const tag of lexicon) {
      const opt = document.createElement('option');
      opt.value = String(tag.id);
      opt.textContent = tag.name;
      sel.appendChild(opt);
    }
    if (picked[i]) sel.value = String(picked[i]);
    // 旧配置只有名字、词表里又找不到 → 明确告知，不静默丢
    if (!picked[i] && legacyNames[i]) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = `（旧配置「${legacyNames[i]}」不在词库里，请重选）`;
      opt.disabled = true;
      sel.appendChild(opt);
      sel.value = '';
    }
  }
}

chrome.storage.sync.get(STORAGE_KEY, (data) => {
  const prefs = { ...DEFAULTS, ...(data[STORAGE_KEY] || {}) };
  backendInput.value = prefs.backendBaseUrl;
  silentCheckbox.checked = prefs.quickSilent;
  watchEndCheckbox.checked = !!prefs.watchEndPrompt;
  for (let i = 1; i <= 9; i++) {
    const id = prefs.quickTagIds && prefs.quickTagIds[i];
    if (id) picked[i] = Number(id);
    const name = prefs.quickTags && prefs.quickTags[i];
    if (name) legacyNames[i] = name;
  }
  // 拉词表（受控：下拉候选；顺带把旧名字映射回 id）
  fetch(`${backendBase(prefs)}/api/tags/manage?size=10000`)
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((page) => {
      lexicon = ((page && page.items) || []).map((t) => ({ id: t.id, name: t.name }));
      for (let i = 1; i <= 9; i++) {
        if (picked[i] || !legacyNames[i]) continue;
        const hit = lexicon.find((t) => t.name === legacyNames[i]);
        if (hit) picked[i] = hit.id;
      }
      fillSlotOptions();
    })
    .catch(() => {
      fillSlotOptions();
      status.textContent = '词表读取失败（后端未启动？）——先手动重选';
    });
  fillSlotOptions();
});

document.getElementById('save').addEventListener('click', () => {
  const quickTagIds = {};
  const quickTags = {};
  for (let i = 1; i <= 9; i++) {
    const raw = document.getElementById(`slot-${i}`).value;
    if (!raw) continue;
    const id = Number(raw);
    const hit = lexicon.find((t) => t.id === id);
    quickTagIds[i] = id;
    quickTags[i] = hit ? hit.name : '';
  }
  chrome.storage.sync.set({
    [STORAGE_KEY]: {
      backendBaseUrl: backendInput.value.trim() || DEFAULTS.backendBaseUrl,
      quickTagIds,
      quickTags,
      quickSilent: silentCheckbox.checked,
      watchEndPrompt: watchEndCheckbox.checked
    }
  }, () => {
    status.textContent = '已保存（快捷位已绑定词条 id）';
    setTimeout(() => { status.textContent = ''; }, 1800);
  });
});
