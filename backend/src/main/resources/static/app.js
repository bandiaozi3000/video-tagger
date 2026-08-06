const views = {
  search: document.getElementById('view-search'),
  media: document.getElementById('view-media'),
  'media-detail': document.getElementById('view-media-detail'),
  'episode-detail': document.getElementById('view-episode-detail'),
  'clip-detail': document.getElementById('view-clip-detail'),
  videos: document.getElementById('view-videos'),
  timeline: document.getElementById('view-timeline'),
  stats: document.getElementById('view-stats'),
  tags: document.getElementById('view-tags')
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

const mediaStatusEl = document.getElementById('media-status');
const mediaGridEl = document.getElementById('media-grid');
const mediaDetailHeadEl = document.getElementById('media-detail-head');
const episodeListEl = document.getElementById('episode-list');
const detailTagsEl = document.getElementById('detail-tags');
const detailCollectionsEl = document.getElementById('detail-collections');
const detailStatusEl = document.getElementById('detail-status');
const filterStatusEl = document.getElementById('filter-status');
const filterSubcategoryEl = document.getElementById('filter-subcategory');
const filterCollectionEl = document.getElementById('filter-collection');
const filterUnconfirmedEl = document.getElementById('filter-unconfirmed');
const formatTabsEl = document.getElementById('format-tabs');
const mediaFormatManageBtn = document.getElementById('media-format-manage');
const detailConfirmBtn = document.getElementById('detail-confirm');
const mediaModal = document.getElementById('media-modal');
const mediaModalTitle = document.getElementById('media-modal-title');
const mediaTitleInput = document.getElementById('media-title');
const mediaFormatSelect = document.getElementById('media-format');
const mediaSubcategorySelect = document.getElementById('media-subcategory');
const mediaNewSubInput = document.getElementById('media-new-sub');
const mediaAddSubBtn = document.getElementById('media-add-sub-btn');
const mediaInlineAddBtn = document.getElementById('media-inline-add');
const mediaStatusSelect = document.getElementById('media-status');
const mediaRatingInput = document.getElementById('media-rating');
const mediaNoteInput = document.getElementById('media-note');
const coverModal = document.getElementById('cover-modal');
const coverUrlInput = document.getElementById('cover-url');
const coverFileInput = document.getElementById('cover-file');
const renameModal = document.getElementById('rename-modal');
const renameTitleInput = document.getElementById('rename-title');
const mergeIntoSelect = document.getElementById('merge-into');
const collectionModal = document.getElementById('collection-modal');
const collectionNameInput = document.getElementById('collection-name');
const episodeTagModal = document.getElementById('episode-tag-modal');
const episodeTagTargetEl = document.getElementById('episode-tag-target');
const episodeTagInput = document.getElementById('episode-tag-input');
const episodeCoverModal = document.getElementById('episode-cover-modal');
const episodeCoverTargetEl = document.getElementById('episode-cover-target');
const episodeCoverHintEl = document.getElementById('episode-cover-hint');
const episodeCoverGridEl = document.getElementById('episode-cover-grid');
const episodeCoverFileEl = document.getElementById('episode-cover-file');
const episodeDetailHeadEl = document.getElementById('episode-detail-head');
const episodeDetailNoteEl = document.getElementById('episode-detail-note');
const episodeDetailTagsEl = document.getElementById('episode-detail-tags');
const episodeDetailClipsEl = document.getElementById('episode-detail-clips');
const episodeDetailStatusEl = document.getElementById('episode-detail-status');
const clipDetailHeadEl = document.getElementById('clip-detail-head');
const clipDetailSiblingsEl = document.getElementById('clip-detail-siblings');
const clipDetailSimilarEl = document.getElementById('clip-detail-similar');
const clipDetailStatusEl = document.getElementById('clip-detail-status');
const hoverPreviewEl = document.getElementById('vt-hover-preview');
const tagListEl = document.getElementById('tag-list');
const tagStatusEl = document.getElementById('tag-status');
const tagFilterEl = document.getElementById('tag-filter');
const tagMediaSelectEl = document.getElementById('tag-media-select');
const tagRenameModal = document.getElementById('tag-rename-modal');
const tagRenameTargetEl = document.getElementById('tag-rename-target');
const tagRenameInput = document.getElementById('tag-rename-input');
const tagRenameStatusEl = document.getElementById('tag-rename-status');
const tagAddBtn = document.getElementById('tag-add-btn');
const tagAddModal = document.getElementById('tag-add-modal');
const tagAddInput = document.getElementById('tag-add-input');
const tagAddPreviewEl = document.getElementById('tag-add-preview');
const tagAddStatusEl = document.getElementById('tag-add-status');
const tagBatchDelBtn = document.getElementById('tag-batch-del');
const tagCheckAll = document.getElementById('tag-check-all');
const tagCheckAllWrap = document.getElementById('tag-check-all-wrap');
const tagPager = document.getElementById('tag-pager');
const tagPageInfo = document.getElementById('tag-page-info');
const tagPagePrev = document.getElementById('tag-page-prev');
const tagPageNext = document.getElementById('tag-page-next');
const tagPageSizeSel = document.getElementById('tag-page-size');
const tagMergeModal = document.getElementById('tag-merge-modal');
const tagMergeTargetEl = document.getElementById('tag-merge-target');
const tagMergeIntoEl = document.getElementById('tag-merge-into');
const tagMergeStatusEl = document.getElementById('tag-merge-status');

const MEDIA_STATUS_LABEL = { WANT: '想看', WATCHING: '在看', DONE: '看完', PAUSED: '搁置', DROPPED: '弃番' };
const SEARCH_FORMAT_SELECT = document.getElementById('search-format');
const SEARCH_SUBCATEGORY_SELECT = document.getElementById('search-subcategory');
const searchTimeSelect = document.getElementById('search-time');
const searchTimeCustom = document.getElementById('search-time-custom');
const searchTimeFrom = document.getElementById('search-time-from');
const searchTimeTo = document.getElementById('search-time-to');
const searchGroupToggle = document.getElementById('search-group');
const statsFormatsEl = document.getElementById('stats-formats');
const statsSubcategoriesEl = document.getElementById('stats-subcategories');
const mediaFormatModal = document.getElementById('media-format-modal');
const fmFormatsEl = document.getElementById('fm-formats');
const fmSubListEl = document.getElementById('fm-sub-list');
const fmCurrentFormatEl = document.getElementById('fm-current-format');
const fmNewSubInput = document.getElementById('fm-new-sub');
const fmAddSubBtn = document.getElementById('fm-add-sub-btn');
const fmAddRootBtn = document.getElementById('fm-add-root-btn');
const fmSubTarget = document.getElementById('fm-sub-target');
const fmNewCodeInput = document.getElementById('fm-new-code');
const fmNewNameInput = document.getElementById('fm-new-name');
const fmNewHasChildren = document.getElementById('fm-new-has-children');
const fmAddFormatBtn = document.getElementById('fm-add-format-btn');
const fmStatusEl = document.getElementById('fm-status');

/** 格式树缓存：{ id, code, name, hasChildren, subcategories: [{id,name,mediaCount}] } */
let formatsCache = [];
let activeFormatTab = '';
let fmSelectedFormatId = null;
let fmSubParentId = 0;            // fm 弹层新增子分类的父节点 id（0=根），点行内 ＋ 切换

let currentQuery = '';
let currentDim = 'mixed';
let editingClip = null;
let videoCursor = null;   // { latest, fp } 下一页游标
let pageSize = 20;
let currentVideo = null;  // { fp, title }
let mediaMode = 'recent';
let mediaBatchMode = false; // 批量删除模式
const mediaSelected = new Set();
const mediaById = new Map();       // id → 媒体对象（弹确认弹窗时取标题/格式）
const batchDelModal = document.getElementById('batch-del-modal');
let batchDelIds = [];              // 当前待确认删除的媒体 id 列表
const confirmModal = document.getElementById('confirm-modal');
let confirmModalAction = null;     // 确认后要执行的回调
let tagMode = 'global';            // 标签页视图：global 通用池 / media 按媒体
let tagMediaId = null;             // 标签页媒体维度当前媒体 id
let tagListCache = [];             // 当前已加载词条（合并目标候选、删除后刷新用）
let tagFilterTimer = null;         // 过滤输入防抖
let tagPage = 1;                   // 通用池分页：当前页
let tagPageSize = 50;              // 通用池分页：每页条数
let tagTotal = 0;                  // 通用池分页：过滤后总条数
const tagSelected = new Set();     // 批量删除勾选的词条 id
let tagRenameId = null;            // 改名弹窗当前词条 id
let tagMergeId = null;             // 合并弹窗源词条 id
let tagPoolByName = new Map();     // 全量词库 name→id（新增实时去重用，惰性加载）
let tagAddTimer = null;            // 新增输入防抖

/** 通用确认弹窗：替代原生 confirm()，风格与页面一致。 */
function showConfirm({ title = '确认', msg = '', okText = '确定', danger = true, onOk }) {
    document.getElementById('confirm-modal-title').textContent = title;
    const msgEl = document.getElementById('confirm-modal-msg');
    msgEl.textContent = msg;
    msgEl.title = msg; // 长文本悬停查看全文
    const ok = document.getElementById('confirm-modal-ok');
    ok.textContent = okText;
    ok.classList.toggle('danger', danger);
    confirmModalAction = onOk;
    confirmModal.hidden = false;
}

/** 关闭通用确认弹窗（取消/确认共用）。 */
function closeConfirmModal() {
    confirmModal.hidden = true;
    confirmModalAction = null;
}
let mediaFilter = { status: '', format: '', subcategoryId: '', collectionId: '', unconfirmed: false };
let currentMedia = null;  // 媒体详情当前对象
let editingMediaId = null;
let episodeTagEpisodeId = null;
let coverEpisode = null;   // 集封面弹层当前集 { id, title, videoFp }
let currentEpisode = null; // 集详情页当前对象 { id, ... }
let currentClip = null;    // 片段详情页当前对象 { id, ... }
let viewHistory = [];      // 详情页返回栈：记录上一活动视图名
let fromMediaDetail = false;
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
    if (name === 'media') loadMedia();
    if (name === 'tags') loadTags();
}

// ---------- 视图历史栈（详情页逐层返回） ----------

function activeView() {
    return currentViewName;
}

/** 进入详情页：记住当前视图（含详情 id）并入栈，返回可回到原处。 */
function pushView(name) {
    let id = null;
    if (activeView() === 'media-detail' && currentMedia) id = currentMedia.id;
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
    else if (prev.view === 'media-detail' && prev.id != null) loadMediaDetail(prev.id);
    else if (prev.view === 'timeline' && currentVideo) openTimeline(currentVideo);
    else if (prev.view === 'episode-detail' && prev.id != null) loadEpisodeDetail(prev.id);
    else if (prev.view === 'clip-detail' && prev.id != null) renderClipDetail(prev.id);
    // 'media' / 'videos' / 'stats' 由 showView 自动重新加载
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

        // 集 / 媒体导航信息
        let ep = null, media = null;
        if (clip.episodeId) {
            const epResp = await fetch(`/api/episodes/${clip.episodeId}`);
            if (epResp.ok) {
                ep = await epResp.json();
                if (ep.mediaId) {
                    const mediaResp = await fetch(`/api/media/${ep.mediaId}`);
                    if (mediaResp.ok) media = await mediaResp.json();
                }
            }
        }
        renderClipDetailHead(clip, ep, media);
        loadClipDetailExtras(clip);
        clipDetailStatusEl.textContent = '';
    } catch (err) {
        clipDetailStatusEl.textContent = '加载失败：后端未响应';
    }
}

function renderClipDetailHead(clip, ep, media) {
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
    if (media) nav.push(`<button class="nav-link" data-nav="media">所属媒体：《${esc(media.title)}》</button>`);
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
    clipDetailHeadEl.querySelector('[data-nav="media"]')?.addEventListener('click', () => openMediaDetail(media.id));
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

        let media = null;
        if (ep.mediaId) {
            const mediaResp = await fetch(`/api/media/${ep.mediaId}`);
            if (mediaResp.ok) media = await mediaResp.json();
        }
        renderEpisodeDetailHead(ep, media);
        renderEpisodeNote(ep);
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

function renderEpisodeDetailHead(ep, media) {
    const cover = ep.coverPath
        ? `<img src="${ep.coverPath}" alt="">`
        : `<span class="cover-placeholder large">${esc((ep.title || '?')).slice(0, 1)}</span>`;
    const no = ep.episodeNo != null
        ? (ep.season != null ? `S${ep.season}-Ep${ep.episodeNo}` : `第${ep.episodeNo}集`)
        : (ep.season != null ? `S${ep.season}` : '本集');
    const mediaNav = media
        ? `<div class="cd-nav"><button class="nav-link" data-nav="media">所属媒体：《${esc(media.title)}》</button></div>`
        : '';
    episodeDetailHeadEl.innerHTML = `
        <div class="ad-cover">${cover}</div>
        <div class="ad-info">
            <h2 class="ad-title"></h2>
            <div class="ad-meta"></div>
            <button type="button" class="btn-mini ep-no-edit-btn">编辑季/集</button>
            ${mediaNav}
        </div>`;
    episodeDetailHeadEl.querySelector('.ad-title').textContent = ep.title || '(未命名)';
    const meta = [no, `${ep.clipCount || 0} 条片段`];
    if (ep.latestAt) meta.push(`最近标记 ${fmtDateTime(ep.latestAt)}`);
    const metaEl = episodeDetailHeadEl.querySelector('.ad-meta');
    metaEl.textContent = meta.join(' · ');
    // 季/集号内联编辑：保存走 PUT /api/episodes/{id}（season/episodeNo）
    episodeDetailHeadEl.querySelector('.ep-no-edit-btn').addEventListener('click', () => {
        const oldNo = metaEl.textContent;
        const sInput = document.createElement('input');
        sInput.type = 'number'; sInput.min = '1'; sInput.placeholder = '季';
        sInput.value = ep.season != null ? ep.season : '';
        sInput.className = 'no-edit-input';
        const eInput = document.createElement('input');
        eInput.type = 'number'; eInput.min = '1'; eInput.placeholder = '集';
        eInput.value = ep.episodeNo != null ? ep.episodeNo : '';
        eInput.className = 'no-edit-input';
        const save = document.createElement('button'); save.type = 'button'; save.className = 'btn-mini'; save.textContent = '保存';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn-mini'; cancel.textContent = '取消';
        const wrap = document.createElement('div');
        wrap.className = 'no-edit';
        wrap.append('季', sInput, '集', eInput, save, cancel);
        metaEl.replaceWith(wrap);
        sInput.focus();
        cancel.addEventListener('click', () => loadEpisodeDetail(ep.id));
        save.addEventListener('click', async () => {
            const body = {};
            const s = parseInt(sInput.value, 10);
            const e = parseInt(eInput.value, 10);
            if (!isNaN(s) && s >= 1) body.season = s;
            if (!isNaN(e) && e >= 1) body.episodeNo = e;
            if (body.season == null && body.episodeNo == null) { loadEpisodeDetail(ep.id); return; }
            try {
                const resp = await fetch(`/api/episodes/${ep.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (resp.ok) { loadEpisodeDetail(ep.id); return; }
            } catch (err) { }
            wrap.replaceWith(metaEl);
            metaEl.textContent = oldNo + '（保存失败）';
        });
    });
    episodeDetailHeadEl.querySelector('[data-nav="media"]')?.addEventListener('click', () => openMediaDetail(media.id));
}

// 集备注：展示 + 内联编辑（保存走 PUT /api/episodes/{id}，仅改 note；变更后端入队重嵌）
function renderEpisodeNote(ep) {
    const el = episodeDetailNoteEl;
    el.hidden = false;
    const note = (ep.note || '').trim();
    el.classList.toggle('empty', !note);
    el.innerHTML = '';
    if (note) {
        const txt = document.createElement('div');
        txt.className = 'detail-note-text';
        txt.textContent = `备注：${note}`;
        el.appendChild(txt);
    }
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-mini note-edit-btn';
    editBtn.textContent = note ? '编辑备注' : '＋ 添加备注';
    editBtn.addEventListener('click', () => {
        el.innerHTML = '';
        const ta = document.createElement('textarea');
        ta.className = 'note-edit-input';
        ta.rows = 3;
        ta.placeholder = '集备注（该集看点/重点），参与搜索';
        ta.value = note;
        const actions = document.createElement('div');
        actions.className = 'note-edit-actions';
        const save = document.createElement('button');
        save.type = 'button'; save.className = 'btn-mini'; save.textContent = '保存';
        const cancel = document.createElement('button');
        cancel.type = 'button'; cancel.className = 'btn-mini'; cancel.textContent = '取消';
        actions.appendChild(save);
        actions.appendChild(cancel);
        el.appendChild(ta);
        el.appendChild(actions);
        ta.focus();
        cancel.addEventListener('click', () => loadEpisodeDetail(ep.id));
        save.addEventListener('click', async () => {
            const resp = await fetch(`/api/episodes/${ep.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: ta.value.trim() })
            });
            if (resp.ok) {
                loadEpisodeDetail(ep.id);
            } else {
                el.innerHTML = '<span class="note-err">保存失败</span>';
            }
        });
    });
    el.appendChild(editBtn);
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

/** 删除集：级联清理其下片段与封面；集详情页删除后返回，媒体详情行删除后刷新。 */
function deleteEpisode(ep) {
    const no = ep.episodeNo != null ? `第${ep.episodeNo}集` : '本集';
    showConfirm({
        title: `删除${no}`,
        msg: `删除${no}？其下所有片段、标签与封面将一并删除！`,
        okText: '删除',
        onOk: async () => {
            try {
                const resp = await fetch(`/api/episodes/${ep.id}`, { method: 'DELETE' });
                if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
                if (activeView() === 'episode-detail') { goBack(); return; }
                if (activeView() === 'media-detail' && currentMedia) loadMediaDetail(currentMedia.id);
            } catch (err) {
                const st = activeView() === 'episode-detail' ? episodeDetailStatusEl : detailStatusEl;
                st.textContent = '删除失败：后端未响应';
            }
        }
    });
}

// ---------- 搜索 ----------

// 时间范围筛选：'' 不限；'7/30/90' 近 N 天；'custom' 取两个 date 输入（本地时区）
function searchTimeRange() {
    const v = searchTimeSelect ? searchTimeSelect.value : '';
    if (!v) return { from: null, to: null };
    if (v === 'custom') {
        const f = searchTimeFrom.value, t = searchTimeTo.value;
        const from = f ? new Date(f + 'T00:00:00').getTime() : null;
        const to = t ? new Date(t + 'T23:59:59').getTime() : null;
        return { from, to };
    }
    const days = parseInt(v, 10);
    return { from: Date.now() - days * 86400000, to: null };
}

async function runSearch(q) {
    currentQuery = q;
    statusEl.textContent = '搜索中…';
    resultsEl.innerHTML = '';
    try {
        const sp = new URLSearchParams({ q, dim: currentDim });
        if (SEARCH_FORMAT_SELECT && SEARCH_FORMAT_SELECT.value) sp.set('format', SEARCH_FORMAT_SELECT.value);
        if (SEARCH_SUBCATEGORY_SELECT && SEARCH_SUBCATEGORY_SELECT.value) sp.set('subcategoryId', SEARCH_SUBCATEGORY_SELECT.value);
        const { from, to } = searchTimeRange();
        if (from != null) sp.set('from', String(from));
        if (to != null) sp.set('to', String(to));
        const resp = await fetch(`/api/search?${sp.toString()}`);
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

// 站点角标：URL 前端解析 hostname → 常用站点短名
function siteName(url) {
    if (!url) return '';
    try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        const map = {
            'bilibili.com': 'B站', 'youtube.com': 'YouTube', 'youtu.be': 'YouTube',
            'pixiv.net': 'Pixiv', 'artstation.com': 'ArtStation', 'weibo.com': '微博',
            'twitter.com': 'X', 'x.com': 'X', 'douyin.com': '抖音', 'xiaohongshu.com': '小红书'
        };
        return map[host] || host.split('.')[0] || host;
    } catch (e) {
        return '';
    }
}

// 结果角标：格式 / 子分类 / 站点
function resultBadges(r) {
    const badges = [];
    if (r.mediaFormat) {
        badges.push(`<span class="result-badge badge-fmt fmt-${esc(r.mediaFormat)}">${esc(formatName(r.mediaFormat))}</span>`);
    }
    if (r.subcategory) {
        badges.push(`<span class="result-badge badge-sub">${esc(r.subcategory)}</span>`);
    }
    const site = siteName(r.url);
    if (site) {
        badges.push(`<span class="result-badge badge-site">${esc(site)}</span>`);
    }
    if (r.createdAt) {
        badges.push(`<span class="result-badge badge-time-stamp" title="打标时间">${fmtDateTime(r.createdAt)}</span>`);
    }
    return badges.length ? `<div class="result-badges">${badges.join('')}</div>` : '';
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
            ${resultBadges(r)}
            ${scoreBar}
            <div class="card-actions">
                <button class="btn-similar" type="button">相似</button>
                <button class="btn-edit" type="button">编辑</button>
                <button class="btn-delete" type="button">删除</button>
            </div>
        </div>`;
    card.querySelector('.card-title').innerHTML = hl(r.title, currentQuery);
    const tagNote = (r.tag || '') + (r.note ? ` · ${r.note}` : '');
    card.querySelector('.card-tag').innerHTML = hl(tagNote, currentQuery);
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
    if (searchGroupToggle && searchGroupToggle.checked) {
        renderGroupedByMedia(results);
    } else if (currentDim === 'mixed') {
        renderMixed(results);
    } else {
        for (const r of results) appendSearchCard(resultsEl, r, {});
    }
}

// 按媒体聚合：结果按所属媒体分组，媒体→集→片段结构化，方便顺着一部部收素材
function renderGroupedByMedia(results) {
    const groups = new Map(); // mediaId → { title, format, subcategory, mediaId, items: [] }
    for (const r of results) {
        let mediaId = r.mediaId;
        if (mediaId == null && r.entityType === 'MEDIA') mediaId = r.id;
        if (mediaId == null) mediaId = '__orphan__';
        if (!groups.has(mediaId)) {
            groups.set(mediaId, {
                mediaId: mediaId === '__orphan__' ? null : mediaId,
                title: r.entityType === 'MEDIA' ? r.title : (r.mediaTitle || '未归组'),
                format: r.mediaFormat || '',
                subcategory: r.subcategory || '',
                items: []
            });
        }
        groups.get(mediaId).items.push(r);
    }
    for (const [key, g] of groups) {
        const sec = document.createElement('section');
        sec.className = 'mixed-section group-media';
        const h = document.createElement('h3');
        h.className = 'mixed-title group-title';
        const badge = [];
        if (g.format) badge.push(`<span class="result-badge badge-fmt fmt-${esc(g.format)}">${esc(formatName(g.format))}</span>`);
        if (g.subcategory) badge.push(`<span class="result-badge badge-sub">${esc(g.subcategory)}</span>`);
        h.innerHTML = `<span class="group-title-text">${esc(g.title)}</span>${badge.join('')}<span class="group-count">${g.items.length} 条</span>`;
        h.style.cursor = g.mediaId ? 'pointer' : 'default';
        if (g.mediaId) h.addEventListener('click', () => openMediaDetail(g.mediaId));
        const body = document.createElement('div');
        body.className = 'mixed-body';
        for (const r of g.items) appendSearchCard(body, r, {});
        sec.appendChild(h);
        sec.appendChild(body);
        resultsEl.appendChild(sec);
    }
}

// 混合模式：三层结果分栏展示（媒体 / 集 / 片段）
function renderMixed(results) {
    const groups = { MEDIA: [], EPISODE: [], CLIP: [] };
    for (const r of results) (groups[r.entityType] || groups.CLIP).push(r);
    const labels = { MEDIA: '媒体', EPISODE: '集', CLIP: '片段' };
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
    if (r.entityType === 'MEDIA') return appendMediaCard(container, r);
    if (r.entityType === 'EPISODE') return appendEpisodeCard(container, r);
    appendClipCard(container, r, opts);
}

function appendMediaCard(container, r) {
    const card = document.createElement('div');
    card.className = 'card card-clip';
    const thumb = r.coverPath
        ? `<div class="cc-thumb"><img src="${r.coverPath}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>`
        : '';
    const noteHtml = r.note ? `<div class="card-note">${hl(r.note, currentQuery)}</div>` : '';
    card.innerHTML = `${thumb}
        <div class="cc-body">
            <div class="card-title"></div>
            <div class="cc-meta"><span class="card-tag"></span></div>
            ${noteHtml}
            ${resultBadges(r)}
        </div>`;
    card.querySelector('.card-title').innerHTML = hl(r.title || '(未命名)', currentQuery);
    card.querySelector('.card-tag').textContent = `媒体 · 匹配 ${Math.round((r.score || 0) * 100) / 100}`;
    const thumbEl = card.querySelector('.cc-thumb');
    if (thumbEl) bindHoverPreview(thumbEl, r.coverPath); // 媒体悬浮看封面大图
    card.addEventListener('click', () => openMediaDetail(r.mediaId));
    container.appendChild(card);
}

function appendEpisodeCard(container, r) {
    const card = document.createElement('div');
    card.className = 'card card-clip';
    const thumb = r.coverPath
        ? `<div class="cc-thumb"><img src="${r.coverPath}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>`
        : '';
    const noteHtml = r.note ? `<div class="card-note">${hl(r.note, currentQuery)}</div>` : '';
    card.innerHTML = `${thumb}
        <div class="cc-body">
            <div class="card-title"></div>
            <div class="cc-meta"><span class="card-tag"></span></div>
            ${noteHtml}
            ${resultBadges(r)}
        </div>`;
    card.querySelector('.card-title').innerHTML = hl(r.title || '(未命名)', currentQuery);
    card.querySelector('.card-tag').textContent = `集 · 匹配 ${Math.round((r.score || 0) * 100) / 100}`;
    const thumbEl = card.querySelector('.cc-thumb');
    if (thumbEl) bindHoverPreview(thumbEl, r.coverPath); // 集悬浮看封面大图
    card.addEventListener('click', () => {
        if (r.episodeId) {
            openEpisodeDetail(r.episodeId); // 点集卡片进集详情
        } else if (r.videoFp) {
            fromMediaDetail = true;
            openTimeline({ fp: r.videoFp, title: r.title || '时间线' });
        } else if (r.mediaId) {
            openMediaDetail(r.mediaId);
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

function confirmDelete(r) {
    const desc = `${r.title} · ${r.timestampSec != null ? fmtTime(r.timestampSec) : ''} · ${r.tag || ''}`;
    showConfirm({
        title: '删除这条标签',
        msg: `删除这条标签？\n${desc}`,
        okText: '删除',
        onOk: async () => {
            try {
                const resp = await fetch(`/api/clips/${r.id}`, { method: 'DELETE' });
                if (!resp.ok && resp.status !== 204) throw new Error(`HTTP ${resp.status}`);
                if (activeView() === 'clip-detail') { goBack(); return; } // 详情页删除后返回
                refreshCurrentView();
            } catch (err) {
                statusEl.textContent = '删除失败：后端未响应';
            }
        }
    });
}

function refreshCurrentView() {
    const active = activeView();
    if (active === 'search') {
        if (currentQuery) runSearch(currentQuery);
    } else if (active === 'timeline' && currentVideo) {
        openTimeline(currentVideo);
    } else if (active === 'videos') {
        loadVideos(true);
    } else if (active === 'media') {
        loadMedia();
    } else if (active === 'media-detail' && currentMedia) {
        loadMediaDetail(currentMedia.id);
    } else if (active === 'episode-detail' && currentEpisode) {
        loadEpisodeDetail(currentEpisode.id);
    } else if (active === 'clip-detail' && currentClip) {
        renderClipDetail(currentClip.id);
    }
}

// ---------- 媒体 ----------

function esc(s) {
    const div = document.createElement('div');
    div.textContent = s == null ? '' : String(s);
    return div.innerHTML;
}

/** 全字段高亮：escape 后把当前查询词包裹 <mark class="hl">（大小写不敏感，按空白分词）。 */
function hl(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const terms = String(q).trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return safe;
    return terms.reduce((html, term) => {
        if (!term) return html;
        const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return html.replace(new RegExp(pattern, 'gi'), m => `<mark class="hl">${m}</mark>`);
    }, safe);
}

async function loadMedia() {
    mediaStatusEl.textContent = '加载中…';
    mediaGridEl.innerHTML = '';
    try {
        let url;
        if (mediaFilter.collectionId && mediaMode !== 'recent') {
            const params = new URLSearchParams();
            if (mediaFilter.status) params.set('status', mediaFilter.status);
            if (mediaFilter.unconfirmed) params.set('confirmed', '0');
            url = `/api/collections/${mediaFilter.collectionId}/media?${params.toString()}`;
        } else if (mediaMode === 'recent') {
            const params = new URLSearchParams({ limit: '100' });
            if (mediaFilter.collectionId) params.set('collectionId', mediaFilter.collectionId);
            if (mediaFilter.status) params.set('status', mediaFilter.status);
            if (mediaFilter.unconfirmed) params.set('confirmed', '0');
            url = `/api/media/recent?${params.toString()}`;
        } else {
            const params = new URLSearchParams({ limit: '100' });
            if (mediaFilter.status) params.set('status', mediaFilter.status);
            if (mediaFilter.format) params.set('format', mediaFilter.format);
            if (mediaFilter.subcategoryId) params.set('subcategoryId', mediaFilter.subcategoryId);
            if (mediaFilter.unconfirmed) params.set('confirmed', '0');
            url = `/api/media?${params.toString()}`;
        }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        let list = await resp.json();
        // 格式/子分类过滤兜底：recent 与收藏夹分支后端只过滤 status/confirmed，format/subcategoryId 客户端统一过滤（数据量小）
        if (mediaFilter.format || mediaFilter.subcategoryId) {
            const f = formatsCache.find(x => x.code === activeFormatTab);
            const subTree = mediaFilter.subcategoryId && f
                ? subcategoryTreeIds(f, mediaFilter.subcategoryId) : null;
            list = list.filter(m =>
                (!mediaFilter.format || (m.mediaFormat || '') === mediaFilter.format) &&
                (!mediaFilter.subcategoryId || subTree.has(String(m.subcategoryId))));
        }
        mediaStatusEl.textContent = list.length
            ? ''
            : (mediaMode === 'recent' ? '还没有打过标记的媒体，去看片按 Alt+S 打一个' : '没有符合条件的媒体');
        renderMediaGrid(list);
    } catch (err) {
        mediaStatusEl.textContent = '加载失败：后端未响应';
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
            opt.textContent = `${c.name}（${c.mediaCount || 0}）`;
            filterCollectionEl.appendChild(opt);
        }
        filterCollectionEl.value = cur;
    } catch (e) { /* 忽略 */ }
}

/** 媒体栏工具栏：新建收藏夹（modal 输入 → 创建后选中新收藏夹并刷新列表）。 */
function createCollectionFromToolbar() {
    collectionNameInput.value = '';
    collectionModal.hidden = false;
    collectionNameInput.focus();
}

async function saveCollectionFromModal() {
    const name = collectionNameInput.value.trim();
    if (!name) { collectionNameInput.focus(); return; }
    try {
        const resp = await fetch('/api/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!resp.ok) { alert('创建失败'); return; }
        const c = await resp.json();
        collectionModal.hidden = true;
        await fillFilterCollections();
        filterCollectionEl.value = String(c.id);
        mediaFilter.collectionId = String(c.id);
        loadMedia();
    } catch (err) { alert('创建失败：后端未响应'); }
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
                await fetch(`/api/collections/${c.id}/media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mediaId: d.id })
                });
            } else {
                await fetch(`/api/collections/${c.id}/media/${d.id}`, { method: 'DELETE' });
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

function renderMediaGrid(list) {
    for (const a of list) {
        mediaById.set(a.id, a);
        const card = document.createElement('div');
        card.className = 'media-card' + (mediaBatchMode ? ' batch-mode' : '') + (mediaSelected.has(a.id) ? ' selected' : '');
        const cover = (a.coverPath || a.fallbackCoverPath)
            ? `<img src="${a.coverPath || a.fallbackCoverPath}" alt="" onerror="this.style.display='none'">`
            : `<span class="cover-placeholder">${esc(a.title).slice(0, 1)}</span>`;
        const fmtBadge = a.mediaFormat
            ? `<span class="media-format-badge fmt-${esc(a.mediaFormat)}">${esc(formatName(a.mediaFormat))}</span>`
            : '';
        card.innerHTML = `
            <div class="media-cover">${fmtBadge}${cover}
                <input type="checkbox" class="media-batch-cb" ${mediaBatchMode ? '' : 'hidden'} ${mediaSelected.has(a.id) ? 'checked' : ''}>
                <button type="button" class="media-del-btn" title="删除媒体">×</button>
            </div>
            <div class="media-card-body">
                <div class="media-card-title"></div>
                <div class="media-card-meta"></div>
                <div class="media-card-badges"></div>
            </div>`;
        card.querySelector('.media-card-title').textContent = a.title;
        const meta = [];
        if (a.subcategory) meta.push(a.subcategory);
        if (a.status) meta.push(MEDIA_STATUS_LABEL[a.status] || a.status);
        if (a.rating != null) meta.push(`★ ${a.rating}`);
        meta.push(`${a.clipCount || 0} 条片段`);
        card.querySelector('.media-card-meta').textContent = meta.join(' · ');
        const badges = card.querySelector('.media-card-badges');
        if (a.confirmed === 0) {
            const b = document.createElement('span');
            b.className = 'badge-warn';
            b.textContent = '待确认';
            badges.appendChild(b);
        }
        // 批量勾选（click stopPropagation：避免冒泡到 card click 导致批量模式下二次 toggle 把勾选取消）
        const cb = card.querySelector('.media-batch-cb');
        cb.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', () => {
            if (cb.checked) { mediaSelected.add(a.id); card.classList.add('selected'); }
            else { mediaSelected.delete(a.id); card.classList.remove('selected'); }
            updateMediaBatchConfirm();
        });
        // 单卡片删除（详情页外的新入口）
        card.querySelector('.media-del-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openBatchDelModal([a.id]);
        });
        card.addEventListener('click', () => {
            if (mediaBatchMode) { // 批量模式下点卡片=切换勾选
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
                return;
            }
            openMediaDetail(a.id);
        });
        mediaGridEl.appendChild(card);
    }
}

/** 批量删除模式：工具栏按钮切换 + 删除选中。 */
function updateMediaBatchConfirm() {
    const btn = document.getElementById('media-batch-confirm');
    btn.textContent = `删除选中(${mediaSelected.size})`;
    btn.hidden = !mediaBatchMode;
}

function toggleMediaBatchMode() {
    mediaBatchMode = !mediaBatchMode;
    mediaSelected.clear();
    document.getElementById('media-batch-del').textContent = mediaBatchMode ? '取消批量' : '批量删除';
    updateMediaBatchConfirm();
    loadMedia(); // 重渲染以显示/隐藏勾选框
}

/** 打开删除确认弹窗（单删 ids=[id] / 批量 ids=mediaSelected）。 */
function openBatchDelModal(ids) {
    if (!ids || ids.length === 0) return;
    batchDelIds = ids;
    const names = ids.map(id => {
        const m = mediaById.get(id);
        return { title: m ? m.title : `#${id}`, fmt: m && m.mediaFormat ? formatName(m.mediaFormat) : '' };
    });
    document.getElementById('batch-del-count').textContent = names.length;
    const ul = document.getElementById('batch-del-list');
    ul.innerHTML = '';
    for (const n of names) {
        const li = document.createElement('li');
        const t = document.createElement('span');
        t.className = 'title';
        t.textContent = n.title;
        li.appendChild(t);
        if (n.fmt) {
            const f = document.createElement('span');
            f.className = 'fmt';
            f.textContent = n.fmt;
            li.appendChild(f);
        }
        ul.appendChild(li);
    }
    batchDelModal.hidden = false;
}

/** 确认删除：调批量端点（单删 ids 也走同一端点）。 */
async function confirmBatchDelete() {
    if (batchDelIds.length === 0) return;
    const ids = batchDelIds;
    try {
        await fetch(`/api/media?ids=${ids.join(',')}`, { method: 'DELETE' });
    } catch (err) { }
    batchDelModal.hidden = true;
    batchDelIds = [];
    if (mediaBatchMode) { // 来自批量模式：退出
        mediaBatchMode = false;
        mediaSelected.clear();
        document.getElementById('media-batch-del').textContent = '批量删除';
        updateMediaBatchConfirm();
    } else { // 来自单卡片删除：仅移除已删 id
        ids.forEach(id => mediaSelected.delete(id));
    }
    loadMedia();
}

/** 导航入口：入栈再加载媒体详情。 */
function openMediaDetail(id) {
    pushView('media-detail');
    loadMediaDetail(id);
}

/** 媒体详情渲染（刷新/返回复用，不入栈）。 */
async function loadMediaDetail(id) {
    currentMedia = { id };
    fromMediaDetail = false;
    mediaDetailHeadEl.innerHTML = '';
    episodeListEl.innerHTML = '';
    detailTagsEl.innerHTML = '';
    detailStatusEl.textContent = '加载中…';
    try {
        const [detailResp, epResp] = await Promise.all([
            fetch(`/api/media/${id}`),
            fetch(`/api/media/${id}/episodes`)
        ]);
        if (!detailResp.ok) throw new Error(`HTTP ${detailResp.status}`);
        const detail = await detailResp.json();
        const eps = epResp.ok ? await epResp.json() : [];
        currentMedia = detail;
        renderMediaDetail(detail, eps);
        detailStatusEl.textContent = '';
    } catch (err) {
        detailStatusEl.textContent = '加载失败：后端未响应';
    }
}

function renderMediaDetail(d, eps) {
    const cover = (d.coverPath || d.fallbackCoverPath)
        ? `<img src="${d.coverPath || d.fallbackCoverPath}" alt="">`
        : `<span class="cover-placeholder large">${esc(d.title).slice(0, 1)}</span>`;
    mediaDetailHeadEl.innerHTML = `
        <div class="ad-cover">${cover}</div>
        <div class="ad-info">
            <h2 class="ad-title"></h2>
            <div class="ad-meta"></div>
            ${d.note ? '<div class="ad-note"></div>' : ''}
        </div>`;
    mediaDetailHeadEl.querySelector('.ad-title').textContent = d.title;
    const meta = [];
    if (d.mediaFormat) meta.push(formatName(d.mediaFormat));
    if (d.subcategory) meta.push(d.subcategory);
    if (d.status) meta.push(MEDIA_STATUS_LABEL[d.status] || d.status);
    if (d.rating != null) meta.push(`★ ${d.rating}`);
    const isVideo = d.mediaFormat === 'VIDEO';
    meta.push(isVideo ? `${d.episodeCount || 0} 集 · ${d.clipCount || 0} 条片段` : `${d.clipCount || 0} 条`);
    mediaDetailHeadEl.querySelector('.ad-meta').textContent = meta.join(' · ');
    if (d.note) mediaDetailHeadEl.querySelector('.ad-note').textContent = `备注：${d.note}`;
    renderDetailTags(d);
    renderDetailCollections(d);
    // 仅视频格式展示「集列表」；图片/文字为单层媒体
    const epListTitle = document.getElementById('episode-list-title');
    episodeListEl.hidden = !isVideo;
    if (epListTitle) epListTitle.hidden = !isVideo;
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
            await fetch(`/api/media/${d.id}/tags/${t.id}`, { method: 'DELETE' });
            refreshMediaDetail();
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
            await fetch(`/api/media/${d.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag: input.value.trim() })
            });
            refreshMediaDetail();
        }
    });
    wrap.appendChild(input);
    detailTagsEl.appendChild(wrap);
    attachTagSuggest(input, () => (currentMedia && currentMedia.id) || null);
}

function refreshMediaDetail() {
    if (currentMedia && currentMedia.id) loadMediaDetail(currentMedia.id);
}

// ---------- 媒体格式 / 子分类 ----------

function formatName(code) {
    if (!code) return '';
    const f = formatsCache.find(x => x.code === code);
    return f ? f.name : code;
}

/** 拉取格式树并刷新各下拉/格式 tab（页面加载、维护操作后调用）。 */
async function loadFormats() {
    try {
        const resp = await fetch('/api/media-formats');
        if (!resp.ok) return;
        formatsCache = await resp.json();
    } catch (e) {
        formatsCache = [];
    }
    renderFormatTabs();
    fillSubcategoryFilter();
    fillSearchFilters();
}

function renderFormatTabs() {
    if (!formatTabsEl) return;
    formatTabsEl.innerHTML = '';
    const mk = (code, label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ftab' + (activeFormatTab === code ? ' active' : '');
        b.textContent = label;
        b.addEventListener('click', () => selectFormatTab(code));
        return b;
    };
    formatTabsEl.appendChild(mk('', '全部'));
    for (const f of formatsCache) formatTabsEl.appendChild(mk(f.code, f.name));
}

function selectFormatTab(code) {
    activeFormatTab = code;
    mediaFilter.format = code;
    // 格式切换后子分类过滤可能不再属于该格式，清空
    mediaFilter.subcategoryId = '';
    fillSubcategoryFilter();
    renderFormatTabs();
    loadMedia();
}

/** 子分类树各节点路径（根到当前，如「番剧 / 异世界」）。下拉选项用路径而非空格缩进，
 *  原生 option 里空格缩进渲染不可靠，路径能一眼看出上级。 */
function subPathMap(f) {
    const path = new Map();
    const byParent = new Map();
    for (const s of f.subcategories) {
        const k = String(s.parentId || 0);
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k).push(s);
    }
    const walk = (pid, prefix) => {
        for (const s of (byParent.get(String(pid)) || [])) {
            const full = prefix ? `${prefix} / ${s.name}` : s.name;
            path.set(String(s.id), full);
            walk(s.id, full);
        }
    };
    walk(0, '');
    return path;
}

/** 节点及其全部子孙 id 集合（子树收敛；客户端过滤兜底用）。 */
function subcategoryTreeIds(f, nodeId) {
    const set = new Set([String(nodeId)]);
    const byParent = new Map();
    for (const s of f.subcategories) {
        const k = String(s.parentId || 0);
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k).push(s);
    }
    const stack = [String(nodeId)];
    while (stack.length) {
        const p = stack.pop();
        for (const s of (byParent.get(p) || [])) {
            set.add(String(s.id));
            stack.push(String(s.id));
        }
    }
    return set;
}

function fillSubcategoryFilter() {
    if (!filterSubcategoryEl) return;
    const f = formatsCache.find(x => x.code === activeFormatTab);
    filterSubcategoryEl.innerHTML = `<option value="">${f ? '子分类' : '（先选格式）'}</option>`;
    if (f) {
        const path = subPathMap(f);
        for (const s of f.subcategories) {
            const opt = document.createElement('option');
            opt.value = String(s.id);
            opt.textContent = path.get(String(s.id)) || s.name;
            filterSubcategoryEl.appendChild(opt);
        }
    }
    filterSubcategoryEl.value = mediaFilter.subcategoryId || '';
}

function fillSearchFilters() {
    if (!SEARCH_FORMAT_SELECT) return;
    SEARCH_FORMAT_SELECT.innerHTML = '<option value="">格式</option>';
    for (const f of formatsCache) {
        const opt = document.createElement('option');
        opt.value = f.code;
        opt.textContent = f.name;
        SEARCH_FORMAT_SELECT.appendChild(opt);
    }
    fillSearchSubcategory();
}

function fillSearchSubcategory() {
    if (!SEARCH_SUBCATEGORY_SELECT) return;
    const code = SEARCH_FORMAT_SELECT.value;
    const f = formatsCache.find(x => x.code === code);
    SEARCH_SUBCATEGORY_SELECT.innerHTML = `<option value="">${f ? '子分类' : '（先选格式）'}</option>`;
    if (f) {
        const path = subPathMap(f);
        for (const s of f.subcategories) {
            const opt = document.createElement('option');
            opt.value = String(s.id);
            opt.textContent = path.get(String(s.id)) || s.name;
            SEARCH_SUBCATEGORY_SELECT.appendChild(opt);
        }
    }
}

function fillMediaFormatSelect(selected) {
    const cur = selected || '';
    mediaFormatSelect.innerHTML = '<option value="">— 请选择 —</option>';
    for (const f of formatsCache) {
        const opt = document.createElement('option');
        opt.value = f.code;
        opt.textContent = f.name;
        mediaFormatSelect.appendChild(opt);
    }
    mediaFormatSelect.value = cur;
}

function fillMediaSubcategorySelect(selected) {
    const f = formatsCache.find(x => x.code === mediaFormatSelect.value);
    const cur = selected != null ? String(selected) : '';
    mediaSubcategorySelect.innerHTML = `<option value="">${f ? '— 未分类 —' : '（先选格式）'}</option>`;
    if (f) {
        const path = subPathMap(f);
        for (const s of f.subcategories) {
            const opt = document.createElement('option');
            opt.value = String(s.id);
            opt.textContent = path.get(String(s.id)) || s.name;
            mediaSubcategorySelect.appendChild(opt);
        }
    }
    mediaSubcategorySelect.value = cur;
}

function hideInlineAdd() {
    mediaNewSubInput.hidden = true;
    mediaNewSubInput.value = '';
    mediaAddSubBtn.hidden = true;
    mediaInlineAddBtn.hidden = false;
}

/** 新建媒体弹窗内联新增子分类：挂到当前选中的分类下（未选中=根级）。 */
async function addMediaSubcategoryInline() {
    const name = mediaNewSubInput.value.trim();
    const f = formatsCache.find(x => x.code === mediaFormatSelect.value);
    if (!name || !f) return;
    const parentId = mediaSubcategorySelect.value ? Number(mediaSubcategorySelect.value) : 0;
    try {
        const resp = await fetch(`/api/media-formats/${f.id}/subcategories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parentId })
        });
        if (!resp.ok) return;
        const created = await resp.json();
        await loadFormats();
        fillMediaFormatSelect(f.code);
        fillMediaSubcategorySelect(created.id);
        hideInlineAdd();
    } catch (e) { /* 忽略 */ }
}

// ---------- 管理格式 / 子分类弹层 ----------

async function openMediaFormatModal() {
    mediaFormatModal.hidden = false;
    fmStatusEl.textContent = '';
    fmSubParentId = 0;                    // 每次打开都从所选格式的根级开始
    await loadFormats();
    fmSelectedFormatId = formatsCache.length ? formatsCache[0].id : null;
    renderFormatManager();
}

function renderFormatManager() {
    fmFormatsEl.innerHTML = '';
    for (const f of formatsCache) {
        const item = document.createElement('div');
        item.className = 'fm-format' + (f.id === fmSelectedFormatId ? ' active' : '');
        item.innerHTML = `<span class="fm-format-name"></span>`
            + `<button type="button" class="fm-del" title="删除格式">×</button>`;
        item.querySelector('.fm-format-name').textContent = `${f.name}（${f.code}）`;
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('fm-del')) return;
            fmSelectedFormatId = f.id;
            fmSubParentId = 0;            // 切格式后新增目标回到该格式的根级
            renderFormatManager();
        });
        item.querySelector('.fm-del').addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirm({
                title: `删除格式「${f.name}」`,
                msg: `删除格式「${f.name}」？其子分类一并删除，格式下有媒体时会被拒绝。`,
                okText: '删除',
                onOk: async () => {
                    try {
                        const resp = await fetch(`/api/media-formats/${f.id}`, { method: 'DELETE' });
                        if (!resp.ok) { fmStatusEl.textContent = '删除失败：格式下存在媒体'; return; }
                        await loadFormats();
                        fmSelectedFormatId = formatsCache.length ? formatsCache[0].id : null;
                        fmSubParentId = 0;
                        renderFormatManager();
                    } catch (err) { fmStatusEl.textContent = '删除失败'; }
                }
            });
        });
        fmFormatsEl.appendChild(item);
    }
    renderFmSubs();
}

/** 新增目标指示：实时显示「新增到「视频」下（根级）」或「新增到「热血」下」。 */
function updateFmTarget() {
    if (!fmSubTarget) return;
    const f = formatsCache.find(x => x.id === fmSelectedFormatId);
    if (!f) { fmSubTarget.textContent = ''; return; }
    if (fmSubParentId) {
        const parent = (f.subcategories || []).find(s => s.id === fmSubParentId);
        fmSubTarget.textContent = parent ? `新增到「${parent.name}」下` : '新增到根级';
    } else {
        fmSubTarget.textContent = `新增到「${f.name}」下（根级）`;
    }
}

/** 子分类树渲染：按 parentId 递归，行内缩进 + 每节点「＋新增下级 / ×删除」；＋ 目标高亮。 */
function renderFmSubs() {
    const f = formatsCache.find(x => x.id === fmSelectedFormatId);
    fmCurrentFormatEl.textContent = f ? `${f.name} · 子分类` : '选择左侧格式';
    updateFmTarget();
    fmSubListEl.innerHTML = '';
    fmNewSubInput.value = '';
    if (!f) return;
    const byParent = new Map();
    for (const s of f.subcategories) {
        const k = String(s.parentId || 0);
        if (!byParent.has(k)) byParent.set(k, []);
        byParent.get(k).push(s);
    }
    const render = (pid, level) => {
        for (const s of (byParent.get(String(pid)) || [])) {
            const row = document.createElement('div');
            row.className = 'fm-sub' + (s.id === fmSubParentId ? ' add-target' : '');
            row.style.marginLeft = (level * 18) + 'px';
            row.innerHTML = `<span></span><span class="fm-sub-count"></span>`
                + `<button type="button" class="fm-add-child" title="在此分类下新增下级">＋</button>`
                + `<button type="button" class="fm-del" title="删除子分类">×</button>`;
            row.querySelector('span').textContent = s.name;
            row.querySelector('.fm-sub-count').textContent = `${s.mediaCount || 0} 个媒体`;
            row.querySelector('.fm-add-child').addEventListener('click', () => {
                fmSubParentId = s.id;
                fmNewSubInput.focus();
                renderFmSubs();
            });
            row.querySelector('.fm-del').addEventListener('click', () => {
                showConfirm({
                    title: `删除子分类「${s.name}」`,
                    msg: `删除子分类「${s.name}」？其下有下级或媒体时会被拒绝。`,
                    okText: '删除',
                    onOk: async () => {
                        try {
                            const resp = await fetch(`/api/media-formats/subcategories/${s.id}`, { method: 'DELETE' });
                            if (!resp.ok) { fmStatusEl.textContent = '删除失败：该分类下存在下级或媒体'; return; }
                            if (fmSubParentId === s.id) fmSubParentId = 0;
                            await loadFormats();
                            renderFormatManager();
                        } catch (err) { fmStatusEl.textContent = '删除失败'; }
                    }
                });
            });
            fmSubListEl.appendChild(row);
            render(s.id, level + 1);
        }
    };
    render(0, 0);
}

/** 新增子分类：挂到 fmSubParentId（默认根级，点行内 ＋ 切换）。 */
async function fmAddSubcategory() {
    const name = fmNewSubInput.value.trim();
    if (!fmSelectedFormatId || !name) return;
    try {
        const resp = await fetch(`/api/media-formats/${fmSelectedFormatId}/subcategories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parentId: fmSubParentId })
        });
        if (!resp.ok) { fmStatusEl.textContent = '添加失败（同级已存在）'; return; }
        await loadFormats();
        renderFormatManager();
    } catch (err) { fmStatusEl.textContent = '添加失败'; }
}

/** 新增位置切回所选格式的根级。 */
function fmAddRoot() {
    fmSubParentId = 0;
    fmNewSubInput.focus();
    renderFmSubs();
}

async function fmAddFormat() {
    const code = fmNewCodeInput.value.trim().toUpperCase();
    const name = fmNewNameInput.value.trim();
    if (!code || !name) { fmStatusEl.textContent = '编码与显示名不能为空'; return; }
    try {
        const resp = await fetch('/api/media-formats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, name, hasChildren: fmNewHasChildren.checked ? 1 : 0 })
        });
        if (!resp.ok) { fmStatusEl.textContent = '新增失败（编码已存在？）'; return; }
        const created = await resp.json();
        fmNewCodeInput.value = '';
        fmNewNameInput.value = '';
        fmNewHasChildren.checked = false;
        await loadFormats();
        fmSelectedFormatId = created.id;
        renderFormatManager();
    } catch (err) { fmStatusEl.textContent = '新增失败'; }
}

function renderEpisodeList(eps) {
    episodeListEl.innerHTML = '';
    if (eps.length === 0) {
        episodeListEl.innerHTML = '<div class="status">该媒体还没有集，去看片按 Alt+S 打标记会自动创建</div>';
        return;
    }
    // 按季分组：season 非空按季排序；season 为空归「未识别」组（高亮提示编辑）
    const groups = new Map();
    const unknown = [];
    for (const ep of eps) {
        if (ep.season != null) {
            if (!groups.has(ep.season)) groups.set(ep.season, []);
            groups.get(ep.season).push(ep);
        } else {
            unknown.push(ep);
        }
    }
    for (const season of [...groups.keys()].sort((a, b) => a - b)) {
        const groupEl = document.createElement('div');
        groupEl.className = 'episode-group';
        const head = document.createElement('div');
        head.className = 'episode-group-head';
        head.textContent = `第 ${season} 季`;
        groupEl.appendChild(head);
        const listEl = document.createElement('div');
        listEl.className = 'episode-group-list';
        for (const ep of groups.get(season)) listEl.appendChild(buildEpisodeRow(ep, false));
        groupEl.appendChild(listEl);
        episodeListEl.appendChild(groupEl);
    }
    if (unknown.length > 0) {
        const groupEl = document.createElement('div');
        groupEl.className = 'episode-group unknown';
        const head = document.createElement('div');
        head.className = 'episode-group-head';
        head.innerHTML = '未识别季/集 <span class="ep-unknown-tip">季/集号未识别，点击集进详情「编辑季/集」修正</span>';
        groupEl.appendChild(head);
        const listEl = document.createElement('div');
        listEl.className = 'episode-group-list';
        for (const ep of unknown) listEl.appendChild(buildEpisodeRow(ep, true));
        groupEl.appendChild(listEl);
        episodeListEl.appendChild(groupEl);
    }
}

function buildEpisodeRow(ep, unknown) {
    const row = document.createElement('div');
    row.className = 'episode-row' + (unknown ? ' ep-unknown' : '');
    const no = unknown ? '？' : (ep.episodeNo != null ? `第${ep.episodeNo}集` : '?');
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
            refreshMediaDetail();
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
        fromMediaDetail = true;
        openTimeline({ fp: ep.videoFp, title: (currentMedia.title || '') + (unknown ? ' · 未识别' : ` · 第${ep.episodeNo}集`) });
    });
    row.querySelector('.ep-del-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteEpisode(ep);
    });
    row.addEventListener('click', () => openEpisodeDetail(ep.id)); // 点集行进集详情
    return row;
}

function openEpisodeTagModal(ep) {
    episodeTagEpisodeId = ep.id;
    const mediaName = currentMedia && currentMedia.title ? `《${currentMedia.title}》 · ` : '';
    episodeTagTargetEl.textContent = `${mediaName}${ep.episodeNo != null ? `第${ep.episodeNo}集` : '本集'}`;
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
    refreshCurrentView(); // 集详情 / 媒体详情 各自刷新
}

// ---------- 集封面：自选片段帧 / 上传兜底 ----------

function openEpisodeCoverModal(ep) {
    coverEpisode = ep;
    const mediaName = currentMedia && currentMedia.title ? `《${currentMedia.title}》 · ` : '';
    episodeCoverTargetEl.textContent = `${mediaName}${ep.title || '本集'}`;
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

function openCreateMedia() {
    editingMediaId = null;
    mediaModalTitle.textContent = '新建媒体';
    mediaTitleInput.value = '';
    hideInlineAdd();
    fillMediaFormatSelect();
    fillMediaSubcategorySelect(null);
    mediaStatusSelect.value = 'WANT';
    mediaRatingInput.value = '';
    mediaNoteInput.value = '';
    mediaModal.hidden = false;
    mediaTitleInput.focus();
}

function openEditMedia() {
    const d = currentMedia;
    if (!d) return;
    editingMediaId = d.id;
    mediaModalTitle.textContent = '编辑媒体';
    mediaTitleInput.value = d.title;
    hideInlineAdd();
    fillMediaFormatSelect(d.mediaFormat);
    fillMediaSubcategorySelect(d.subcategoryId);
    mediaStatusSelect.value = d.status || 'WANT';
    mediaRatingInput.value = d.rating != null ? d.rating : '';
    mediaNoteInput.value = d.note || '';
    mediaModal.hidden = false;
    mediaTitleInput.focus();
}

async function saveMedia() {
    const title = mediaTitleInput.value.trim();
    if (!title) return;
    const payload = {
        title,
        mediaFormat: mediaFormatSelect.value,
        subcategoryId: mediaSubcategorySelect.value ? Number(mediaSubcategorySelect.value) : null,
        status: mediaStatusSelect.value,
        rating: mediaRatingInput.value === '' ? null : parseFloat(mediaRatingInput.value),
        note: mediaNoteInput.value.trim()
    };
    if (editingMediaId == null) {
        const resp = await fetch('/api/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (resp.ok) {
            const created = await resp.json();
            mediaModal.hidden = true;
            openMediaDetail(created.id);
        }
    } else {
        await fetch(`/api/media/${editingMediaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        mediaModal.hidden = true;
        refreshMediaDetail();
    }
}

function openCoverModal() {
    coverUrlInput.value = '';
    coverFileInput.value = '';
    coverModal.hidden = false;
    coverUrlInput.focus();
}

async function saveCover() {
    if (!currentMedia) return;
    const url = coverUrlInput.value.trim();
    if (url) {
        await fetch(`/api/media/${currentMedia.id}/cover-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
    } else if (coverFileInput.files && coverFileInput.files[0]) {
        const fd = new FormData();
        fd.append('file', coverFileInput.files[0]);
        await fetch(`/api/media/${currentMedia.id}/cover`, { method: 'POST', body: fd });
    }
    coverModal.hidden = true;
    refreshMediaDetail();
}

async function openRenameModal() {
    renameTitleInput.value = '';
    mergeIntoSelect.innerHTML = '<option value="">— 不合并 —</option>';
    try {
        const resp = await fetch('/api/media?limit=100');
        if (resp.ok) {
            const list = await resp.json();
            for (const a of list) {
                if (a.id === currentMedia.id) continue;
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
    if (!currentMedia) return;
    const into = mergeIntoSelect.value;
    const title = renameTitleInput.value.trim();
    if (into) {
        await fetch(`/api/media/${currentMedia.id}/merge?into=${into}`, { method: 'POST' });
        renameModal.hidden = true;
        showView('media');
    } else if (title) {
        await fetch(`/api/media/${currentMedia.id}/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        renameModal.hidden = true;
        refreshMediaDetail();
    } else {
        renameModal.hidden = true;
    }
}

function deleteMedia() {
    if (!currentMedia) return;
    showConfirm({
        title: `删除媒体「${currentMedia.title}」`,
        msg: `删除媒体「${currentMedia.title}」？其下所有集与片段标签将一并删除！`,
        okText: '删除',
        onOk: async () => {
            await fetch(`/api/media/${currentMedia.id}`, { method: 'DELETE' });
            showView('media');
        }
    });
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

        renderBars(statsFormatsEl, data.byMediaFormat || [], {
            value: s => s.count,
            label: s => s.name,
            barW: 60
        });
        renderBars(statsSubcategoriesEl, data.bySubcategory || [], {
            value: s => s.count,
            label: s => s.label,
            barW: 60,
            emptyText: '暂无子分类数据'
        });
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

// ---------- 标签管理 ----------

/** 加载标签列表：global=全词库三级计数（分页）；media=某媒体维度引用数（不分页）。 */
async function loadTags() {
    tagSelected.clear();
    updateTagBatchBtn();
    if (tagCheckAll) tagCheckAll.checked = false;
    if (tagMode === 'media' && !tagMediaId) {
        tagStatusEl.textContent = '';
        tagListEl.textContent = '请先在右上角选择媒体';
        updateTagPager();
        return;
    }
    tagStatusEl.textContent = '加载中…';
    try {
        const q = tagFilterEl.value.trim();
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (tagMode === 'media' && tagMediaId) {
            params.set('mediaId', tagMediaId);
        } else {
            params.set('page', tagPage);
            params.set('size', tagPageSize);
        }
        const resp = await fetch(`/api/tags/manage?${params.toString()}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        tagListCache = data.items || [];
        tagTotal = data.total || 0;
        tagStatusEl.textContent = '';
        renderTagList();
        updateTagPager();
    } catch (err) {
        tagStatusEl.textContent = '加载失败：后端未响应';
    }
}

/** 分页控件状态：仅通用池显示；按媒体隐藏。 */
function updateTagPager() {
    const isGlobal = tagMode === 'global';
    if (tagPager) tagPager.hidden = !isGlobal;
    if (tagCheckAllWrap) tagCheckAllWrap.hidden = !isGlobal;
    if (!isGlobal || !tagPageInfo) return;
    const pages = Math.max(1, Math.ceil(tagTotal / tagPageSize));
    tagPageInfo.textContent = `第 ${Math.min(tagPage, pages)} / ${pages} 页 · 共 ${tagTotal} 个`;
    tagPagePrev.disabled = tagPage <= 1;
    tagPageNext.disabled = tagPage >= pages;
}

function renderTagList() {
    tagListEl.innerHTML = '';
    if (tagListCache.length === 0) {
        tagListEl.textContent = tagMode === 'media' ? '该媒体暂无标签' : '暂无标签，打标后自动收录';
        return;
    }
    for (const t of tagListCache) {
        const row = document.createElement('div');
        row.className = 'tag-row';

        if (tagMode === 'global') {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'tag-check';
            cb.title = '勾选后批量删除（仅孤儿词条）';
            cb.addEventListener('change', () => {
                if (cb.checked) tagSelected.add(t.id); else tagSelected.delete(t.id);
                updateTagBatchBtn();
            });
            row.prepend(cb);
        }

        const name = document.createElement('span');
        name.className = 'tag-name';
        name.textContent = t.name;

        const counts = document.createElement('span');
        counts.className = 'tag-counts';
        if (tagMode === 'media') {
            const c = document.createElement('span');
            c.textContent = `本媒体引用 ${t.refCount} 次`;
            counts.appendChild(c);
        } else {
            const m = document.createElement('span'); m.textContent = `媒体 ${t.mediaCount}`;
            const e = document.createElement('span'); e.textContent = `集 ${t.episodeCount}`;
            const c = document.createElement('span'); c.textContent = `片段 ${t.clipCount}`;
            counts.append(m, e, c);
        }

        const actions = document.createElement('span');
        actions.className = 'tag-actions';
        const btnRename = document.createElement('button');
        btnRename.type = 'button'; btnRename.className = 'btn-mini'; btnRename.textContent = '改名';
        btnRename.addEventListener('click', () => openTagRename(t));
        const btnMerge = document.createElement('button');
        btnMerge.type = 'button'; btnMerge.className = 'btn-mini'; btnMerge.textContent = '合并';
        btnMerge.addEventListener('click', () => openTagMerge(t));
        const btnDel = document.createElement('button');
        btnDel.type = 'button'; btnDel.className = 'btn-mini danger'; btnDel.textContent = '删除';
        btnDel.addEventListener('click', () => confirmTagDelete(t));
        actions.append(btnRename, btnMerge, btnDel);

        row.append(name, counts, actions);
        tagListEl.appendChild(row);
    }
}

function openTagRename(t) {
    tagRenameId = t.id;
    tagRenameTargetEl.textContent = `当前名称：${t.name}`;
    tagRenameInput.value = t.name;
    tagRenameStatusEl.textContent = '';
    tagRenameModal.hidden = false;
    tagRenameInput.focus();
}

async function saveTagRename() {
    const name = tagRenameInput.value.trim();
    if (!name) { tagRenameStatusEl.textContent = '名称不能为空'; return; }
    try {
        const resp = await fetch(`/api/tags/${tagRenameId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            tagRenameStatusEl.textContent = (err && err.message) || '改名失败';
            return;
        }
        tagRenameModal.hidden = true;
        tagRenameId = null;
        invalidateTagPool();
        loadTags();
    } catch (err) {
        tagRenameStatusEl.textContent = '请求失败';
    }
}

async function openTagMerge(t) {
    tagMergeId = t.id;
    tagMergeTargetEl.textContent = `源标签：${t.name}`;
    tagMergeStatusEl.textContent = '';
    tagMergeIntoEl.innerHTML = '<option value="">— 选择目标标签 —</option>';
    // 合并候选需全量词条（列表已分页，候选单独拉一次，size 足够大）
    try {
        const resp = await fetch('/api/tags/manage?size=10000');
        if (!resp.ok) return;
        const data = await resp.json();
        for (const other of (data.items || [])) {
            if (other.id === t.id) continue;
            const opt = document.createElement('option');
            opt.value = other.id;
            opt.textContent = other.name;
            tagMergeIntoEl.appendChild(opt);
        }
    } catch (err) { /* 候选加载失败仅保留空选项 */ }
    tagMergeModal.hidden = false;
}

async function saveTagMerge() {
    const toId = Number(tagMergeIntoEl.value);
    if (!toId) { tagMergeStatusEl.textContent = '请选择目标标签'; return; }
    try {
        const resp = await fetch('/api/tags/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromId: tagMergeId, toId })
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            tagMergeStatusEl.textContent = (err && err.message) || '合并失败';
            return;
        }
        tagMergeModal.hidden = true;
        tagMergeId = null;
        invalidateTagPool();
        loadTags();
    } catch (err) {
        tagMergeStatusEl.textContent = '请求失败';
    }
}

function confirmTagDelete(t) {
    showConfirm({
        title: '删除标签',
        msg: `确定删除标签「${t.name}」？仅无任何引用的孤儿词条可删。`,
        okText: '删除',
        onOk: async () => {
            const resp = await fetch(`/api/tags/${t.id}`, { method: 'DELETE' });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                tagStatusEl.textContent = (err && err.message) || '删除失败';
            }
            invalidateTagPool();
            loadTags();
        }
    });
}

/** 词库缓存失效：词条改名/合并/删除后调用，下次打开新增弹层重拉。 */
function invalidateTagPool() {
    tagPoolByName = new Map();
}

/** 懒加载全量词库 name→id（新增实时去重用；词条变化后清空重拉）。 */
async function ensureTagPool() {
    if (tagPoolByName.size > 0) return;
    try {
        const resp = await fetch('/api/tags/manage?size=10000');
        if (!resp.ok) return;
        const data = await resp.json();
        const m = new Map();
        for (const t of (data.items || [])) m.set(t.name, t.id);
        tagPoolByName = m;
    } catch (err) { /* 拉取失败则去重静默降级为空词库 */ }
}

/** 打开新增弹层：清空表单、聚焦输入、拉全量词库。 */
function openTagAdd() {
    tagAddInput.value = '';
    tagAddStatusEl.textContent = '';
    tagAddPreviewEl.innerHTML = '';
    tagAddModal.hidden = false;
    tagAddInput.focus();
    ensureTagPool().then(refreshTagAddPreview);
}

/** 按空格 / 逗号（中英文）拆输入，去重后返回候选词。 */
function splitTagInput(raw) {
    const seen = new Set();
    const out = [];
    for (const tok of String(raw || '').split(/[\s,，]+/)) {
        const t = tok.trim();
        if (!t) continue;
        if (seen.has(t)) continue;
        seen.add(t);
        out.push(t);
    }
    return out;
}

/** 实时去重预览：命中已有词条给「跳去合并」，未命中显示将新增。 */
function refreshTagAddPreview() {
    const names = splitTagInput(tagAddInput.value);
    tagAddPreviewEl.innerHTML = '';
    if (names.length === 0) return;
    const fresh = names.filter(n => !tagPoolByName.has(n));
    const dups = names.filter(n => tagPoolByName.has(n));
    const chips = [];
    if (fresh.length > 0) {
        chips.push(`<span class="chip chip-ok">✓ 将新增 ${fresh.length} 个：${fresh.map(esc).join(' ')}</span>`);
    }
    if (dups.length > 0) {
        const links = dups.map(n => {
            const id = tagPoolByName.get(n);
            return `<a href="#" data-tag-id="${id}" data-tag-name="${esc(n)}">「${esc(n)}」</a>`;
        }).join(' ');
        chips.push(`<span class="chip chip-warn">⚠ 已存在 ${dups.length} 个：${links}（点标签可跳去合并）</span>`);
    }
    tagAddPreviewEl.innerHTML = chips.join('');
    tagAddPreviewEl.querySelectorAll('a[data-tag-id]').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const id = Number(a.dataset.tagId);
            const name = a.dataset.tagName;
            tagAddModal.hidden = true;
            openTagMerge({ id, name });
        });
    });
}

/** 提交新增：逐个 POST，重复跳过，结果回填到预览区。 */
async function submitTagAdd() {
    const names = splitTagInput(tagAddInput.value);
    if (names.length === 0) {
        tagAddStatusEl.textContent = '请输入要新增的标签';
        tagAddInput.focus();
        return;
    }
    const fresh = names.filter(n => !tagPoolByName.has(n));
    if (fresh.length === 0) {
        tagAddStatusEl.textContent = '输入的内容都已存在，无需新增';
        return;
    }
    tagAddStatusEl.textContent = '新增中…';
    const results = [];
    let failed = false;
    for (const name of fresh) {
        try {
            const resp = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (resp.ok) {
                results.push(`<span class="chip chip-ok">${esc(name)} ✓</span>`);
                const created = await resp.json().catch(() => ({}));
                if (created && created.id) tagPoolByName.set(name, created.id); // 已入库：后续预览当它存在
            } else {
                const err = await resp.json().catch(() => ({}));
                results.push(`<span class="chip chip-warn">${esc(name)} ✕ ${esc((err && err.message) || '失败')}</span>`);
                failed = true;
            }
        } catch (err) {
            results.push(`<span class="chip chip-warn">${esc(name)} ✕ 请求失败</span>`);
            failed = true;
        }
    }
    tagAddPreviewEl.innerHTML = results.join('');
    if (!failed) {
        tagAddStatusEl.textContent = `已新增 ${fresh.length} 个标签`;
        tagAddInput.value = '';
        loadTags();
        setTimeout(() => tagAddInput.focus(), 0);
    } else {
        tagAddStatusEl.textContent = '部分标签新增失败，请重试';
    }
}

/** 批量删除按钮状态：按勾选数显示。 */
function updateTagBatchBtn() {
    if (!tagBatchDelBtn) return;
    tagBatchDelBtn.hidden = tagSelected.size === 0;
    tagBatchDelBtn.textContent = `批量删除(${tagSelected.size})`;
}

/** 批量删除：选中词条删除，含被引用词条整体拒绝。 */
function confirmTagBatchDelete() {
    if (tagSelected.size === 0) return;
    showConfirm({
        title: `批量删除 ${tagSelected.size} 个标签`,
        msg: `删除选中的 ${tagSelected.size} 个标签？仅无任何引用的孤儿词条可删，含被引用词条会整体拒绝。`,
        okText: '删除',
        onOk: async () => {
            const ids = [...tagSelected].join(',');
            const resp = await fetch(`/api/tags?ids=${ids}`, { method: 'DELETE' });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                tagStatusEl.textContent = (err && err.message) || '删除失败';
            } else {
                tagStatusEl.textContent = '';
            }
            tagSelected.clear();
            invalidateTagPool();
            loadTags();
        }
    });
}

/** 按媒体视图：填充媒体下拉（与媒体页共用 /api/media）。 */
async function fillTagMediaSelect() {
    tagMediaSelectEl.innerHTML = '<option value="">— 选择媒体 —</option>';
    try {
        const resp = await fetch('/api/media?limit=500');
        if (!resp.ok) return;
        const list = await resp.json();
        for (const m of list) {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.title || `#${m.id}`;
            tagMediaSelectEl.appendChild(opt);
        }
    } catch (err) { /* 下拉填充失败不阻塞视图 */ }
}

// ---------- 打标输入补全（媒体上下文） ----------

const tagSuggestList = document.getElementById('tag-suggest-list');
const mediaIdByEpisode = new Map();   // episodeId → mediaId（惰性解析缓存，避免每次补全都查集）

async function resolveEpisodeMediaId(episodeId) {
    if (!episodeId) return null;
    if (mediaIdByEpisode.has(episodeId)) return mediaIdByEpisode.get(episodeId);
    try {
        const resp = await fetch(`/api/episodes/${episodeId}`);
        if (!resp.ok) return null;
        const ep = await resp.json();
        const m = ep.mediaId || null;
        mediaIdByEpisode.set(episodeId, m);
        return m;
    } catch (err) {
        return null;
    }
}

/** 给打标输入挂共享补全：mediaId 由 resolveMediaId() 惰性取（可为 async）。 */
function attachTagSuggest(inputEl, resolveMediaId) {
    inputEl.setAttribute('list', 'tag-suggest-list');
    let timer = null;
    inputEl.addEventListener('input', () => {
        clearTimeout(timer);
        const v = inputEl.value.trim();
        if (!v) return;
        timer = setTimeout(async () => {
            let mediaId = null;
            try { mediaId = await resolveMediaId(); } catch (err) { mediaId = null; }
            const params = new URLSearchParams({ prefix: v, limit: '8' });
            if (mediaId) params.set('mediaId', mediaId);
            try {
                const resp = await fetch(`/api/tags?${params.toString()}`);
                if (!resp.ok) return;
                const tags = await resp.json();
                tagSuggestList.innerHTML = '';
                for (const t of tags) {
                    const opt = document.createElement('option');
                    opt.value = t.tag;
                    tagSuggestList.appendChild(opt);
                }
            } catch (err) { /* 补全失败静默 */ }
        }, 180);
    });
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
// 时间范围筛选：切「自定义」显示日期输入；变更后重跑搜索
searchTimeSelect.addEventListener('change', () => {
    searchTimeCustom.hidden = searchTimeSelect.value !== 'custom';
    const q = input.value.trim();
    if (q) runSearch(q);
});
searchTimeFrom.addEventListener('change', () => { const q = input.value.trim(); if (q) runSearch(q); });
searchTimeTo.addEventListener('change', () => { const q = input.value.trim(); if (q) runSearch(q); });
// 按媒体聚合开关：仅重渲染不重新请求（结果数据没变）
searchGroupToggle.addEventListener('change', () => {
    if (currentQuery && resultsEl.children.length) runSearch(currentQuery);
});
loadMoreBtn.addEventListener('click', () => loadVideos(false));
backBtn.addEventListener('click', () => {
    if (fromMediaDetail && currentMedia) {
        fromMediaDetail = false;
        showView('media-detail');
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

// ---------- 媒体事件 ----------

document.querySelectorAll('.media-tabs .atab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.media-tabs .atab').forEach(b => b.classList.toggle('active', b === btn));
        mediaMode = btn.dataset.mediaTab;
        loadMedia();
    });
});
document.getElementById('media-create').addEventListener('click', openCreateMedia);
document.getElementById('media-batch-del').addEventListener('click', toggleMediaBatchMode);
document.getElementById('media-batch-confirm').addEventListener('click', () => openBatchDelModal([...mediaSelected]));
document.getElementById('batch-del-cancel').addEventListener('click', () => { batchDelModal.hidden = true; batchDelIds = []; });
document.getElementById('batch-del-confirm').addEventListener('click', confirmBatchDelete);
document.getElementById('confirm-modal-cancel').addEventListener('click', closeConfirmModal);
document.getElementById('confirm-modal-ok').addEventListener('click', () => {
    const fn = confirmModalAction;
    closeConfirmModal();
    if (fn) fn();
});
document.getElementById('collection-create').addEventListener('click', createCollectionFromToolbar);
document.getElementById('collection-modal-cancel').addEventListener('click', () => { collectionModal.hidden = true; });
document.getElementById('collection-modal-save').addEventListener('click', saveCollectionFromModal);
collectionModal.addEventListener('click', (e) => { if (e.target === collectionModal) collectionModal.hidden = true; });
collectionNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCollectionFromModal(); });
mediaFormatManageBtn.addEventListener('click', openMediaFormatModal);
document.getElementById('back-to-media').addEventListener('click', goBack);
document.getElementById('detail-edit').addEventListener('click', openEditMedia);
document.getElementById('detail-rename').addEventListener('click', openRenameModal);
document.getElementById('detail-cover').addEventListener('click', openCoverModal);
document.getElementById('detail-confirm').addEventListener('click', async () => {
    if (!currentMedia) return;
    await fetch(`/api/media/${currentMedia.id}/confirm`, { method: 'POST' });
    refreshMediaDetail();
});
document.getElementById('detail-delete').addEventListener('click', deleteMedia);
filterStatusEl.addEventListener('change', () => { mediaFilter.status = filterStatusEl.value; loadMedia(); });
filterSubcategoryEl.addEventListener('change', () => { mediaFilter.subcategoryId = filterSubcategoryEl.value; loadMedia(); });
filterCollectionEl.addEventListener('change', () => { mediaFilter.collectionId = filterCollectionEl.value; loadMedia(); });
filterUnconfirmedEl.addEventListener('change', () => { mediaFilter.unconfirmed = filterUnconfirmedEl.checked; loadMedia(); });
fillFilterCollections();
mediaModal.addEventListener('click', (e) => { if (e.target === mediaModal) mediaModal.hidden = true; });
document.getElementById('media-modal-cancel').addEventListener('click', () => { mediaModal.hidden = true; });
document.getElementById('media-modal-save').addEventListener('click', saveMedia);
mediaFormatSelect.addEventListener('change', () => fillMediaSubcategorySelect(null));
mediaInlineAddBtn.addEventListener('click', () => {
    mediaInlineAddBtn.hidden = true;
    mediaNewSubInput.hidden = false;
    mediaAddSubBtn.hidden = false;
    mediaNewSubInput.focus();
});
mediaAddSubBtn.addEventListener('click', addMediaSubcategoryInline);
mediaNewSubInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMediaSubcategoryInline(); } });
// 管理格式弹层
mediaFormatModal.addEventListener('click', (e) => { if (e.target === mediaFormatModal) mediaFormatModal.hidden = true; });
document.getElementById('media-format-close').addEventListener('click', () => { mediaFormatModal.hidden = true; });
fmAddSubBtn.addEventListener('click', fmAddSubcategory);
fmNewSubInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fmAddSubcategory(); } });
if (fmAddRootBtn) fmAddRootBtn.addEventListener('click', fmAddRoot);
fmAddFormatBtn.addEventListener('click', fmAddFormat);
// 搜索格式/子分类筛选
if (SEARCH_FORMAT_SELECT) {
    SEARCH_FORMAT_SELECT.addEventListener('change', () => {
        fillSearchSubcategory();
        if (input.value.trim()) runSearch(input.value.trim());
    });
}
if (SEARCH_SUBCATEGORY_SELECT) {
    SEARCH_SUBCATEGORY_SELECT.addEventListener('change', () => {
        if (input.value.trim()) runSearch(input.value.trim());
    });
}
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

// ---------- 标签管理事件 ----------
document.querySelectorAll('[data-tag-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tag-tab]').forEach(b => b.classList.toggle('active', b === btn));
        tagMode = btn.dataset.tagTab;
        tagMediaSelectEl.hidden = tagMode !== 'media';
        tagPage = 1;
        if (tagMode === 'media' && tagMediaSelectEl.children.length <= 1) fillTagMediaSelect();
        loadTags();
    });
});
tagPagePrev.addEventListener('click', () => { if (tagPage > 1) { tagPage--; loadTags(); } });
tagPageNext.addEventListener('click', () => { tagPage++; loadTags(); });
tagPageSizeSel.addEventListener('change', () => { tagPageSize = Number(tagPageSizeSel.value); tagPage = 1; loadTags(); });
tagCheckAll.addEventListener('change', () => {
    if (tagCheckAll.checked) {
        for (const t of tagListCache) tagSelected.add(t.id);
    } else {
        for (const t of tagListCache) tagSelected.delete(t.id);
    }
    updateTagBatchBtn();
});
tagFilterEl.addEventListener('input', () => {
    clearTimeout(tagFilterTimer);
    tagPage = 1;
    tagFilterTimer = setTimeout(loadTags, 300);
});
tagMediaSelectEl.addEventListener('change', () => {
    tagMediaId = tagMediaSelectEl.value ? Number(tagMediaSelectEl.value) : null;
    loadTags();
});
tagAddBtn.addEventListener('click', openTagAdd);
tagAddModal.addEventListener('click', (e) => { if (e.target === tagAddModal) tagAddModal.hidden = true; });
document.getElementById('tag-add-cancel').addEventListener('click', () => { tagAddModal.hidden = true; });
document.getElementById('tag-add-save').addEventListener('click', submitTagAdd);
tagAddInput.addEventListener('input', () => {
    clearTimeout(tagAddTimer);
    tagAddTimer = setTimeout(refreshTagAddPreview, 250);
});
tagAddInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitTagAdd(); } });
tagBatchDelBtn.addEventListener('click', confirmTagBatchDelete);
tagRenameModal.addEventListener('click', (e) => { if (e.target === tagRenameModal) { tagRenameModal.hidden = true; tagRenameId = null; } });
document.getElementById('tag-rename-cancel').addEventListener('click', () => { tagRenameModal.hidden = true; tagRenameId = null; });
document.getElementById('tag-rename-save').addEventListener('click', saveTagRename);
tagRenameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveTagRename(); } });
tagMergeModal.addEventListener('click', (e) => { if (e.target === tagMergeModal) { tagMergeModal.hidden = true; tagMergeId = null; } });
document.getElementById('tag-merge-cancel').addEventListener('click', () => { tagMergeModal.hidden = true; tagMergeId = null; });
document.getElementById('tag-merge-save').addEventListener('click', saveTagMerge);

// ---------- 打标输入补全接线 ----------
// 片段编辑：mediaId 经 episode 惰性解析（clip 不含 mediaId，缓存复用）
attachTagSuggest(editTag, () => editingClip ? resolveEpisodeMediaId(editingClip.episodeId) : Promise.resolve(null));
// 集打标：当前集自带 mediaId
attachTagSuggest(episodeTagInput, () => (currentEpisode && currentEpisode.mediaId) || null);

// 启动加载格式字典（格式 tab / 各筛选下拉）
loadFormats();
