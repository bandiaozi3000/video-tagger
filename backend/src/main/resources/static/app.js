const views = {
  search: document.getElementById('view-search'),
  anime: document.getElementById('view-anime'),
  'anime-detail': document.getElementById('view-anime-detail'),
  'episode-detail': document.getElementById('view-episode-detail'),
  'clip-detail': document.getElementById('view-clip-detail'),
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
const detailCollectionsEl = document.getElementById('detail-collections');
const detailStatusEl = document.getElementById('detail-status');
const filterStatusEl = document.getElementById('filter-status');
const filterTypeEl = document.getElementById('filter-type');
const filterCollectionEl = document.getElementById('filter-collection');
const filterUnconfirmedEl = document.getElementById('filter-unconfirmed');
const detailConfirmBtn = document.getElementById('detail-confirm');
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
const episodeCoverModal = document.getElementById('episode-cover-modal');
const episodeCoverTargetEl = document.getElementById('episode-cover-target');
const episodeCoverHintEl = document.getElementById('episode-cover-hint');
const episodeCoverGridEl = document.getElementById('episode-cover-grid');
const episodeCoverFileEl = document.getElementById('episode-cover-file');
const episodeDetailHeadEl = document.getElementById('episode-detail-head');
const episodeDetailTagsEl = document.getElementById('episode-detail-tags');
const episodeDetailClipsEl = document.getElementById('episode-detail-clips');
const episodeDetailStatusEl = document.getElementById('episode-detail-status');
const clipDetailHeadEl = document.getElementById('clip-detail-head');
const clipDetailSiblingsEl = document.getElementById('clip-detail-siblings');
const clipDetailSimilarEl = document.getElementById('clip-detail-similar');
const clipDetailStatusEl = document.getElementById('clip-detail-status');
const hoverPreviewEl = document.getElementById('vt-hover-preview');

const ANIME_TYPE_LABEL = { ANIME: '动画', MOVIE: '电影' };
const ANIME_STATUS_LABEL = { WANT: '想看', WATCHING: '在看', DONE: '看完', PAUSED: '搁置', DROPPED: '弃番' };

let currentQuery = '';
let currentDim = 'mixed';
let editingClip = null;
let videoCursor = null;   // { latest, fp } 下一页游标
let pageSize = 20;
let currentVideo = null;  // { fp, title }
let animeMode = 'recent';
let animeFilter = { status: '', type: '', collectionId: '', unconfirmed: false };
let currentAnime = null;  // 番剧详情当前对象
let editingAnimeId = null;
let episodeTagEpisodeId = null;
let coverEpisode = null;   // 集封面弹层当前集 { id, title, videoFp }
let currentEpisode = null; // 集详情页当前对象 { id, ... }
let currentClip = null;    // 片段详情页当前对象 { id, ... }
let viewHistory = [];      // 详情页返回栈：记录上一活动视图名
let fromAnimeDetail = false;
let fromEpisodeDetail = false;

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

let currentViewName = 'search';

function showView(name) {
    currentViewName = name;
    if (hoverPreviewEl) hoverPreviewEl.hidden = true; // 切视图收起悬浮预览，防残留
    document.querySelectorAll('.nav .tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
    for (const [k, el] of Object.entries(views)) {
        el.hidden = k !== name;
    }
    if (name === 'videos') loadVideos(true);
    if (name === 'stats') loadStats();
    if (name === 'anime') loadAnime();
}

// ---------- 视图历史栈（详情页逐层返回） ----------

function activeView() {
    return currentViewName;
}

/** 进入详情页：记住当前视图（含详情 id）并入栈，返回可回到原处。 */
function pushView(name) {
    let id = null;
    if (activeView() === 'anime-detail' && currentAnime) id = currentAnime.id;
    else if (activeView() === 'episode-detail' && currentEpisode) id = currentEpisode.id;
    else if (activeView() === 'clip-detail' && currentClip) id = currentClip.id;
    viewHistory.push({ view: activeView(), id });
    showView(name);
}

function goBack() {
    const prev = viewHistory.pop();
    if (!prev) { showView('search'); return; }
    showView(prev.view);
    if (prev.view === 'search' && currentQuery) runSearch(currentQuery);
    else if (prev.view === 'anime-detail' && prev.id != null) loadAnimeDetail(prev.id);
    else if (prev.view === 'timeline' && currentVideo) openTimeline(currentVideo);
    else if (prev.view === 'episode-detail' && prev.id != null) loadEpisodeDetail(prev.id);
    else if (prev.view === 'clip-detail' && prev.id != null) renderClipDetail(prev.id);
    // 'anime' / 'videos' / 'stats' 由 showView 自动重新加载
}

// ---------- 片段详情 ----------

function openClipDetail(r) {
    similarModal.hidden = true; // 从相似弹窗进入时先收起弹窗，避免覆盖详情
    pushView('clip-detail');
    renderClipDetail(r.id);
}

async function renderClipDetail(id) {
    clipDetailHeadEl.innerHTML = '';
    clipDetailSiblingsEl.innerHTML = '';
    clipDetailSimilarEl.innerHTML = '';
    clipDetailStatusEl.textContent = '加载中…';
    try {
        const clipResp = await fetch(`/api/clips/${id}`);
        if (!clipResp.ok) throw new Error(`HTTP ${clipResp.status}`);
        const clip = await clipResp.json();
        currentClip = clip;

        // 集 / 番剧导航信息
        let ep = null, anime = null;
        if (clip.episodeId) {
            const epResp = await fetch(`/api/episodes/${clip.episodeId}`);
            if (epResp.ok) {
                ep = await epResp.json();
                if (ep.animeId) {
                    const animeResp = await fetch(`/api/anime/${ep.animeId}`);
                    if (animeResp.ok) anime = await animeResp.json();
                }
            }
        }
        renderClipDetailHead(clip, ep, anime);
        loadClipDetailExtras(clip);
        clipDetailStatusEl.textContent = '';
    } catch (err) {
        clipDetailStatusEl.textContent = '加载失败：后端未响应';
    }
}

function renderClipDetailHead(clip, ep, anime) {
    const heroSrc = clip.detailCoverPath || clip.coverPath; // 详情页优先用大图
    const cover = heroSrc
        ? `<img src="${heroSrc}" alt="">`
        : `<span class="cover-placeholder large">${esc(clip.tag || '片段').slice(0, 1)}</span>`;
    const nav = [];
    if (ep) {
        const epNo = ep.episodeNo != null
            ? (ep.season != null ? `S${ep.season}-Ep${ep.episodeNo}` : `第${ep.episodeNo}集`)
            : (ep.season != null ? `S${ep.season}` : '本集');
        nav.push(`<button class="nav-link" data-nav="episode">所属集：${esc(epNo)}</button>`);
    }
    if (anime) nav.push(`<button class="nav-link" data-nav="anime">所属番剧：《${esc(anime.title)}》</button>`);
    clipDetailHeadEl.innerHTML = `
        <div class="ad-cover">${cover}</div>
        <div class="ad-info">
            <h2 class="ad-title"></h2>
            <div class="ad-meta"></div>
            ${clip.note ? '<div class="cd-note"></div>' : ''}
            ${nav.length ? `<div class="cd-nav">${nav.join('')}</div>` : ''}
        </div>`;
    clipDetailHeadEl.querySelector('.ad-title').textContent = clip.title || '(未命名)';
    clipDetailHeadEl.querySelector('.ad-meta').textContent = `片段 · ${fmtTime(clip.timestampSec)} · ${clip.tag}`;
    if (clip.note) clipDetailHeadEl.querySelector('.cd-note').textContent = `备注：${clip.note}`;
    clipDetailHeadEl.querySelector('[data-nav="episode"]')?.addEventListener('click', () => openEpisodeDetail(ep.id));
    clipDetailHeadEl.querySelector('[data-nav="anime"]')?.addEventListener('click', () => openAnimeDetail(anime.id));
}

async function loadClipDetailExtras(clip) {
    // 同集其他片段（排除自身）
    if (clip.videoFp) {
        try {
            const resp = await fetch(`/api/videos/${encodeURIComponent(clip.videoFp)}/clips`);
            if (resp.ok) {
                const clips = await resp.json();
                const siblings = clips.filter(c => c.id !== clip.id);
                if (siblings.length === 0) {
                    clipDetailSiblingsEl.innerHTML = '<div class="status">该集暂无其他标记片段</div>';
                } else {
                    for (const c of siblings) appendClipCard(clipDetailSiblingsEl, c, {});
                }
            }
        } catch (e) { /* 忽略 */ }
    }
    // 相似片段
    try {
        const resp = await fetch(`/api/search/similar?id=${clip.id}&limit=8`);
        if (resp.ok) {
            const list = await resp.json();
            if (list.length === 0) {
                clipDetailSimilarEl.innerHTML = '<div class="status">没有找到相似片段</div>';
            } else {
                for (const s of list) appendClipCard(clipDetailSimilarEl, s, {});
            }
        }
    } catch (e) { /* 忽略 */ }
}

// ---------- 集详情 ----------

function openEpisodeDetail(id) {
    pushView('episode-detail');
    loadEpisodeDetail(id);
}

async function loadEpisodeDetail(id) {
    episodeDetailHeadEl.innerHTML = '';
    episodeDetailTagsEl.innerHTML = '';
    episodeDetailClipsEl.innerHTML = '';
    episodeDetailStatusEl.textContent = '加载中…';
    try {
        const epResp = await fetch(`/api/episodes/${id}`);
        if (!epResp.ok) throw new Error(`HTTP ${epResp.status}`);
        const ep = await epResp.json();
        currentEpisode = ep;

        let anime = null;
        if (ep.animeId) {
            const animeResp = await fetch(`/api/anime/${ep.animeId}`);
            if (animeResp.ok) anime = await animeResp.json();
        }
        renderEpisodeDetailHead(ep, anime);
        renderEpisodeDetailTags(ep);

        // 该集片段（左缩略图列表）
        if (ep.videoFp) {
            const clipsResp = await fetch(`/api/videos/${encodeURIComponent(ep.videoFp)}/clips`);
            if (clipsResp.ok) {
                const clips = await clipsResp.json();
                if (clips.length === 0) {
                    episodeDetailClipsEl.innerHTML = '<div class="status">该集还没有片段标记，去看片按 Alt+S 打一个</div>';
                } else {
                    for (const c of clips) appendClipCard(episodeDetailClipsEl, c, {});
                }
            }
        }
        episodeDetailStatusEl.textContent = '';
    } catch (err) {
        episodeDetailStatusEl.textContent = '加载失败：后端未响应';
    }
}

function renderEpisodeDetailHead(ep, anime) {
    const cover = ep.coverPath
        ? `<img src="${ep.coverPath}" alt="">`
        : `<span class="cover-placeholder large">${esc((ep.title || '?')).slice(0, 1)}</span>`;
    const no = ep.episodeNo != null
        ? (ep.season != null ? `S${ep.season}-Ep${ep.episodeNo}` : `第${ep.episodeNo}集`)
        : (ep.season != null ? `S${ep.season}` : '本集');
    const animeNav = anime
        ? `<div class="cd-nav"><button class="nav-link" data-nav="anime">所属番剧：《${esc(anime.title)}》</button></div>`
        : '';
    episodeDetailHeadEl.innerHTML = `
        <div class="ad-cover">${cover}</div>
        <div class="ad-info">
            <h2 class="ad-title"></h2>
            <div class="ad-meta"></div>
            ${animeNav}
        </div>`;
    episodeDetailHeadEl.querySelector('.ad-title').textContent = ep.title || '(未命名)';
    const meta = [no, `${ep.clipCount || 0} 条片段`];
    if (ep.latestAt) meta.push(`最近标记 ${fmtDateTime(ep.latestAt)}`);
    episodeDetailHeadEl.querySelector('.ad-meta').textContent = meta.join(' · ');
    episodeDetailHeadEl.querySelector('[data-nav="anime"]')?.addEventListener('click', () => openAnimeDetail(anime.id));
}

function renderEpisodeDetailTags(ep) {
    episodeDetailTagsEl.innerHTML = '';
    for (const t of (ep.tags || [])) {
        const chip = document.createElement('span');
        chip.className = 'tag-chip removable';
        chip.textContent = t.name;
        const rm = document.createElement('span');
        rm.className = 'chip-remove';
        rm.textContent = '×';
        rm.addEventListener('click', async (e) => {
            e.stopPropagation();
            await fetch(`/api/episodes/${ep.id}/tags/${t.id}`, { method: 'DELETE' });
            loadEpisodeDetail(ep.id);
        });
        chip.appendChild(rm);
        episodeDetailTagsEl.appendChild(chip);
    }
    const wrap = document.createElement('span');
    wrap.className = 'tag-add-wrap';
    const input = document.createElement('input');
    input.className = 'tag-add-input';
    input.placeholder = '+ 添加集标签';
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            await fetch(`/api/episodes/${ep.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag: input.value.trim() })
            });
            loadEpisodeDetail(ep.id);
        }
    });
    wrap.appendChild(input);
    episodeDetailTagsEl.appendChild(wrap);
}

/** 删除集：级联清理其下片段与封面；集详情页删除后返回，番剧详情行删除后刷新。 */
async function deleteEpisode(ep) {
    const no = ep.episodeNo != null ? `第${ep.episodeNo}集` : '本集';
    if (!confirm(`删除${no}？其下所有片段、标签与封面将一并删除！`)) return;
    try {
        const resp = await fetch(`/api/episodes/${ep.id}`, { method: 'DELETE' });
        if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
        if (activeView() === 'episode-detail') { goBack(); return; }
        if (activeView() === 'anime-detail' && currentAnime) loadAnimeDetail(currentAnime.id);
    } catch (err) {
        const st = activeView() === 'episode-detail' ? episodeDetailStatusEl : detailStatusEl;
        st.textContent = '删除失败：后端未响应';
    }
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
    card.className = 'card card-clip';
    const maxScore = opts && opts.maxScore;
    const scoreBar = maxScore
        ? `<div class="score-bar"><div style="width:${Math.round(r.score / maxScore * 100)}%"></div></div>`
        : '';
    const thumb = r.coverPath
        ? `<div class="cc-thumb"><img src="${r.coverPath}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>`
        : '';
    card.innerHTML = `
        ${thumb}
        <div class="cc-body">
            <div class="card-title"></div>
            <div class="cc-meta">
                <span class="badge-time">${fmtTime(r.timestampSec)}</span>
                <span class="card-tag"></span>
            </div>
            ${scoreBar}
            <div class="card-actions">
                <button class="btn-similar" type="button">相似</button>
                <button class="btn-edit" type="button">编辑</button>
                <button class="btn-delete" type="button">删除</button>
            </div>
        </div>`;
    card.querySelector('.card-title').textContent = r.title;
    card.querySelector('.card-tag').textContent = r.tag + (r.note ? ` · ${r.note}` : '');
    const thumbEl = card.querySelector('.cc-thumb');
    if (thumbEl) bindHoverPreview(thumbEl, r.detailCoverPath || r.coverPath); // 悬浮展示详情大图
    card.addEventListener('click', () => openClipDetail(r)); // 点卡片进片段详情页
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

// ---------- 悬浮详情大图预览 ----------

/** 缩略图 hover 展示详情大图；无详情图回退缩略图。 */
function bindHoverPreview(thumbEl, src) {
    thumbEl.addEventListener('mouseenter', () => {
        const img = hoverPreviewEl.querySelector('img');
        img.src = src;
        hoverPreviewEl.hidden = false;
        const rect = thumbEl.getBoundingClientRect();
        let left = rect.right + 12;
        let top = Math.max(8, rect.top);
        if (left + 360 > window.innerWidth) left = Math.max(8, rect.left - 372);
        hoverPreviewEl.style.left = left + 'px';
        hoverPreviewEl.style.top = top + 'px';
    });
    thumbEl.addEventListener('mouseleave', () => {
        hoverPreviewEl.hidden = true;
    });
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
    card.className = 'card card-clip';
    const thumb = r.coverPath
        ? `<div class="cc-thumb"><img src="${r.coverPath}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>`
        : '';
    card.innerHTML = `${thumb}
        <div class="cc-body">
            <div class="card-title"></div>
            <div class="cc-meta"><span class="card-tag"></span></div>
        </div>`;
    card.querySelector('.card-title').textContent = r.title || '(未命名)';
    card.querySelector('.card-tag').textContent = `番剧 · 匹配 ${Math.round((r.score || 0) * 100) / 100}`;
    const thumbEl = card.querySelector('.cc-thumb');
    if (thumbEl) bindHoverPreview(thumbEl, r.coverPath); // 番剧悬浮看封面大图
    card.addEventListener('click', () => openAnimeDetail(r.animeId));
    container.appendChild(card);
}

function appendEpisodeCard(container, r) {
    const card = document.createElement('div');
    card.className = 'card card-clip';
    const thumb = r.coverPath
        ? `<div class="cc-thumb"><img src="${r.coverPath}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>`
        : '';
    card.innerHTML = `${thumb}
        <div class="cc-body">
            <div class="card-title"></div>
            <div class="cc-meta"><span class="card-tag"></span></div>
        </div>`;
    card.querySelector('.card-title').textContent = r.title || '(未命名)';
    card.querySelector('.card-tag').textContent = `集 · 匹配 ${Math.round((r.score || 0) * 100) / 100}`;
    const thumbEl = card.querySelector('.cc-thumb');
    if (thumbEl) bindHoverPreview(thumbEl, r.coverPath); // 集悬浮看封面大图
    card.addEventListener('click', () => {
        if (r.episodeId) {
            openEpisodeDetail(r.episodeId); // 点集卡片进集详情
        } else if (r.videoFp) {
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
    if (!confirm(`删除这条标签？\n${r.title} · ${r.timestampSec != null ? fmtTime(r.timestampSec) : ''} · ${r.tag || ''}`)) return;
    try {
        const resp = await fetch(`/api/clips/${r.id}`, { method: 'DELETE' });
        if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
        if (activeView() === 'clip-detail') { goBack(); return; } // 详情页删除后返回
        refreshCurrentView();
    } catch (err) {
        statusEl.textContent = '删除失败：后端未响应';
    }
}

function refreshCurrentView() {
    const active = activeView();
    if (active === 'search') {
        if (currentQuery) runSearch(currentQuery);
    } else if (active === 'timeline' && currentVideo) {
        openTimeline(currentVideo);
    } else if (active === 'videos') {
        loadVideos(true);
    } else if (active === 'anime') {
        loadAnime();
    } else if (active === 'anime-detail' && currentAnime) {
        loadAnimeDetail(currentAnime.id);
    } else if (active === 'episode-detail' && currentEpisode) {
        loadEpisodeDetail(currentEpisode.id);
    } else if (active === 'clip-detail' && currentClip) {
        renderClipDetail(currentClip.id);
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
        let url;
        if (animeFilter.collectionId && animeMode !== 'recent') {
            url = `/api/collections/${animeFilter.collectionId}/anime`;
        } else if (animeMode === 'recent') {
            url = '/api/anime/recent?limit=50';
        } else {
            const params = new URLSearchParams({ limit: '100' });
            if (animeFilter.status) params.set('status', animeFilter.status);
            if (animeFilter.type) params.set('type', animeFilter.type);
            if (animeFilter.unconfirmed) params.set('confirmed', '0');
            url = `/api/anime?${params}`;
        }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const list = await resp.json();
        animeStatusEl.textContent = list.length
            ? ''
            : (animeMode === 'recent' ? '还没有打过标记的番剧，去看片按 Alt+S 打一个' : '没有符合条件的番剧');
        renderAnimeGrid(list);
    } catch (err) {
        animeStatusEl.textContent = '加载失败：后端未响应';
    }
}

async function fillFilterCollections() {
    try {
        const resp = await fetch('/api/collections');
        if (!resp.ok) return;
        const list = await resp.json();
        const cur = filterCollectionEl.value;
        filterCollectionEl.innerHTML = '<option value="">收藏夹</option>';
        for (const c of list) {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name}（${c.animeCount || 0}）`;
            filterCollectionEl.appendChild(opt);
        }
        filterCollectionEl.value = cur;
    } catch (e) { /* 忽略 */ }
}

async function renderDetailCollections(d) {
    detailCollectionsEl.innerHTML = '';
    let list = [];
    try {
        const resp = await fetch('/api/collections');
        if (resp.ok) list = await resp.json();
    } catch (e) { /* 忽略 */ }
    const current = new Set(d.collectionIds || []);
    for (const c of list) {
        const label = document.createElement('label');
        label.className = 'coll-check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = current.has(c.id);
        cb.addEventListener('change', async () => {
            if (cb.checked) {
                await fetch(`/api/collections/${c.id}/anime`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ animeId: d.id })
                });
            } else {
                await fetch(`/api/collections/${c.id}/anime/${d.id}`, { method: 'DELETE' });
            }
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(` ${c.name}`));
        detailCollectionsEl.appendChild(label);
    }
    const wrap = document.createElement('span');
    wrap.className = 'tag-add-wrap';
    const input = document.createElement('input');
    input.className = 'tag-add-input';
    input.placeholder = '+ 新建收藏夹';
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: input.value.trim() })
            });
            renderDetailCollections(d);
            fillFilterCollections();
        }
    });
    wrap.appendChild(input);
    detailCollectionsEl.appendChild(wrap);
}

function renderAnimeGrid(list) {
    for (const a of list) {
        const card = document.createElement('div');
        card.className = 'anime-card';
        const cover = (a.coverPath || a.fallbackCoverPath)
            ? `<img src="${a.coverPath || a.fallbackCoverPath}" alt="" onerror="this.style.display='none'">`
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

/** 导航入口：入栈再加载番剧详情。 */
function openAnimeDetail(id) {
    pushView('anime-detail');
    loadAnimeDetail(id);
}

/** 番剧详情渲染（刷新/返回复用，不入栈）。 */
async function loadAnimeDetail(id) {
    currentAnime = { id };
    fromAnimeDetail = false;
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
    const cover = (d.coverPath || d.fallbackCoverPath)
        ? `<img src="${d.coverPath || d.fallbackCoverPath}" alt="">`
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
    renderDetailCollections(d);
    renderEpisodeList(eps);
    detailConfirmBtn.hidden = d.confirmed !== 0;
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
    if (currentAnime && currentAnime.id) loadAnimeDetail(currentAnime.id);
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
        const coverHtml = ep.coverPath
            ? `<div class="ep-cover"><img src="${ep.coverPath}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>`
            : `<div class="ep-cover ep-cover-empty">◇</div>`;
        row.innerHTML = `
            <div class="ep-no"></div>
            ${coverHtml}
            <div class="ep-main">
                <div class="ep-title"></div>
                <div class="ep-meta"></div>
                <div class="ep-tags"></div>
            </div>
            <div class="ep-actions">
                <button type="button" class="btn-mini ep-cover-btn">封面</button>
                <button type="button" class="btn-mini ep-tag-btn">打标签</button>
                <button type="button" class="btn-mini ep-time-btn">时间线</button>
                <button type="button" class="btn-mini danger ep-del-btn">删除</button>
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
        row.querySelector('.ep-cover-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEpisodeCoverModal(ep);
        });
        row.querySelector('.ep-time-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            fromAnimeDetail = true;
            openTimeline({ fp: ep.videoFp, title: (currentAnime.title || '') + (no !== '?' ? ` · ${no}` : '') });
        });
        row.querySelector('.ep-del-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteEpisode(ep);
        });
        row.addEventListener('click', () => openEpisodeDetail(ep.id)); // 点集行进集详情
        episodeListEl.appendChild(row);
    }
}

function openEpisodeTagModal(ep) {
    episodeTagEpisodeId = ep.id;
    const animeName = currentAnime && currentAnime.title ? `《${currentAnime.title}》 · ` : '';
    episodeTagTargetEl.textContent = `${animeName}${ep.episodeNo != null ? `第${ep.episodeNo}集` : '本集'}`;
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
    refreshCurrentView(); // 集详情 / 番剧详情 各自刷新
}

// ---------- 集封面：自选片段帧 / 上传兜底 ----------

function openEpisodeCoverModal(ep) {
    coverEpisode = ep;
    const animeName = currentAnime && currentAnime.title ? `《${currentAnime.title}》 · ` : '';
    episodeCoverTargetEl.textContent = `${animeName}${ep.title || '本集'}`;
    episodeCoverHintEl.textContent = '从本集片段帧里挑一个高能画面，或上传图片';
    episodeCoverGridEl.innerHTML = '';
    episodeCoverFileEl.value = '';
    episodeCoverModal.hidden = false;
    if (!ep.videoFp) {
        episodeCoverGridEl.innerHTML = '<div class="status">该集没有关联视频，无法列出片段，请直接上传图片</div>';
        return;
    }
    loadEpisodeCoverCandidates(ep);
}

async function loadEpisodeCoverCandidates(ep) {
    episodeCoverGridEl.innerHTML = '<div class="status">加载片段中…</div>';
    try {
        const resp = await fetch(`/api/videos/${encodeURIComponent(ep.videoFp)}/clips`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const clips = await resp.json();
        const withCover = clips.filter(c => c.coverPath);
        episodeCoverGridEl.innerHTML = '';
        if (withCover.length === 0) {
            episodeCoverGridEl.innerHTML = '<div class="status">该集还没有带截帧的片段，看片打标后即可自选，或直接上传图片</div>';
            return;
        }
        for (const c of withCover) {
            const item = document.createElement('div');
            item.className = 'cover-pick-item';
            item.innerHTML = `<img src="${c.coverPath}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"><span>${fmtTime(c.timestampSec)}</span>`;
            item.title = `设为集封面 · ${fmtTime(c.timestampSec)}`;
            item.addEventListener('click', async () => {
                await fetch(`/api/episodes/${ep.id}/cover-from-clip/${c.id}`, { method: 'POST' });
                episodeCoverModal.hidden = true;
                refreshCurrentView();
            });
            episodeCoverGridEl.appendChild(item);
        }
    } catch (err) {
        episodeCoverGridEl.innerHTML = '<div class="status">加载片段失败：后端未响应</div>';
    }
}

async function saveEpisodeCoverUpload() {
    if (!coverEpisode) return;
    const f = episodeCoverFileEl.files && episodeCoverFileEl.files[0];
    if (!f) { episodeCoverHintEl.textContent = '请先选择图片文件'; return; }
    const fd = new FormData();
    fd.append('file', f);
    const resp = await fetch(`/api/episodes/${coverEpisode.id}/cover`, { method: 'POST', body: fd });
    if (!resp.ok) { episodeCoverHintEl.textContent = '上传失败：后端未响应或图片过大'; return; }
    episodeCoverModal.hidden = true;
    refreshCurrentView();
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
        // 用当前输入框内容判断，避免空框时重跑上一次的旧查询
        const q = input.value.trim();
        if (q) runSearch(q);
    });
});
clearBtn.addEventListener('click', () => { input.value = ''; currentQuery = ''; resultsEl.innerHTML = ''; statusEl.textContent = ''; input.focus(); });
loadMoreBtn.addEventListener('click', () => loadVideos(false));
backBtn.addEventListener('click', () => {
    if (fromAnimeDetail && currentAnime) {
        fromAnimeDetail = false;
        showView('anime-detail');
    } else if (fromEpisodeDetail && currentEpisode) {
        fromEpisodeDetail = false;
        showView('episode-detail');
        loadEpisodeDetail(currentEpisode.id);
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
document.getElementById('back-to-anime').addEventListener('click', goBack);
document.getElementById('detail-edit').addEventListener('click', openEditAnime);
document.getElementById('detail-rename').addEventListener('click', openRenameModal);
document.getElementById('detail-cover').addEventListener('click', openCoverModal);
document.getElementById('detail-confirm').addEventListener('click', async () => {
    if (!currentAnime) return;
    await fetch(`/api/anime/${currentAnime.id}/confirm`, { method: 'POST' });
    refreshAnimeDetail();
});
document.getElementById('detail-delete').addEventListener('click', deleteAnime);
filterStatusEl.addEventListener('change', () => { animeFilter.status = filterStatusEl.value; loadAnime(); });
filterTypeEl.addEventListener('change', () => { animeFilter.type = filterTypeEl.value; loadAnime(); });
filterCollectionEl.addEventListener('change', () => { animeFilter.collectionId = filterCollectionEl.value; loadAnime(); });
filterUnconfirmedEl.addEventListener('change', () => { animeFilter.unconfirmed = filterUnconfirmedEl.checked; loadAnime(); });
fillFilterCollections();
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
episodeCoverModal.addEventListener('click', (e) => { if (e.target === episodeCoverModal) { episodeCoverModal.hidden = true; coverEpisode = null; } });
document.getElementById('episode-cover-cancel').addEventListener('click', () => { episodeCoverModal.hidden = true; coverEpisode = null; });
document.getElementById('episode-cover-save').addEventListener('click', saveEpisodeCoverUpload);

// ---------- 片段详情操作 ----------
document.getElementById('back-from-clip').addEventListener('click', goBack);
document.getElementById('clip-detail-jump').addEventListener('click', () => { if (currentClip) jump(currentClip); });
document.getElementById('clip-detail-edit').addEventListener('click', () => { if (currentClip) openEditModal(currentClip); });
document.getElementById('clip-detail-delete').addEventListener('click', () => { if (currentClip) confirmDelete(currentClip); });
document.getElementById('clip-detail-similar').addEventListener('click', () => clipDetailSimilarEl.scrollIntoView({ behavior: 'smooth' }));

// ---------- 集详情操作 ----------
document.getElementById('back-from-episode').addEventListener('click', goBack);
document.getElementById('ep-detail-tag').addEventListener('click', () => { if (currentEpisode) openEpisodeTagModal(currentEpisode); });
document.getElementById('ep-detail-cover').addEventListener('click', () => { if (currentEpisode) openEpisodeCoverModal(currentEpisode); });
document.getElementById('ep-detail-timeline').addEventListener('click', () => {
    if (!currentEpisode) return;
    fromEpisodeDetail = true;
    openTimeline({ fp: currentEpisode.videoFp, title: currentEpisode.title || '时间线' });
});
document.getElementById('ep-detail-jump').addEventListener('click', () => {
    if (currentEpisode) jump({ url: currentEpisode.url, timestampSec: 0 });
});
document.getElementById('ep-detail-delete').addEventListener('click', () => { if (currentEpisode) deleteEpisode(currentEpisode); });
