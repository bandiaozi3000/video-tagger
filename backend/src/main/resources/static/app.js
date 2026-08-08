const views = {
  search: document.getElementById('view-search'),
  media: document.getElementById('view-media'),
  'media-detail': document.getElementById('view-media-detail'),
  'episode-detail': document.getElementById('view-episode-detail'),
  'clip-detail': document.getElementById('view-clip-detail'),
  videos: document.getElementById('view-videos'),
  timeline: document.getElementById('view-timeline'),
  stats: document.getElementById('view-stats'),
  tags: document.getElementById('view-tags'),
  collections: document.getElementById('view-collections'),
  recommend: document.getElementById('view-recommend')
};

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const semanticHint = document.getElementById('semantic-hint');

const videoStatusEl = document.getElementById('video-status');
const videoListEl = document.getElementById('video-list');
const videoPageSizeEl = document.getElementById('video-page-size');
const videoPagePrevEl = document.getElementById('video-page-prev');
const videoPageNextEl = document.getElementById('video-page-next');
const videoPageInfoEl = document.getElementById('video-page-info');
const videoTotalEl = document.getElementById('video-total');

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
const filterYearEl = document.getElementById('filter-year');
const filterSourceEl = document.getElementById('filter-source');
const filterSortEl = document.getElementById('filter-sort');
const filterOrderBtn = document.getElementById('filter-order');
const trashView = document.getElementById('trash-view');
const trashBackBtn = document.getElementById('trash-back');
const trashSearchInput = document.getElementById('trash-search');
const trashClearBtn = document.getElementById('trash-clear');
const trashStatusEl = document.getElementById('trash-status');
const trashListEl = document.getElementById('trash-list');
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
const mediaYearInput = document.getElementById('media-year');
const mediaNoteInput = document.getElementById('media-note');
const mediaSyncModal = document.getElementById('media-sync-modal');
const syncYearGridEl = document.getElementById('sync-year-grid');
const mediaSyncStatusEl = document.getElementById('media-sync-status');
const mediaSyncStartBtn = document.getElementById('media-sync-start');
const mediaSyncProgressEl = document.getElementById('media-sync-progress');
const syncSourceChips = document.querySelectorAll('#media-sync-modal .sync-source-chip');
const syncSourceHintEl = document.getElementById('sync-source-hint');
const syncCategoryGridEl = document.getElementById('sync-category-grid');
let syncSource = 'ANILIST'; // 同步数据源（弹层内单选，AniList/omofuna）
let omofunaPollTimer = null; // omofuna 同步进度轮询定时器（关弹窗清除，刷新可恢复）
// 分类 chips 选项：AniList 用 format，omofuna 用类目（多选，默认全选）
const SYNC_FORMATS = [
    { code: 'TV', name: 'TV' },
    { code: 'TV_SHORT', name: 'TV 短片' },
    { code: 'MOVIE', name: '剧场版' },
    { code: 'OVA', name: 'OVA' },
    { code: 'ONA', name: 'ONA' },
    { code: 'SPECIAL', name: '特别篇' },
    { code: 'MUSIC', name: '音乐' },
];
const SYNC_TYPES = [
    { id: 1, name: '日漫' },
    { id: 5, name: '动画' },
    { id: 24, name: '剧场' },
];
const mediaRetryCoversBtn = document.getElementById('media-retry-covers');
const mediaSelectAllBtn = document.getElementById('media-batch-select-all');
const mediaPageSizeEl = document.getElementById('media-page-size');
const mediaPagePrevEl = document.getElementById('media-page-prev');
const mediaPageNextEl = document.getElementById('media-page-next');
const mediaPageInfoEl = document.getElementById('media-page-info');
const mediaTotalEl = document.getElementById('media-total');
const MEDIA_PAGE_SIZE = 30;      // 媒体列表默认每页条数（下拉可选 30/50/100/200）
let mediaPage = 1;                // 当前页码（1-based）
let mediaPageSize = MEDIA_PAGE_SIZE;   // 每页条数（默认 30，可切换）
let mediaTotal = 0;               // 当前筛选下总数（分页页码用）
let currentMediaList = [];        // 当前页媒体列表（全选本页用）
const coverModal = document.getElementById('cover-modal');
const coverUrlInput = document.getElementById('cover-url');
const coverFileInput = document.getElementById('cover-file');
const renameModal = document.getElementById('rename-modal');
const renameTitleInput = document.getElementById('rename-title');
const mergeIntoSelect = document.getElementById('merge-into');
const collectionModal = document.getElementById('collection-modal');
const collectionNameInput = document.getElementById('collection-name');
const collectionModalSaveBtn = document.getElementById('collection-modal-save');
const collListEl = document.getElementById('coll-list');
const collContentHeadEl = document.getElementById('coll-content-head');
const collMediaGridEl = document.getElementById('coll-media-grid');
const collStatusEl = document.getElementById('coll-status');
const collPageSizeEl = document.getElementById('coll-page-size');
const collPagePrevEl = document.getElementById('coll-page-prev');
const collPageNextEl = document.getElementById('coll-page-next');
const collPageInfoEl = document.getElementById('coll-page-info');
const collTotalEl = document.getElementById('coll-total');
const recommendSourceEl = document.getElementById('recommend-source');
const recommendTagInputEl = document.getElementById('recommend-tag-input');
const recommendTagClearEl = document.getElementById('recommend-tag-clear');
const recommendGridEl = document.getElementById('recommend-grid');
const recommendPageSizeEl = document.getElementById('recommend-page-size');
const recommendPagePrevEl = document.getElementById('recommend-page-prev');
const recommendPageNextEl = document.getElementById('recommend-page-next');
const recommendPageInfoEl = document.getElementById('recommend-page-info');
const recommendTotalEl = document.getElementById('recommend-total');
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
const clipDetailTagsEl = document.getElementById('clip-detail-tags');
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
const tagSyncAllBtn = document.getElementById('tag-sync-all');
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
const SEARCH_SOURCE_SELECT = document.getElementById('search-source');
const searchMoreBtn = document.getElementById('search-more-btn');
const searchFiltersMore = document.getElementById('search-filters-more');
const searchPaginationEl = document.getElementById('search-pagination');
const searchPageSizeEl = document.getElementById('search-page-size');
const searchPagePrevEl = document.getElementById('search-page-prev');
const searchPageNextEl = document.getElementById('search-page-next');
const searchPageInfoEl = document.getElementById('search-page-info');
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
let videoPage = 1;        // 视频列表分页
let videoPageSize = 20;
let videoTotal = 0;
let searchPage = 1;       // 搜索结果分页
let searchPageSize = 20;
let searchTotal = 0;
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
let mediaFilter = { status: '', format: '', subcategoryId: '', collectionId: '', unconfirmed: false, year: '', source: '', sort: '', order: 'desc' };
let collSelectedId = null;           // 收藏夹 tab：当前选中的收藏夹 id
let collectionsCache = [];           // 收藏夹列表缓存（管理视图用）
let collPage = 1;                    // 收藏夹内媒体分页
let collPageSize = 30;
let collTotal = 0;
let recommendPage = 1;               // 推荐向导来源网格分页
let recommendPageSize = 30;
let recommendTotal = 0;
let recommendSourceType = '';        // 推荐来源过滤：'' | 'collection'
let recommendSourceId = null;
let recommendTagId = null;           // 标签过滤（已解析的 tag id）
let recommendTagName = '';           // 已应用的标签名（防 Enter+blur 双触发）
let currentRecommendList = [];       // 推荐向导当前页媒体（全选本页用）
let collectionModalMode = 'create';  // collection-modal：create / rename
let collectionRenameId = null;       // rename 模式的目标收藏夹 id
let favOverlay = null;               // 卡片快捷收藏浮层
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
    let u;
    try {
        u = new URL(url);
    } catch (e) {
        return url; // 非法 URL 原样返回
    }
    // 按域名匹配时间参数格式：YouTube 秒后带 s（t=1018s）；B站系视频/番剧/合集统一纯秒（t=1018）。
    // searchParams.set 会覆盖 URL 里已带的时间参数，避免出现 ?t=123&...&t=807 双 t 冲突。
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/watch')) {
        u.searchParams.set('t', `${s}s`);
    } else if (u.hostname.includes('bilibili.com')) {
        u.searchParams.set('t', String(s));
    } else {
        return url; // 未知站点不拼，参数格式不定，拼了无效
    }
    return u.toString();
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
    // media 保留当前分页/筛选：详情返回或导航切回都回到上次浏览位置（不重置回第一页）
    if (name === 'media') loadMedia(false);
    if (name === 'tags') loadTags();
    if (name === 'collections') loadCollections();
    if (name === 'recommend') { fillRecommendSources(); loadRecommend(); }
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
    renderClipTags(clip, media ? media.id : null);
}

/** 片段标签池：片段自身标签（clip.tag 拆词）+ 在整部作品里的引用热度，纯展示。 */
async function renderClipTags(clip, mediaId) {
    clipDetailTagsEl.innerHTML = '';
    const names = (clip.tag || '').split(/[，,]/).map(s => s.trim()).filter(Boolean);
    if (names.length === 0) {
        clipDetailTagsEl.innerHTML = '<span class="status">无标签</span>';
        return;
    }
    // 作品内热度（词条名 → 引用次数）；接口失败则无热度、纯卡片
    const heat = new Map();
    if (mediaId) {
        try {
            const resp = await fetch(`/api/tags/manage?mediaId=${mediaId}&page=1&size=1000`);
            if (resp.ok) {
                const pr = await resp.json();
                for (const s of (pr.items || [])) heat.set(s.name, Number(s.refCount) || 0);
            }
        } catch (e) { /* 兜底无热度 */ }
    }
    for (const n of names) {
        const count = heat.get(n) || 0;
        const chip = document.createElement('span');
        chip.className = `tag-pool-chip stat-${tagStatTier(count)}`;
        chip.title = count > 0 ? `${n} · 在作品中引用 ${count} 次` : n;
        const name = document.createElement('span');
        name.className = 'tag-pool-name';
        name.textContent = n;
        chip.appendChild(name);
        if (count > 0) {
            const cnt = document.createElement('span');
            cnt.className = 'tag-pool-count';
            cnt.textContent = `×${count}`;
            chip.appendChild(cnt);
        }
        clipDetailTagsEl.appendChild(chip);
    }
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

/** 集标签池：集内聚合热度视图（集本身 + 其下片段引用），集标签可删，保留添加；接口失败兜底回集标签。 */
async function renderEpisodeDetailTags(ep) {
    episodeDetailTagsEl.innerHTML = '';
    let stats = [];
    try {
        const resp = await fetch(`/api/tags/episode-stats?episodeId=${ep.id}`);
        if (resp.ok) {
            const arr = await resp.json();
            stats = (arr || []).map(s => ({
                id: s.id, name: s.name, count: Number(s.refCount) || 0
            }));
        }
    } catch (e) { /* 兜底：仅集标签 */ }
    const removableIds = new Set((ep.tags || []).map(t => t.id));
    const pool = stats.length > 0 ? stats : (ep.tags || []).map(t => ({ id: t.id, name: t.name, count: 1 }));
    pool.sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const p of pool) {
        const chip = document.createElement('span');
        chip.className = `tag-pool-chip stat-${tagStatTier(p.count)}`;
        chip.title = `${p.name} · 引用 ${p.count} 次`;
        const name = document.createElement('span');
        name.className = 'tag-pool-name';
        name.textContent = p.name;
        chip.appendChild(name);
        const cnt = document.createElement('span');
        cnt.className = 'tag-pool-count';
        cnt.textContent = `×${p.count}`;
        chip.appendChild(cnt);
        if (removableIds.has(p.id)) {
            const rm = document.createElement('span');
            rm.className = 'chip-remove';
            rm.textContent = '×';
            rm.title = '从集标签移除（片段引用保留）';
            rm.addEventListener('click', async (e) => {
                e.stopPropagation();
                await fetch(`/api/episodes/${ep.id}/tags/${p.id}`, { method: 'DELETE' });
                loadEpisodeDetail(ep.id);
            });
            chip.appendChild(rm);
        }
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

async function runSearch(q, resetPage = true) {
    if (resetPage) searchPage = 1;
    currentQuery = q;
    statusEl.textContent = '搜索中…';
    resultsEl.innerHTML = '';
    try {
        const sp = new URLSearchParams({ q, dim: currentDim });
        if (SEARCH_FORMAT_SELECT && SEARCH_FORMAT_SELECT.value) sp.set('format', SEARCH_FORMAT_SELECT.value);
        if (SEARCH_SUBCATEGORY_SELECT && SEARCH_SUBCATEGORY_SELECT.value) sp.set('subcategoryId', SEARCH_SUBCATEGORY_SELECT.value);
        if (SEARCH_SOURCE_SELECT && SEARCH_SOURCE_SELECT.value) sp.set('source', SEARCH_SOURCE_SELECT.value);
        const { from, to } = searchTimeRange();
        if (from != null) sp.set('from', String(from));
        if (to != null) sp.set('to', String(to));
        // 按媒体聚合 → 一次全量（分组后组数可控，跨页分组会拆散媒体）；否则传统分页
        const grouped = searchGroupToggle && searchGroupToggle.checked;
        if (grouped) {
            sp.set('limit', '500');
        } else {
            sp.set('limit', String(searchPageSize));
            sp.set('offset', String((searchPage - 1) * searchPageSize));
        }
        const resp = await fetch(`/api/search?${sp.toString()}`);
        const data = await resp.json();
        semanticHint.hidden = data.semanticEnabled;
        searchTotal = data.total != null ? data.total : data.results.length;
        const totalPages = Math.max(1, Math.ceil(searchTotal / searchPageSize));
        if (!grouped && searchPage > totalPages) { searchPage = totalPages; return runSearch(q, false); }
        renderResults(data.results);
        renderSearchPagination(totalPages, grouped);
        statusEl.textContent = searchTotal ? `共 ${searchTotal} 条结果` : '没有找到相关内容';
    } catch (err) {
        statusEl.textContent = '搜索失败：后端未响应，请确认服务已启动';
    }
}

/** 搜索分页条：聚合模式整条隐藏（一次全量无页码）；非聚合显示总数 + 页信息 + 上/下页。 */
function renderSearchPagination(totalPages, grouped) {
    searchPaginationEl.hidden = grouped;
    if (grouped) return;
    searchPageInfoEl.textContent = `共 ${searchTotal} 条 · 第 ${searchPage}/${totalPages} 页`;
    searchPagePrevEl.disabled = searchPage <= 1;
    searchPageNextEl.disabled = searchPage >= totalPages;
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

async function loadVideos(resetPage = true) {
    if (resetPage) videoPage = 1;
    videoListEl.innerHTML = '';
    videoStatusEl.textContent = '加载中…';
    try {
        const [listResp, countResp] = await Promise.all([
            fetch(`/api/videos?limit=${videoPageSize}&offset=${(videoPage - 1) * videoPageSize}`),
            fetch('/api/videos/count')
        ]);
        if (!listResp.ok) throw new Error(`HTTP ${listResp.status}`);
        const list = await listResp.json();
        videoTotal = countResp.ok ? Number(await countResp.json()) : list.length;
        const totalPages = Math.max(1, Math.ceil(videoTotal / videoPageSize));
        if (videoPage > totalPages) { videoPage = totalPages; return loadVideos(false); }
        if (videoPage < 1) videoPage = 1;
        videoStatusEl.textContent = '';
        if (list.length === 0) {
            videoStatusEl.textContent = '还没有标记过任何视频，去看片按 Alt+S 打标吧';
            renderVideoPagination(totalPages);
            return;
        }
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
        renderVideoPagination(totalPages);
    } catch (err) {
        videoStatusEl.textContent = '加载失败：后端未响应';
    }
}

/** 视频列表分页条：总数 + 页信息 + 上/下页可用态。 */
function renderVideoPagination(totalPages) {
    videoPageInfoEl.textContent = `共 ${videoTotal} 部 · 第 ${videoPage}/${totalPages} 页`;
    videoPagePrevEl.disabled = videoPage <= 1;
    videoPageNextEl.disabled = videoPage >= totalPages;
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

/** 媒体列表当前页 + 总数（分页版）：筛选/页大小/翻页/tab 切换共用。
 *  resetPage=true 回到第 1 页（筛选/切换/初始加载），false 保持当前页（翻页/越界回退）。 */
async function loadMedia(resetPage = true) {
    if (resetPage) mediaPage = 1;
    mediaStatusEl.textContent = '加载中…';
    try {
        const { url, countUrl } = buildMediaUrls();
        const [listResp, countResp] = await Promise.all([fetch(url), fetch(countUrl)]);
        if (!listResp.ok) throw new Error(`HTTP ${listResp.status}`);
        let list = await listResp.json();
        mediaTotal = countResp.ok ? Number(await countResp.json()) : list.length;
        const totalPages = Math.max(1, Math.ceil(mediaTotal / mediaPageSize));
        if (mediaPage > totalPages) { mediaPage = totalPages; return loadMedia(false); }
        if (mediaPage < 1) mediaPage = 1;
        mediaGridEl.innerHTML = '';
        currentMediaList = list;
        renderMediaGrid(list);
        renderMediaPagination(totalPages);
        if (list.length === 0) {
            mediaStatusEl.textContent = mediaMode === 'recent' && mediaTotal === 0
                ? '还没有打过标记的媒体，去看片按 Alt+S 打一个' : '没有符合条件的媒体';
        } else {
            mediaStatusEl.textContent = '';
        }
    } catch (err) {
        mediaStatusEl.textContent = '加载失败：后端未响应';
    }
}

/** 按当前筛选/分页构造列表与 count 请求 URL（全部媒体/最近观看/收藏夹三分支）。
 *  format/subcategoryId/year 全部后端过滤，保证分页总数与列表同条件。 */
function buildMediaUrls() {
    const base = new URLSearchParams({ limit: String(mediaPageSize), offset: String((mediaPage - 1) * mediaPageSize) });
    const addCommon = p => {
        if (mediaFilter.status) p.set('status', mediaFilter.status);
        if (mediaFilter.format) p.set('format', mediaFilter.format);
        if (mediaFilter.subcategoryId) p.set('subcategoryId', mediaFilter.subcategoryId);
        if (mediaFilter.unconfirmed) p.set('confirmed', '0');
        if (mediaFilter.year) p.set('year', mediaFilter.year);
        if (mediaFilter.source) p.set('source', mediaFilter.source);
        if (mediaFilter.sort) p.set('sort', mediaFilter.sort);
        if (mediaFilter.order !== 'desc') p.set('order', mediaFilter.order);
    };
    let url, countParams;
    if (mediaFilter.collectionId && mediaMode !== 'recent') {
        addCommon(base);
        url = `/api/collections/${mediaFilter.collectionId}/media?${base.toString()}`;
        countParams = new URLSearchParams({ collectionId: mediaFilter.collectionId });
        addCommon(countParams);
    } else if (mediaMode === 'recent') {
        if (mediaFilter.collectionId) base.set('collectionId', mediaFilter.collectionId);
        addCommon(base);
        url = `/api/media/recent?${base.toString()}`;
        countParams = new URLSearchParams({ latest: 'true' });
        if (mediaFilter.collectionId) countParams.set('collectionId', mediaFilter.collectionId);
        addCommon(countParams);
    } else {
        addCommon(base);
        url = `/api/media?${base.toString()}`;
        countParams = new URLSearchParams();
        addCommon(countParams);
    }
    return { url, countUrl: `/api/media/count?${countParams.toString()}` };
}

/** 渲染分页条：总数 + 页信息 + 上/下页可用态。 */
function renderMediaPagination(totalPages) {
    mediaPageInfoEl.textContent = `共 ${mediaTotal} 部 · 第 ${mediaPage}/${totalPages} 页`;
    mediaPagePrevEl.disabled = mediaPage <= 1;
    mediaPageNextEl.disabled = mediaPage >= totalPages;
}

/** 年份筛选下拉：库中已有的首播年份（降序）。 */
async function fillYearFilter() {
    try {
        const resp = await fetch('/api/media/years');
        if (!resp.ok) return;
        const years = await resp.json();
        const cur = filterYearEl.value;
        filterYearEl.innerHTML = '<option value="">全部年份</option>';
        for (const y of years) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = `${y} 年`;
            filterYearEl.appendChild(opt);
        }
        filterYearEl.value = cur;
    } catch (e) { /* 忽略 */ }
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

/** 工具栏/收藏夹 tab：新建收藏夹（modal create 模式）。 */
function createCollectionFromToolbar() {
    collectionModalMode = 'create';
    collectionRenameId = null;
    document.getElementById('collection-modal-title').textContent = '新建收藏夹';
    collectionModalSaveBtn.textContent = '创建';
    collectionNameInput.value = '';
    collectionModal.hidden = false;
    collectionNameInput.focus();
}

/** 收藏夹管理：重命名入口（modal rename 模式）。 */
function openRenameCollection(id, name) {
    collectionModalMode = 'rename';
    collectionRenameId = id;
    document.getElementById('collection-modal-title').textContent = '重命名收藏夹';
    collectionModalSaveBtn.textContent = '保存';
    collectionNameInput.value = name;
    collectionModal.hidden = false;
    collectionNameInput.focus();
}

async function saveCollectionFromModal() {
    const name = collectionNameInput.value.trim();
    if (!name) { collectionNameInput.focus(); return; }
    try {
        if (collectionModalMode === 'rename') {
            const resp = await fetch(`/api/collections/${collectionRenameId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!resp.ok) { alert('改名失败'); return; }
            collectionModal.hidden = true;
            await loadCollections();
            await fillFilterCollections();
        } else {
            const resp = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!resp.ok) { alert('创建失败'); return; }
            const c = await resp.json();
            collectionModal.hidden = true;
            if (currentViewName === 'collections') {
                collSelectedId = c.id;   // 在收藏夹 tab 创建 → 选中新收藏夹
                await loadCollections();
                await fillFilterCollections();
            } else {
                await fillFilterCollections();
                filterCollectionEl.value = String(c.id);
                mediaFilter.collectionId = String(c.id);
                loadMedia();
            }
        }
    } catch (err) { alert(collectionModalMode === 'rename' ? '改名失败：后端未响应' : '创建失败：后端未响应'); }
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

// ---------- 收藏夹 tab：管理视图（左列表 + 右内容） ----------

/** 进入收藏夹视图：拉列表 → 恢复/回退选中 → 加载选中内容。 */
async function loadCollections() {
    let list = [];
    try {
        const resp = await fetch('/api/collections');
        if (!resp.ok) throw new Error();
        list = await resp.json();
    } catch (e) {
        collStatusEl.textContent = '加载失败：后端未响应';
        return;
    }
    collectionsCache = list;
    collStatusEl.textContent = '';
    if (collSelectedId != null && !list.some(c => c.id === collSelectedId)) {
        collSelectedId = null;   // 原选中已被删除 → 回退
    }
    if (collSelectedId == null && list.length > 0) collSelectedId = list[0].id;
    renderCollList(list);
    if (collSelectedId != null) {
        loadCollMedia(collSelectedId);
    } else {
        collContentHeadEl.textContent = '';
        collMediaGridEl.innerHTML = '';
        collStatusEl.textContent = list.length === 0 ? '还没有收藏夹，点「＋ 新建收藏夹」建一个' : '';
    }
}

function renderCollList(list) {
    collListEl.innerHTML = '';
    if (list.length === 0) {
        collListEl.innerHTML = '<div class="coll-empty">还没有收藏夹</div>';
        return;
    }
    for (const c of list) {
        const item = document.createElement('div');
        item.className = 'coll-item' + (c.id === collSelectedId ? ' selected' : '');
        item.innerHTML = `
            <div class="coll-item-main">
                <div class="coll-item-name">${esc(c.name)}</div>
                <div class="coll-item-count">${c.mediaCount || 0} 个媒体</div>
            </div>
            <div class="coll-item-actions">
                <button type="button" class="coll-item-btn" title="重命名">✎</button>
                <button type="button" class="coll-item-btn danger" title="删除">🗑</button>
            </div>`;
        item.querySelector('.coll-item-main').addEventListener('click', () => {
            if (collSelectedId === c.id) return;
            collSelectedId = c.id;
            renderCollList(list);
            loadCollMedia(c.id);
        });
        item.querySelector('.coll-item-btn[title="重命名"]').addEventListener('click', (e) => {
            e.stopPropagation();
            openRenameCollection(c.id, c.name);
        });
        item.querySelector('.coll-item-btn.danger').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCollection(c.id, c.name);
        });
        collListEl.appendChild(item);
    }
}

/** 加载选中收藏夹的媒体（复用 renderMediaGrid，渲染进收藏夹视图容器）。 */
async function loadCollMedia(id, resetPage = true) {
    if (resetPage) collPage = 1;
    collMediaGridEl.innerHTML = '';
    collContentHeadEl.textContent = '';
    try {
        const base = new URLSearchParams({ limit: String(collPageSize), offset: String((collPage - 1) * collPageSize) });
        const [listResp, countResp] = await Promise.all([
            fetch(`/api/collections/${id}/media?${base.toString()}`),
            fetch(`/api/media/count?collectionId=${id}`)
        ]);
        if (!listResp.ok) throw new Error();
        const list = await listResp.json();
        collTotal = countResp.ok ? Number(await countResp.json()) : list.length;
        const totalPages = Math.max(1, Math.ceil(collTotal / collPageSize));
        if (collPage > totalPages) { collPage = totalPages; return loadCollMedia(id, false); }
        if (collPage < 1) collPage = 1;
        const coll = collectionsCache.find(c => c.id === id);
        collContentHeadEl.textContent = coll ? `${coll.name} · ${collTotal} 个媒体` : '';
        collStatusEl.textContent = '';
        if (collTotal === 0) {
            collStatusEl.textContent = '这个收藏夹还没有媒体，可在媒体卡片点 ♡ 加入';
            renderCollPagination(totalPages);
            return;
        }
        renderMediaGrid(list, collMediaGridEl, 'collection');
        renderCollPagination(totalPages);
    } catch (e) {
        collStatusEl.textContent = '加载失败：后端未响应';
    }
}

/** 收藏夹内媒体分页条：总数 + 页信息 + 上/下页可用态。 */
function renderCollPagination(totalPages) {
    collPageInfoEl.textContent = `共 ${collTotal} 部 · 第 ${collPage}/${totalPages} 页`;
    collPagePrevEl.disabled = collPage <= 1;
    collPageNextEl.disabled = collPage >= totalPages;
}

/** 收藏夹 tab：把媒体移出当前收藏夹（解除关联，媒体本体保留）。可逆——♡ 可再加回。 */
async function removeFromCollection(mediaId) {
    if (collSelectedId == null) return;
    const coll = collectionsCache.find(c => c.id === collSelectedId);
    try {
        const resp = await fetch(`/api/collections/${collSelectedId}/media/${mediaId}`, { method: 'DELETE' });
        if (!resp.ok) { alert('移出失败'); return; }
        await loadCollMedia(collSelectedId);   // 刷新内容
        await loadCollections();               // 刷新左侧列表媒体数
        collStatusEl.textContent = coll ? `已移出收藏夹「${coll.name}」` : '';
    } catch (e) { alert('移出失败：后端未响应'); }
}

/** 删除收藏夹：确认弹窗 → DELETE → 刷新列表/筛选/选中回退。媒体本身保留，仅解除关联。 */
function deleteCollection(id, name) {
    showConfirm({
        title: '删除收藏夹',
        msg: `删除收藏夹「${name}」？其中媒体将保留，仅解除关联。`,
        okText: '删除',
        onOk: async () => {
            try {
                const resp = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
                if (!resp.ok) { alert('删除失败'); return; }
                if (collSelectedId === id) collSelectedId = null;
                await loadCollections();
                await fillFilterCollections();
                if (currentViewName !== 'collections') loadMedia();
            } catch (e) { alert('删除失败：后端未响应'); }
        }
    });
}

// ---------- 卡片快捷收藏（♡ 按钮 → 收藏夹勾选浮层） ----------

function openFavPicker(mediaId, btn) {
    closeFavPicker();
    const overlay = document.createElement('div');
    overlay.className = 'coll-pick';
    overlay.textContent = '加载中…';
    favOverlay = overlay;
    document.body.appendChild(overlay);
    btn.classList.add('fav-open');
    const rect = btn.getBoundingClientRect();
    const w = Math.min(210, window.innerWidth - 24);
    overlay.style.width = `${w}px`;
    overlay.style.left = `${Math.min(Math.max(rect.left, 12), window.innerWidth - w - 12)}px`;
    // 视口钳制：浮层 max-height 260，卡片靠底时往上翻，避免超出视口
    overlay.style.top = `${Math.min(rect.bottom + 6, Math.max(12, window.innerHeight - 268))}px`;
    loadFavOptions(mediaId, overlay);
}

function closeFavPicker() {
    if (favOverlay) { favOverlay.remove(); favOverlay = null; }
    document.querySelectorAll('.fav-open').forEach(b => b.classList.remove('fav-open'));
}

async function loadFavOptions(mediaId, overlay) {
    let colls = [], media = null;
    try {
        const [cr, mr] = await Promise.all([
            fetch('/api/collections'),
            fetch(`/api/media/${mediaId}`)
        ]);
        colls = cr.ok ? await cr.json() : [];
        media = mr.ok ? await mr.json() : null;
    } catch (e) { /* 走空态 */ }
    overlay.innerHTML = '';
    if (colls.length === 0) {
        overlay.innerHTML = '<div class="coll-pick-empty">还没有收藏夹，先去媒体页建一个</div>';
        return;
    }
    const current = new Set(media?.collectionIds || []);
    for (const c of colls) {
        const label = document.createElement('label');
        label.className = 'coll-pick-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = current.has(c.id);
        cb.addEventListener('change', async () => {
            cb.disabled = true;   // 防连点
            try {
                if (cb.checked) {
                    await fetch(`/api/collections/${c.id}/media`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mediaId })
                    });
                } else {
                    await fetch(`/api/collections/${c.id}/media/${mediaId}`, { method: 'DELETE' });
                }
            } catch (e) { /* 忽略：下次进入浮层会重新同步 */ }
            setTimeout(() => cb.disabled = false, 300);
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(` ${c.name}`));
        overlay.appendChild(label);
    }
}

function renderMediaGrid(list, container = mediaGridEl, mode = 'media') {
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
        // 来源角标：仅同步来源显示（手动为默认态不刷屏）
        const srcBadge = (a.source === 'ANILIST' || a.source === 'OMOFUNA')
            ? `<span class="media-source-badge">${esc(a.source === 'ANILIST' ? 'AniList' : 'omofuna')}</span>`
            : '';
        card.innerHTML = `
            <div class="media-cover">${fmtBadge}${srcBadge}${cover}
                <input type="checkbox" class="media-batch-cb" title="勾选后可批量删除或导出推荐" ${mediaSelected.has(a.id) ? 'checked' : ''}>
                ${mode === 'collection'
                    ? `<button type="button" class="media-remove-btn" title="移出收藏夹">⇤</button>`
                    : `<button type="button" class="media-del-btn" title="删除媒体">×</button>`}
                <button type="button" class="media-fav-btn" title="收藏到收藏夹">♡</button>
            </div>
            <div class="media-card-body">
                <div class="media-card-title"></div>
                <div class="media-card-meta"></div>
                <div class="media-card-badges"></div>
            </div>`;
        card.querySelector('.media-card-title').textContent = a.title;
        const meta = [];
        if (a.year) meta.push(String(a.year));
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
        // 单卡片操作：媒体视图 = 删除媒体；收藏夹视图 = 移出收藏夹（互斥，按 mode 渲染）
        if (mode === 'collection') {
            card.querySelector('.media-remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromCollection(a.id);
            });
        } else {
            card.querySelector('.media-del-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openBatchDelModal([a.id]);
            });
        }
        // 卡片快捷收藏（batch-mode 下按钮被 CSS 隐藏，事件无影响）
        card.querySelector('.media-fav-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openFavPicker(a.id, e.currentTarget);
        });
        card.addEventListener('click', () => {
            if (mediaBatchMode) { // 批量模式下点卡片=切换勾选
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change'));
                return;
            }
            openMediaDetail(a.id);
        });
        container.appendChild(card);
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
    showToast(`已将 ${ids.length} 个媒体移入回收站，可随时撤回`);
    loadMedia();
}

// ---------- 回收站视图 ----------

/** 打开回收站视图（隐藏媒体主区，显示回收站列表）。 */
function openTrashView() {
    document.querySelector('.media-toolbar').hidden = true;
    document.getElementById('format-tabs').hidden = true;
    document.getElementById('media-filters').hidden = true;
    document.getElementById('media-status').hidden = true;
    mediaGridEl.hidden = true;
    document.getElementById('media-pagination').hidden = true;
    trashView.hidden = false;
    trashSearchInput.value = '';
    loadTrash();
}

/** 返回媒体列表（恢复主区显示）。 */
function backToMedia() {
    trashView.hidden = true;
    document.querySelector('.media-toolbar').hidden = false;
    document.getElementById('format-tabs').hidden = false;
    document.getElementById('media-filters').hidden = false;
    document.getElementById('media-status').hidden = false;
    mediaGridEl.hidden = false;
    document.getElementById('media-pagination').hidden = false;
    loadMedia();
}

/** 加载回收站列表（q 标题搜索）。 */
async function loadTrash() {
    const q = trashSearchInput.value.trim();
    trashStatusEl.textContent = '加载中…';
    try {
        const sp = new URLSearchParams({ limit: '200', offset: '0' });
        if (q) sp.set('q', q);
        const [listResp, countResp] = await Promise.all([
            fetch(`/api/media/trash?${sp.toString()}`),
            fetch(`/api/media/trash/count${q ? '?q=' + encodeURIComponent(q) : ''}`)
        ]);
        const list = listResp.ok ? await listResp.json() : [];
        const total = countResp.ok ? Number(await countResp.json()) : list.length;
        renderTrashList(list);
        trashStatusEl.textContent = total
            ? `回收站共 ${total} 条`
            : (q ? '没有匹配的已删媒体' : '回收站是空的');
    } catch (e) {
        trashStatusEl.textContent = '加载失败：后端未响应';
    }
}

/** 渲染回收站卡片：封面/标题/删除时间 + 撤回/彻底删除。 */
function renderTrashList(list) {
    trashListEl.innerHTML = '';
    if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'trash-empty';
        empty.textContent = '回收站是空的';
        trashListEl.appendChild(empty);
        return;
    }
    for (const m of list) {
        const card = document.createElement('div');
        card.className = 'media-card trash-card';
        const cover = m.coverPath
            ? `<img src="${m.coverPath}" alt="" onerror="this.style.display='none'">`
            : `<span class="cover-placeholder">${esc(m.title).slice(0, 1)}</span>`;
        card.innerHTML = `
            <div class="media-cover">${cover}</div>
            <div class="media-card-body">
                <div class="media-card-title"></div>
                <div class="media-card-meta"></div>
                <div class="trash-actions">
                    <button type="button" class="btn-mini trash-restore" title="撤回恢复到媒体列表">↩ 撤回</button>
                    <button type="button" class="btn-mini danger trash-purge" title="彻底删除（不可恢复）">彻底删除</button>
                </div>
            </div>`;
        card.querySelector('.media-card-title').textContent = m.title;
        const meta = [];
        if (m.year) meta.push(String(m.year));
        if (m.subcategory) meta.push(m.subcategory);
        if (m.deletedAt) meta.push('删除于 ' + fmtTime(m.deletedAt));
        card.querySelector('.media-card-meta').textContent = meta.join(' · ');
        card.querySelector('.trash-restore').addEventListener('click', () => restoreTrash(m.id));
        card.querySelector('.trash-purge').addEventListener('click', () => purgeTrash(m.id));
        trashListEl.appendChild(card);
    }
}

/** 撤回：恢复回收站媒体到列表。 */
async function restoreTrash(id) {
    try {
        const resp = await fetch(`/api/media/${id}/restore`, { method: 'POST' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        showToast('已撤回该媒体');
        loadTrash();
    } catch (e) {
        showToast('撤回失败：后端未响应');
    }
}

/** 彻底删除单条（不可恢复，级联清集/片段/封面）。 */
async function purgeTrash(id) {
    if (!confirm('彻底删除该媒体？其下集/片段/封面将一并删除，不可恢复。')) return;
    try {
        const resp = await fetch(`/api/media/purge?ids=${id}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        showToast('已彻底删除');
        loadTrash();
    } catch (e) {
        showToast('删除失败：后端未响应');
    }
}

/** 清空回收站：全部彻底删除。 */
async function clearTrash() {
    if (!confirm('清空回收站？全部媒体将彻底删除，不可恢复。')) return;
    try {
        const resp = await fetch('/api/media/trash', { method: 'DELETE' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        showToast('回收站已清空');
        loadTrash();
    } catch (e) {
        showToast('清空失败：后端未响应');
    }
}

/** 轻提示：全局唯一 toast，2.5s 自动消失，可打断重显。 */
let toastTimer = null;
function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
}

// ---------- 推荐导出向导（独立「推荐」tab：勾选 → 主题 → 预览导出） ----------

/** 推荐向导勾选的媒体 id（独立于媒体页批量删除的 mediaSelected）。 */
const recommendSelected = new Set();
let recommendStep = 1;            // 向导当前步骤 1/2/3
let recommendDstHandle = null;    // File System Access API 保存句柄（选过保存位置后非空）

/** 拉取推荐用媒体列表并渲染到向导网格（复用媒体列表接口；收藏夹/标签过滤 + offset 分页，勾选跨页保留）。 */
async function loadRecommend(resetPage = true) {
    if (resetPage) recommendPage = 1;
    recommendGridEl.innerHTML = '';
    try {
        const params = new URLSearchParams({ limit: String(recommendPageSize), offset: String((recommendPage - 1) * recommendPageSize) });
        const filters = new URLSearchParams();
        if (recommendSourceType === 'collection') {
            params.set('collectionId', String(recommendSourceId));
            filters.set('collectionId', String(recommendSourceId));
        }
        if (recommendTagId) {
            params.set('tagId', String(recommendTagId));
            filters.set('tagId', String(recommendTagId));
        }
        const qs = filters.toString();
        const [listResp, countResp] = await Promise.all([
            fetch(`/api/media?${params.toString()}`),
            fetch(`/api/media/count${qs ? '?' + qs : ''}`)
        ]);
        if (!listResp.ok) throw new Error();
        const list = await listResp.json();
        recommendTotal = countResp.ok ? Number(await countResp.json()) : (Array.isArray(list) ? list.length : 0);
        const totalPages = Math.max(1, Math.ceil(recommendTotal / recommendPageSize));
        if (recommendPage > totalPages) { recommendPage = totalPages; return loadRecommend(false); }
        if (recommendPage < 1) recommendPage = 1;
        renderRecommendGrid(Array.isArray(list) ? list : []);
        renderRecommendPagination(totalPages);
    } catch (e) {
        showToast('加载媒体失败');
        renderRecommendPagination(1);
    }
}

/** 标签名 → tag id：manage?q 模糊查后精确匹配词条名（零后端改动）。查不到返回 null。 */
async function resolveRecommendTagId(name) {
    try {
        const resp = await fetch(`/api/tags/manage?q=${encodeURIComponent(name)}&size=50`);
        if (!resp.ok) return null;
        const page = await resp.json();
        const hit = (page.items || []).find(t => t.name === name);
        return hit ? hit.id : null;
    } catch (e) {
        return null;
    }
}

/** 应用标签过滤：输入名 → 解析 id → 触发加载（空输入则清除标签过滤）。 */
async function applyRecommendTagFilter() {
    const name = recommendTagInputEl.value.trim();
    if (name === recommendTagName) return;   // 已应用，防 Enter+blur 双触发
    if (!name) {
        recommendTagName = '';
        recommendTagId = null;
        recommendTagClearEl.hidden = true;
        loadRecommend();
        return;
    }
    const id = await resolveRecommendTagId(name);
    if (!id) {
        showToast(`标签「${name}」不在标签池中`);
        return;
    }
    recommendTagName = name;
    recommendTagId = id;
    recommendTagClearEl.hidden = false;
    loadRecommend();
}

/** 推荐来源网格分页条：总数 + 页信息 + 上/下页可用态。 */
function renderRecommendPagination(totalPages) {
    recommendTotalEl.textContent = `共 ${recommendTotal} 部`;
    recommendPageInfoEl.textContent = `第 ${recommendPage}/${totalPages} 页`;
    recommendPagePrevEl.disabled = recommendPage <= 1;
    recommendPageNextEl.disabled = recommendPage >= totalPages;
}

/** 填充推荐收藏夹下拉：全部媒体 + 各收藏夹（值即收藏夹 id）。 */
async function fillRecommendSources() {
    try {
        const resp = await fetch('/api/collections');
        if (!resp.ok) return;
        const list = await resp.json();
        const cur = recommendSourceEl.value;
        recommendSourceEl.innerHTML = '<option value="">全部媒体</option>';
        for (const c of list) {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name}（${c.mediaCount || 0}）`;
            recommendSourceEl.appendChild(opt);
        }
        recommendSourceEl.value = cur;
    } catch (e) { /* 忽略 */ }
}

/** 渲染推荐勾选网格：复用 .media-card/.media-batch-cb 样式，勾选走 recommendSelected。 */
function renderRecommendGrid(list) {
    currentRecommendList = list;
    const grid = recommendGridEl;
    grid.innerHTML = '';
    for (const a of list) {
        mediaById.set(a.id, a);
        const card = document.createElement('div');
        card.className = 'media-card' + (recommendSelected.has(a.id) ? ' selected' : '');
        const cover = (a.coverPath || a.fallbackCoverPath)
            ? `<img src="${a.coverPath || a.fallbackCoverPath}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<span class="cover-placeholder">${esc(a.title).slice(0, 1)}</span>`;
        const fmtBadge = a.mediaFormat
            ? `<span class="media-format-badge fmt-${esc(a.mediaFormat)}">${esc(formatName(a.mediaFormat))}</span>`
            : '';
        // 来源角标：仅同步来源显示（推荐勾选时便于识别 omofuna/AniList 重复来源）
        const srcBadge = (a.source === 'ANILIST' || a.source === 'OMOFUNA')
            ? `<span class="media-source-badge">${esc(a.source === 'ANILIST' ? 'AniList' : 'omofuna')}</span>`
            : '';
        card.innerHTML = `
            <div class="media-cover">${fmtBadge}${srcBadge}${cover}
                <input type="checkbox" class="media-batch-cb" title="勾选后进入推荐导出" ${recommendSelected.has(a.id) ? 'checked' : ''}>
                <button type="button" class="media-fav-btn" title="收藏到收藏夹">♡</button>
            </div>
            <div class="media-card-body">
                <div class="media-card-title"></div>
                <div class="media-card-meta"></div>
            </div>`;
        card.querySelector('.media-card-title').textContent = a.title;
        const meta = [];
        if (a.subcategory) meta.push(a.subcategory);
        if (a.status) meta.push(MEDIA_STATUS_LABEL[a.status] || a.status);
        meta.push(`${a.clipCount || 0} 条片段`);
        card.querySelector('.media-card-meta').textContent = meta.join(' · ');
        const cb = card.querySelector('.media-batch-cb');
        cb.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', () => {
            if (cb.checked) { recommendSelected.add(a.id); card.classList.add('selected'); }
            else { recommendSelected.delete(a.id); card.classList.remove('selected'); }
            updateRecommendCount();
        });
        card.querySelector('.media-fav-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openFavPicker(a.id, e.currentTarget);
        });
        card.addEventListener('click', () => openMediaDetail(a.id));
        grid.appendChild(card);
    }
}

/** 勾选数 → 计数 + 下一步按钮可用态。 */
function updateRecommendCount() {
    const n = recommendSelected.size;
    document.getElementById('recommend-picked').innerHTML = `已选 <b>${n}</b> 部`;
    document.getElementById('recommend-step-1-next').disabled = n === 0;
    document.getElementById('recommend-export-count').textContent = n;
}

/** 全选本页：把当前页已渲染媒体全部加入/移出 recommendSelected（toggle，勾选跨页保留）。 */
function selectRecommendAll() {
    if (currentRecommendList.length === 0) { showToast('当前列表为空'); return; }
    const allSelected = currentRecommendList.every(a => recommendSelected.has(a.id));
    currentRecommendList.forEach(a => {
        if (allSelected) recommendSelected.delete(a.id);
        else recommendSelected.add(a.id);
    });
    document.querySelectorAll('#recommend-grid .media-batch-cb').forEach(cb => {
        cb.checked = !allSelected;
        cb.closest('.media-card').classList.toggle('selected', !allSelected);
    });
    updateRecommendCount();
    showToast(allSelected
        ? `已取消本页 ${currentRecommendList.length} 部全选`
        : `已全选本页 ${currentRecommendList.length} 部`);
}

/** 向导步骤切换：步骤条 active 态 + 面板显隐。 */
function showRecommendStep(step) {
    recommendStep = step;
    document.querySelectorAll('.wizard-step').forEach(s => {
        const cur = Number(s.dataset.wstep);
        s.classList.toggle('active', cur === step);
        s.classList.toggle('done', cur < step);
    });
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`wizard-pane-${i}`).hidden = i !== step;
    }
}

/** 推荐页标题（主题）当前值，空 → 默认。 */
function recommendTitle() {
    const t = document.getElementById('recommend-title').value.trim();
    return t === '' ? '我的番剧推荐' : t;
}

/** 生成预览：POST html → blob → iframe.srcdoc 渲染（自包含页面）。 */
async function generateRecommendPreview() {
    const ids = [...recommendSelected];
    if (ids.length === 0) { showToast('请先勾选要推荐的媒体'); return; }
    const title = recommendTitle();
    const statusEl = document.getElementById('recommend-export-status');
    statusEl.textContent = '生成预览中…';
    try {
        const resp = await fetch('/api/recommend/html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, title }),
        });
        if (!resp.ok) throw new Error(`生成失败 (${resp.status})`);
        const html = await resp.text();
        const frame = document.getElementById('recommend-preview-frame');
        frame.srcdoc = html;
        document.getElementById('preview-title-note').textContent = `「${title}」· ${ids.length} 部`;
        document.getElementById('recommend-preview-modal').hidden = false;
        statusEl.textContent = '';
    } catch (err) {
        statusEl.textContent = '';
        showToast(err.message || '生成预览失败');
    }
}

/** 下载 HTML（普通 a.download，文件带时间戳）。 */
async function downloadRecommendHtml() {
    const ids = [...recommendSelected];
    if (ids.length === 0) { showToast('请先勾选要推荐的媒体'); return; }
    const title = recommendTitle();
    try {
        const resp = await fetch('/api/recommend/html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, title }),
        });
        if (!resp.ok) throw new Error(`生成失败 (${resp.status})`);
        const blob = await resp.blob();
        const stamp = stampNow();
        downloadBlob(blob, `video-tagger-recommend-${stamp}.html`);
        showToast(`已生成，共 ${ids.length} 部`);
    } catch (err) {
        showToast(err.message || '下载失败');
    }
}

/** 打开视频导出弹窗：预填标题/计数，重置保存位置选择。 */
function openVideoExport() {
    document.getElementById('video-count').textContent = recommendSelected.size;
    const title = recommendTitle();
    document.getElementById('video-filename').value = title === '我的番剧推荐'
        ? 'video-tagger-recommend'
        : title;
    document.getElementById('video-dst').value = '';
    document.getElementById('video-dst-pick').textContent = '选择位置';
    recommendDstHandle = null;
    document.getElementById('video-export-confirm').disabled = false;
    document.getElementById('video-format-hint').hidden = document.getElementById('video-format').value !== 'WEBM';
    document.getElementById('recommend-video-modal').hidden = false;
}

/** 选择保存位置（File System Access API；非 Chromium → toast 提示走降级下载）。 */
async function pickVideoDst() {
    const ext = document.getElementById('video-format').value === 'WEBM' ? 'webm' : 'mp4';
    const base = document.getElementById('video-filename').value.trim() || 'video-tagger-recommend';
    if (!window.showSaveFilePicker) {
        showToast('当前浏览器不支持选择保存位置，将直接下载到默认目录');
        return;
    }
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: `${base}.${ext}`,
            types: [{
                description: ext === 'webm' ? 'WebM 视频' : 'MP4 视频',
                accept: { [ext === 'webm' ? 'video/webm' : 'video/mp4']: [`.${ext}`] },
            }],
        });
        recommendDstHandle = handle;
        document.getElementById('video-dst').value = handle.name;
        document.getElementById('video-dst-pick').textContent = '重新选择';
    } catch (err) {
        if (err && err.name === 'AbortError') return; // 用户取消选择，保留原状
        showToast('选择保存位置失败');
    }
}

/** 导出视频：渲染 → 写入选中位置（或降级下载）。 */
async function exportRecommendVideo() {
    const ids = [...recommendSelected];
    if (ids.length === 0) { showToast('请先勾选要推荐的媒体'); return; }
    const title = recommendTitle();
    const format = document.getElementById('video-format').value;
    const resolution = document.getElementById('video-resolution').value;
    const btn = document.getElementById('video-export-confirm');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '渲染中…(约几十秒)';
    try {
        const resp = await fetch('/api/recommend/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, title, format, resolution }),
        });
        if (!resp.ok) {
            let msg = `渲染失败 (${resp.status})`;
            try { const e = await resp.json(); if (e && e.message) msg = e.message; } catch (e2) { }
            throw new Error(msg);
        }
        const blob = await resp.blob();
        const ext = format === 'WEBM' ? 'webm' : 'mp4';
        if (recommendDstHandle && window.showSaveFilePicker) {
            const writable = await recommendDstHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            showToast('视频已导出到所选位置');
        } else {
            const base = document.getElementById('video-filename').value.trim() || 'video-tagger-recommend';
            downloadBlob(blob, `${base}-${stampNow()}.${ext}`);
            showToast('视频已生成');
        }
        document.getElementById('recommend-video-modal').hidden = true;
    } catch (err) {
        showToast(err.message || '视频导出失败');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

/** 时间戳文件名辅助。 */
function stampNow() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/** blob 触发浏览器下载。 */
function downloadBlob(blob, fileName) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
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
    meta.push(mediaSourceLabel(d.source)); // 手动 / AniList 同步 / omofuna 同步
    if (d.mediaFormat) meta.push(formatName(d.mediaFormat));
    if (d.year) meta.push(String(d.year));
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

/** 标签池：三级聚合热度视图（次数降序 + 分级配色）。作品级已挂标签可删，保留添加；聚合接口失败兜底回作品级。 */
async function renderDetailTags(d) {
    detailTagsEl.innerHTML = '';
    let stats = [];
    try {
        const resp = await fetch(`/api/tags/manage?mediaId=${d.id}&page=1&size=1000`);
        if (resp.ok) {
            const pr = await resp.json();
            stats = (pr.items || []).map(s => ({
                id: s.id, name: s.name, count: Number(s.refCount) || 0
            }));
        }
    } catch (e) { /* 兜底：仅作品级 */ }
    // 作品级标签 id 集合 → 标记可删除（删作品级关联，集/片段引用不动）
    const removableIds = new Set((d.tags || []).map(t => t.id));
    const pool = stats.length > 0 ? stats : (d.tags || []).map(t => ({ id: t.id, name: t.name, count: 1 }));
    pool.sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const p of pool) {
        const chip = document.createElement('span');
        chip.className = `tag-pool-chip stat-${tagStatTier(p.count)}`;
        chip.title = `${p.name} · 引用 ${p.count} 次`;
        const name = document.createElement('span');
        name.className = 'tag-pool-name';
        name.textContent = p.name;
        chip.appendChild(name);
        const cnt = document.createElement('span');
        cnt.className = 'tag-pool-count';
        cnt.textContent = `×${p.count}`;
        chip.appendChild(cnt);
        if (removableIds.has(p.id)) {
            const rm = document.createElement('span');
            rm.className = 'chip-remove';
            rm.textContent = '×';
            rm.title = '从作品级移除（集/片段引用保留）';
            rm.addEventListener('click', async (e) => {
                e.stopPropagation();
                await fetch(`/api/media/${d.id}/tags/${p.id}`, { method: 'DELETE' });
                refreshMediaDetail();
            });
            chip.appendChild(rm);
        }
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

/** 标签池分级档位：1 / 2-3 / 4-6 / 7-9 / 10+ → 1..5。 */
function tagStatTier(n) {
    if (n >= 10) return 5;
    if (n >= 7) return 4;
    if (n >= 4) return 3;
    if (n >= 2) return 2;
    return 1;
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

/** 媒体来源 → 完整展示名（详情 meta 用；角标用短名直接内联）。 */
function mediaSourceLabel(s) {
    if (s === 'ANILIST') return 'AniList 同步';
    if (s === 'OMOFUNA') return 'omofuna 同步';
    return '手动';
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
    fillYearFilter();
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

/** 打开番剧同步弹窗：生成 2000~2026 年份勾选 chips，默认全不选。 */
/** 打开同步弹窗：年份 chips + 来源 chips 状态 + 检查进行中 omofuna 任务（刷新恢复进度）。 */
function openMediaSyncModal() {
    syncYearGridEl.innerHTML = '';
    mediaSyncStatusEl.textContent = '';
    mediaSyncProgressEl.hidden = true;
    const now = new Date().getFullYear();
    for (let y = now; y >= 2000; y--) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sync-year-chip';
        chip.dataset.year = y;
        chip.textContent = y;
        chip.addEventListener('click', () => {
            chip.classList.toggle('on');
        });
        syncYearGridEl.appendChild(chip);
    }
    syncSourceChips.forEach(c => c.classList.toggle('on', c.dataset.source === syncSource));
    updateSyncSourceHint();
    renderSyncCategories();
    mediaSyncModal.hidden = false;
    checkOmofunaCurrent();
}

/** 来源切换（单选互斥）；切换时重渲染分类 chips、清空状态/进度并停掉旧轮询。 */
function setSyncSource(src) {
    syncSource = src;
    syncSourceChips.forEach(c => c.classList.toggle('on', c.dataset.source === src));
    updateSyncSourceHint();
    renderSyncCategories();
    mediaSyncStatusEl.textContent = '';
    mediaSyncProgressEl.hidden = true;
    mediaSyncStartBtn.disabled = false;
    if (omofunaPollTimer) { clearInterval(omofunaPollTimer); omofunaPollTimer = null; }
}

/** 按当前数据源渲染分类 chips（AniList format / omofuna 类目），多选默认全选。 */
function renderSyncCategories() {
    syncCategoryGridEl.innerHTML = '';
    const list = syncSource === 'OMOFUNA' ? SYNC_TYPES : SYNC_FORMATS;
    for (const c of list) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sync-year-chip on';
        chip.dataset.val = c.code != null ? c.code : String(c.id);
        chip.textContent = c.name;
        chip.addEventListener('click', () => chip.classList.toggle('on'));
        syncCategoryGridEl.appendChild(chip);
    }
}

/** 按数据源更新提示文案。 */
function updateSyncSourceHint() {
    syncSourceHintEl.textContent = syncSource === 'OMOFUNA'
        ? 'omofuna：抓取中文标题（日漫/动画/剧场），后台运行约 20~40 分钟，刷新可恢复进度'
        : 'AniList：日文原名占位，同步约几十秒，命中已有自动跳过';
}

/** 全选 / 清空年份 chips。 */
function setSyncYears(on) {
    syncYearGridEl.querySelectorAll('.sync-year-chip').forEach(c => c.classList.toggle('on', on));
}

/** 开始同步：按数据源分流（AniList 同步阻塞 / omofuna 异步任务 + 轮询）。分类全选时不传（不过滤）。 */
async function startMediaSync() {
    const years = [...syncYearGridEl.querySelectorAll('.sync-year-chip.on')]
        .map(c => Number(c.dataset.year));
    if (years.length === 0) { mediaSyncStatusEl.textContent = '请先勾选至少一个年份'; return; }
    const catVals = [...syncCategoryGridEl.querySelectorAll('.sync-year-chip.on')].map(c => c.dataset.val);
    const allCats = catVals.length === syncCategoryGridEl.children.length;
    if (syncSource === 'OMOFUNA') {
        await startOmofunaSync(years, allCats ? null : catVals.map(Number));
    } else {
        await startAnilistSync(years, allCats ? null : catVals);
    }
}

/** AniList 同步（同步阻塞，几十秒）：POST → 展示结果 → 刷新媒体列表。formats 空=不过滤。 */
async function startAnilistSync(years, formats) {
    mediaSyncStartBtn.disabled = true;
    mediaSyncStatusEl.textContent = `正在同步 ${Math.min(...years)}~${Math.max(...years)} 年…（数据源 AniList）`;
    try {
        const body = { years };
        if (formats && formats.length) body.formats = formats;
        const resp = await fetch('/api/media/sync-anilist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const r = await resp.json();
        mediaSyncStatusEl.textContent = `完成：新增 ${r.added} 部，跳过 ${r.skipped} 部`;
        showToast(`番剧同步完成：新增 ${r.added}，跳过 ${r.skipped}`);
        loadMedia();
    } catch (e) {
        mediaSyncStatusEl.textContent = '同步失败：后端未响应，请确认后端已启动';
    } finally {
        mediaSyncStartBtn.disabled = false;
    }
}

/** omofuna 同步（异步任务）：POST 建后台任务（立即返回 taskId）→ 轮询进度。types 空=全部类目。 */
async function startOmofunaSync(years, types) {
    mediaSyncStartBtn.disabled = true;
    mediaSyncStatusEl.textContent = '正在创建抓取任务…';
    try {
        const body = { years };
        if (types && types.length) body.types = types;
        const resp = await fetch('/api/media/sync-omofuna', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error((err && err.message) || `HTTP ${resp.status}`);
        }
        const t = await resp.json();
        mediaSyncStatusEl.textContent = `任务已启动，正在抓取 ${Math.min(...years)}~${Math.max(...years)} 年…`;
        pollOmofunaTask(t.taskId);
    } catch (e) {
        mediaSyncStatusEl.textContent = '启动失败：' + (e.message || '后端未响应');
        mediaSyncStartBtn.disabled = false;
    }
}

/** 轮询 omofuna 任务进度；DONE 收尾刷新媒体列表，ERROR 展示失败原因。 */
function pollOmofunaTask(taskId) {
    if (omofunaPollTimer) clearInterval(omofunaPollTimer);
    omofunaPollTimer = setInterval(async () => {
        try {
            const resp = await fetch('/api/media/sync-omofuna/' + taskId);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const t = await resp.json();
            if (t.status === 'RUNNING') {
                mediaSyncProgressEl.hidden = false;
                mediaSyncStatusEl.textContent = `正在抓取：已抓 ${t.processedPages} 页，约 ${t.itemsFound} 条`;
            } else if (t.status === 'DONE') {
                clearInterval(omofunaPollTimer);
                omofunaPollTimer = null;
                mediaSyncProgressEl.hidden = true;
                mediaSyncStatusEl.textContent = `完成：新增 ${t.added} 部，跳过 ${t.skipped} 部`;
                showToast(`omofuna 同步完成：新增 ${t.added}，跳过 ${t.skipped}`);
                mediaSyncStartBtn.disabled = false;
                loadMedia();
            } else { // ERROR
                clearInterval(omofunaPollTimer);
                omofunaPollTimer = null;
                mediaSyncProgressEl.hidden = true;
                mediaSyncStatusEl.textContent = '同步失败：' + (t.message || '未知错误');
                showToast('omofuna 同步失败');
                mediaSyncStartBtn.disabled = false;
            }
        } catch (e) {
            clearInterval(omofunaPollTimer);
            omofunaPollTimer = null;
            mediaSyncStatusEl.textContent = '轮询失败：后端未响应';
            mediaSyncStartBtn.disabled = false;
        }
    }, 2000);
}

/** 刷新恢复：打开弹窗时查最近 omofuna 任务，RUNNING 续轮询（来源自动切 omofuna）/ DONE·ERROR 展示上次结果。 */
async function checkOmofunaCurrent() {
    try {
        const resp = await fetch('/api/media/sync-omofuna/current');
        if (!resp.ok) return;
        const t = await resp.json();
        if (!t) return;
        if (t.status === 'RUNNING') {
            syncSource = 'OMOFUNA';
            syncSourceChips.forEach(c => c.classList.toggle('on', c.dataset.source === 'OMOFUNA'));
            updateSyncSourceHint();
            mediaSyncStartBtn.disabled = true;
            mediaSyncProgressEl.hidden = false;
            mediaSyncStatusEl.textContent = `恢复进度：正在抓取 ${t.years.join(',')} 年…`;
            pollOmofunaTask(t.taskId);
        } else if (t.status === 'DONE') {
            mediaSyncStatusEl.textContent = `上次 omofuna 结果：新增 ${t.added} 部，跳过 ${t.skipped} 部`;
        } else if (t.status === 'ERROR') {
            mediaSyncStatusEl.textContent = '上次 omofuna 同步失败：' + (t.message || '未知错误');
        }
    } catch (e) { /* 刷新恢复失败不阻塞 */ }
}

/** 全选本页：把当前已渲染的媒体全部加入勾选集合（批量删除前快速圈选）。 */
function selectAllCurrent() {
    if (currentMediaList.length === 0) { showToast('当前列表为空'); return; }
    // 全选/取消全选切换：本页已全部选中 → 取消本页全选；否则全选本页
    const allSelected = currentMediaList.every(a => mediaSelected.has(a.id));
    currentMediaList.forEach(a => {
        if (allSelected) mediaSelected.delete(a.id);
        else mediaSelected.add(a.id);
    });
    document.querySelectorAll('#media-grid .media-batch-cb').forEach(cb => {
        cb.checked = !allSelected;
        cb.closest('.media-card').classList.toggle('selected', !allSelected);
    });
    updateMediaBatchConfirm();
    showToast(allSelected
        ? `已取消本页 ${currentMediaList.length} 部全选`
        : `已全选本页 ${currentMediaList.length} 部`);
}

/** 补下缺失封面：触发后端重下 cover_url 非空但尚无封面的媒体（异步下载中断/未下完的一键补齐）。 */
async function retryCovers() {
    showToast('正在触发补下缺失封面…');
    try {
        const resp = await fetch('/api/media/retry-covers', { method: 'POST' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const r = await resp.json();
        showToast(`已触发 ${r.triggered} 部封面补下（异步下载中，稍后刷新可见）`);
    } catch (e) {
        showToast('补下封面失败：后端未响应');
    }
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
    mediaYearInput.value = '';
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
    mediaYearInput.value = d.year || '';
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
        year: mediaYearInput.value === '' ? null : Number(mediaYearInput.value),
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
searchPageSizeEl.addEventListener('change', () => { searchPageSize = Number(searchPageSizeEl.value); runSearch(currentQuery); });
searchPagePrevEl.addEventListener('click', () => { if (searchPage > 1) { searchPage--; runSearch(currentQuery, false); } });
searchPageNextEl.addEventListener('click', () => { searchPage++; runSearch(currentQuery, false); });
videoPageSizeEl.addEventListener('change', () => { videoPageSize = Number(videoPageSizeEl.value); loadVideos(); });
videoPagePrevEl.addEventListener('click', () => { if (videoPage > 1) { videoPage--; loadVideos(false); } });
videoPageNextEl.addEventListener('click', () => { videoPage++; loadVideos(false); });
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
        if (mediaMode === 'trash') {
            openTrashView(); // 回收站独立视图（媒体栏下）
        } else {
            backToMedia(); // 内部恢复主区 + loadMedia
        }
    });
});
document.getElementById('media-create').addEventListener('click', openCreateMedia);
document.getElementById('media-batch-del').addEventListener('click', toggleMediaBatchMode);
document.getElementById('media-batch-confirm').addEventListener('click', () => openBatchDelModal([...mediaSelected]));
// 番剧同步（AniList）：按钮 → 弹窗 → 勾选年份 → 开始同步
document.getElementById('media-sync').addEventListener('click', openMediaSyncModal);
document.getElementById('media-sync-cancel').addEventListener('click', () => { mediaSyncModal.hidden = true; });
mediaSyncModal.addEventListener('click', (e) => { if (e.target === mediaSyncModal) mediaSyncModal.hidden = true; });
document.getElementById('sync-year-all').addEventListener('click', () => setSyncYears(true));
document.getElementById('sync-year-clear').addEventListener('click', () => setSyncYears(false));
document.getElementById('media-sync-start').addEventListener('click', startMediaSync);
// 同步来源单选 chips：切换即分流（AniList 同步阻塞 / omofuna 异步任务）
syncSourceChips.forEach(c => c.addEventListener('click', () => setSyncSource(c.dataset.source)));
// 封面补下 / 全选本页 / 媒体列表分页（页大小 / 上页 / 下页）
document.getElementById('media-retry-covers').addEventListener('click', retryCovers);
document.getElementById('media-batch-select-all').addEventListener('click', selectAllCurrent);
mediaPageSizeEl.addEventListener('change', () => { mediaPageSize = Number(mediaPageSizeEl.value); loadMedia(); });
mediaPagePrevEl.addEventListener('click', () => { if (mediaPage > 1) { mediaPage--; loadMedia(false); } });
mediaPageNextEl.addEventListener('click', () => { mediaPage++; loadMedia(false); });
collPageSizeEl.addEventListener('change', () => { collPageSize = Number(collPageSizeEl.value); if (collSelectedId != null) loadCollMedia(collSelectedId); });
collPagePrevEl.addEventListener('click', () => { if (collPage > 1 && collSelectedId != null) { collPage--; loadCollMedia(collSelectedId, false); } });
collPageNextEl.addEventListener('click', () => { if (collSelectedId != null) { collPage++; loadCollMedia(collSelectedId, false); } });
// 推荐向导来源网格：收藏夹过滤 / 标签过滤 / 页大小 / 翻页
recommendSourceEl.addEventListener('change', () => {
    const v = recommendSourceEl.value;
    recommendSourceType = v ? 'collection' : '';
    recommendSourceId = v ? Number(v) : null;
    loadRecommend();
});
recommendTagInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyRecommendTagFilter(); } });
recommendTagInputEl.addEventListener('blur', () => applyRecommendTagFilter());
recommendTagClearEl.addEventListener('click', () => {
    recommendTagInputEl.value = '';
    recommendTagName = '';
    recommendTagId = null;
    recommendTagClearEl.hidden = true;
    loadRecommend();
});
recommendPageSizeEl.addEventListener('change', () => { recommendPageSize = Number(recommendPageSizeEl.value); loadRecommend(); });
recommendPagePrevEl.addEventListener('click', () => { if (recommendPage > 1) { recommendPage--; loadRecommend(false); } });
recommendPageNextEl.addEventListener('click', () => { recommendPage++; loadRecommend(false); });
// 推荐标签输入框挂全局补全（复用打标输入补全的数据源 /api/tags?prefix=）
attachTagSuggest(recommendTagInputEl, () => null);
document.getElementById('recommend-select-all').addEventListener('click', selectRecommendAll);

// 推荐导出向导：步骤条 + 面板导航
document.querySelectorAll('.wizard-step').forEach(s => s.addEventListener('click', () => {
    if (s.dataset.wstep === '3' && recommendSelected.size === 0) { showToast('请先勾选要推荐的媒体'); return; }
    showRecommendStep(Number(s.dataset.wstep));
}));
document.getElementById('recommend-step-1-next').addEventListener('click', () => showRecommendStep(2));
document.getElementById('recommend-step-2-back').addEventListener('click', () => showRecommendStep(1));
document.getElementById('recommend-step-2-next').addEventListener('click', () => {
    document.getElementById('recommend-export-title').textContent = recommendTitle();
    showRecommendStep(3);
});
document.getElementById('recommend-step-3-back').addEventListener('click', () => showRecommendStep(2));
document.getElementById('recommend-title').addEventListener('input', () => {
    document.getElementById('recommend-title-preview').textContent = recommendTitle();
});
// 预览导出
document.getElementById('recommend-gen-preview').addEventListener('click', generateRecommendPreview);
document.getElementById('recommend-export-html').addEventListener('click', downloadRecommendHtml);
document.getElementById('recommend-export-video').addEventListener('click', openVideoExport);
// 预览弹窗
document.getElementById('preview-close').addEventListener('click', () => { document.getElementById('recommend-preview-modal').hidden = true; });
document.getElementById('preview-export-video').addEventListener('click', () => {
    document.getElementById('recommend-preview-modal').hidden = true;
    openVideoExport();
});
// 预览全屏/还原
document.getElementById('preview-expand').addEventListener('click', () => {
    const modal = document.getElementById('recommend-preview-modal').querySelector('.preview-modal');
    const full = modal.classList.toggle('preview-modal-full');
    const btn = document.getElementById('preview-expand');
    btn.textContent = full ? '还原 ⇲' : '全屏 ⇱';
    btn.title = full ? '还原弹窗' : '全屏预览';
});
// 视频导出弹窗
document.getElementById('video-export-cancel').addEventListener('click', () => { document.getElementById('recommend-video-modal').hidden = true; });
document.getElementById('video-dst-pick').addEventListener('click', pickVideoDst);
document.getElementById('video-export-confirm').addEventListener('click', exportRecommendVideo);
document.getElementById('video-format').addEventListener('change', () => {
    if (recommendDstHandle) { recommendDstHandle = null; document.getElementById('video-dst').value = ''; document.getElementById('video-dst-pick').textContent = '选择位置'; }
    document.getElementById('video-format-hint').hidden = document.getElementById('video-format').value !== 'WEBM';
});
document.getElementById('batch-del-cancel').addEventListener('click', () => { batchDelModal.hidden = true; batchDelIds = []; });
document.getElementById('batch-del-confirm').addEventListener('click', confirmBatchDelete);
document.getElementById('confirm-modal-cancel').addEventListener('click', closeConfirmModal);
document.getElementById('confirm-modal-ok').addEventListener('click', () => {
    const fn = confirmModalAction;
    closeConfirmModal();
    if (fn) fn();
});
document.getElementById('collection-create').addEventListener('click', createCollectionFromToolbar);
document.getElementById('coll-create').addEventListener('click', createCollectionFromToolbar);
document.getElementById('collection-modal-cancel').addEventListener('click', () => { collectionModal.hidden = true; });
document.getElementById('collection-modal-save').addEventListener('click', saveCollectionFromModal);
collectionModal.addEventListener('click', (e) => { if (e.target === collectionModal) collectionModal.hidden = true; });
collectionNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCollectionFromModal(); });
// 快捷收藏浮层：点击浮层外部收起（fav-btn 的 click 已 stopPropagation，不会在打开瞬间误触）
document.addEventListener('click', (e) => {
    if (!favOverlay) return;
    if (favOverlay.contains(e.target)) return;   // 浮层内（含 checkbox）不收起
    closeFavPicker();
});
window.addEventListener('scroll', () => { if (favOverlay) closeFavPicker(); }, true);
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
filterYearEl.addEventListener('change', () => { mediaFilter.year = filterYearEl.value; loadMedia(); });
filterSourceEl.addEventListener('change', () => { mediaFilter.source = filterSourceEl.value; loadMedia(); });
filterSortEl.addEventListener('change', () => { mediaFilter.sort = filterSortEl.value; loadMedia(); });
filterOrderBtn.addEventListener('click', () => {
    mediaFilter.order = mediaFilter.order === 'desc' ? 'asc' : 'desc';
    filterOrderBtn.textContent = mediaFilter.order === 'desc' ? '↓' : '↑';
    filterOrderBtn.title = mediaFilter.order === 'desc' ? '当前降序，点击切换升序' : '当前升序，点击切换降序';
    loadMedia();
});
// 回收站：返回/清空/搜索（input 防抖 300ms；打开走媒体 tab 的 trash 分支）
trashBackBtn.addEventListener('click', () => {
    // 返回媒体列表：切回「全部媒体」tab（含主区恢复）
    const allTab = document.querySelector('.media-tabs .atab[data-media-tab="all"]');
    if (allTab) allTab.click();
});
trashClearBtn.addEventListener('click', clearTrash);
let trashSearchTimer = null;
trashSearchInput.addEventListener('input', () => {
    clearTimeout(trashSearchTimer);
    trashSearchTimer = setTimeout(loadTrash, 300);
});
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
// 来源筛选：选中即重搜
if (SEARCH_SOURCE_SELECT) {
    SEARCH_SOURCE_SELECT.addEventListener('change', () => {
        if (input.value.trim()) runSearch(input.value.trim());
    });
}
// 更多筛选折叠 toggle：展开次要项（时间/聚合），保持主行简洁
if (searchMoreBtn) {
    searchMoreBtn.addEventListener('click', () => {
        const show = searchFiltersMore.hidden;
        searchFiltersMore.hidden = !show;
        searchMoreBtn.textContent = show ? '更多筛选 ▴' : '更多筛选 ▾';
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
// 历史标签三级同步：片段/集标签并集落库到集/媒体（幂等），让推荐页媒体标签过滤可用
tagSyncAllBtn.addEventListener('click', async () => {
    const btn = tagSyncAllBtn;
    btn.disabled = true;
    btn.textContent = '⇄ 同步中…';
    try {
        const r = await fetch('/api/tags/sync-all', { method: 'POST' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        showToast('已同步 ' + (data.synced ?? 0) + ' 条媒体标签（幂等可重复点）');
    } catch (e) {
        showToast('同步失败：' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '⇄ 同步历史标签';
    }
    loadTags();
});
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
