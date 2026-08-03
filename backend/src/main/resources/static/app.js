const views = {
  search: document.getElementById('view-search'),
  anime: document.getElementById('view-anime'),
  animeDetail: document.getElementById('view-anime-detail'),
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

const animeStatusEl = document.getElementById('anime-status');
const animeGridEl = document.getElementById('anime-grid');
const animeDetailHeadEl = document.getElementById('anime-detail-head');
const episodeListEl = document.getElementById('episode-list');
const detailTagsEl = document.getElementById('detail-tags');
const detailStatusEl = document.getElementById('detail-status');
const animeModal = document.getElementById('anime-modal');
const animeModalTitle = document.getElementById('anime-modal-title');
const animeTitleInput = document.getElementById('anime-title');
const animeTypeSelect = document.getElementById('anime-type');
const animeStatusSelect = document.getElementById('anime-status');
const animeRatingInput = document.getElementById('anime-rating');
const coverModal = document.getElementById('cover-modal');
const coverUrlInput = document.getElementById('cover-url');
const coverFileInput = document.getElementById('cover-file');
const renameModal = document.getElementById('rename-modal');
const renameTitleInput = document.getElementById('rename-title');
const mergeIntoSelect = document.getElementById('merge-into');
const episodeTagModal = document.getElementById('episode-tag-modal');
const episodeTagTargetEl = document.getElementById('episode-tag-target');
const episodeTagInput = document.getElementById('episode-tag-input');

const ANIME_TYPE_LABEL = { ANIME: '动画', MOVIE: '电影' };
const ANIME_STATUS_LABEL = { WANT: '想看', WATCHING: '在看', DONE: '看完', PAUSED: '搁置', DROPPED: '弃番' };

let currentQuery = '';
let currentDim = 'mixed';
let editingClip = null;
let videoCursor = null;   // { latest, fp } 下一页游标
let pageSize = 20;
let currentVideo = null;  // { fp, title }
let animeMode = 'recent';
let currentAnime = null;  // 番剧详情当前对象
let editingAnimeId = null;
let episodeTagEpisodeId = null;
let fromAnimeDetail = false;

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
    if (name === 'anime') loadAnime();
}

// ---------- 搜索 ----------

async function runSearch(q) {
    currentQuery = q;
    statusEl.textContent = '搜索中…';
    resultsEl.innerHTML = '';
    try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}&dim=${encodeURIComponent(currentDim)}`);
        const data = await resp.json();
        semanticHint.hidden = data.semanticEnabled;
        renderResults(data.results);
        statusEl.textContent = data.results.length ? `共 ${data.results.length} 条结果` : '没有找到相关内容';
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
    resultsEl.innerHTML = '';
    if (!results || results.length === 0) return;
    if (currentDim === 'mixed') {
        renderMixed(results);
    } else {
        for (const r of results) appendSearchCard(resultsEl, r, {});
    }
}

// 混合模式：三层结果分栏展示（番剧 / 集 / 片段）
function renderMixed(results) {
    const groups = { ANIME: [], EPISODE: [], CLIP: [] };
    for (const r of results) (groups[r.entityType] || groups.CLIP).push(r);
    const labels = { ANIME: '番剧', EPISODE: '集', CLIP: '片段' };
    for (const [type, items] of Object.entries(groups)) {
        if (items.length === 0) continue;
        const sec = document.createElement('section');
        sec.className = 'mixed-section';
        const h = document.createElement('h3');
        h.className = 'mixed-title';
        h.textContent = `${labels[type]}（${items.length}）`;
        const body = document.createElement('div');
        body.className = 'mixed-body';
        for (const r of items) appendSearchCard(body, r, {});
        sec.appendChild(h);
        sec.appendChild(body);
        resultsEl.appendChild(sec);
    }
}

function appendSearchCard(container, r, opts) {
    if (r.entityType === 'ANIME') return appendAnimeCard(container, r);
    if (r.entityType === 'EPISODE') return appendEpisodeCard(container, r);
    appendClipCard(container, r, opts);
}

function appendAnimeCard(container, r) {
    const card = document.createElement('div');
    card.className = 'card search-entity-card';
    card.innerHTML = `<div class="card-title"></div><div class="card-tag"></div>`;
    card.querySelector('.card-title').textContent = r.title || '(未命名)';
    card.querySelector('.card-tag').textContent = `番剧 · 匹配 ${Math.round((r.score || 0) * 100) / 100}`;
    card.addEventListener('click', () => openAnimeDetail(r.animeId));
    container.appendChild(card);
}

function appendEpisodeCard(container, r) {
    const card = document.createElement('div');
    card.className = 'card search-entity-card';
    card.innerHTML = `<div class="card-title"></div><div class="card-tag"></div>`;
    card.querySelector('.card-title').textContent = r.title || '(未命名)';
    card.querySelector('.card-tag').textContent = `集 · 匹配 ${Math.round((r.score || 0) * 100) / 100}`;
    card.addEventListener('click', () => {
        if (r.videoFp) {
            fromAnimeDetail = true;
            openTimeline({ fp: r.videoFp, title: r.title || '时间线' });
        } else if (r.animeId) {
            openAnimeDetail(r.animeId);
        }
    });
    container.appendChild(card);
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
    } else if (active === 'anime') {
        loadAnime();
    } else if (active === 'anime-detail' && currentAnime) {
        openAnimeDetail(currentAnime.id);
    }
}

// ---------- 番剧 ----------

function esc(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
}

async function loadAnime() {
    animeStatusEl.textContent = '加载中…';
    animeGridEl.innerHTML = '';
    try {
        const path = animeMode === 'recent' ? '/api/anime/recent?limit=50' : '/api/anime?limit=100';
        const resp = await fetch(path);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const list = await resp.json();
        animeStatusEl.textContent = list.length
            ? ''
            : (animeMode === 'recent' ? '还没有打过标记的番剧，去看片按 Alt+S 打一个' : '还没有番剧，点右上角新建或看片打标');
        renderAnimeGrid(list);
    } catch (err) {
        animeStatusEl.textContent = '加载失败：后端未响应';
    }
}

function renderAnimeGrid(list) {
    for (const a of list) {
        const card = document.createElement('div');
        card.className = 'anime-card';
        const cover = a.coverPath
            ? `<img src="${a.coverPath}" alt="">`
            : `<span class="cover-placeholder">${esc(a.title).slice(0, 1)}</span>`;
        card.innerHTML = `
            <div class="anime-cover">${cover}</div>
            <div class="anime-card-body">
                <div class="anime-card-title"></div>
                <div class="anime-card-meta"></div>
                <div class="anime-card-badges"></div>
            </div>`;
        card.querySelector('.anime-card-title').textContent = a.title;
        const meta = [];
        if (a.status) meta.push(ANIME_STATUS_LABEL[a.status] || a.status);
        if (a.type) meta.push(ANIME_TYPE_LABEL[a.type] || a.type);
        if (a.rating != null) meta.push(`★ ${a.rating}`);
        meta.push(`${a.clipCount || 0} 条片段`);
        card.querySelector('.anime-card-meta').textContent = meta.join(' · ');
        const badges = card.querySelector('.anime-card-badges');
        if (a.confirmed === 0) {
            const b = document.createElement('span');
            b.className = 'badge-warn';
            b.textContent = '待确认';
            badges.appendChild(b);
        }
        card.addEventListener('click', () => openAnimeDetail(a.id));
        animeGridEl.appendChild(card);
    }
}

async function openAnimeDetail(id) {
    currentAnime = { id };
    fromAnimeDetail = false;
    showView('anime-detail');
    animeDetailHeadEl.innerHTML = '';
    episodeListEl.innerHTML = '';
    detailTagsEl.innerHTML = '';
    detailStatusEl.textContent = '加载中…';
    try {
        const [detailResp, epResp] = await Promise.all([
            fetch(`/api/anime/${id}`),
            fetch(`/api/anime/${id}/episodes`)
        ]);
        if (!detailResp.ok) throw new Error(`HTTP ${detailResp.status}`);
        const detail = await detailResp.json();
        const eps = epResp.ok ? await epResp.json() : [];
        currentAnime = detail;
        renderAnimeDetail(detail, eps);
        detailStatusEl.textContent = '';
    } catch (err) {
        detailStatusEl.textContent = '加载失败：后端未响应';
    }
}

function renderAnimeDetail(d, eps) {
    const cover = d.coverPath
        ? `<img src="${d.coverPath}" alt="">`
        : `<span class="cover-placeholder large">${esc(d.title).slice(0, 1)}</span>`;
    animeDetailHeadEl.innerHTML = `
        <div class="ad-cover">${cover}</div>
        <div class="ad-info">
            <h2 class="ad-title"></h2>
            <div class="ad-meta"></div>
        </div>`;
    animeDetailHeadEl.querySelector('.ad-title').textContent = d.title;
    const meta = [];
    if (d.status) meta.push(ANIME_STATUS_LABEL[d.status] || d.status);
    if (d.type) meta.push(ANIME_TYPE_LABEL[d.type] || d.type);
    if (d.rating != null) meta.push(`★ ${d.rating}`);
    meta.push(`${d.episodeCount || 0} 集 · ${d.clipCount || 0} 条片段`);
    animeDetailHeadEl.querySelector('.ad-meta').textContent = meta.join(' · ');
    renderDetailTags(d);
    renderEpisodeList(eps);
}

function renderDetailTags(d) {
    detailTagsEl.innerHTML = '';
    for (const t of (d.tags || [])) {
        const chip = document.createElement('span');
        chip.className = 'tag-chip removable';
        chip.textContent = t.name;
        const rm = document.createElement('span');
        rm.className = 'chip-remove';
        rm.textContent = '×';
        rm.addEventListener('click', async (e) => {
            e.stopPropagation();
            await fetch(`/api/anime/${d.id}/tags/${t.id}`, { method: 'DELETE' });
            refreshAnimeDetail();
        });
        chip.appendChild(rm);
        detailTagsEl.appendChild(chip);
    }
    const wrap = document.createElement('span');
    wrap.className = 'tag-add-wrap';
    const input = document.createElement('input');
    input.className = 'tag-add-input';
    input.placeholder = '+ 添加标签';
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            await fetch(`/api/anime/${d.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag: input.value.trim() })
            });
            refreshAnimeDetail();
        }
    });
    wrap.appendChild(input);
    detailTagsEl.appendChild(wrap);
}

function refreshAnimeDetail() {
    if (currentAnime && currentAnime.id) openAnimeDetail(currentAnime.id);
}

function renderEpisodeList(eps) {
    episodeListEl.innerHTML = '';
    if (eps.length === 0) {
        episodeListEl.innerHTML = '<div class="status">该番剧还没有集，去看片按 Alt+S 打标记会自动创建</div>';
        return;
    }
    for (const ep of eps) {
        const row = document.createElement('div');
        row.className = 'episode-row';
        const no = ep.episodeNo != null
            ? (ep.season != null ? `${ep.season}-${ep.episodeNo}` : `第${ep.episodeNo}集`)
            : (ep.season != null ? `S${ep.season}` : '?');
        row.innerHTML = `
            <div class="ep-no"></div>
            <div class="ep-main">
                <div class="ep-title"></div>
                <div class="ep-meta"></div>
                <div class="ep-tags"></div>
            </div>
            <div class="ep-actions">
                <button type="button" class="btn-mini ep-tag-btn">打标签</button>
                <button type="button" class="btn-mini ep-time-btn">时间线</button>
            </div>`;
        row.querySelector('.ep-no').textContent = no;
        row.querySelector('.ep-title').textContent = ep.title || '(未命名)';
        row.querySelector('.ep-meta').textContent = `${ep.clipCount || 0} 条片段`
            + (ep.latestAt ? ` · 最近标记 ${fmtDateTime(ep.latestAt)}` : '');
        const tagsEl = row.querySelector('.ep-tags');
        for (const t of (ep.tags || [])) {
            const chip = document.createElement('span');
            chip.className = 'ep-tag-chip';
            chip.textContent = t.name;
            const rm = document.createElement('span');
            rm.className = 'chip-remove';
            rm.textContent = '×';
            rm.addEventListener('click', async (e) => {
                e.stopPropagation();
                await fetch(`/api/episodes/${ep.id}/tags/${t.id}`, { method: 'DELETE' });
                refreshAnimeDetail();
            });
            chip.appendChild(rm);
            tagsEl.appendChild(chip);
        }
        row.querySelector('.ep-tag-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEpisodeTagModal(ep);
        });
        row.querySelector('.ep-time-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            fromAnimeDetail = true;
            openTimeline({ fp: ep.videoFp, title: (currentAnime.title || '') + (no !== '?' ? ` · ${no}` : '') });
        });
        episodeListEl.appendChild(row);
    }
}

function openEpisodeTagModal(ep) {
    episodeTagEpisodeId = ep.id;
    episodeTagTargetEl.textContent = `《${currentAnime.title}》 · ${ep.episodeNo != null ? `第${ep.episodeNo}集` : '本集'}`;
    episodeTagInput.value = '';
    episodeTagModal.hidden = false;
    episodeTagInput.focus();
}

async function saveEpisodeTag() {
    const tag = episodeTagInput.value.trim();
    if (!tag || episodeTagEpisodeId == null) return;
    await fetch(`/api/episodes/${episodeTagEpisodeId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
    });
    episodeTagModal.hidden = true;
    refreshAnimeDetail();
}

function openCreateAnime() {
    editingAnimeId = null;
    animeModalTitle.textContent = '新建番剧';
    animeTitleInput.value = '';
    animeTypeSelect.value = 'ANIME';
    animeStatusSelect.value = 'WANT';
    animeRatingInput.value = '';
    animeModal.hidden = false;
    animeTitleInput.focus();
}

function openEditAnime() {
    const d = currentAnime;
    if (!d) return;
    editingAnimeId = d.id;
    animeModalTitle.textContent = '编辑番剧';
    animeTitleInput.value = d.title;
    animeTypeSelect.value = d.type || 'ANIME';
    animeStatusSelect.value = d.status || 'WANT';
    animeRatingInput.value = d.rating != null ? d.rating : '';
    animeModal.hidden = false;
    animeTitleInput.focus();
}

async function saveAnime() {
    const title = animeTitleInput.value.trim();
    if (!title) return;
    const payload = {
        title,
        type: animeTypeSelect.value,
        status: animeStatusSelect.value,
        rating: animeRatingInput.value === '' ? null : parseFloat(animeRatingInput.value)
    };
    if (editingAnimeId == null) {
        const resp = await fetch('/api/anime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            const created = await resp.json();
            animeModal.hidden = true;
            openAnimeDetail(created.id);
        }
    } else {
        await fetch(`/api/anime/${editingAnimeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        animeModal.hidden = true;
        refreshAnimeDetail();
    }
}

function openCoverModal() {
    coverUrlInput.value = '';
    coverFileInput.value = '';
    coverModal.hidden = false;
    coverUrlInput.focus();
}

async function saveCover() {
    if (!currentAnime) return;
    const url = coverUrlInput.value.trim();
    if (url) {
        await fetch(`/api/anime/${currentAnime.id}/cover-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
    } else if (coverFileInput.files && coverFileInput.files[0]) {
        const fd = new FormData();
        fd.append('file', coverFileInput.files[0]);
        await fetch(`/api/anime/${currentAnime.id}/cover`, { method: 'POST', body: fd });
    }
    coverModal.hidden = true;
    refreshAnimeDetail();
}

async function openRenameModal() {
    renameTitleInput.value = '';
    mergeIntoSelect.innerHTML = '<option value="">— 不合并 —</option>';
    try {
        const resp = await fetch('/api/anime?limit=100');
        if (resp.ok) {
            const list = await resp.json();
            for (const a of list) {
                if (a.id === currentAnime.id) continue;
                const opt = document.createElement('option');
                opt.value = a.id;
                opt.textContent = a.title;
                mergeIntoSelect.appendChild(opt);
            }
        }
    } catch (e) { /* 忽略 */ }
    renameModal.hidden = false;
    renameTitleInput.focus();
}

async function saveRename() {
    if (!currentAnime) return;
    const into = mergeIntoSelect.value;
    const title = renameTitleInput.value.trim();
    if (into) {
        await fetch(`/api/anime/${currentAnime.id}/merge?into=${into}`, { method: 'POST' });
        renameModal.hidden = true;
        showView('anime');
    } else if (title) {
        await fetch(`/api/anime/${currentAnime.id}/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        renameModal.hidden = true;
        refreshAnimeDetail();
    } else {
        renameModal.hidden = true;
    }
}

async function deleteAnime() {
    if (!currentAnime) return;
    if (!confirm(`删除番剧「${currentAnime.title}」？其下所有集与片段标签将一并删除！`)) return;
    await fetch(`/api/anime/${currentAnime.id}`, { method: 'DELETE' });
    showView('anime');
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
document.querySelectorAll('.dim-tabs .dtab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.dim-tabs .dtab').forEach(b => b.classList.toggle('active', b === btn));
        currentDim = btn.dataset.dim;
        if (currentQuery) runSearch(currentQuery);
    });
});
clearBtn.addEventListener('click', () => { input.value = ''; resultsEl.innerHTML = ''; statusEl.textContent = ''; input.focus(); });
loadMoreBtn.addEventListener('click', () => loadVideos(false));
backBtn.addEventListener('click', () => {
    if (fromAnimeDetail && currentAnime) {
        fromAnimeDetail = false;
        showView('anime-detail');
    } else {
        showView('videos');
    }
});
document.querySelectorAll('.nav .tab').forEach(tab => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
});
editModal.addEventListener('click', (e) => { if (e.target === editModal) editModal.hidden = true; });
document.getElementById('edit-cancel').addEventListener('click', () => { editModal.hidden = true; editingClip = null; });
document.getElementById('edit-save').addEventListener('click', saveEdit);
similarModal.addEventListener('click', (e) => { if (e.target === similarModal) similarModal.hidden = true; });
document.getElementById('similar-close').addEventListener('click', () => { similarModal.hidden = true; });

// ---------- 番剧事件 ----------

document.querySelectorAll('.anime-tabs .atab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.anime-tabs .atab').forEach(b => b.classList.toggle('active', b === btn));
        animeMode = btn.dataset.animeTab;
        loadAnime();
    });
});
document.getElementById('anime-create').addEventListener('click', openCreateAnime);
document.getElementById('back-to-anime').addEventListener('click', () => showView('anime'));
document.getElementById('detail-edit').addEventListener('click', openEditAnime);
document.getElementById('detail-rename').addEventListener('click', openRenameModal);
document.getElementById('detail-cover').addEventListener('click', openCoverModal);
document.getElementById('detail-delete').addEventListener('click', deleteAnime);
animeModal.addEventListener('click', (e) => { if (e.target === animeModal) animeModal.hidden = true; });
document.getElementById('anime-modal-cancel').addEventListener('click', () => { animeModal.hidden = true; });
document.getElementById('anime-modal-save').addEventListener('click', saveAnime);
coverModal.addEventListener('click', (e) => { if (e.target === coverModal) coverModal.hidden = true; });
document.getElementById('cover-modal-cancel').addEventListener('click', () => { coverModal.hidden = true; });
document.getElementById('cover-modal-save').addEventListener('click', saveCover);
renameModal.addEventListener('click', (e) => { if (e.target === renameModal) renameModal.hidden = true; });
document.getElementById('rename-cancel').addEventListener('click', () => { renameModal.hidden = true; });
document.getElementById('rename-save').addEventListener('click', saveRename);
episodeTagModal.addEventListener('click', (e) => { if (e.target === episodeTagModal) episodeTagModal.hidden = true; });
document.getElementById('episode-tag-cancel').addEventListener('click', () => { episodeTagModal.hidden = true; });
document.getElementById('episode-tag-save').addEventListener('click', saveEpisodeTag);
episodeTagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveEpisodeTag(); } });
