const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const semanticHint = document.getElementById('semantic-hint');

const editModal = document.getElementById('edit-modal');
const editTitle = document.getElementById('edit-title');
const editTag = document.getElementById('edit-tag');
const editNote = document.getElementById('edit-note');
const editTime = document.getElementById('edit-time');

let currentQuery = '';
let editingClip = null;

function fmtTime(sec) {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

async function runSearch(q) {
    currentQuery = q;
    statusEl.textContent = '搜索中…';
    resultsEl.innerHTML = '';
    try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        semanticHint.hidden = data.semanticEnabled;
        renderResults(data.results);
        statusEl.textContent = data.results.length ? `共 ${data.results.length} 条结果` : '没有找到相关片段';
    } catch (err) {
        statusEl.textContent = '搜索失败：后端未响应，请确认服务已启动';
    }
}

function doSearch(e) {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    runSearch(q);
}

function renderResults(results) {
    const maxScore = Math.max(...results.map(r => r.score), 0.0001);
    for (const r of results) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-title"></div>
            <div>
                <span class="badge-time">${fmtTime(r.timestampSec)}</span>
                <span class="card-tag"></span>
            </div>
            <div class="score-bar"><div style="width:${Math.round(r.score / maxScore * 100)}%"></div></div>
            <div class="card-actions">
                <button class="btn-edit" type="button">编辑</button>
                <button class="btn-delete" type="button">删除</button>
            </div>`;
        card.querySelector('.card-title').textContent = r.title;
        card.querySelector('.card-tag').textContent = r.tag + (r.note ? ` · ${r.note}` : '');
        card.addEventListener('click', () => jump(r));
        card.querySelector('.btn-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(r);
        });
        card.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDelete(r);
        });
        resultsEl.appendChild(card);
    }
}

async function jump(r) {
    try {
        await fetch('/api/jump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: r.url, timestampSec: r.timestampSec })
        });
    } catch (err) { /* 跳转队列失败不阻塞打开页面 */ }
    window.open(r.jumpUrl, '_blank');
}

function openEditModal(r) {
    editingClip = r;
    editTitle.value = r.title;
    editTag.value = r.tag;
    editNote.value = r.note || '';
    editTime.value = r.timestampSec;
    editModal.hidden = false;
    editTitle.focus();
}

async function saveEdit() {
    if (!editingClip) return;
    const payload = {
        title: editTitle.value.trim() || editingClip.title,
        url: editingClip.url,
        timestampSec: parseFloat(editTime.value),
        tag: editTag.value.trim(),
        note: editNote.value.trim()
    };
    if (!Number.isFinite(payload.timestampSec) || payload.timestampSec < 0 || !payload.tag) {
        statusEl.textContent = '保存失败：时间戳或标签不合法';
        return;
    }
    try {
        const resp = await fetch(`/api/clips/${editingClip.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        editModal.hidden = true;
        editingClip = null;
        runSearch(currentQuery);
    } catch (err) {
        statusEl.textContent = '保存失败：后端未响应或记录不存在';
    }
}

async function confirmDelete(r) {
    if (!confirm(`删除这条标签？\n${r.title} · ${fmtTime(r.timestampSec)} · ${r.tag}`)) return;
    try {
        const resp = await fetch(`/api/clips/${r.id}`, { method: 'DELETE' });
        if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
        runSearch(currentQuery);
    } catch (err) {
        statusEl.textContent = '删除失败：后端未响应';
    }
}

form.addEventListener('submit', doSearch);
clearBtn.addEventListener('click', () => { input.value = ''; resultsEl.innerHTML = ''; statusEl.textContent = ''; input.focus(); });
editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.hidden = true; });
document.getElementById('edit-cancel').addEventListener('click', () => { editModal.hidden = true; editingClip = null; });
document.getElementById('edit-save').addEventListener('click', saveEdit);
