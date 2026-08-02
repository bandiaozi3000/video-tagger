const views = {
  search: document.getElementById('view-search'),
  videos: document.getElementById('view-videos'),
  timeline: document.getElementById('view-timeline'),
  stats: document.getElementById('view-stats')
};

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const semanticHint = document.getElementById('semantic-hint');

const videoStatusEl = document.getElementById('video-status');
const videoListEl = document.getElementById('video-list');
const loadMoreBtn = document.getElementById('load-more');

const backBtn = document.getElementById('back-to-videos');
const timelineTitleEl = document.getElementById('timeline-title');
const timelineAxisEl = document.getElementById('timeline-axis');
const timelineStatusEl = document.getElementById('timeline-status');
const timelineClipsEl = document.getElementById('timeline-clips');

const editModal = document.getElementById('edit-modal');
const editTitle = document.getElementById('edit-title');
const editTag = document.getElementById('edit-tag');
const editNote = document.getElementById('edit-note');
const editTime = document.getElementById('edit-time');

const similarModal = document.getElementById('similar-modal');
const similarStatusEl = document.getElementById('similar-status');
const similarResultsEl = document.getElementById('similar-results');

const statClipsEl = document.getElementById('stat-clips');
const statVideosEl = document.getElementById('stat-videos');
const statTagsEl = document.getElementById('stat-tags');
const statsTagsEl = document.getElementById('stats-tags');
const statsSitesEl = document.getElementById('stats-sites');
const statsTrendEl = document.getElementById('stats-trend');
const statsStatusEl = document.getElementById('stats-status');

let currentQuery = '';
let editingClip = null;
let videoCursor = null;   // { latest, fp } 下一页游标
let pageSize = 20;
let currentVideo = null;  // { fp, title }

// ---------- 通用 ----------

function fmtTime(sec) {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtDateTime(ms) {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildJumpUrl(url, ts) {
    const s = Math.floor(ts);
    if (url.includes('youtube.com/watch')) return url + (url.includes('?') ? '&' : '?') + `t=${s}s`;
    if (url.includes('bilibili.com/video')) return url + (url.includes('?') ? '&' : '?') + `t=${s}`;
    return url;
}

async function jump(r) {
    try {
        await fetch('/api/jump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: r.url, timestampSec: r.timestampSec })
        });
    } catch (err) { /* 跳转队列失败不阻塞打开页面 */ }
    window.open(buildJumpUrl(r.url, r.timestampSec), '_blank');
}

function showView(name) {
    document.querySelectorAll('.nav .tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
    for (const [k, el] of Object.entries(views)) {
        el.hidden = k !== name;
    }
    if (name === 'videos') loadVideos(true);
    if (name === 'stats') loadStats();
}

// ---------- 搜索 ----------

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

function appendClipCard(container, r, opts) {
    const card = document.createElement('div');
    card.className = 'card';
    const maxScore = opts && opts.maxScore;
    const scoreBar = maxScore
        ? `<div class="score-bar"><div style="width:${Math.round(r.score / maxScore * 100)}%"></div></div>`
        : '';
    card.innerHTML = `
        <div class="card-title"></div>
        <div>
            <span class="badge-time">${fmtTime(r.timestampSec)}</span>
            <span class="card-tag"></span>
        </div>
        ${scoreBar}
        <div class="card-actions">
            <button class="btn-similar" type="button">相似</button>
            <button class="btn-edit" type="button">编辑</button>
            <button class="btn-delete" type="button">删除</button>
        </div>`;
    card.querySelector('.card-title').textContent = r.title;
    card.querySelector('.card-tag').textContent = r.tag + (r.note ? ` · ${r.note}` : '');
    card.addEventListener('click', () => jump(r));
    card.querySelector('.btn-similar').addEventListener('click', (e) => {
        e.stopPropagation();
        openSimilar(r);
    });
    card.querySelector('.btn-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(r);
    });
    card.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDelete(r);
    });
    container.appendChild(card);
}

function renderResults(results) {
    const maxScore = Math.max(...results.map(r => r.score), 0.0001);
    for (const r of results) {
        appendClipCard(resultsEl, r, { maxScore });
    }
}

// ---------- 视频列表 ----------

async function loadVideos(reset) {
    if (reset) {
        videoListEl.innerHTML = '';
        videoCursor = null;
    }
    videoStatusEl.textContent = '加载中…';
    try {
        const params = new URLSearchParams({ limit: pageSize });
        if (videoCursor) {
            params.set('cursorLatest', videoCursor.latest);
            params.set('cursorFp', videoCursor.fp);
        }
        const resp = await fetch(`/api/videos?${params}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const list = await resp.json();
        videoStatusEl.textContent = '';
        for (const v of list) {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="video-card">
                    <div class="vc-main">
                        <div class="vc-title"></div>
                        <div class="vc-meta"></div>
                    </div>
                    <div class="vc-count"></div>
                </div>`;
            card.querySelector('.vc-title').textContent = v.title || '(未命名)';
            card.querySelector('.vc-meta').textContent = `最近标记 ${fmtDateTime(v.latest)}`;
            card.querySelector('.vc-count').textContent = `${v.count} 条`;
            card.addEventListener('click', () => openTimeline(v));
            videoListEl.appendChild(card);
        }
        const last = list[list.length - 1];
        videoCursor = last ? { latest: last.latest, fp: last.fp } : null;
        loadMoreBtn.hidden = list.length < pageSize;
    } catch (err) {
        videoStatusEl.textContent = '加载失败：后端未响应';
    }
}

// ---------- 时间线 ----------

async function openTimeline(v) {
    currentVideo = { fp: v.fp, title: v.title };
    showView('timeline');
    timelineTitleEl.textContent = v.title || '(未命名)';
    timelineAxisEl.innerHTML = '';
    timelineClipsEl.innerHTML = '';
    timelineStatusEl.textContent = '加载中…';
    try {
        const resp = await fetch(`/api/videos/${encodeURIComponent(v.fp)}/clips`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const clips = await resp.json();
        timelineStatusEl.textContent = '';
        renderTimeline(clips);
    } catch (err) {
        timelineStatusEl.textContent = '加载失败：后端未响应';
    }
}

function renderTimeline(clips) {
    if (clips.length === 0) {
        timelineStatusEl.textContent = '该视频暂无标记，去看片按 Alt+S 打一个';
        return;
    }
    const maxTs = Math.max(...clips.map(c => c.timestampSec || 0));
    const total = Math.max(...clips.map(c => c.videoDuration || 0), maxTs, 1);

    for (const c of clips) {
        const marker = document.createElement('div');
        marker.className = 'marker';
        marker.dataset.time = fmtTime(c.timestampSec);
        marker.style.left = `${Math.min(c.timestampSec / total * 100, 100)}%`;
        marker.title = `${fmtTime(c.timestampSec)} · ${c.tag}`;
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            jump(c);
        });
        timelineAxisEl.appendChild(marker);
    }
    const endLabel = document.createElement('div');
    endLabel.className = 'axis-label';
    endLabel.style.right = '6px';
    endLabel.textContent = fmtTime(total);
    timelineAxisEl.appendChild(endLabel);

    for (const c of clips) {
        appendClipCard(timelineClipsEl, c, {});
    }
    timelineStatusEl.textContent = `共 ${clips.length} 个标记点`;
}

// ---------- 编辑 / 删除 ----------

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
        refreshCurrentView();
    } catch (err) {
        statusEl.textContent = '保存失败：后端未响应或记录不存在';
    }
}

async function confirmDelete(r) {
    if (!confirm(`删除这条标签？\n${r.title} · ${fmtTime(r.timestampSec)} · ${r.tag}`)) return;
    try {
        const resp = await fetch(`/api/clips/${r.id}`, { method: 'DELETE' });
        if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
        refreshCurrentView();
    } catch (err) {
        statusEl.textContent = '删除失败：后端未响应';
    }
}

function refreshCurrentView() {
    const active = document.querySelector('.nav .tab.active').dataset.view;
    if (active === 'search') {
        if (currentQuery) runSearch(currentQuery);
    } else if (active === 'timeline' && currentVideo) {
        openTimeline(currentVideo);
    } else if (active === 'videos') {
        loadVideos(true);
    }
}

// ---------- 相似片段 ----------

async function openSimilar(r) {
    similarModal.hidden = false;
    similarStatusEl.textContent = '加载中…';
    similarResultsEl.innerHTML = '';
    try {
        const resp = await fetch(`/api/search/similar?id=${r.id}&limit=10`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const list = await resp.json();
        similarStatusEl.textContent = '';
        if (list.length === 0) {
            similarStatusEl.textContent = '没有找到相似片段';
            return;
        }
        for (const s of list) appendClipCard(similarResultsEl, s, {});
    } catch (err) {
        similarStatusEl.textContent = '加载失败：后端未响应';
    }
}

// ---------- 统计 ----------

async function loadStats() {
    statsStatusEl.textContent = '加载中…';
    try {
        const resp = await fetch('/api/stats');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        statsStatusEl.textContent = '';
        statClipsEl.textContent = data.totalClips;
        statVideosEl.textContent = data.totalVideos;
        statTagsEl.textContent = data.totalTags;

        statsTagsEl.innerHTML = '';
        if (!data.topTags || data.topTags.length === 0) {
            statsTagsEl.textContent = '暂无标签';
        } else {
            for (const t of data.topTags) {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'tag-chip';
                chip.textContent = `${t.tag} · ${t.count}`;
                chip.addEventListener('click', () => {
                    showView('search');
                    input.value = t.tag;
                    runSearch(t.tag);
                });
                statsTagsEl.appendChild(chip);
            }
        }

        renderBars(statsSitesEl, data.bySite || [], {
            value: s => s.count,
            label: s => s.site.replace(/^www\./, ''),
            barW: 60
        });
        renderBars(statsTrendEl, fillTrend(data.trend30 || [], 30), {
            value: p => p.count,
            label: p => p.date.slice(5),
            barW: 16,
            labelEvery: 5,
            emptyText: '近 30 天暂无标记'
        });
    } catch (err) {
        statsStatusEl.textContent = '加载失败：后端未响应';
    }
}

function fillTrend(points, days) {
    const map = {};
    for (const p of points) map[p.date] = p.count;
    const result = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        result.push({ date: key, count: map[key] || 0 });
    }
    return result;
}

function renderBars(el, items, opts) {
    el.innerHTML = '';
    if (!items || items.length === 0) {
        el.textContent = opts.emptyText || '暂无数据';
        return;
    }
    const barW = opts.barW || 40;
    const gap = barW >= 40 ? 8 : 3;
    const max = Math.max(...items.map(opts.value), 1);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '150');
    svg.setAttribute('viewBox', `0 0 ${items.length * (barW + gap)} 150`);
    items.forEach((item, i) => {
        const h = Math.max(item.count > 0 ? opts.value(item) / max * 110 : 2, 2);
        const x = i * (barW + gap);
        const y = 128 - h;
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', barW - 2);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', '3');
        rect.setAttribute('fill', opts.value(item) === 0 ? '#45475a' : '#cba6f7');
        svg.appendChild(rect);
        const num = document.createElementNS(svgNS, 'text');
        num.setAttribute('x', x + (barW - 2) / 2);
        num.setAttribute('y', y - 5);
        num.setAttribute('text-anchor', 'middle');
        num.setAttribute('font-size', '10');
        num.setAttribute('fill', '#a6adc8');
        num.textContent = opts.value(item);
        svg.appendChild(num);
        const showLabel = !opts.labelEvery || i % opts.labelEvery === 0;
        if (showLabel && opts.label) {
            const name = document.createElementNS(svgNS, 'text');
            name.setAttribute('x', x + (barW - 2) / 2);
            name.setAttribute('y', 144);
            name.setAttribute('text-anchor', 'middle');
            name.setAttribute('font-size', '10');
            name.setAttribute('fill', '#6c7086');
            name.textContent = opts.label(item);
            svg.appendChild(name);
        }
    });
    el.appendChild(svg);
}

// ---------- 事件绑定 ----------

form.addEventListener('submit', doSearch);
clearBtn.addEventListener('click', () => { input.value = ''; resultsEl.innerHTML = ''; statusEl.textContent = ''; input.focus(); });
loadMoreBtn.addEventListener('click', () => loadVideos(false));
backBtn.addEventListener('click', () => showView('videos'));
document.querySelectorAll('.nav .tab').forEach(tab => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
});
editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.hidden = true; });
document.getElementById('edit-cancel').addEventListener('click', () => { editModal.hidden = true; editingClip = null; });
document.getElementById('edit-save').addEventListener('click', saveEdit);
similarModal.addEventListener('click', (e) => { if (e.target === similarModal) similarModal.hidden = true; });
document.getElementById('similar-close').addEventListener('click', () => { similarModal.hidden = true; });
