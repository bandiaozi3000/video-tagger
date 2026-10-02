const views = {
  search: document.getElementById('view-search'),
  media: document.getElementById('view-media'),
  'media-detail': document.getElementById('view-media-detail'),
  'episode-detail': document.getElementById('view-episode-detail'),
  'clip-detail': document.getElementById('view-clip-detail'),
  highlight: document.getElementById('view-highlight'),
  videos: document.getElementById('view-videos'),
  timeline: document.getElementById('view-timeline'),
  stats: document.getElementById('view-stats'),
  tags: document.getElementById('view-tags'),
  collections: document.getElementById('view-collections'),
  recommend: document.getElementById('view-recommend')
};

const APP_MODE = new URLSearchParams(window.location.search).get('appMode');
const RECOMMEND_DESKTOP_MODE = APP_MODE === 'recommend';
if (RECOMMEND_DESKTOP_MODE) document.body.classList.add('app-mode-recommend');

/* ===== 桌面版布局（方案 C）：Electron 壳注入 window.vtDesktop 时启用 ===== */
const DESKTOP_MODE = !!(window.vtDesktop && window.vtDesktop.platform === 'win32');
if (DESKTOP_MODE) {
    document.body.classList.add('desktop-mode');
    // 窗控按钮：最小化 / 最大化 / 关闭
    const bindWin = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    bindWin('win-min', () => window.vtDesktop.minimize());
    bindWin('win-max', () => window.vtDesktop.maximize());
    bindWin('win-close', () => window.vtDesktop.close());
    // 最大化状态 → 切换按钮图标（□ ⇄ ❐）
    window.vtDesktop.onMaximize(isMax => {
        const btn = document.getElementById('win-max');
        if (btn) btn.textContent = isMax ? '❐' : '□';
    });
    // 状态栏：端口从当前地址栏推断
    const portEl = document.getElementById('sb-port');
    if (portEl) portEl.textContent = '端口 ' + (window.location.port || '') + ' · 127.0.0.1';
    // 服务状态：health 探测
    const dotEl = document.getElementById('sb-dot'), svcEl = document.getElementById('sb-service');
    if (dotEl && svcEl) {
        fetch('/actuator/health').then(r => r.json()).then(d => {
            if (d && d.status === 'UP') { svcEl.textContent = '本地服务已就绪'; dotEl.style.background = 'var(--green)'; }
            else { svcEl.textContent = '服务状态异常'; dotEl.style.background = 'var(--red)'; }
        }).catch(() => { svcEl.textContent = '服务未连接'; dotEl.style.background = 'var(--red)'; });
    }
    // 状态栏数据库：媒体数（随加载更新）
    const dbEl = document.getElementById('sb-db');
    if (dbEl) {
        fetch('/api/media/count').then(r => r.json()).then(n => { dbEl.textContent = 'SQLite · ' + n + ' 部媒体'; }).catch(() => {});
    }
}

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
const editEndTime = document.getElementById('edit-end-time');

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
/* 媒体页筛选（2026-09-25 重构为「搜素 + ⚙ 筛选浮层 + 条件 chips」）：
   维度定义 MEDIA_DIMS、选项字典 mediaFilterDict、渲染见 renderFilterPop 一带。 */
const filterChipsEl = document.getElementById('filter-chips');
const filterPopEl = document.getElementById('filter-pop');
const filterCountEl = document.getElementById('filter-count');
const filterClearEl = document.getElementById('filter-clear');
const filterOpenBtn = document.getElementById('filter-open');
const filterSourceEl = null;
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
const highlightBackBtn = document.getElementById('highlight-back');
const highlightTitleEl = document.getElementById('highlight-title');
const highlightProjectMetaEl = document.getElementById('highlight-project-meta');
const highlightLibraryEl = document.getElementById('highlight-library');
const highlightTimelineEl = document.getElementById('highlight-timeline');
const highlightEmptyEl = document.getElementById('highlight-empty');
const highlightLibraryCountEl = document.getElementById('highlight-library-count');
const highlightTimelineCountEl = document.getElementById('highlight-timeline-count');
const highlightNameEl = document.getElementById('highlight-name');
const highlightModeEl = document.getElementById('highlight-mode');
const highlightResolutionEl = document.getElementById('highlight-resolution');
const highlightStylePresetEl = document.getElementById('highlight-style-preset');
const highlightTransitionEl = document.getElementById('highlight-transition');
const highlightCardsEnabledEl = document.getElementById('highlight-cards-enabled');
const highlightChaptersEnabledEl = document.getElementById('highlight-chapters-enabled');
const highlightBgmPickBtn = document.getElementById('highlight-bgm-pick');
const highlightBgmFileEl = document.getElementById('highlight-bgm-file');
const highlightBgmNameEl = document.getElementById('highlight-bgm-name');
const highlightBgmPathEl = document.getElementById('highlight-bgm-path');
const highlightBgmVolumeEl = document.getElementById('highlight-bgm-volume');
const highlightBgmVolumeValueEl = document.getElementById('highlight-bgm-volume-value');
const highlightEstimateEl = document.getElementById('highlight-estimate');
const highlightStatusEl = document.getElementById('highlight-status');
const highlightExportsEl = document.getElementById('highlight-exports');
const highlightSaveBtn = document.getElementById('highlight-save');
const highlightSinglePreviewBtn = document.getElementById('highlight-single-preview');
const highlightPreviewBtn = document.getElementById('highlight-preview');
const highlightExportBtn = document.getElementById('highlight-export');
const highlightPreviewPanelEl = document.getElementById('highlight-preview-panel');
const highlightPreviewVideoEl = document.getElementById('highlight-preview-video');
const highlightPreviewStatusEl = document.getElementById('highlight-preview-status');
const highlightMissingEl = document.getElementById('highlight-missing');
const mediaModal = document.getElementById('media-modal');
const mediaModalTitle = document.getElementById('media-modal-title');
const mediaTitleInput = document.getElementById('media-title');
const mediaFormatSelect = document.getElementById('media-format');
const mediaSubcategorySelect = document.getElementById('media-subcategory');
const mediaNewSubInput = document.getElementById('media-new-sub');
const mediaAddSubBtn = document.getElementById('media-add-sub-btn');
const mediaInlineAddBtn = document.getElementById('media-inline-add');
const mediaStatusSelect = document.getElementById('media-status-select');
const mediaRatingInput = document.getElementById('media-rating');
const mediaYearInput = document.getElementById('media-year');
const mediaSeasonInput = document.getElementById('media-season');
const mediaNoteInput = document.getElementById('media-note');
const mediaAllowHardsub = document.getElementById('media-allow-hardsub');
const mediaRetryCoversBtn = null;
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
const mergeSearchEl = document.getElementById('merge-search');
const mergeCandidatesEl = document.getElementById('merge-candidates');
const renameDupeModal = document.getElementById('rename-dupe-modal');
const renameDupeMsg = document.getElementById('rename-dupe-msg');
let mergeTargetId = null;         // 合并目标 id（搜索选择器选中）
let mergeTargetTitle = '';        // 选中目标的标题（input 回填检测）
let renameDupeResolve = null;     // 重名弹窗：{ dup, title } 待用户三选一
let mergeSearchTimer = null;      // 合并目标搜索防抖
const collectionModal = document.getElementById('collection-modal');
const collectionNameInput = document.getElementById('collection-name');
const collectionModalSaveBtn = document.getElementById('collection-modal-save');
const collListEl = document.getElementById('coll-list');
const collQEl = document.getElementById('coll-q');
const collYearEl = document.getElementById('coll-year');
const collSortEl = document.getElementById('coll-sort');
const collOrderBtn = document.getElementById('coll-order');
const collContentHeadEl = document.getElementById('coll-content-head');
const collMediaGridEl = document.getElementById('coll-media-grid');
const collStatusEl = document.getElementById('coll-status');
const collPageSizeEl = document.getElementById('coll-page-size');
const collPagePrevEl = document.getElementById('coll-page-prev');
const collPageNextEl = document.getElementById('coll-page-next');
const collPageInfoEl = document.getElementById('coll-page-info');
const collTotalEl = document.getElementById('coll-total');
const collPaginationEl = document.getElementById('coll-pagination');
const collGroupedEl = document.getElementById('coll-grouped');
const collGroupSizeEl = document.getElementById('coll-group-size');
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
const clipDetailStatusEl = document.getElementById('clip-detail-status');
const clipExportVideoBtn = document.getElementById('clip-export-video');
const clipExportFrameBtn = document.getElementById('clip-export-frame');
const clipExportSequenceBtn = document.getElementById('clip-export-sequence');
const clipRecordBrowserBtn = document.getElementById('clip-record-browser');
const clipExportStatusEl = document.getElementById('clip-export-status');
const clipSequenceModal = document.getElementById('clip-sequence-modal');
const clipSequenceIntervalEl = document.getElementById('clip-sequence-interval');
const clipSequenceEstimateEl = document.getElementById('clip-sequence-estimate');
const clipRecordModal = document.getElementById('clip-record-modal');
const clipRecordStatusEl = document.getElementById('clip-record-status');
const clipRecordPreviewEl = document.getElementById('clip-record-preview');
const hoverPreviewEl = document.getElementById('vt-hover-preview');
const tagListEl = document.getElementById('tag-list');
const tagStatusEl = document.getElementById('tag-status');
const tagFilterEl = document.getElementById('tag-filter');
const tagStatsEl = document.getElementById('tag-stats');
const tagOnlyOrphanEl = document.getElementById('tag-only-orphan');
const tagSortEl = document.getElementById('tag-sort');
const tagOrderBtn = document.getElementById('tag-order');
const tagScopeChipsEl = document.getElementById('tag-scope-chips');
const tagSelectedInfoEl = document.getElementById('tag-selected-info');
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
const SEARCH_SOURCE_SELECT = null;
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
let confirmModalOnCancel = null;   // 取消/关闭时的回调（confirmAsync 等用）
// 标签页（v0.31 重设计）：单一列表 + 客户端筛选/排序/分页；媒体维度变成可清除的 chip
let tagScopeMediaId = null;        // 非 null = 只看该媒体自己挂的词条（实体视角）
let tagScopeMediaName = '';
let tagAllRows = [];               // 本次拉到的全量词条（过滤/排序/分页都在本地做）
let tagListCache = [];             // 当前页词条（供批量删除/刷新用）
let tagFilterTimer = null;         // 过滤输入防抖
let tagSort = 'refs';              // refs | name | created
let tagSortDir = 'desc';           // desc | asc
let tagOnlyOrphanFilter = false;   // 只看未引用
let tagPage = 1;                   // 当前页
let tagPageSize = 50;              // 每页条数
let tagTotal = 0;                  // 过滤后总条数
let tagExpandedId = null;          // 行内展开使用位置的词条 id
let tagUsageCache = new Map();     // tagId → 使用位置响应
const tagSelected = new Set();     // 批量删除勾选的词条 id（只可能是孤儿）
let tagRenameId = null;            // 改名弹窗当前词条 id
let tagMergeId = null;             // 合并弹窗源词条 id
let tagPoolByName = new Map();     // 全量词库 name→id（新增实时去重用，惰性加载）
let tagAddTimer = null;            // 新增输入防抖

/** 通用确认弹窗：替代原生 confirm()，风格与页面一致。 */
function showConfirm({ title = '确认', msg = '', okText = '确定', danger = true, onOk, onCancel }) {
    document.getElementById('confirm-modal-title').textContent = title;
    const msgEl = document.getElementById('confirm-modal-msg');
    msgEl.textContent = msg;
    msgEl.title = msg; // 长文本悬停查看全文
    const ok = document.getElementById('confirm-modal-ok');
    ok.textContent = okText;
    ok.classList.toggle('danger', danger);
    confirmModalAction = onOk;
    confirmModalOnCancel = onCancel;
    confirmModal.hidden = false;
}

/** Promise 版确认：确定 → true；取消/关闭 → false。适合 async 流程里 await 使用。 */
function confirmAsync(opts) {
    return new Promise(resolve => {
        showConfirm({ ...opts, onOk: () => resolve(true), onCancel: () => resolve(false) });
    });
}

/** 关闭通用确认弹窗（取消/确认共用）。 */
function closeConfirmModal() {
    confirmModal.hidden = true;
    confirmModalAction = null;
    const cancel = confirmModalOnCancel;
    confirmModalOnCancel = null;
    if (cancel) cancel();
    // 换绑确认弹层取消/关闭后，恢复关联弹窗确认按钮，允许重新选择或重试
    const mdlBtn = document.getElementById('mdl-confirm');
    if (mdlBtn) mdlBtn.disabled = false;
}

// ---------- 通用输入弹窗（替代原生 prompt：集号/标题/关键字/订阅地址等） ----------
const promptModal = document.getElementById('prompt-modal');
let promptModalOk = null;          // 确定回调：onOk(value)
let promptModalCancel = null;      // 取消回调

/** 打开通用输入弹窗。onOk(value) 仅确定时触发；onCancel() 取消/关闭时触发。 */
function showPrompt({ title = '输入', msg = '', placeholder = '', value = '', okText = '确定', danger = true, onOk, onCancel }) {
    document.getElementById('prompt-modal-title').textContent = title;
    const msgEl = document.getElementById('prompt-modal-msg');
    msgEl.textContent = msg;
    msgEl.title = msg;
    const input = document.getElementById('prompt-modal-input');
    input.placeholder = placeholder;
    input.value = value == null ? '' : String(value);
    const ok = document.getElementById('prompt-modal-ok');
    ok.textContent = okText;
    ok.classList.toggle('danger', !!danger);
    promptModalOk = onOk;
    promptModalCancel = onCancel;
    promptModal.hidden = false;
    input.focus();
    input.select();
}

function closePromptModal() {
    promptModal.hidden = true;
    promptModalOk = null;
    promptModalCancel = null;
}

/** Promise 版输入弹窗：确定 → resolve(输入值)；取消/关闭 → resolve(null)（等价原生 prompt 取消语义）。 */
function promptInput(opts) {
    return new Promise(resolve => {
        showPrompt({ ...opts, onOk: value => resolve(value), onCancel: () => resolve(null) });
    });
}

document.getElementById('prompt-modal-cancel').addEventListener('click', () => { const c = promptModalCancel; closePromptModal(); if (c) c(); });
document.getElementById('prompt-modal-ok').addEventListener('click', () => {
    const fn = promptModalOk;
    const input = document.getElementById('prompt-modal-input');
    const value = input ? input.value : '';
    closePromptModal();
    if (fn) fn(value);
});
document.getElementById('prompt-modal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('prompt-modal-ok').click(); }
});
document.getElementById('prompt-modal').addEventListener('click', (e) => { if (e.target && e.target.id === 'prompt-modal') { const c = promptModalCancel; closePromptModal(); if (c) c(); } });
let mediaFilter = { q: '', format: '', subcategoryId: '', unconfirmed: false, sort: '', order: 'desc', genres: [], tagIds: [], status: [], year: [], season: [], collectionId: [], mode: { genres: 'OR', tagIds: 'AND', collectionId: 'OR' } };
let displayView = 'card';   // 全局视图偏好：card 卡片 / list 列表（媒体页/收藏夹/推荐页共用，单按钮切换）
let collSelectedId = null;           // 收藏夹 tab：当前选中的收藏夹 id
let collectionsCache = [];           // 收藏夹列表缓存（管理视图用）
let collPage = 1;                    // 收藏夹内媒体分页
let collPageSize = 30;
let collFilter = { q: '', year: '', sort: '', order: 'desc' };   // 收藏夹 tab 内容筛选：标题/年份/排序
let collGrouped = true;   // 收藏夹分组显示开关（按首播年份分组，默认开）
let collTotal = 0;
let collGroupPage = 1;             // 收藏夹分组视图当前页（组打包分页）
let collGroupPerPage = 500;        // 分组每页媒体数上限（档位：200/300/500/1000/不限=Infinity）
let collGroupPages = [];           // 组打包结果：每页 = 组数组 [{year,items,chunk,...}]
let collGroupTotalPages = 1;
let collGroupNav = {};             // year → 该年首个切片所在页 index（导航跨页跳转）
let collGroupNavYears = [];        // [{year}] 全部年份（导航显示顺序）
let collectionModalMode = 'create';  // collection-modal：create / rename
let collectionRenameId = null;       // rename 模式的目标收藏夹 id
let favOverlay = null;               // 卡片快捷收藏浮层
let currentMedia = null;  // 媒体详情当前对象
let editingMediaId = null;
let episodeTagEpisodeId = null;
let coverEpisode = null;   // 集封面弹层当前集 { id, title, videoFp }
let currentEpisode = null; // 集详情页当前对象 { id, ... }
let currentClip = null;    // 片段详情页当前对象 { id, ... }
let currentHighlight = null;
let highlightClips = [];
let highlightSaveTimer = null;
let highlightDraggedItemId = null;
let highlightBgmStoredPath = null;
let highlightPreviewExportId = null;
let clipExportTaskId = null;
let clipRecordState = null;
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
    const url = r?.url;
    // v0.24 A档：Animeko 引用无深链 → 唤起 Animeko 窗口置前 + 提示手动定位；网页源保持原逻辑跳转。
    if (url && url.startsWith('animeko://')) {
        return activateAnimekoWithHint(r, true);
    }
    if ((!url || url === 'null') && r && (r.watchedAt || r.animekoSource)) {
        // Animeko 导入的集：无网页 url，但 watchedAt 已回灌 → 唤起 Animeko 提示
        return activateAnimekoWithHint(r, false);
    }
    try {
        await fetch('/api/jump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, timestampSec: r.timestampSec ?? 0 })
        });
    } catch (err) { /* 跳转队列失败不阻塞打开页面 */ }
    window.open(buildJumpUrl(url, r.timestampSec ?? 0), '_blank');
}

/** v0.24：片段「去原视频」可用性——有网页/Animeko 引用可跳则高亮，否则置灰。 */
function syncClipJumpAvailability(clip) {
    const btn = document.getElementById('clip-detail-jump');
    if (!btn) return;
    const url = clip.url && clip.url !== 'null' ? String(clip.url) : '';
    const animekoFallback = !url && ((clip.watchedAt) || (clip.animekoSource));
    const can = !!url || animekoFallback;
    btn.disabled = !can;
    btn.classList.toggle('live', can);
    btn.title = can
        ? (url.startsWith('animeko://') ? '唤起 Animeko 定位该片段' : '在原始视频页打开该时间点')
        : '无原视频来源（片段无网页引用，也无 Animeko 观看记录可唤起）';
}

/** Animeko 唤起 + 提示（片段给片段区间提示，集给集名提示）。 */
async function activateAnimekoWithHint(r, isClip) {
    let hint = '正在唤起 Animeko…';
    showToast(hint, 1200);
    try {
        const resp = await fetch('/api/animeko/watch/activate', { method: 'POST' });
        const a = await resp.json();
        if (!resp.ok || !a.ok) {
            showToast(a.message || '唤起 Animeko 失败', 4000);
            return;
        }
        const label = r.title || (isClip ? '该片段' : '该集');
        if (isClip) {
            const range = r.endSec != null ? `${fmtTime(r.timestampSec)} – ${fmtTime(r.endSec)}` : fmtTime(r.timestampSec);
            showToast(`已唤起 Animeko。片段《${label}》${range}：请在 Animeko 打开对应番剧集（Animeko 不支持外部定位）`, 6500);
        } else {
            showToast(`已唤起 Animeko。请在弹出的 Animeko 窗口打开《${label}》（Animeko 不支持外部定位）`, 6500);
        }
    } catch (e) {
        showToast('唤起 Animeko 失败：' + e.message, 4000);
    }
}

let currentViewName = 'search';

function showView(name) {
    const previousView = currentViewName;
    currentViewName = name;
    if (previousView === 'recommend' && name !== 'recommend') unmountRecommendEditor();
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
    if (name === 'recommend') mountRecommendEditor();
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
    else if (activeView() === 'highlight' && currentHighlight) id = currentHighlight.id;
    viewHistory.push({ view: activeView(), id, scrollY: window.scrollY });
    showView(name);
}

/** 返回需恢复滚动的列表视图（媒体/收藏夹：showView 会自动重新加载列表）。 */
const SCROLL_RESTORE_VIEWS = new Set(['media', 'collections']);

function goBack() {
    const prev = viewHistory.pop();
    if (!prev) { showView(RECOMMEND_DESKTOP_MODE ? 'media' : 'search'); return; }
    showView(prev.view);
    // 从列表进详情返回：恢复离开时的滚动位置（轮询等列表渲染完成，避免异步加载后落回顶部）
    if (SCROLL_RESTORE_VIEWS.has(prev.view) && prev.scrollY > 0) restoreListScroll(prev.scrollY, prev.view);
    if (prev.view === 'search' && currentQuery) runSearch(currentQuery);
    else if (prev.view === 'media-detail' && prev.id != null) loadMediaDetail(prev.id);
    else if (prev.view === 'timeline' && currentVideo) openTimeline(currentVideo);
    else if (prev.view === 'episode-detail' && prev.id != null) loadEpisodeDetail(prev.id);
    else if (prev.view === 'clip-detail' && prev.id != null) renderClipDetail(prev.id);
    else if (prev.view === 'highlight' && prev.id != null) loadHighlightProject(prev.id);
    // 'media' / 'videos' / 'stats' 由 showView 自动重新加载
}

/** 列表返回后恢复滚动：按目标视图容器轮询等渲染稳定（scrollHeight 不再增长且已有卡片/分组）再滚回离开位置。
 *  viewName 用于限定查询容器（避免全局 querySelector 误判 hidden 的其他视图旧卡片）。 */
function restoreListScroll(y, viewName) {
    const gridSel = viewName === 'media' ? '#media-grid'
        : '#coll-media-grid';
    const grid = document.querySelector(gridSel);
    if (grid) grid.innerHTML = '';   // 先清空旧内容：避免返回瞬间 section 里残留上次列表被 poll 误判「已渲染」
    let tries = 0, lastH = -1;
    (function poll() {
        if (tries++ > 120) return;   // 最多 ~6s 超时放弃（内容加载异常时不硬跳）
        const h = document.documentElement.scrollHeight;
        const hasItem = grid && grid.querySelector('.media-card, .media-row, .coll-group') != null;
        if (hasItem && h > window.innerHeight) {
            if (h === lastH) {       // 高度稳定 → 渲染完成，恢复
                window.scrollTo(0, Math.min(y, h - window.innerHeight));
                return;
            }
            lastH = h;
        }
        setTimeout(poll, 50);
    })();
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
    clipDetailStatusEl.textContent = '加载中…';
    try {
        const clipResp = await fetch(`/api/clips/${id}`);
        if (!clipResp.ok) throw new Error(`HTTP ${clipResp.status}`);
        const clip = await clipResp.json();
        currentClip = clip;
        syncClipJumpAvailability(clip);

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
        : `<span class="cover-placeholder large">${esc((clip.tag || '片').slice(0, 1))}</span>`;
    // hero 只保留画面/标题/备注；基础信息入档案卡、素材渠道入左栏面板、播放类按钮在底部 ops
    clipDetailHeadEl.innerHTML = `
        <div class="ad-cover">${cover}</div>
        <div class="ad-info">
            <h2 class="ad-title"></h2>
            <div id="clip-detail-note" class="detail-note" hidden></div>
        </div>`;
    clipDetailHeadEl.querySelector('.ad-title').textContent = clip.title || '(未命名)';
    renderClipNote(clip);
    renderClipProfile(clip, ep, media);
    renderClipTags(clip, media ? media.id : null);
    // 本地回顾按钮（hero-ops 静态）——onclick 覆盖绑定，避免重复渲染叠加
    const reviewBtn = document.getElementById('clip-detail-review');
    if (reviewBtn) {
        reviewBtn.onclick = async () => {
            try {
                const resp = await fetch(`/api/clips/${clip.id}/material/play-source`);
                if (!resp.ok) throw new Error('无可用本地文件源');
                const blob = await resp.blob();
                openLocalVideoPlayer(blob, clip, {
                    mode: 'update',
                    clipId: clip.id,
                    onSaved: () => renderClipDetail(clip.id)
                });
            } catch (e) { showToast(e.message || '本地回顾不可用', 3500); }
        };
    }
    syncClipReviewAvailability(clip);
    bindClipExportActions(clip);
}

/** 片段备注：Hero 封面右侧，点击内联编辑（PUT /api/clips/{id} 全量字段，仅改 note）。 */
function renderClipNote(clip) {
    const el = document.getElementById('clip-detail-note');
    if (!el) return;
    el.hidden = false;
    el.classList.remove('editing');
    const note = (clip.note || '').trim();
    el.classList.toggle('empty', !note);
    el.innerHTML = '';
    const openEditor = () => {
        el.classList.add('editing');
        el.innerHTML = '';
        const ta = document.createElement('textarea');
        ta.className = 'note-edit-input';
        ta.rows = 3;
        ta.placeholder = '片段备注（看点/重点），参与搜索；留空保存即清空';
        ta.value = note;
        const actions = document.createElement('div');
        actions.className = 'note-edit-actions';
        const save = document.createElement('button'); save.type = 'button'; save.className = 'btn-mini'; save.textContent = '保存';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn-mini'; cancel.textContent = '取消';
        actions.append(save, cancel);
        el.append(ta, actions);
        ta.focus();
        cancel.addEventListener('click', () => renderClipDetail(clip.id));
        save.addEventListener('click', async () => {
            const payload = {
                title: clip.title || '(未命名)',
                url: clip.url || '',
                timestampSec: clip.timestampSec ?? 0,
                endSec: clip.endSec != null ? clip.endSec : null,
                tagIds: clip.tagIds || [],
                note: ta.value.trim()
            };
            const resp = await fetch(`/api/clips/${clip.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (resp.ok) { renderClipDetail(clip.id); }
            else { el.innerHTML = '<span class="note-err">保存失败</span>'; }
        });
    };
    const body = document.createElement('div');
    body.className = 'note-editable';
    body.tabIndex = 0;
    body.title = '点击编辑备注';
    body.setAttribute('role', 'button');
    const label = document.createElement('span');
    label.className = 'note-kicker';
    label.textContent = note ? '备注' : '备注（空）';
    const txt = document.createElement('span');
    txt.className = 'note-text';
    txt.textContent = note || '＋ 点击添加备注';
    body.append(label, txt);
    body.addEventListener('click', openEditor);
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(); } });
    el.appendChild(body);
}

/** 片段档案卡（左栏）：所属媒体 / 所属集（可点跳转）/ 片段时间 / 创建时间。 */
function renderClipProfile(clip, ep, media) {
    const el = document.getElementById('clip-detail-profile');
    if (!el) return;
    const season = media && media.season != null ? media.season : 1;
    const epNo = ep && ep.episodeNo != null
        ? `第${season}季 · 第${ep.episodeNo}集`
        : (ep ? `第${season}季` : null);
    const range = clip.endSec != null ? `${fmtTime(clip.timestampSec)} – ${fmtTime(clip.endSec)}` : fmtTime(clip.timestampSec);
    const rows = [
        { l: '所属媒体', v: media ? media.title : '—', k: media ? 'media' : '' },
        { l: '所属集', v: epNo || '—', k: ep ? 'ep' : '' },
        { l: '片段时间', v: range, k: '' },
        { l: '创建时间', v: clip.createdAt ? fmtDateTime(clip.createdAt) : '—', k: '' },
    ];
    el.innerHTML = rows.map(r => `<div class="profile-row${r.k ? ' link-row' : ''}"${r.k === 'media' ? ' data-open-media="1" title="点击进入媒体详情"' : ''}${r.k === 'ep' ? ' data-open-ep="1" title="点击进入该集详情"' : ''}><span>${esc(r.l)}</span><span class="pv">${r.k ? `<b class="m-link">${esc(r.v)}</b>` : `<b>${esc(r.v)}</b>`}</span></div>`).join('');
    const m = el.querySelector('[data-open-media]');
    if (m) m.addEventListener('click', () => { if (media) openMediaDetail(media.id); });
    const e = el.querySelector('[data-open-ep]');
    if (e) e.addEventListener('click', () => { if (ep) openEpisodeDetail(ep.id); });
}

/** 片段渠道求值：本地回顾可用态 + 素材来源面板（未剪出时含「准备素材」）。 */
async function syncClipReviewAvailability(clip) {
    const reviewBtn = document.getElementById('clip-detail-review');
    const apply = (ev) => {
        const present = ev && ev.state === 'PRESENT';
        if (reviewBtn) {
            reviewBtn.disabled = !present;
            reviewBtn.classList.toggle('live', present);
            reviewBtn.title = present ? `本地回顾播放（${ev.channel || ''}）` : ((ev && ev.message) || '无本地文件源');
        }
        renderClipSourcePanel(clip, ev);
    };
    try {
        const resp = await fetch(`/api/clips/${clip.id}/material/channels`);
        const ev = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(ev.message || `HTTP ${resp.status}`);
        apply(ev);
    } catch (e) { apply(null); }
}

/** 准备素材（左栏素材来源面板按钮）：刷新渠道 → 就地物化/外部文件裁剪，完成后重载详情。 */
async function handleClipPrepare(clip, panelEl) {
    if (!panelEl) return;
    panelEl.innerHTML = '<span class="source-muted">正在求值素材渠道…</span>';
    try {
        const chResp = await fetch(`/api/clips/${clip.id}/material/channels/refresh`, { method: 'POST' });
        const ev = await chResp.json();
        if (!chResp.ok) throw new Error(ev.message || `HTTP ${chResp.status}`);
        if (ev.state === 'PRESENT' && ev.strategy === 'ALREADY_READY') {
            showToast('✓ 已物化就绪，可「本地回顾」查看');
            renderClipDetail(clip.id);
        } else if (ev.state === 'PRESENT' && (ev.strategy === 'TRIM_LOCAL_ASSET' || (ev.strategy === 'TRIM_EXTERNAL_FILE' && ev.filePath))) {
            panelEl.innerHTML = '<span class="source-muted">素材在场，正在裁剪…</span>';
            const url = ev.strategy === 'TRIM_LOCAL_ASSET'
                ? `/api/clips/${clip.id}/material`
                : `/api/clips/${clip.id}/material/materialize-from-file?path=${encodeURIComponent(ev.filePath)}`;
            const resp = await fetch(url, { method: 'POST' });
            const result = await resp.json();
            if (!resp.ok) throw new Error(result.message || `HTTP ${resp.status}`);
            await renderClipDetail(clip.id);
        } else {
            renderClipSourcePanel(clip, ev);
            showToast(ev.message || '无可用本地素材源，可回退浏览器录制或先显式缓存该集', 4000);
        }
    } catch (e) {
        renderClipSourcePanel(clip, null);
        showToast('素材准备失败：' + e.message, 4000);
    }
}

/** v0.24 M3：本地回顾播放——blob 弹窗播放素材源，并 seek 到片段起点（本地精确回顾）。
 *  v0.30：弹窗内可直接剪——标起点/终点取当前播放位置 + 标签/备注。
 *  ctx = {mode:'update', clipId, onSaved?} → 更新**本片段**（后端把弹窗内坐标换算回原视频坐标）+ 存为片段封面
 *      | {mode:'create', episodeId, onSaved?} → 落成新片段 + 存为集封面；无 ctx 则不给剪辑行。 */
function openLocalVideoPlayer(blob, clip, ctx) {
    const isUpdate = !!(ctx && ctx.mode === 'update' && ctx.clipId);
    const cutCtx = isUpdate || (ctx && ctx.episodeId) ? ctx : null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay player-overlay';
    overlay.style.zIndex = '1000';
    const srcName = (clip.title || '片段').replace(/[\\/:*?"<>|]/g, '_');
    const range = `${fmtTime(clip.timestampSec)}${clip.endSec != null ? ' – ' + fmtTime(clip.endSec) : ''}`;
    overlay.innerHTML = `
        <div class="player-sheet">
            <div class="player-top">
                <div class="player-title"><span class="player-badge">${clip.materialState === 'READY' && clip.videoAssetId != null ? '产物' : '整集'}</span><h2>${esc(clip.title || '片段')}</h2></div>
                <div class="player-top-side">
                    <span class="player-range">${esc(range)}${clip.tag ? ` · ${esc(clip.tag)}` : ''}</span>
                    <button type="button" class="btn-mini danger modal-close">✕</button>
                </div>
            </div>
            <div class="player-stage"><video controls autoplay playsinline></video></div>
            ${cutCtx ? `<div class="player-cut">
                <button type="button" class="btn-mini" data-cut-start title="用当前播放位置作为起点">⟦ 起点</button>
                <button type="button" class="btn-mini" data-cut-end title="用当前播放位置作为终点（可留空=单点）">终点 ⟧</button>
                <span class="player-cut-range"></span>
                <input class="player-cut-tag" placeholder="标签（必填）" maxlength="100" autocomplete="off">
                <input class="player-cut-note" placeholder="备注（可选）" maxlength="2000" autocomplete="off">
                <button type="button" class="btn-primary" data-cut-save>💾 ${isUpdate ? '更新本片段' : '保存片段'}</button>
                <button type="button" class="btn-mini" data-cut-cover title="把当前暂停画面存为封面">🖼 ${isUpdate ? '存为封面' : '存为集封面'}</button>
            </div>` : ''}
            <div class="player-bar">
                <button type="button" class="btn-mini" data-cap-frame>📷 存当前帧</button>
                <span class="player-status"></span>
                <span class="player-hint">暂停到目标画面后点「存当前帧」，保存 PNG 截图</span>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const url = URL.createObjectURL(blob);
    const video = overlay.querySelector('video');
    const statusEl = overlay.querySelector('.player-status');
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
        if (video.duration) {
            if (clip.materialState === 'READY' && clip.videoAssetId != null) {
                // 已物化：blob 是产物文件（本体即片段），从头播，无需 seek
                video.currentTime = 0;
            } else if (clip.timestampSec != null) {
                // 未物化：blob 是源整集，seek 到源视频坐标
                video.currentTime = Math.max(0, Math.min(clip.timestampSec, video.duration - 0.1));
            }
        }
    });
    // 截图辅助：确保有可绘制帧
    async function ensureFrame(t) {
        return new Promise((resolve) => {
            if (video.readyState >= 2) { resolve(); return; }
            const h = () => { video.removeEventListener('seeked', h); resolve(); };
            video.addEventListener('seeked', h);
            try { video.currentTime = Math.min(t, (video.duration || 0) - 0.05); } catch (e) { resolve(); }
        });
    }
    function drawToCanvas() {
        const w = video.videoWidth || 1280, h = video.videoHeight || 720;
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(video, 0, 0, w, h);
        return cv;
    }
    function downloadCanvas(cv, label) {
        const a = document.createElement('a');
        a.href = cv.toDataURL('image/png');
        a.download = `${srcName}@${label}.png`;
        a.click();
    }
    function fmtStamp(t) {
        const s = Math.max(0, Math.floor(t));
        return `${String(Math.floor(s / 60)).padStart(2, '0')}m${String(s % 60).padStart(2, '0')}s`;
    }
    overlay.querySelector('[data-cap-frame]').onclick = async () => {
        video.pause();
        await ensureFrame(video.currentTime);
        try {
            downloadCanvas(drawToCanvas(), fmtStamp(video.currentTime));
            statusEl.textContent = `已保存 ${fmtStamp(video.currentTime)} 帧`;
        } catch (e) { statusEl.textContent = '截图失败（请稍候再试）'; }
    };
    // 剪辑行：起点/终点取当前播放位置 → 保存（update=更新本片段 / create=落成新片段）
    if (cutCtx) {
        const row = overlay.querySelector('.player-cut');
        const rangeEl = row.querySelector('.player-cut-range');
        const tagEl = row.querySelector('.player-cut-tag');
        const noteEl = row.querySelector('.player-cut-note');
        const saveBtn = row.querySelector('[data-cut-save]');
        const coverBtn = row.querySelector('[data-cut-cover]');
        let markStart = null, markEnd = null;
        if (isUpdate) {   // 预填本片段现有标签/备注
            tagEl.value = clip.tag || '';
            noteEl.value = clip.note || '';
        }
        const fmtMs = ms => ms == null ? '—' : fmtStamp(ms / 1000);
        const renderMarks = () => {
            rangeEl.textContent = markStart == null ? '未标记起点'
                : `${fmtMs(markStart)} → ${markEnd == null ? '（未标终点）' : fmtMs(markEnd)}`;
            rangeEl.classList.toggle('set', markStart != null);
        };
        row.querySelector('[data-cut-start]').onclick = () => {
            markStart = Math.round(video.currentTime * 1000);
            if (markEnd != null && markEnd <= markStart) markEnd = null;
            renderMarks();
        };
        row.querySelector('[data-cut-end]').onclick = () => {
            markEnd = Math.round(video.currentTime * 1000);
            renderMarks();
        };
        saveBtn.onclick = async () => {
            if (markStart == null) { statusEl.textContent = '先播到起点，点「⟦ 起点」'; return; }
            const tag = tagEl.value.trim();
            if (!tag) { statusEl.textContent = '标签必填'; tagEl.focus(); return; }
            const pickedTag = await resolveTagId(tagEl);
            if (!pickedTag) { statusEl.textContent = ''; return; }
            saveBtn.disabled = true;
            statusEl.textContent = isUpdate ? '更新本片段中…' : '保存片段中…';
            try {
                const resp = isUpdate
                    ? await fetch(`/api/clips/${cutCtx.clipId}/playback-range`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ startMs: markStart, endMs: markEnd, tagIds: [pickedTag.id], note: noteEl.value.trim() })
                    })
                    : await fetch(`/api/episodes/${cutCtx.episodeId}/clips`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ startMs: markStart, endMs: markEnd, tagIds: [pickedTag.id], note: noteEl.value.trim() })
                    });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
                // update 分支返回的是原视频坐标（已换算），直接展示
                const saved = isUpdate && data.startMs != null ? data : null;
                const rangeText = saved
                    ? `${fmtMs(saved.startMs)}${saved.endMs == null ? '' : ' → ' + fmtMs(saved.endMs)}（原视频）`
                    : `${fmtMs(markStart)}${markEnd == null ? '' : ' → ' + fmtMs(markEnd)}`;
                statusEl.textContent = isUpdate ? `✓ 已更新本片段：${rangeText}` : `✓ 已保存片段 #${data.id}：${rangeText}`;
                showToast(isUpdate ? '✓ 本片段已更新' : '✓ 片段已保存');
                markStart = null; markEnd = null;
                if (!isUpdate) { tagEl.value = ''; noteEl.value = ''; }
                renderMarks();
                if (typeof cutCtx.onSaved === 'function') cutCtx.onSaved();
            } catch (e) {
                statusEl.textContent = (isUpdate ? '更新失败：' : '保存失败：') + e.message;
            } finally { saveBtn.disabled = false; }
        };
        if (coverBtn) coverBtn.onclick = async () => {
            video.pause();
            await ensureFrame(video.currentTime);
            statusEl.textContent = '封面保存中…';
            try {
                const canvas = drawToCanvas();
                let resp;
                if (isUpdate) {
                    // 片段封面：接口收 base64 data URL（同时写缩略图 + 详情大图）
                    resp = await fetch(`/api/clips/${cutCtx.clipId}/cover`, {
                        method: 'POST', headers: { 'Content-Type': 'text/plain' },
                        body: canvas.toDataURL('image/png')
                    });
                } else {
                    // 集封面：接口收 multipart 文件
                    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
                    const form = new FormData();
                    form.append('file', blob, `episode-${cutCtx.episodeId}.png`);
                    resp = await fetch(`/api/episodes/${cutCtx.episodeId}/cover`, { method: 'POST', body: form });
                }
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                statusEl.textContent = `✓ 已把 ${fmtStamp(video.currentTime)} 这一帧存为${isUpdate ? '封面' : '集封面'}`;
                showToast(isUpdate ? '✓ 封面已更新' : '✓ 集封面已更新');
                if (typeof cutCtx.onSaved === 'function') cutCtx.onSaved();
            } catch (e) { statusEl.textContent = '封面保存失败：' + e.message; }
        };
        renderMarks();
    }
    overlay.querySelector('.modal-close').onclick = () => {
        URL.revokeObjectURL(url);
        video.pause();
        overlay.remove();
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { URL.revokeObjectURL(url); video.pause(); overlay.remove(); } });
}

async function bindClipExportActions(clip) {
    if (!clipExportVideoBtn || !clipExportFrameBtn || !clipExportSequenceBtn || !clipExportStatusEl) return;
    clipExportStatusEl.textContent = '';
    setClipExportButtons(false);
    clipRecordBrowserBtn.hidden = true;
    clipExportVideoBtn.onclick = () => startClipExport(clip.id, 'video');
    clipExportFrameBtn.onclick = () => startClipExport(clip.id, 'frame');
    clipExportSequenceBtn.onclick = () => openSequenceExport(clip);
    clipRecordBrowserBtn.onclick = () => openBrowserRecording(clip);
    try {
        const resp = await fetch(`/api/clips/${clip.id}/exports`);
        if (!resp.ok) return;
        const artifacts = await resp.json();
        if (artifacts.length) {
            clipExportStatusEl.innerHTML = artifacts.map(a => {
                const name = a.type === 'video' ? '本地视频' : a.type === 'browser-video' ? '浏览器 WEBM'
                    : a.type === 'sequence-frame' ? `连续截图 ${a.count} 张` : '单帧截图';
                return `<a class="nav-link" href="${esc(a.url)}" target="_blank" rel="noopener">${name}（${Math.ceil(a.size / 1024)} KB）</a>`;
            }).join(' · ');
        }
    } catch (e) { }
}

function setClipExportButtons(disabled) {
    clipExportVideoBtn.disabled = disabled;
    clipExportFrameBtn.disabled = disabled;
    clipExportSequenceBtn.disabled = disabled;
}

function openSequenceExport(clip) {
    if (clip.endSec == null || clip.endSec <= clip.timestampSec) {
        showToast('连续截图需要先填写结束时间');
        return;
    }
    clipSequenceModal.hidden = false;
    const updateEstimate = () => {
        const interval = Number(clipSequenceIntervalEl.value);
        const count = Math.ceil((clip.endSec - clip.timestampSec) / interval);
        clipSequenceEstimateEl.textContent = count > 300
            ? `预计 ${count} 张，超过 300 张限制，请增大间隔或缩短区间` : `预计生成 ${count} 张（最多 300 张）`;
        document.getElementById('clip-sequence-start').disabled = count > 300;
    };
    clipSequenceIntervalEl.onchange = updateEstimate;
    document.getElementById('clip-sequence-cancel').onclick = () => { clipSequenceModal.hidden = true; };
    document.getElementById('clip-sequence-start').onclick = async () => {
        clipSequenceModal.hidden = true;
        await startClipExport(clip.id, 'sequence', Number(clipSequenceIntervalEl.value));
    };
    updateEstimate();
}

async function startClipExport(id, kind, intervalSec = null) {
    clipExportStatusEl.textContent = '任务提交中…';
    setClipExportButtons(true);
    try {
        const endpoint = kind === 'video' ? `/api/clips/${id}/export-video`
            : kind === 'sequence' ? `/api/clips/${id}/export-sequence` : `/api/clips/${id}/export-images`;
        const body = kind === 'frame' ? { strategy: 'middle' }
            : kind === 'sequence' ? { intervalSec } : null;
        const resp = await fetch(endpoint, {
            method: 'POST', headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || '任务提交失败');
        clipExportTaskId = data.id;
        await pollClipExport(data.id, id);
    } catch (e) {
        const fallback = kind === 'video' && currentClip ? '，可尝试浏览器录制回退' : '';
        clipExportStatusEl.textContent = `导出失败：${e.message}${fallback}`;
        if (kind === 'video' && currentClip && /找不到|冲突|指纹|源视频/.test(e.message || '')) {
            clipRecordBrowserBtn.hidden = false;
        }
        setClipExportButtons(false);
    }
}

async function pollClipExport(taskId, clipId) {
    for (let i = 0; i < 720; i++) {
        const resp = await fetch(`/api/clips/export-tasks/${taskId}`);
        const task = await resp.json();
        if (task.status === 'SUCCEEDED') {
            clipExportStatusEl.innerHTML = `<a class="nav-link" href="${esc(task.artifactUrl)}" target="_blank" rel="noopener">导出完成：打开产物</a>`;
            clipExportTaskId = null;
            setClipExportButtons(false);
            bindClipExportActions(currentClip || { id: clipId });
            return;
        }
        if (task.status === 'FAILED' || task.status === 'CANCELLED') {
            throw new Error(task.message || '任务未完成');
        }
        const progress = task.total > 0 ? ` ${task.progress || 0}/${task.total}` : '';
        clipExportStatusEl.innerHTML = `${esc(task.phase || (task.status === 'RUNNING' ? '导出处理中' : '任务排队中'))}${progress} <button type="button" class="btn-mini" id="clip-export-cancel">取消</button>`;
        document.getElementById('clip-export-cancel').onclick = async () => {
            await fetch(`/api/clips/export-tasks/${taskId}/cancel`, { method: 'POST' });
        };
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('任务查询超时');
}

function openBrowserRecording(clip) {
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
        showToast('当前浏览器不支持屏幕录制，请使用 Chromium 浏览器');
        return;
    }
    clipRecordState = { clip, stream: null, recorder: null, chunks: [], blob: null, timer: null, manualStop: !clip.endSec };
    clipRecordModal.hidden = false;
    clipRecordPreviewEl.hidden = true;
    clipRecordPreviewEl.removeAttribute('src');
    const startBtn = document.getElementById('clip-record-start');
    const stopBtn = document.getElementById('clip-record-stop');
    const retryBtn = document.getElementById('clip-record-retry');
    const uploadBtn = document.getElementById('clip-record-upload');
    startBtn.hidden = false;
    stopBtn.hidden = true;
    retryBtn.hidden = true;
    uploadBtn.hidden = true;
    clipRecordStatusEl.textContent = clip.endSec != null
        ? `将录制约 ${Math.max(0, clip.endSec - clip.timestampSec).toFixed(1)} 秒；请先在原视频中定位到开始时间。`
        : '此片段没有结束时间，录制开始后请手动点击“停止录制”。';
    startBtn.onclick = startBrowserRecording;
    stopBtn.onclick = () => stopBrowserRecording(true);
    retryBtn.onclick = () => openBrowserRecording(clip);
    uploadBtn.onclick = uploadBrowserRecording;
    document.getElementById('clip-record-cancel').onclick = closeBrowserRecording;
    document.getElementById('clip-record-open-source').onclick = () => jump(clip);
}

async function startBrowserRecording() {
    const state = clipRecordState;
    if (!state) return;
    const startBtn = document.getElementById('clip-record-start');
    startBtn.disabled = true;
    try {
        clipRecordStatusEl.textContent = '请在授权框中选择原视频标签页或窗口…';
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true });
        state.stream = stream;
        const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
            .find(type => MediaRecorder.isTypeSupported(type));
        if (!mimeType) throw new Error('浏览器不支持 WebM 录制');
        clipRecordStatusEl.textContent = '3 秒后开始录制，请切回原视频并保持播放…';
        await new Promise(resolve => setTimeout(resolve, 1000));
        clipRecordStatusEl.textContent = '2 秒后开始录制…';
        await new Promise(resolve => setTimeout(resolve, 1000));
        clipRecordStatusEl.textContent = '1 秒后开始录制…';
        await new Promise(resolve => setTimeout(resolve, 1000));
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
        state.recorder = recorder;
        state.chunks = [];
        recorder.ondataavailable = event => { if (event.data.size > 0) state.chunks.push(event.data); };
        recorder.onstop = finishBrowserRecording;
        recorder.onerror = () => { clipRecordStatusEl.textContent = '录制器发生错误，可重新录制'; };
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
            if (recorder.state !== 'inactive') stopBrowserRecording(false);
        }, { once: true });
        recorder.start(1000);
        document.getElementById('clip-record-stop').hidden = false;
        startBtn.hidden = true;
        const duration = state.clip.endSec != null ? state.clip.endSec - state.clip.timestampSec : null;
        clipRecordStatusEl.textContent = duration != null ? `正在录制，约 ${duration.toFixed(1)} 秒后自动停止…` : '正在录制，请在片段结束时手动停止。';
        if (duration != null && duration > 0) state.timer = setTimeout(() => stopBrowserRecording(false), duration * 1000);
    } catch (e) {
        closeRecordingStream(state);
        clipRecordStatusEl.textContent = e.name === 'NotAllowedError' ? '未授予录制权限，可再次授权或关闭。' : `无法开始录制：${e.message}`;
        startBtn.disabled = false;
    }
}

function stopBrowserRecording(manual) {
    const state = clipRecordState;
    if (!state?.recorder || state.recorder.state === 'inactive') return;
    state.manualStop = manual || state.clip.endSec == null;
    clearTimeout(state.timer);
    document.getElementById('clip-record-stop').disabled = true;
    clipRecordStatusEl.textContent = '正在整理录制文件…';
    state.recorder.stop();
}

function finishBrowserRecording() {
    const state = clipRecordState;
    if (!state) return;
    closeRecordingStream(state);
    const mime = state.recorder?.mimeType || 'video/webm';
    state.blob = new Blob(state.chunks, { type: mime });
    if (state.blob.size === 0) {
        clipRecordStatusEl.textContent = '录制结果为空，可重新录制。';
        document.getElementById('clip-record-retry').hidden = false;
        return;
    }
    clipRecordPreviewEl.src = URL.createObjectURL(state.blob);
    clipRecordPreviewEl.hidden = false;
    clipRecordStatusEl.textContent = `录制完成（${Math.ceil(state.blob.size / 1024)} KB），请预览后上传或重新录制。`;
    document.getElementById('clip-record-retry').hidden = false;
    document.getElementById('clip-record-upload').hidden = false;
}

async function uploadBrowserRecording() {
    const state = clipRecordState;
    if (!state?.blob) return;
    const uploadBtn = document.getElementById('clip-record-upload');
    uploadBtn.disabled = true;
    clipRecordStatusEl.textContent = '正在上传 WEBM…';
    try {
        const form = new FormData();
        form.append('file', new File([state.blob], `clip-${state.clip.id}.webm`, { type: 'video/webm' }));
        form.append('manualStop', String(state.manualStop));
        const resp = await fetch(`/api/clips/${state.clip.id}/exports/video`, { method: 'POST', body: form });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || '上传失败');
        clipRecordStatusEl.textContent = '上传完成，正在刷新产物…';
        await bindClipExportActions(state.clip);
        closeBrowserRecording();
        showToast('浏览器录制已保存');
    } catch (e) {
        clipRecordStatusEl.textContent = `上传失败：${e.message}`;
        uploadBtn.disabled = false;
    }
}

function closeRecordingStream(state) {
    clearTimeout(state?.timer);
    state?.stream?.getTracks().forEach(track => track.stop());
    if (state) state.stream = null;
}

function closeBrowserRecording() {
    if (clipRecordPreviewEl.src?.startsWith('blob:')) URL.revokeObjectURL(clipRecordPreviewEl.src);
    closeRecordingStream(clipRecordState);
    clipRecordState = null;
    clipRecordModal.hidden = true;
}

async function renderClipTags(clip, mediaId) {
    clipDetailTagsEl.innerHTML = '';
    const names = (Array.isArray(clip.tagNames) && clip.tagNames.length)
        ? clip.tagNames
        : String(clip.tag || '').split(/[，,\s]+/).map(s => s.trim()).filter(Boolean);
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
        renderEpisodeProfile(ep, media);
        renderEpisodeDetailTags(ep);
        syncEpisodeAvailability(ep);

        const clipsResp = await fetch(`/api/episodes/${id}/clips`);
        if (clipsResp.ok) {
            const clips = await clipsResp.json();
            if (clips.length === 0) {
                episodeDetailClipsEl.innerHTML = '<div class="status">该集还没有片段标记，可以在播放工作台直接创建</div>';
            } else {
                for (const c of clips) appendClipCard(episodeDetailClipsEl, c, {});
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
    // hero 只保留封面/标题/备注；集号·片段数·标记时间·所属媒体统一收左栏档案卡（避免信息重复）
    episodeDetailHeadEl.innerHTML = `
        <div class="ad-cover">${cover}</div>
        <div class="ad-info">
            <h2 class="ad-title"></h2>
            <div id="episode-detail-note" class="detail-note" hidden></div>
        </div>`;
    episodeDetailHeadEl.querySelector('.ad-title').textContent = ep.title || '(未命名)';
}

// 集备注：Hero 卡内展示 + 点击内联编辑（保存走 PUT /api/episodes/{id}，仅改 note；变更后端入队重嵌）
function renderEpisodeNote(ep) {
    const el = document.getElementById('episode-detail-note');
    if (!el) return;
    el.hidden = false;
    el.classList.remove('editing');
    const note = (ep.note || '').trim();
    el.classList.toggle('empty', !note);
    el.innerHTML = '';
    const openEditor = () => {
        el.classList.add('editing');
        el.innerHTML = '';
        const ta = document.createElement('textarea');
        ta.className = 'note-edit-input';
        ta.rows = 3;
        ta.placeholder = '集备注（该集看点/重点），参与搜索；留空保存即清空';
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
            if (resp.ok) { loadEpisodeDetail(ep.id); }
            else { el.innerHTML = '<span class="note-err">保存失败</span>'; }
        });
    };
    const body = document.createElement('div');
    body.className = 'note-editable';
    body.tabIndex = 0;
    body.title = '点击编辑备注';
    body.setAttribute('role', 'button');
    const label = document.createElement('span');
    label.className = 'note-kicker';
    label.textContent = note ? '备注' : '备注（空）';
    const txt = document.createElement('span');
    txt.className = 'note-text';
    txt.textContent = note || '＋ 点击添加备注';
    body.append(label, txt);
    body.addEventListener('click', openEditor);
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(); } });
    el.appendChild(body);
}

/** 集详情左栏：档案信息展示卡（所属媒体/集数/片段/标记时间）。 */
function renderEpisodeProfile(ep, media) {
    const el = document.getElementById('episode-detail-profile');
    if (!el) return;
    const no = ep.episodeNo != null ? `第${ep.episodeNo}集` : '本集';
    const rows = [
        ['所属媒体', media ? media.title : '—', media ? 'link' : ''],
        ['集数', no, ''],
        ['片段', `${ep.clipCount || 0} 条`, ''],
        ['标记时间', ep.latestAt ? fmtDateTime(ep.latestAt) : '—', ''],
    ];
    el.innerHTML = rows.map(([l, v, c]) => `<div class="profile-row${c === 'link' ? ' link-row' : ''}"${c === 'link' ? ' data-open-media="1" title="点击进入媒体详情"' : ''}><span>${esc(l)}</span><span class="pv">${c === 'link' ? `<b class="m-link">${esc(v)}</b>` : `<b>${esc(v)}</b>`}</span></div>`).join('');
    const link = el.querySelector('[data-open-media]');
    if (link) link.addEventListener('click', () => { if (media) openMediaDetail(media.id); });
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
            const picked = await resolveTagId(input);
            if (!picked) return;
            input.value = '';
            await fetch(`/api/episodes/${ep.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagIds: [picked.id] })
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

function clipTimeLabel(r) {
    if (r.endSec != null && Number(r.endSec) > Number(r.timestampSec)) {
        return `${fmtTime(r.timestampSec)} – ${fmtTime(r.endSec)}`;
    }
    return fmtTime(r.timestampSec);
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
                <span class="badge-time">${clipTimeLabel(r)}</span>
                <span class="clip-light" data-clip="${r.id}"></span>
                <span class="card-tag"></span>
            </div>
            ${resultBadges(r)}
            ${scoreBar}
            <div class="card-ops">
                <button class="cmenu-btn" type="button" aria-label="更多操作" title="操作">⋯</button>
                <div class="cmenu">
                    <button class="cmenu-item" data-ca="similar" type="button">相似</button>
                    <button class="cmenu-item" data-ca="edit" type="button">编辑</button>
                    <button class="cmenu-item danger" data-ca="delete" type="button">删除</button>
                </div>
            </div>
        </div>`;
    card.querySelector('.card-title').innerHTML = hl(r.title, currentQuery);
    const tagNote = (r.tag || '') + (r.note ? ` · ${r.note}` : '');
    card.querySelector('.card-tag').innerHTML = hl(tagNote, currentQuery);
    const thumbEl = card.querySelector('.cc-thumb');
    if (thumbEl) bindHoverPreview(thumbEl, r.detailCoverPath || r.coverPath); // 悬浮展示详情大图
    // ⋯ 菜单开合：浮层定位到 body（不受列表容器 overflow 裁剪），自动判断向上/向下弹
    const cmenuBtn = card.querySelector('.cmenu-btn');
    if (cmenuBtn) cmenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openClipMenu(card);
    });
    const act = (fn) => (e) => { e.stopPropagation(); closeClipMenus(); fn(); };
    card.querySelector('[data-ca="similar"]').addEventListener('click', act(() => openSimilar(r)));
    card.querySelector('[data-ca="edit"]').addEventListener('click', act(() => openEditModal(r)));
    card.querySelector('[data-ca="delete"]').addEventListener('click', act(() => confirmDelete(r)));
    card.addEventListener('click', (e) => {
        if (e.target.closest('.cmenu, .cmenu-btn')) return;
        openClipDetail(r); // 点卡片主体进片段详情页
    });
    container.appendChild(card);
    enqueueClipLight(card);
}

/** 打开片段卡 ⋯ 菜单（浮层定位，自适应视口不裁剪；已在 body 后再次点击关闭）。 */
function openClipMenu(card) {
    const cmenu = card.querySelector('.cmenu');
    if (!cmenu) return;
    if (cmenu.classList.contains('open')) { closeClipMenus(); return; }
    closeClipMenus();
    const btn = card.querySelector('.cmenu-btn');
    if (!btn) return;
    if (cmenu.parentElement !== document.body) document.body.appendChild(cmenu);
    cmenu.classList.add('open');
    const rect = btn.getBoundingClientRect();
    const mw = cmenu.offsetWidth, mh = cmenu.offsetHeight;
    cmenu.style.position = 'fixed';
    let top = rect.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, rect.top - mh - 6);
    let left = Math.max(8, rect.right - mw);
    if (left + mw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - mw - 8);
    cmenu.style.top = top + 'px';
    cmenu.style.left = left + 'px';
}

/** 收起全部片段卡 ⋯ 菜单。 */
function closeClipMenus() {
    document.querySelectorAll('.cmenu.open').forEach(m => m.classList.remove('open'));
}

// 点卡片/菜单外收起；滚动/缩放时收起（fixed 定位菜单需重算）
document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && (e.target.closest('.cmenu') || e.target.closest('.cmenu-btn') || e.target.closest('.card'))) return;
    closeClipMenus();
});
window.addEventListener('scroll', closeClipMenus, { passive: true, capture: true });
window.addEventListener('resize', closeClipMenus);

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
    const mediaCover = mediaCoverSrc(r);
    const thumb = mediaCover
        ? `<div class="cc-thumb"><img src="${esc(mediaCover)}" alt="" loading="lazy" ${mediaCoverAttrs(r)}></div>`
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
    if (thumbEl) bindHoverPreview(thumbEl, mediaCover); // 媒体悬浮看封面大图
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
        marker.title = `${clipTimeLabel(c)} · ${c.tag}`;
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
    // v0.31：标签改成受控词表（名字 → tagId），多标签在这里只编辑第一个（不改时保存会原样保留全部）
    const names = Array.isArray(r.tagNames) && r.tagNames.length
        ? r.tagNames
        : String(r.tag || '').split(/\s+/).filter(Boolean);
    editTag.value = names.join(' ');
    editNote.value = r.note || '';
    editTime.value = toClockText(r.timestampSec);
    editEndTime.value = r.endSec != null ? toClockText(r.endSec) : '';
    editModal.hidden = false;
    editTitle.focus();
}

/** 秒 → 分:秒[.十分位]（超 1 小时自动带小时前缀）。 */
function toClockText(sec) {
    if (sec == null || !Number.isFinite(sec)) return '';
    const tenth = Math.round(sec * 10);          // 保留 0.1s 精度
    const h = Math.floor(tenth / 36000);
    const m = Math.floor((tenth % 36000) / 600);
    const s = Math.floor((tenth % 600) / 10);
    const d = tenth % 10;
    const core = (h > 0 ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
    return core + (d !== 0 ? '.' + d : '');
}

/** 解析分:秒文本 → 秒；支持 [时:]分:秒[.十分位]；纯数字按秒兼容；空/null → null；非法 → NaN。 */
function parseClockText(text) {
    if (text == null) return null;
    const s = String(text).trim();
    if (s === '') return null;
    if (/^\d+(\.\d+)?$/.test(s)) return Number(s);            // 纯秒兼容
    const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d))?$/);
    if (!m) return NaN;
    const h = m[1] ? Number(m[1]) : 0;
    const mm = Number(m[2]);
    const ss = Number(m[3]);
    if (mm > 59 || ss > 59) return NaN;
    return h * 3600 + mm * 60 + ss + (m[4] ? Number(m[4]) / 10 : 0);
}

async function saveEdit() {
    if (!editingClip) return;
    const timestampSec = parseClockText(editTime.value);
    const endSec = editEndTime.value.trim() === '' ? null : parseClockText(editEndTime.value);
    const payload = {
        title: editTitle.value.trim() || editingClip.title,
        url: editingClip.url,
        timestampSec,
        endSec,
        tag: editTag.value.trim(),
        note: editNote.value.trim()
    };
    if (!Number.isFinite(timestampSec) || timestampSec < 0 ||
        (endSec != null && (!Number.isFinite(endSec) || endSec <= timestampSec)) || !payload.tag) {
        statusEl.textContent = '保存失败：时间戳（分:秒）或标签不合法';
        return;
    }
    // v0.31 受控词表：名字 → tagId（不存在则询问「新建并打上」）
    // 名字没改（仍是原来的多个标签拼串）→ 原样保留原 tagIds，避免多标签被压缩成一个
    const originalNames = Array.isArray(editingClip.tagNames) && editingClip.tagNames.length
        ? editingClip.tagNames
        : String(editingClip.tag || '').split(/\s+/).filter(Boolean);
    let pickedTag = null;
    if (editTag.value.trim() === originalNames.join(' ') && Array.isArray(editingClip.tagIds)) {
        delete payload.tag;
        payload.tagIds = editingClip.tagIds;
    } else {
        pickedTag = await resolveTagId(editTag);
        if (!pickedTag) {
            statusEl.textContent = '';
            return;
        }
        delete payload.tag;
        payload.tagIds = [pickedTag.id];
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

/**
 * 媒体封面取值链（用户 2026-09-20 定稿）：**Bangumi 外链 → 显式封面 → 代表片段帧兑底**。
 *
 * 所有"媒体封面"展示位（卡片/列表行/搜索卡/回收站/详情/工作台）都走这里，
 * 别再各写各的顺序 —— 之前列表写成 `coverPath || fallbackCoverPath || externalCoverUrl`，
 * 片段帧排在 Bangumi 前面，于是"片段有封面后媒体列表就显示片段封面"。
 */
/** 封面取值链（本应用统一）：**本地显式封面 → Bangumi 封面 → 代表片段帧**。
 *
 * 2026-09-25 用户拍板反转：以前是 Bangumi 在前。现在「手动上传的封面以本地为准」，
 * 而自动下载的本地封面在对账时会被清掉，所以两级实际上不会打架。
 * ⚠️ 新增封面展示位请走这条链，别写 `externalCoverUrl || coverPath || ...`。 */
function mediaCoverSources(m) {
    return [m && m.coverPath, m && m.externalCoverUrl, m && m.fallbackCoverPath].filter(Boolean);
}

function mediaCoverSrc(m) {
    return mediaCoverSources(m)[0] || '';
}

/** <img> 的降级属性：本地挂了 → 换 Bangumi 封面 → 再挂换片段帧 → 都没有则移除元素。 */
function mediaCoverAttrs(m) {
    const chain = mediaCoverSources(m);
    if (chain.length < 2) return `onerror="this.remove()"`;
    return `data-cover-chain="${esc(chain.join('|'))}" onerror="var c=this.dataset.coverChain.split('|');var i=+(this.dataset.i||0)+1;if(i<c.length){this.dataset.i=i;this.src=c[i];}else{this.remove();}"`;
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
/**
 * 媒体列表请求序号：**后发的请求赢**。
 *
 * 为什么需要（2026-10-02 用户报「从标签点媒体跳转失败」）：跳转 = `showView('media')`（先发一笔**未筛选**请求）
 * + 紧接着 `loadMedia()`（再发一笔筛选后请求）。两笔并发且**没有序号保护** → 谁后返回谁写网格。
 * 实测：未筛选那笔 344ms、筛选后那笔 40ms → 轻的先画 19 张，重的后到直接盖成未筛24 张，
 * 于是 chip 写着「标签 性转」、网格却是全库。同一道理也修掉「连点几个筛选条件」的乱序覆盖。
 */
let mediaLoadSeq = 0;

async function loadMedia(resetPage = true) {
    if (resetPage) mediaPage = 1;
    mediaStatusEl.textContent = '加载中…';
    const seq = ++mediaLoadSeq;
    let url = '';
    let countUrl = '';
    try {
        const built = buildMediaUrls();
        url = built.url;
        countUrl = built.countUrl;
        const [listResp, countResp] = await Promise.all([fetch(url), fetch(countUrl)]);
        // 已被更新的请求取代 → 整笔丢弃（包括后面的 mediaPage / DOM / 状态文案，一个字也不许写）
        if (seq !== mediaLoadSeq) return;
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
            // 有筛选条件时不要把“筛出来 0 条”说成“你还没打过标记”（2026-10-02 用户报筛选结果为空时被误导）
            const hasFilter = !!(mediaFilter.q || mediaFilter.format
                || mediaFilter.subcategoryId || mediaFilter.unconfirmed
                || MEDIA_DIMS.some(d => (mediaFilter[d.key] || []).length));
            mediaStatusEl.textContent = hasFilter
                ? '没有符合筛选条件的媒体（可以清掉筛选或换个标签再看看）'
                : mediaMode === 'recent' && mediaTotal === 0
                    ? '还没有打过标记的媒体，去看片按 Alt+S 打一个' : '没有符合条件的媒体';
        } else {
            mediaStatusEl.textContent = '';
        }
    } catch (err) {
        // 已被取代的旧请求报错也一律丢掉：否则旧请求的失败会盖掉新请求已经画好的结果
        if (seq !== mediaLoadSeq) return;
        // 以前这里一律写「后端未响应」→ 客户端的 JS 异常也被说成后端没响应，误导排查（2026-10-02 用户报筛选失败，查了两轮才发现这句话在撝）。
        // 现在：只有真的是 fetch 网络失败才说"后端未响应"，其余把**原始报错**写出来。
        const msg = String((err && err.message) || err || '未知错误');
        if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(msg)) {
            mediaStatusEl.textContent = `加载失败：后端未响应（${msg}）`;
        } else {
            mediaStatusEl.textContent = `加载失败：${msg}`;
        }
        if (window.console) console.error('[loadMedia]', url, err);
    }
}

/* ═══ 媒体页筛选（2026-09-25 用户拍板）╔══════════════════════════════════════════
   语言对齐推荐编辑器的候选库筛选（remotion/editor/panes.tsx 的 FilterPopover）：
   主行只留高频（搜索）+ 一个 ⚙ 筛选按钮；已选条件变成可单个 × 掉的 chips；
   点 ⚙ 开浮层：左栏维度、右栏取值，取值点选**即时生效**且面板不关（可连加条件）。
   维度之间 AND；「题材」是多选，同维度内 OR（JSON_OVERLAPS）。

   已删的旧控件（用户 2026-09-25：「删掉，先保留状态」）：
   - 「待确认」：confirmed 全库 5255 条全是 1，筛了恒为 0 —— 死选项；
   - 「子分类」：5254/5255 是 null —— 死选项。 */

const MEDIA_DIMS = [
    { key: 'genres', label: '题材' },
    { key: 'year', label: '年份' },
    { key: 'season', label: '季度' },
    { key: 'status', label: '状态' },
    { key: 'collectionId', label: '收藏夹' },
    { key: 'tagIds', label: '标签' },
];

/** 季度：唯一真值 = external_work.season，与同步弹窗的段标签同口径（冬=1–3月）。 */
const SEASON_OPTIONS = [
    { value: 'WINTER', label: '冬（1–3月）' },
    { value: 'SPRING', label: '春（4–6月）' },
    { value: 'SUMMER', label: '夏（7–9月）' },
    { value: 'FALL', label: '秋（10–12月）' },
];

/** 状态字典唯一真值 = 后端 MediaService.STATUSES；中文沿用媒体详情页。 */
const MEDIA_STATUS_OPTIONS = [
    { value: 'WANT', label: '想看' },
    { value: 'WATCHING', label: '在看' },
    { value: 'DONE', label: '看完' },
    { value: 'PAUSED', label: '搁置' },
    { value: 'DROPPED', label: '弃番' },
];

/** 浮层选项字典：全部数据驱动（只列库里真有的），空数组 = 该维度暂无可选项。 */
const mediaFilterDict = { years: [], genres: [], tags: [], collections: [] };

/**
 * 常驻题材（2026-10-02 用户拍板）：手动往题材选项里加的词，**只存本机 localStorage，后端零参与**。
 *
 * <p>为什么前端就够了：查询侧不校验白名单（白名单只用于生成选项列表，见 docs/rules.md §19），
 * 常驻词直接进 `mediaFilter.genres` 就能筛。唯一要求是**字面量必须与库内 `genres_json`
 * 里的写法完全一致**，否则筛出 0 条 —— 所以添加时用 `/api/media/count` 探一次拦掉死选项。
 *
 * <p>代价（已知且接受）：只在这台浏览器常驻，换机/换浏览器/清缓存就没了。
 */
const CUSTOM_GENRES_KEY = 'vt-media-genres';
const customGenreCounts = {};   // 运行时探到的媒体数，不落盘；刷新后由 fillMediaFilterDict 重探

function customGenres() {
    try {
        const v = JSON.parse(localStorage.getItem(CUSTOM_GENRES_KEY) || '[]');
        return Array.isArray(v) ? v.filter(s => typeof s === 'string' && s.trim()) : [];
    } catch (e) { return []; }
}

function saveCustomGenres(list) {
    const uniq = [...new Set(list.map(s => String(s).trim()).filter(Boolean))];
    localStorage.setItem(CUSTOM_GENRES_KEY, JSON.stringify(uniq));
    return uniq;
}

/** 探一个题材词在库里的媒体数：>0 = 有效；0 = 库里没这个词；null = 请求失败（不拦，当成“未知”）。 */
async function probeGenreCount(word) {
    try {
        const r = await fetch(`/api/media/count?genres=${encodeURIComponent(word)}`);
        if (!r.ok) return null;
        const n = await r.json();
        return typeof n === 'number' ? n : null;
    } catch (e) { return null; }
}

/** 添加常驻题材。库里查不到的词不收（防手滑打成 0 结果的死选项）。返回 { ok, msg }。 */
async function addCustomGenre(word) {
    const w = String(word || '').trim();
    if (!w) return { ok: false, msg: '' };
    if (customGenres().includes(w)) return { ok: false, msg: '已经是常驻了' };
    if (mediaFilterDict.genres.some(g => g.genre === w)) return { ok: false, msg: '列表里已经有这个词了' };
    const n = await probeGenreCount(w);
    if (n === 0) return { ok: false, msg: '库里没有这个题材（0 部），没添加' };
    if (n != null) customGenreCounts[w] = n;
    saveCustomGenres([...customGenres(), w]);
    return { ok: true, msg: n == null ? '已常驻（媒体数未知）' : `已常驻（${n} 部）` };
}

/* 维度取值基数（v0.32）：六个维度**全部多选**（值是数组）。
   true = 同维度内「全部匹配 / 任一匹配」都成立 → 给开关；
   false = 单值列（`media.year`／`media.status`；季度实测每部媒体只有 1 条外部条目）→ 只「任一匹配」。
   ⚠ 不给单值维度「且」不是漏改：选 2 个年份取交恒为空集（详见 `docs/worklog`）。 */
const DIM_MODE_CAPABLE = { genres: true, tagIds: true, collectionId: true };
const isModeDim = (key) => !!DIM_MODE_CAPABLE[key];

function dimActive(key) {
    return (mediaFilter[key] || []).length > 0;
}

/** 某维度的取值列表（带媒体数，方便判断哪个条件划得来）。 */
function dimValues(key) {
    let list;
    switch (key) {
        case 'genres': {
            // 常驻词排最前（它们没有稳定的计数可参与降序），后端字典里的同名词去重
            const custom = customGenres();
            list = [
                ...custom.map(g => ({ value: g, label: g, count: customGenreCounts[g], custom: true })),
                ...mediaFilterDict.genres.filter(g => !custom.includes(g.genre))
                    .map(g => ({ value: g.genre, label: g.genre, count: g.count })),
            ];
            break;
        }
        case 'year':
            list = mediaFilterDict.years.map(y => ({ value: String(y), label: `${y} 年` }));
            break;
        case 'season': list = SEASON_OPTIONS; break;
        case 'status': list = MEDIA_STATUS_OPTIONS; break;
        case 'collectionId':
            list = mediaFilterDict.collections.map(c => ({ value: String(c.id), label: c.name, count: c.mediaCount }));
            break;
        case 'tagIds':
            list = mediaFilterDict.tags.map(t => ({ value: String(t.tagId), label: t.name, count: t.count }));
            break;
        default: list = [];
    }
    return list;
}

/** 维度当前值的中文展示（chip 与浮层左栏共用）；连接词跟模式走，别让用户猜。 */
function dimLabel(key) {
    const names = (mediaFilter[key] || []).map(v => {
        const hit = dimValues(key).find(o => String(o.value) === String(v));
        return hit ? hit.label : v;
    });
    const or = !isModeDim(key) || (mediaFilter.mode[key] || 'OR') === 'OR';
    return names.join(or ? ' 或 ' : ' 且 ');
}

/** 已选条件 chips；返回激活的条件数（题材多选按个数算）。 */
function renderFilterChips() {
    filterChipsEl.innerHTML = '';
    let n = 0;
    for (const d of MEDIA_DIMS) {
        if (!dimActive(d.key)) continue;
        n += (mediaFilter[d.key] || []).length;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'filter-chip';
        chip.title = `移除「${d.label}」条件`;
        const text = document.createElement('span');
        text.textContent = `${d.label} ${dimLabel(d.key)}`;
        const x = document.createElement('span');
        x.className = 'fc-x';
        x.textContent = '×';
        chip.append(text, x);
        chip.addEventListener('click', () => setDim(d.key, null));
        filterChipsEl.appendChild(chip);
    }
    filterCountEl.hidden = n === 0;
    filterCountEl.textContent = String(n);
    filterClearEl.hidden = n === 0;
    filterOpenBtn.classList.toggle('active', n > 0);
    return n;
}

/** 写一个维度的取值并立刻重查（value=null → 清掉该维度；否则在数组里 toggle）。 */
function setDim(key, value) {
    const cur = mediaFilter[key] || [];
    if (value == null) mediaFilter[key] = [];
    else mediaFilter[key] = cur.includes(value) ? cur.filter(g => g !== value) : [...cur, value];
    renderFilterChips();
    renderFilterPop();
    loadMedia();
}

let filterPopDim = 'genres';
let filterDictAt = 0;   // 选项字典上次刷新时间（防止反复开关面板时白拉）

function openFilterPop() {
    renderFilterPop();
    filterPopEl.hidden = false;
    filterOpenBtn.setAttribute('aria-expanded', 'true');
    // 选项字典改成「**每次打开面板都刷新**」（启动时那一次 + 这里）：
    // 否则刚打上的标签 / 刚建的收藏夹在面板里根本看不到（2026-10-02 用户报「筛选我已经添加过标签了，没有显示」）。
    // 3 秒内不重复拉（反复开关面板时不白请求）。
    if (Date.now() - filterDictAt > 3000) {
        filterDictAt = Date.now();
        fillMediaFilterDict().catch(() => { /* 失败保留旧字典，不阻断筛选 */ });
    }
}

function closeFilterPop() {
    filterPopEl.hidden = true;
    filterOpenBtn.setAttribute('aria-expanded', 'false');
}

/** 浮层两栏：左维度（带当前值与激活态）→ 右取值。两栏常驻，不做窄屏的「返回」二级页。 */
function renderFilterPop() {
    const dimsHost = document.getElementById('fp-dims');
    dimsHost.innerHTML = '';
    for (const d of MEDIA_DIMS) {
        const active = dimActive(d.key);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = active ? 'on' : '';
        const name = document.createElement('span');
        name.textContent = d.label;
        b.appendChild(name);
        if (active) {
            const val = document.createElement('span');
            val.className = 'fd-val';
            val.textContent = dimLabel(d.key);
            b.appendChild(val);
        }
        b.addEventListener('click', () => { filterPopDim = d.key; renderFilterPop(); });
        dimsHost.appendChild(b);
    }

    const valHost = document.getElementById('fp-vals');
    valHost.innerHTML = '';
    const dim = MEDIA_DIMS.find(d => d.key === filterPopDim);
    if (!dim) return;
    const head = document.createElement('div');
    head.className = 'fp-vals-head';
    head.textContent = isModeDim(dim.key) ? `${dim.label}（可多选，可设全部 / 任一匹配）` : `${dim.label}（可多选，命中任一）`;
    valHost.appendChild(head);
    // 且/或语义开关（v0.31 起标签有，v0.32 推广到题材/收藏夹）：只有**多值**维度才给 ——
    // 年份/季度/状态是单值列，选 2 个值再取交恒为空集，摆上按钮就是保证让用户踩空列表。
    if (isModeDim(dim.key)) {
        const seg = document.createElement('div');
        seg.className = 'fp-mode';
        for (const [mode, label] of [['AND', '全部匹配'], ['OR', '任一匹配']]) {
            const mb = document.createElement('button');
            mb.type = 'button';
            mb.className = 'btn-mini' + ((mediaFilter.mode[dim.key] || 'OR') === mode ? ' on' : '');
            mb.textContent = label;
            mb.addEventListener('click', () => {
                mediaFilter.mode[dim.key] = mode;
                renderFilterChips();
                renderFilterPop();
                loadMedia();
            });
            seg.appendChild(mb);
        }
        valHost.appendChild(seg);
    }

    const body = document.createElement('div');
    body.className = 'fp-vals-body';
    const items = dimValues(dim.key);
    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'fp-empty';
        empty.textContent = '暂无可选项（库里还没这类数据）';
        body.appendChild(empty);
    }
    for (const item of items) {
        const on = (mediaFilter[dim.key] || []).includes(String(item.value));
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fp-val' + (on ? ' on' : '');
        const mark = document.createElement('span');
        mark.className = 'fv-mark';
        mark.textContent = on ? '☑' : '☐';
        const label = document.createElement('span');
        label.textContent = item.label;
        b.append(mark, label);
        if (item.count != null) {
            const c = document.createElement('span');
            c.className = 'fv-count';
            c.textContent = String(item.count);
            b.appendChild(c);
        }
        b.addEventListener('click', () => setDim(dim.key, item.value));
        if (!item.custom) { body.appendChild(b); continue; }
        // 常驻项：右侧一个 × 直接移除（移除正在用的条件时顺手取消它，免得留下看不见的条件）
        const row = document.createElement('div');
        row.className = 'fp-val-row';
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'fp-del';
        del.textContent = '×';
        del.title = `移除常驻题材「${item.label}」`;
        del.addEventListener('click', () => {
            saveCustomGenres(customGenres().filter(g => g !== item.value));
            delete customGenreCounts[item.value];
            if ((mediaFilter.genres || []).includes(item.value)) setDim('genres', item.value);
            else renderFilterPop();
        });
        row.append(b, del);
        body.appendChild(row);
    }
    valHost.appendChild(body);

    // 题材维度多一行“手写常驻词”；其余维度的取值都是库/常量给的，不给加。
    if (dim.key === 'genres') {
        const foot = document.createElement('div');
        foot.className = 'fp-add';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'fp-add-input';
        input.placeholder = '输入题材词加为常驻（写法要与库里一致）';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fp-add-btn';
        btn.textContent = '＋ 常驻';
        const hint = document.createElement('span');
        hint.className = 'fp-add-hint';
        const submit = async () => {
            btn.disabled = true;
            const res = await addCustomGenre(input.value);
            btn.disabled = false;
            if (res.ok) renderFilterPop();           // 重建列表，新词出现在最前
            else if (res.msg) hint.textContent = res.msg;  // 失败留在原地提示（重建会清掉输入框内容）
        };
        btn.addEventListener('click', submit);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
        foot.append(input, btn, hint);
        valHost.appendChild(foot);
    }
}

/** 按当前筛选/分页构造列表与 count 请求 URL（全部媒体/最近观看/收藏夹三分支）。
 *  format/subcategoryId/year/genres/season/tagIds 全部后端过滤，保证分页总数与列表同条件。 */
function buildMediaUrls() {
    const base = new URLSearchParams({ limit: String(mediaPageSize), offset: String((mediaPage - 1) * mediaPageSize) });
    const addCommon = p => {
        if (mediaFilter.q) p.set('q', mediaFilter.q);
        // v0.32：所有维度都是数组 → 逗号串（后端的 `List<T>` 直接绑，单值调用方照样合法）
        if (mediaFilter.status && mediaFilter.status.length) p.set('status', mediaFilter.status.join(','));
        if (mediaFilter.format) p.set('format', mediaFilter.format);
        if (mediaFilter.subcategoryId) p.set('subcategoryId', mediaFilter.subcategoryId);
        if (mediaFilter.unconfirmed) p.set('confirmed', '0');
        if (mediaFilter.year && mediaFilter.year.length) p.set('year', mediaFilter.year.join(','));
        if (mediaFilter.season && mediaFilter.season.length) p.set('season', mediaFilter.season.join(','));
        if (mediaFilter.collectionId && mediaFilter.collectionId.length) {
            p.set('collectionId', mediaFilter.collectionId.join(','));
            p.set('collectionMode', mediaFilter.mode.collectionId || 'OR');
        }
        if (mediaFilter.tagIds && mediaFilter.tagIds.length) {
            p.set('tagIds', mediaFilter.tagIds.join(','));
            p.set('tagMode', mediaFilter.mode.tagIds || 'AND');
        }
        if (mediaFilter.genres && mediaFilter.genres.length) {
            p.set('genres', mediaFilter.genres.join(','));
            p.set('genreMode', mediaFilter.mode.genres || 'OR');
        }
        if (mediaFilter.sort) p.set('sort', mediaFilter.sort);
        if (mediaFilter.order !== 'desc') p.set('order', mediaFilter.order);
    };
    // 收藏夹不再是「视图路径」（v0.32）：它现在只是一个普通筛选条件（可多选 + 且/或），
    // 统一走 /api/media —— 两条路径的列与 `ORDER BY a.id` 一致，结果等价。
    let url, countParams;
    if (mediaMode === 'recent') {
        addCommon(base);
        url = `/api/media/recent?${base.toString()}`;
        countParams = new URLSearchParams({ latest: 'true' });
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

/**
 * 筛选浮层的选项字典：年份 / 题材 / 标签 / 收藏夹，**全部数据驱动**（只列库里真有的）。
 *
 * <p>题材为什么不是 Bangumi 的全部 tag：那是原始标签堆（全库 17871 个不同值，混着人名、制作公司、
 * 年份档期、国家、用户吐槽），后端用白名单（`MediaService.GENRES`）只种下 41 个真题材词。
 */
async function fillMediaFilterDict() {
    const grab = async (url) => {
        try {
            const resp = await fetch(url);
            return resp.ok ? await resp.json() : [];
        } catch (e) { return []; }
    };
    const [years, genres, tags, collections] = await Promise.all([
        grab('/api/media/years'), grab('/api/media/genres'),
        grab('/api/media/tags'), grab('/api/collections'),
    ]);
    mediaFilterDict.years = Array.isArray(years) ? years : [];
    mediaFilterDict.genres = Array.isArray(genres) ? genres : [];
    mediaFilterDict.tags = Array.isArray(tags) ? tags : [];
    mediaFilterDict.collections = Array.isArray(collections) ? collections : [];
    // 常驻词的媒体数也探一次（字典里没有的就现探），否则列表里显示不出数字
    await Promise.all(customGenres().map(async g => {
        const hit = mediaFilterDict.genres.find(x => x.genre === g);
        const n = hit ? hit.count : await probeGenreCount(g);
        if (n != null) customGenreCounts[g] = n;
    }));
    renderFilterChips();
    if (!filterPopEl.hidden) renderFilterPop();
}

/** 收藏夹 tab 年份筛选下拉：库中已有的首播年份（降序）。 */
async function fillCollYearFilter() {
    try {
        const resp = await fetch('/api/media/years');
        if (!resp.ok) return;
        const years = await resp.json();
        const cur = collYearEl.value;
        collYearEl.innerHTML = '<option value="">全部年份</option>';
        for (const y of years) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = `${y} 年`;
            collYearEl.appendChild(opt);
        }
        collYearEl.value = cur;
    } catch (e) { /* 忽略 */ }
}


/** 收藏夹字典：新建/改名/删除后调（浮层「收藏夹」维度的选项跟着变）。 */
async function fillFilterCollections() {
    try {
        const resp = await fetch('/api/collections');
        if (!resp.ok) return;
        const list = await resp.json();
        mediaFilterDict.collections = Array.isArray(list) ? list : [];
        if (!filterPopEl.hidden) renderFilterPop();
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
            if (!resp.ok) { showToast('改名失败', 3000); return; }
            collectionModal.hidden = true;
            await loadCollections();
            await fillFilterCollections();
        } else {
            const resp = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!resp.ok) { showToast('创建失败', 3000); return; }
            const c = await resp.json();
            collectionModal.hidden = true;
            if (currentViewName === 'collections') {
                collSelectedId = c.id;   // 在收藏夹 tab 创建 → 选中新收藏夹
                await loadCollections();
                await fillFilterCollections();
            } else {
                await fillFilterCollections();
                mediaFilter.collectionId = [String(c.id)];
                renderFilterChips();
                loadMedia();
            }
        }
    } catch (err) { showToast(collectionModalMode === 'rename' ? '改名失败：后端未响应' : '创建失败：后端未响应', 3000); }
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
        const row = document.createElement('div');
        row.className = 'coll-row' + (current.has(c.id) ? ' active' : '');
        row.innerHTML = `<span class="coll-dot"></span><span class="coll-name"></span><span class="coll-count"></span>`;
        row.querySelector('.coll-name').textContent = c.name;
        row.querySelector('.coll-count').textContent = String(c.mediaCount != null ? c.mediaCount : 0);
        row.addEventListener('click', async () => {
            const checked = current.has(c.id);
            if (!checked) {
                await fetch(`/api/collections/${c.id}/media`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaId: d.id })
                });
            } else {
                await fetch(`/api/collections/${c.id}/media/${d.id}`, { method: 'DELETE' });
            }
            current.has(c.id) ? current.delete(c.id) : current.add(c.id);
            row.classList.toggle('active', current.has(c.id));
        });
        detailCollectionsEl.appendChild(row);
    }
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

/* ========== 媒体页批量加入收藏夹：勾选媒体 → 选目标收藏夹 → 批量加入 ========== */
function openMediaFavPick() {
    if (mediaSelected.size === 0) { showToast('请先勾选要加入的媒体'); return; }
    const modal = document.getElementById('media-fav-pick-modal');
    const sel = document.getElementById('mf-collection');
    sel.innerHTML = '<option value="">— 选择收藏夹 —</option>';
    fetch('/api/collections')
        .then(r => r.ok ? r.json() : [])
        .then(colls => {
            if (!colls || colls.length === 0) { showToast('还没有收藏夹，先去收藏夹页建一个'); return; }
            colls.forEach(c => {
                const o = document.createElement('option');
                o.value = c.id;
                o.textContent = `${c.name}（${c.mediaCount || 0} 个媒体）`;
                sel.appendChild(o);
            });
            document.getElementById('mf-count').textContent = mediaSelected.size;
            document.getElementById('mf-confirm').disabled = true;
            modal.hidden = false;
        })
        .catch(() => showToast('加载收藏夹失败'));
}

async function confirmMediaFavPick() {
    const sel = document.getElementById('mf-collection');
    if (!sel.value || mediaSelected.size === 0) return;
    const ids = [...mediaSelected];
    const collId = sel.value;
    try {
        const resp = await fetch(`/api/collections/${collId}/media`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mediaIds: ids }),
        });
        if (!resp.ok) throw new Error();
        document.getElementById('media-fav-pick-modal').hidden = true;
        showToast(`已把 ${ids.length} 个媒体加入收藏夹`);
        exitMediaBatchMode();
        loadMedia(); // 重渲染媒体列表，退出勾选模式
        loadCollections(); // 刷新收藏夹列表的媒体数
        if (collSelectedId === Number(collId)) loadCollMedia(Number(collId));
    } catch (e) { showToast('加入收藏夹失败'); }
}

/** 退出批量勾选模式（删除/加入收藏夹完成后统一走这里）。 */
function exitMediaBatchMode() {
    mediaBatchMode = false;
    mediaSelected.clear();
    const op = document.getElementById('media-batch-op');
    if (op) { op.textContent = '批量操作'; op.classList.remove('active'); }
    const bar = document.getElementById('media-batch-bar');
    if (bar) bar.hidden = true;
    updateMediaBatchConfirm();
}

/** 加载选中收藏夹的媒体（复用 renderMediaGrid，渲染进收藏夹视图容器）。 */
async function loadCollMedia(id, resetPage = true) {
    if (resetPage) collPage = 1;
    collMediaGridEl.innerHTML = '';
    collContentHeadEl.textContent = '';
    const coll = collectionsCache.find(c => c.id === id);
    try {
        if (collGrouped) {
            // 分组视图：拉全量 → 组打包分页（每页媒体数 ≤ 上限、组不跨页切碎；巨型组切片），复用分页条
            const list = await loadAllCollMedia(id);
            collTotal = list.length;
            collContentHeadEl.textContent = coll
                ? `${coll.name} · ${collTotal} 个媒体 · 按首播年份分组，每页最多 ${collGroupPerPage === Infinity ? '不限' : collGroupPerPage} 部`
                : '';
            collStatusEl.textContent = '';
            collPaginationEl.hidden = false;
            if (list.length === 0) {
                collStatusEl.textContent = '这个收藏夹还没有媒体，可在媒体卡片点 ♡ 加入';
                collGroupPages = []; collGroupTotalPages = 1; collGroupPage = 1;
                renderCollGroupPagination();
                return;
            }
            renderCollGrouped(list);
            return;
        }
        collPaginationEl.hidden = false;
        collMediaGridEl.className = 'media-grid';   // 平铺：复位容器（分组模式会改成 coll-group-wrap）
        const base = new URLSearchParams({ limit: String(collPageSize), offset: String((collPage - 1) * collPageSize) });
        if (collFilter.q) base.set('q', collFilter.q);
        if (collFilter.year) base.set('year', collFilter.year);
        if (collFilter.sort) base.set('sort', collFilter.sort);
        base.set('order', collFilter.order);
        const countParams = new URLSearchParams({ collectionId: String(id) });
        if (collFilter.q) countParams.set('q', collFilter.q);
        if (collFilter.year) countParams.set('year', collFilter.year);
        const [listResp, countResp] = await Promise.all([
            fetch(`/api/collections/${id}/media?${base.toString()}`),
            fetch(`/api/media/count?${countParams.toString()}`)
        ]);
        if (!listResp.ok) throw new Error();
        const list = await listResp.json();
        collTotal = countResp.ok ? Number(await countResp.json()) : list.length;
        const totalPages = Math.max(1, Math.ceil(collTotal / collPageSize));
        if (collPage > totalPages) { collPage = totalPages; return loadCollMedia(id, false); }
        if (collPage < 1) collPage = 1;
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

/** 分组视图全量拉取：循环按 200/页 取完该收藏夹全部媒体（带筛选），直到不足一页。 */
async function loadAllCollMedia(id) {
    const all = [];
    const size = 200;
    for (let offset = 0; ; offset += size) {
        const base = new URLSearchParams({ limit: String(size), offset: String(offset) });
        if (collFilter.q) base.set('q', collFilter.q);
        if (collFilter.year) base.set('year', collFilter.year);
        if (collFilter.sort) base.set('sort', collFilter.sort);
        base.set('order', collFilter.order);
        const resp = await fetch(`/api/collections/${id}/media?${base.toString()}`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const list = await resp.json();
        all.push(...list);
        if (list.length < size) break;
    }
    return all;
}

/* ========== 分组「组打包分页」通用渲染器（收藏夹/推荐页共用；替代 renderGroupedLazy 全量懒加载） ========== */

/** 组打包分页：按首播年份分组 → 组按序打包进页，每页媒体总数 ≤ perPage（组不跨页切碎）；
 *  巨型组（单组 > perPage）按 perPage 切片成连续页；perPage=Infinity 时「不限」= 全量一页。
 *  返回 { pages, yearToPage, years }：pages 每页 = 组数组 [{year,items,chunk,chunkIndex,chunkTotal,total}]；
 *  yearToPage = year → 首个切片所在页 index（导航跨页）；years = 全部年份（降序，未知年份兜底）。 */
function buildGroupedPages(list, perPage) {
    const groups = new Map();
    for (const a of list) {
        const key = a.year ? String(a.year) : '未知年份';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
    }
    const years = [...groups.keys()].sort((x, y) => {
        if (x === '未知年份') return 1;
        if (y === '未知年份') return -1;
        return Number(y) - Number(x);
    });
    const pages = [];
    const yearToPage = {};
    let cur = [];          // 当前页组数组
    let curCount = 0;      // 当前页媒体总数
    for (const key of years) {
        const items = groups.get(key);
        if (items.length > perPage) {
            // 巨型组：先结算当前页，再按 perPage 切片成连续页
            if (cur.length) { pages.push(cur); cur = []; curCount = 0; }
            const chunks = Math.ceil(items.length / perPage);
            for (let i = 0; i < chunks; i++) {
                pages.push([{ year: key, items: items.slice(i * perPage, (i + 1) * perPage), chunk: true, chunkIndex: i, chunkTotal: chunks, total: items.length }]);
            }
            yearToPage[key] = pages.length - chunks;
            continue;
        }
        if (curCount + items.length > perPage && cur.length) {
            pages.push(cur); cur = []; curCount = 0;
        }
        cur.push({ year: key, items, total: items.length });
        if (yearToPage[key] === undefined) yearToPage[key] = pages.length;
        curCount += items.length;
    }
    if (cur.length) pages.push(cur);
    return { pages, yearToPage, years };
}

/** 渲染一个年份组 section：组头（年份 + 计数/切片进度 + 折叠）+ 内容容器（跟随全局卡片/列表视图）。 */
function createGroupSection(g, idPrefix, itemRenderer, groupActions) {
    const sec = document.createElement('section');
    sec.className = 'coll-group';
    sec.id = idPrefix + g.year;
    sec.dataset.year = g.year;
    const head = document.createElement('header');
    head.className = 'group-head';
    const countTxt = g.chunk
        ? `${g.total} 部 · 第 ${g.chunkIndex + 1}/${g.chunkTotal} 页`
        : `${g.items.length} 部`;
    head.innerHTML = `<span class="group-year">${esc(g.year)}</span><span class="group-count">${countTxt}</span><span class="group-collapse">▾</span>`
        + (groupActions ? `<span class="group-actions">
            <button type="button" class="btn-mini group-sel-all" title="勾选本组全部">☑ 全选</button>
            <button type="button" class="btn-mini group-sel-none" title="取消本组勾选">☐ 取消</button>
          </span>` : '');
    head.addEventListener('click', () => sec.classList.toggle('collapsed'));
    if (groupActions) {
        /* 组操作按钮：不冒泡到 header（否则会折叠分组） */
        head.querySelector('.group-sel-all').addEventListener('click', (e) => { e.stopPropagation(); groupActions.selectAll(g); });
        head.querySelector('.group-sel-none').addEventListener('click', (e) => { e.stopPropagation(); groupActions.selectNone(g); });
    }
    sec.appendChild(head);
    const wrap = document.createElement('div');
    wrap.className = displayView === 'list' ? 'media-list' : 'group-grid';
    itemRenderer(g.items, wrap);
    sec.appendChild(wrap);
    return sec;
}

/** 渲染分组页：sticky 年份导航（全部年，当前页所在年高亮，点击跨页/页内跳转）+ 当前页各组。 */
function renderGroupedPage(container, pageGroups, opts) {
    const { idPrefix, navYears, currentPageYears, onNavYear, itemRenderer } = opts;
    container.className = 'coll-group-wrap';
    container.innerHTML = '';   // 每次渲染独立清空（loadCollMedia 有 await，并发调用会叠加，必须在此兜底）
    const nav = document.createElement('div');
    nav.className = 'coll-group-nav';
    navYears.forEach((year) => {
        const chip = document.createElement('div');
        chip.className = 'group-nav-chip' + (currentPageYears.has(year) ? ' active' : '');
        chip.dataset.year = year;
        chip.textContent = year;
        chip.addEventListener('click', () => onNavYear(year));
        nav.appendChild(chip);
    });
    container.appendChild(nav);
    const listEl = document.createElement('div');
    listEl.className = 'coll-group-list';
    for (const g of pageGroups || []) {
        const sec = createGroupSection(g, idPrefix, itemRenderer, opts.groupActions);
        listEl.appendChild(sec);
    }
    container.appendChild(listEl);
    // 页内滚动高亮当前组
    const io = new IntersectionObserver((entries) => {
        entries.forEach(en => {
            if (en.isIntersecting) {
                nav.querySelectorAll('.group-nav-chip').forEach(c => c.classList.toggle('active', c.dataset.year === en.target.dataset.year));
            }
        });
    }, { rootMargin: '-80px 0px -65% 0px' });
    listEl.querySelectorAll('.coll-group').forEach(sec => io.observe(sec));
}

/** 分组年份跳转：pageIndex 目标页 0 基。不在当前页 → renderToPage(pageIndex+1, year) 由调用方切页并滚动；在当前页 → 页内直接滚动。
 *  组 section 前缀收藏夹为 grp-、推荐为 rgrp-，用 data-year 选择器规避前缀差异（原硬编码 grp- 导致推荐同页跳转失效）。
 *  同页跳转必须限定在 scopeEl（当前视图容器）内——document.querySelector 会先命中 DOM 靠前的隐藏收藏夹视图同名组（scrollIntoView 对 display:none 无效，跳转失效）。 */
function gotoGroupYear(year, pageIndex, currentPage, renderToPage, scopeEl) {
    if (pageIndex === undefined) return;
    if (pageIndex !== currentPage - 1) {
        renderToPage(pageIndex + 1, year);
    } else {
        (scopeEl || document).querySelector('.coll-group[data-year="' + year + '"]')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/** 收藏夹分组视图：组打包分页（打包全部组 → 渲染当前页 + 分组分页条）。 */
function renderCollGrouped(list) {
    const { pages, yearToPage, years } = buildGroupedPages(list, collGroupPerPage);
    collGroupPages = pages;
    collGroupTotalPages = pages.length;
    collGroupNav = yearToPage;
    collGroupNavYears = years;
    if (collGroupPage > collGroupTotalPages) collGroupPage = 1;
    renderCollGroupPage();
}

/** 渲染收藏夹分组当前页（onDone 渲染完成后回调，用于导航跨页后滚动到目标组）。 */
function renderCollGroupPage(onDone) {
    const page = collGroupPages[collGroupPage - 1];
    renderGroupedPage(collMediaGridEl, page, {
        idPrefix: 'grp-',
        navYears: collGroupNavYears,
        currentPageYears: new Set((page || []).map(g => g.year)),
        onNavYear: (year) => gotoGroupYear(year, collGroupNav[year], collGroupPage, (pg, y) => {
            collGroupPage = pg;
            renderCollGroupPage(() => document.getElementById('grp-' + y)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }, collMediaGridEl),
        itemRenderer: (group, wrap) => renderMediaGrid(group, wrap, 'collection'),
    });
    renderCollGroupPagination();
    if (onDone) requestAnimationFrame(onDone);
}

/** 收藏夹分组分页条（复用平铺分页条 DOM；info 显示「分组第 X/N 页」）。 */
function renderCollGroupPagination() {
    collTotalEl.textContent = `共 ${collTotal} 部`;
    collPageInfoEl.textContent = `分组第 ${collGroupPage}/${collGroupTotalPages} 页`;
    collPagePrevEl.disabled = collGroupPage <= 1;
    collPageNextEl.disabled = collGroupPage >= collGroupTotalPages;
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
        if (!resp.ok) { showToast('移出失败', 3000); return; }
        await loadCollMedia(collSelectedId);   // 刷新内容
        await loadCollections();               // 刷新左侧列表媒体数
        collStatusEl.textContent = coll ? `已移出收藏夹「${coll.name}」` : '';
    } catch (e) { showToast('移出失败：后端未响应', 3000); }
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
                if (!resp.ok) { showToast('删除失败', 3000); return; }
                if (collSelectedId === id) collSelectedId = null;
                await loadCollections();
                await fillFilterCollections();
                if (currentViewName !== 'collections') loadMedia();
            } catch (e) { showToast('删除失败：后端未响应', 3000); }
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
    if (displayView === 'list') { renderMediaRow(list, container, mode); return; }
    container.classList.remove('media-list');   // 卡片视图：清掉列表视图残留 class，恢复 grid 布局
    for (const a of list) {
        mediaById.set(a.id, a);
        const card = document.createElement('div');
        card.className = 'media-card' + (mediaBatchMode ? ' batch-mode' : '') + (mediaSelected.has(a.id) ? ' selected' : '');
        const coverSrc = mediaCoverSrc(a);
        const cover = coverSrc
            ? `<img src="${esc(coverSrc)}" alt="" ${mediaCoverAttrs(a)}>`
            : `<span class="cover-placeholder">${esc(a.title).slice(0, 1)}</span>`;
        const fmtBadge = a.mediaFormat
            ? `<span class="media-format-badge fmt-${esc(a.mediaFormat)}">${esc(formatName(a.mediaFormat))}</span>`
            : '';
        const srcBadge = a.source === 'BANGUMI'
            ? '<span class="media-source-badge">Bangumi</span>'
            : '';
        card.innerHTML = `
            <div class="media-cover">${fmtBadge}${srcBadge}${cover}
                <input type="checkbox" class="media-batch-cb" title="勾选后可批量删除或导出推荐" ${mediaSelected.has(a.id) ? 'checked' : ''}>
                ${mode === 'collection'
                    ? `<button type="button" class="media-remove-btn" title="移出收藏夹">⇤</button>`
                    : `<button type="button" class="media-del-btn" title="删除媒体">×</button>`}
                <button type="button" class="media-fav-btn${(a.collectionCount || 0) > 0 ? ' fav-active' : ''}" title="收藏到收藏夹">${(a.collectionCount || 0) > 0 ? '❤' : '♡'}</button>
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
        // v0.31：卡片正反馈 —— 显示前两个标签（三级并集；多出来的用 +N）
        const cardTags = String(a.tags || '').split(',').map(s => s.trim()).filter(Boolean);
        for (const name of cardTags.slice(0, 2)) {
            const chip = document.createElement('span');
            chip.className = 'media-card-tag';
            chip.textContent = name;
            chip.title = cardTags.join(' / ');
            badges.appendChild(chip);
        }
        if (cardTags.length > 2) {
            const more = document.createElement('span');
            more.className = 'media-card-tag more';
            more.textContent = `+${cardTags.length - 2}`;
            more.title = cardTags.join(' / ');
            badges.appendChild(more);
        }
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

/** 列表视图行渲染（媒体页 / 收藏夹平铺共用）：缩略图 + 标题/元信息 + 操作（收藏 / 删除|移出）。
 *  与卡片分支同事件：批量勾选、收藏浮层、点击进详情。 */
function renderMediaRow(list, container, mode = 'media') {
    container.classList.add('media-list');
    for (const a of list) {
        mediaById.set(a.id, a);
        const row = document.createElement('div');
        row.className = 'media-row' + (mediaBatchMode && mediaSelected.has(a.id) ? ' selected' : '');
        const coverSrc = mediaCoverSrc(a);
        const cover = coverSrc
            ? `<img src="${esc(coverSrc)}" alt="" loading="lazy" ${mediaCoverAttrs(a)}>`
            : `<span class="cover-placeholder">${esc(a.title).slice(0, 1)}</span>`;
        const fmtBadge = a.mediaFormat
            ? `<span class="media-format-badge fmt-${esc(a.mediaFormat)}">${esc(formatName(a.mediaFormat))}</span>`
            : '';
        row.innerHTML = `
            <div class="row-thumb">${fmtBadge}${cover}
                <input type="checkbox" class="media-batch-cb" title="勾选后可批量删除或导出推荐" ${mediaSelected.has(a.id) ? 'checked' : ''}>
            </div>
            <div class="row-body">
                <div class="row-title"></div>
                <div class="row-meta"></div>
            </div>
            <div class="row-actions">
                <button type="button" class="row-btn fav${(a.collectionCount || 0) > 0 ? ' active' : ''}" title="收藏到收藏夹">${(a.collectionCount || 0) > 0 ? '❤' : '♡'}</button>
                ${mode === 'collection'
                    ? `<button type="button" class="row-btn remove" title="移出收藏夹">⇤</button>`
                    : `<button type="button" class="row-btn del" title="删除媒体">🗑</button>`}
            </div>`;
        row.querySelector('.row-title').textContent = a.title;
        const meta = [];
        if (a.year) meta.push(String(a.year));
        if (a.status) meta.push(MEDIA_STATUS_LABEL[a.status] || a.status);
        if (a.rating != null) meta.push(`★ ${a.rating}`);
        meta.push(`${a.clipCount || 0} 条片段`);
        row.querySelector('.row-meta').textContent = meta.join(' · ');
        const cb = row.querySelector('.media-batch-cb');
        cb.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', () => {
            if (cb.checked) { mediaSelected.add(a.id); row.classList.add('selected'); }
            else { mediaSelected.delete(a.id); row.classList.remove('selected'); }
            updateMediaBatchConfirm();
        });
        if (mode === 'collection') {
            row.querySelector('.row-btn.remove').addEventListener('click', (e) => { e.stopPropagation(); removeFromCollection(a.id); });
        } else {
            row.querySelector('.row-btn.del').addEventListener('click', (e) => { e.stopPropagation(); openBatchDelModal([a.id]); });
        }
        row.querySelector('.row-btn.fav').addEventListener('click', (e) => { e.stopPropagation(); openFavPicker(a.id, e.currentTarget); });
        row.addEventListener('click', () => {
            if (mediaBatchMode) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); return; }
            openMediaDetail(a.id);
        });
        container.appendChild(row);
    }
}

/** 批量模式工具条：勾选数实时更新，0 个时禁用动作。 */
function updateMediaBatchConfirm() {
    const bar = document.getElementById('media-batch-bar');
    if (bar) bar.hidden = !mediaBatchMode;
    const n = mediaSelected.size;
    const del = document.getElementById('media-batch-confirm');
    if (del) { del.textContent = `🗑 移入回收站(${n})`; del.disabled = n === 0; }
    const fav = document.getElementById('media-batch-fav-confirm');
    if (fav) { fav.textContent = `＋ 收藏夹(${n})`; fav.disabled = n === 0; }
    const tagBtn = document.getElementById('media-batch-tag');
    if (tagBtn) { tagBtn.textContent = `🏷 标签(${n})`; tagBtn.disabled = n === 0; }
}

function toggleMediaBatchMode() {
    mediaBatchMode = !mediaBatchMode;
    mediaSelected.clear();
    const op = document.getElementById('media-batch-op');
    if (op) {
        op.textContent = mediaBatchMode ? '✓ 勾选模式' : '批量操作';
        op.classList.toggle('active', mediaBatchMode);
    }
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
        exitMediaBatchMode();
    } else { // 来自单卡片删除：仅移除已删 id
        ids.forEach(id => mediaSelected.delete(id));
    }
    showToast(`已将 ${ids.length} 个媒体移入回收站，Bangumi 关联已释放；恢复后需重新关联`);
    loadMedia();
}

// ---------- 回收站视图 ----------

/** 打开回收站视图（隐藏媒体主区，显示回收站列表）。 */
function openTrashView() {
    exitMediaBatchMode(); // 回收站无批量勾选，退出残留模式
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
        const coverSrc = mediaCoverSrc(m);
        const cover = coverSrc
            ? `<img src="${esc(coverSrc)}" alt="" ${mediaCoverAttrs(m)}>`
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
    showConfirm({
        title: '彻底删除媒体',
        msg: '彻底删除该媒体？其下集/片段/封面将一并删除，不可恢复。',
        okText: '彻底删除',
        danger: true,
        onOk: async () => {
            try {
                const resp = await fetch(`/api/media/purge?ids=${id}`, { method: 'DELETE' });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                showToast('已彻底删除');
                loadTrash();
            } catch (e) {
                showToast('删除失败：后端未响应');
            }
        },
    });
}

/** 清空回收站：全部彻底删除。 */
async function clearTrash() {
    showConfirm({
        title: '清空回收站',
        msg: '清空回收站？全部媒体将彻底删除，不可恢复。',
        okText: '清空回收站',
        danger: true,
        onOk: async () => {
            try {
                const resp = await fetch('/api/media/trash', { method: 'DELETE' });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                showToast('回收站已清空');
                loadTrash();
            } catch (e) {
                showToast('清空失败：后端未响应');
            }
        },
    });
}

/** 轻提示：全局唯一 toast，2.5s 自动消失，可打断重显。 */
let toastTimer = null;
function showToast(msg, durationMs) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, durationMs || 2500);
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
    const mdBox = document.getElementById('media-detail');
    if (mdBox) mdBox.innerHTML = '<div style="color:var(--text-dim);padding:20px">加载中…</div>';
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
        await renderMediaDetail(detail, eps);
        detailStatusEl.textContent = '';
    } catch (err) {
        detailStatusEl.textContent = '加载失败：后端未响应';
    }
}

function parseMetadataList(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch (e) { return []; }
}

function renderMetadataChips(container, label, values) {
    if (!container || !values.length) return;
    container.hidden = false;
    container.innerHTML = `<span class="external-chip-label">${esc(label)}</span>` + values.map(v => `<span>${esc(v)}</span>`).join('');
}

async function renderMediaDetail(d, eps) {
    const box = document.getElementById('media-detail');
    if (!box) return;
    const mediaId = d.id;
    // 并行取外部资料 + 收藏夹
    let meta = { work: {}, relations: [], works: [] }, colls = [];
    try {
        const [mResp, cResp] = await Promise.all([
            fetch(`/api/metadata-sync/media/${mediaId}/metadata`),
            fetch('/api/collections')
        ]);
        if (mResp.ok) meta = await mResp.json();
        if (cResp.ok) colls = await cResp.json();
    } catch (e) { /* 外部缺失不影响 */ }
    const w = meta.work || {};
    const genres = parseMetadataList(w.genresJson);
    const aliases = parseMetadataList(w.aliasesJson);
    // v0.25：供 BT 下载搜索带别名（Bangumi 原文/别名）
    const mediaBtAliasList = [];
    if (w.originalTitle) mediaBtAliasList.push(w.originalTitle);
    aliases.forEach(a => mediaBtAliasList.push(a));
    mediaBtAliasCache = { id: d.id, aliases: mediaBtAliasList };
    const rels = Array.isArray(meta.relations) ? meta.relations : [];
    const inColl = new Set(d.collectionIds || []);
    const sorted = [...eps].sort((a,b) => (a.episodeNo||0)-(b.episodeNo||0));
    const statusLabel = s => ({WANT:'想看',WATCHING:'在看',WATCHED:'已看'}[s] || s || '');
    const fmtDate = ms => ms ? new Date(ms).toLocaleDateString() : '';
    // chip 行（题材/别名/关联；对齐 _demo-realtime：ext-row 标签列 + tag 胶囊 + 更多(+N) 展开）
    const chipRow = (label, values, limit, isFirst) => {
        if (!values || !values.length) return '';
        const shown = values.slice(0, limit).map(v => `<span class="tag">${esc(String(v))}</span>`).join('');
        const rest = values.slice(limit).map(v => `<span class="tag">${esc(String(v))}</span>`).join('');
        const overflow = values.length - limit;
        return `<div class="ext-row ${isFirst ? 'first' : ''}"><span class="ext-label">${esc(label)}</span><div class="chips"><span class="chips-shown">${shown}</span>${overflow > 0 ? `<button class="more-btn" data-overflow="${overflow}">更多 (+${overflow})</button><span class="chips-full" style="display:none">${rest}</span>` : ''}</div></div>`;
    };
    // 封面：统一取值链（Bangumi 外链优先，失败自动降级本地封面/片段帧）
    const coverSrc = mediaCoverSrc(d);
    const cover = coverSrc
        ? `<img src="${esc(coverSrc)}" alt="" ${mediaCoverAttrs(d)}>`
        : `<span class="cover-placeholder large">${esc(d.title).slice(0, 1)}</span>`;
    const desc = w.description || '';
    const btn = (id, label, cls) => `<button type="button" id="${id}" class="btn-mini ${cls}">${label}</button>`;

    const epById = new Map(sorted.map(ep => [ep.id, ep]));
    const epRows = sorted.length ? sorted.map(e => `<div class="ep-row" data-ep="${e.id}">
        <div class="ep-thumb">${e.coverPath ? `<img src="${esc(e.coverPath)}" alt="">` : `EP${e.episodeNo ?? '?'}`}</div>
        <div class="ep-body"><span class="ep-title">${esc(e.title || '(未命名)')}</span><span class="ep-status">${e.watchedAt ? '<span class="ep-watched">✓已看</span> · ' : ''}<span class="ep-clips">${e.clipCount||0} 条</span></span><span class="ep-light" data-ep="${e.id}" title="本地源检查中"></span></div>
        <div class="ep-menu-wrap">
          <button type="button" class="ep-more" aria-label="更多操作">⋯</button>
          <div class="ep-menu">
            <button type="button" class="ep-menu-item ep-cover-btn">封面</button>
            <button type="button" class="ep-menu-item ep-tag-btn">打标签</button>
            <button type="button" class="ep-menu-item ep-time-btn">时间线</button>
            <button type="button" class="ep-menu-item ep-bt-btn">BT 下载</button>
            <button type="button" class="ep-menu-item ep-del-btn danger">删除</button>
          </div>
        </div></div>`).join('') : '<div style="color:var(--text-faint);padding:16px">该媒体还没有集</div>';

    const profile = [['观看状态', statusLabel(d.status), d.status === 'WATCHED' ? 'green' : ''], ['个人评分', d.rating != null ? '★ ' + d.rating : '未评分', 'green'], ['资料来源', mediaSourceLabel(d.source), ''], ['档案状态', d.confirmed ? '已确认' : '待确认', 'amber']]
        .map(([l,v,c]) => `<div class="profile-row"><span>${l}</span><b class="${c}">${v}</b></div>`).join('');
    const shelves = colls.map(c => `<div class="shelf-row ${inColl.has(c.id) ? 'active' : ''}" data-coll="${c.id}"><span class="shelf-dot"></span><span class="shelf-name">${esc(c.name)}</span><span class="shelf-count">${c.mediaCount ?? 0}</span></div>`).join('');

    box.innerHTML = `
      <div class="hero">
        <div class="hero-top">
          <div class="hero-cover">${cover}<span class="src-badge">${esc(mediaSourceLabel(d.source))}</span></div>
          <div class="hero-info">
            <div class="hero-title-line"><h1 class="hero-title">${esc(d.title)}</h1>${w.nativeTitle ? `<span class="hero-native">${esc(w.nativeTitle)}</span>` : ''}${w.externalId
              ? `<span class="hero-link-badge linked" title="已关联 Bangumi 条目 #${esc(w.externalId)} · 点击更换关联">Bangumi <b>#${esc(w.externalId)}</b></span>`
              : `<span class="hero-link-badge" title="尚未关联 Bangumi 条目 · 点击绑定">未关联 Bangumi</span>`}</div>
            ${desc ? `<div><div class="ext-desc">${esc(desc)}</div>${desc.length > 120 ? `<span class="desc-toggle">展开更多</span>` : ''}</div>` : ''}
            ${genres.length ? chipRow('题材', genres, 6, true) : ''}
            ${aliases.length ? chipRow('别名', aliases, 4, false) : ''}
            ${rels.length ? chipRow('关联作品', rels.map(r => r.title || r.relatedExternalId || ''), 3, false) : ''}
          </div>
        </div>
        <!-- 操作区：本地档案操作（关联入口 = 标题右侧 Bangumi 徽标） -->
        <div class="hero-ops">
          <div class="hero-ops-main">
            ${btn('detail-edit','编辑信息','')}${btn('detail-rename','改名/合并','')}${btn('detail-cover','设置封面','')}${btn('detail-confirm','确认档案','')}${btn('detail-highlight','制作推荐视频','')}${btn('detail-materialize-batch','批量剪出视频','primary')}${btn('detail-delete','删除','danger')}
          </div>
        </div>
      </div>
      <div class="layout">
        <div class="main-col">
          <div class="section"><div class="section-head"><div><span class="kicker">EPISODE LIBRARY</span><h3>集列表</h3></div><span class="section-note">共 ${sorted.length} 集</span><span class="view-switch" data-view-key="media-episodes" title="切换视图：列表 / 卡片 2-4 列"><button type="button" data-v="list" title="列表视图"><svg class="vs-ic" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button><button type="button" data-v="2" title="卡片 · 每行 2 张"><svg class="vs-ic" viewBox="0 0 16 16"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.4" y="2.4" width="5.2" height="5.2" rx="1"/><rect x="8.4" y="2.4" width="5.2" height="5.2" rx="1"/><rect x="2.4" y="8.4" width="5.2" height="5.2" rx="1"/><rect x="8.4" y="8.4" width="5.2" height="5.2" rx="1"/></g></svg><i>2</i></button><button type="button" data-v="3" title="卡片 · 每行 3 张"><svg class="vs-ic" viewBox="0 0 16 16"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.4" y="2.4" width="5.2" height="5.2" rx="1"/><rect x="8.4" y="2.4" width="5.2" height="5.2" rx="1"/><rect x="2.4" y="8.4" width="5.2" height="5.2" rx="1"/><rect x="8.4" y="8.4" width="5.2" height="5.2" rx="1"/></g></svg><i>3</i></button><button type="button" data-v="4" title="卡片 · 每行 4 张"><svg class="vs-ic" viewBox="0 0 16 16"><g fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.4" y="2.4" width="5.2" height="5.2" rx="1"/><rect x="8.4" y="2.4" width="5.2" height="5.2" rx="1"/><rect x="2.4" y="8.4" width="5.2" height="5.2" rx="1"/><rect x="8.4" y="8.4" width="5.2" height="5.2" rx="1"/></g></svg><i>4</i></button></span></div><div class="section-body" id="episode-list"><div class="ep-list">${epRows}</div></div></div>
        </div>
        <div class="side-col">
          <div class="panel"><div class="panel-head"><span class="kicker">ARCHIVE PROFILE</span><h3>档案信息</h3></div><div class="panel-body">${profile}<div id="media-detail-note" class="detail-note" hidden></div></div></div>
          <div class="panel"><div class="panel-head"><span class="kicker">LOCAL ARCHIVE</span><h3>素材概览</h3></div><div class="panel-body"><div class="asset-grid"><div class="asset-cell"><b>${d.clipCount||0}</b><span>片段</span></div><div class="asset-cell"><b>${d.episodeCount||0}</b><span>集</span></div><div class="asset-cell"><b>${d.tags?.length||0}</b><span>标签</span></div><div class="asset-cell"><b>${colls.length}</b><span>收藏</span></div></div></div></div>
          <div class="panel"><div class="panel-head"><span class="kicker">PERSONAL INDEX</span><h3>标签池</h3></div><div class="panel-body"><div class="tag-cloud" id="detail-tags-pool"></div></div></div>
          <div class="panel"><div class="panel-head"><span class="kicker">YOUR SHELVES</span><h3>收藏夹</h3></div><div class="panel-body">${shelves}</div></div>
        </div>
      </div>`;

    // 交互绑定（chip 行「更多/收起」+ 简介展开收起）
    box.querySelectorAll('.more-btn').forEach(btn2 => {
        btn2.addEventListener('click', () => {
            const chips = btn2.parentElement;
            const full = chips.querySelector('.chips-full'), shown = chips.querySelector('.chips-shown');
            if (!full) return;
            const open = full.style.display !== 'none';
            if (open) { full.style.display = 'none'; if (shown) shown.style.display = 'inline-flex'; btn2.textContent = '更多 (+' + btn2.dataset.overflow + ')'; btn2.classList.remove('less'); }
            else { full.style.display = 'inline-flex'; if (shown) shown.style.display = 'none'; btn2.textContent = '收起'; btn2.classList.add('less'); }
        });
    });
    const descToggle = box.querySelector('.desc-toggle');
    if (descToggle) descToggle.addEventListener('click', () => {
        const e = descToggle.previousElementSibling;
        const open = e.classList.toggle('expanded');
        descToggle.textContent = open ? '收起' : '展开更多';
    });
    // 集行：⋯ 菜单（封面/打标签/时间线/删除）+ 整行点击进集详情
    box.querySelectorAll('.ep-row').forEach(row => {
        const ep = epById.get(Number(row.dataset.ep));
        const more = row.querySelector('.ep-more');
        const menu = row.querySelector('.ep-menu');
        if (more && menu) more.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.ep-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
            menu.classList.toggle('open');
        });
        row.querySelector('.ep-cover-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if (ep) openEpisodeCoverModal(ep); });
        row.querySelector('.ep-tag-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if (ep) openEpisodeTagModal(ep); });
        row.querySelector('.ep-time-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!ep) return;
            fromMediaDetail = true;
            openTimeline({ fp: ep.videoFp, title: (d.title || '') + (ep.episodeNo != null ? ` · 第${ep.episodeNo}集` : '') });
        });
        row.querySelector('.ep-bt-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if (ep && d && d.id) openEpisodeBtDownloadModal(d, ep); });
        row.querySelector('.ep-del-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if (ep) deleteEpisode(ep); });
        row.addEventListener('click', (e) => {
            if (e.target.closest('.ep-more') || e.target.closest('.ep-menu')) return;
            const id = row.dataset.ep;
            if (id) openEpisodeDetail(Number(id));
        });
    });
    box.querySelectorAll('.shelf-row').forEach(row => row.addEventListener('click', async () => {
        const cid = row.dataset.coll; const add = !row.classList.contains('active');
        await fetch(`/api/collections/${cid}/media${add ? '' : '/' + mediaId}`, { method: add ? 'POST' : 'DELETE', headers: {'Content-Type':'application/json'}, body: add ? JSON.stringify({mediaId}) : undefined });
        row.classList.toggle('active', add);
    }));
    const cfm = box.querySelector('#detail-confirm');
    if (cfm) cfm.hidden = d.confirmed !== 0;
    const hl = box.querySelector('#detail-highlight');
    if (hl) {
        hl.hidden = d.mediaFormat !== 'VIDEO';
        hl.addEventListener('click', openHighlightWorkbench);
    }
    // 档案信息卡「个人备注」：内联编辑 + 文字过长折叠/展开
    renderMediaDetailNote(d);
    refreshAllEpLamps();
    // 右栏标签池：可编辑聚合视图（媒体级直挂标签可删 × + 底部「＋ 添加标签」，风格对齐集标签池卡）
    renderTagPool(d, box.querySelector('#detail-tags-pool'));
    initViewSwitches();
}

/** 媒体档案信息卡「个人备注」：展示 / 点击内联编辑（保存走 PUT /api/media/{id}，全字段回填仅改 note）。
 *  复用集备注交互形态；文案过长折叠 2 行并给「展开更多/收起」（同媒体简介折叠，真实溢出判定）。 */
function renderMediaDetailNote(d) {
    const el = document.getElementById('media-detail-note');
    if (!el) return;
    el.hidden = false;
    el.classList.remove('editing');
    const note = (d.note || '').trim();
    el.classList.toggle('empty', !note);
    el.innerHTML = '';
    const openEditor = () => {
        el.classList.add('editing');
        el.innerHTML = '';
        const ta = document.createElement('textarea');
        ta.className = 'note-edit-input';
        ta.rows = 3;
        ta.placeholder = '个人备注（观感/待办等），参与搜索；留空保存即清空';
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
        cancel.addEventListener('click', () => refreshMediaDetail());
        save.addEventListener('click', async () => {
            // PUT /api/media/{id} 为全量 MediaRequest（title 必填）：用当前档案字段回填，仅替换 note
            const payload = {
                title: d.title,
                mediaFormat: d.mediaFormat || null,
                subcategoryId: d.subcategoryId != null ? d.subcategoryId : null,
                status: d.status || null,
                rating: d.rating != null ? Number(d.rating) : null,
                year: d.year != null ? Number(d.year) : null,
                season: d.season != null ? Number(d.season) : null,
                note: ta.value.trim()
            };
            const resp = await fetch(`/api/media/${d.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (resp.ok) { refreshMediaDetail(); }
            else { el.innerHTML = '<span class="note-err">保存失败</span>'; }
        });
    };
    const body = document.createElement('div');
    body.className = 'note-editable';
    body.tabIndex = 0;
    body.title = '点击编辑备注';
    body.setAttribute('role', 'button');
    const label = document.createElement('span');
    label.className = 'note-kicker';
    label.textContent = note ? '个人备注' : '个人备注（空）';
    const txt = document.createElement('span');
    txt.className = 'note-text';
    txt.textContent = note || '＋ 点击添加备注';
    body.append(label, txt);
    const toggle = document.createElement('span');
    toggle.className = 'note-toggle';
    toggle.textContent = '展开更多';
    body.appendChild(toggle);
    el.appendChild(body);
    body.addEventListener('click', openEditor);
    body.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(); } });
    // 真实溢出判定：正文被 -webkit-line-clamp:2 夹断时才显示展开/收起
    const overflowing = note && txt.scrollHeight > txt.clientHeight + 1;
    if (overflowing) {
        toggle.classList.add('on');
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = txt.classList.toggle('expanded');
            toggle.textContent = open ? '收起' : '展开更多';
        });
    }
}

/** 媒体右栏标签池：聚合热度 → stat-1..5 分级配色；可编辑（对齐集标签池卡）——
 *  媒体级直挂标签可点 × 移除（集/片段引用保留），聚合失败兜底作品级；底部「＋ 添加标签」回车新增。 */
async function renderTagPool(d, container) {
    if (!container) return;
    container.innerHTML = '';
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
    // 媒体直挂标签 id 集合 → 标记可删除（删媒体级关联，集/片段引用不动）
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
        container.appendChild(chip);
    }
    const wrap = document.createElement('span');
    wrap.className = 'tag-add-wrap';
    const input = document.createElement('input');
    input.className = 'tag-add-input';
    input.placeholder = '+ 添加标签';
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            const picked = await resolveTagId(input);
            if (!picked) return;
            input.value = '';
            await fetch(`/api/media/${d.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagIds: [picked.id] })
            });
            refreshMediaDetail();
        }
    });
    wrap.appendChild(input);
    container.appendChild(wrap);
    attachTagSuggest(input, () => (currentMedia && currentMedia.id) || null);
    // v0.31：去标签页看这套词条（带上媒体作用域，可单个 × 掉）
    const scope = document.createElement('button');
    scope.type = 'button';
    scope.className = 'btn-mini tag-scope-link';
    scope.textContent = '📋 在标签页查看';
    scope.title = '到标签页只看这部作品自己挂的词条（可改名/合并/删除）';
    scope.addEventListener('click', () => {
        setTagScope(d.id, d.title);
        showView('tags');
    });
    container.appendChild(scope);
}

function renderLocalDetailSummary(d, eps, isVideo) {
    const el = document.getElementById('detail-local-summary');
    if (!el) return;
    const values = [
        ['片段', d.clipCount || 0],
        ['集', isVideo ? (d.episodeCount || eps.length || 0) : '—'],
        ['标签', Array.isArray(d.tags) ? d.tags.length : 0],
        ['收藏', Array.isArray(d.collectionIds) ? d.collectionIds.length : 0]
    ];
    el.innerHTML = values.map(([label, value]) => `<div class="detail-local-stat"><b>${esc(String(value))}</b><span>${esc(label)}</span></div>`).join('');
}

function renderDetailProfile(d, isVideo) {
    const el = document.getElementById('detail-profile');
    if (!el) return;
    const status = d.status ? (MEDIA_STATUS_LABEL[d.status] || d.status) : '未设置';
    const rating = d.rating != null ? `★ ${d.rating} / 10` : '未评分';
    const source = mediaSourceLabel(d.source);
    const confirmed = d.confirmed !== 0 ? '已确认' : '待确认';
    const facts = [
        ['观看状态', status, 'profile-status'],
        ['个人评分', rating, 'profile-rating'],
        ['资料来源', source, ''],
        ['档案状态', confirmed, d.confirmed === 0 ? 'profile-pending' : '']
    ];
    el.innerHTML = facts.map(([label, value, cls]) => `<div class="detail-profile-row"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`).join('');
}

/** 别名管理：该媒体全部标题映射（合并自动记的），逐个可解除。 */
async function renderDetailAliases(d) {
    const titleEl = document.getElementById('detail-aliases-title');
    const el = document.getElementById('detail-aliases');
    let aliases = [];
    try {
        const resp = await fetch(`/api/title-mappings/aliases?mediaId=${d.id}`);
        if (resp.ok) aliases = await resp.json();
    } catch (e) { /* 忽略 */ }
    titleEl.hidden = aliases.length === 0;
    const aliasSection = document.getElementById('detail-alias-section');
    if (aliasSection) aliasSection.hidden = aliases.length === 0;
    el.innerHTML = aliases.length
        ? aliases.map(a => `
            <span class="alias-chip" title="保存标题为「${esc(a)}」的片段时自动归入「${esc(d.title)}」">${esc(a)}
                <button type="button" class="alias-del" data-alias="${esc(a)}" aria-label="解除别名">✕</button>
            </span>`).join('')
        : '';
    el.querySelectorAll('.alias-del').forEach(btn => btn.addEventListener('click', async () => {
        const alias = btn.dataset.alias;
        try {
            const resp = await fetch(`/api/title-mappings?title=${encodeURIComponent(alias)}`, { method: 'DELETE' });
            if (resp.ok) { showToast(`已解除别名「${alias}」`); renderDetailAliases(d); }
            else showToast('解除别名失败');
        } catch (e) { showToast('解除别名失败'); }
    }));
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
            const picked = await resolveTagId(input);
            if (!picked) return;
            input.value = '';
            await fetch(`/api/media/${d.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tagIds: [picked.id] })
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

/* ---- v0.25 BT 种子下载弹窗（媒体详情/集列表行「BT 下载」） ---- */
let torrentBtState = null;   // { media, ep, engineOk, list, selected:Map }
let mediaBtAliasCache = null; // { id, aliases:[...] }
function btTierInfo(tier) {
    if (tier === 'RAW') return ['无字幕', 'raw'];
    if (tier === 'SOFT') return ['软字幕', 'soft'];
    if (tier === 'HARD') return ['硬烧', 'hard'];
    return ['未知', 'unknown'];
}
function btAliasesFor(media) {
    const out = [];
    const push = (v) => { const s = String(v || '').trim(); if (s && !out.includes(s)) out.push(s); };
    if (media) push(media.title);
    if (mediaBtAliasCache && media && mediaBtAliasCache.id === media.id) {
        (mediaBtAliasCache.aliases || []).forEach(push);
    }
    if (media) {
        String(media.aliases || '').split(/[,，、;；\n]/).forEach(push);
    }
    return out.slice(0, 6);
}
function btCandidateKey(c) {
    return c.providerId + '::' + (c.group || '') + '::' + (c.batch ? 'B' : String(c.episodeNumber != null ? c.episodeNumber : '')) + '::' + c.title;
}
function openEpisodeBtDownloadModal(media, ep) {
    const modal = document.getElementById('torrent-download-modal');
    if (!modal || !media || !ep) return;
    torrentBtState = { media, ep, engineOk: false, list: [], selected: new Map(), packChoice: new Map(), sortMode: 'tier' };
    const picker = document.getElementById('bt-pack-picker');
    if (picker) picker.hidden = true;
    const targetEl = document.getElementById('torrent-download-target');
    const engineEl = document.getElementById('torrent-engine-state');
    const listEl = document.getElementById('torrent-candidate-list');
    const searchEl = document.getElementById('bt-search-input');
    if (targetEl) targetEl.textContent = `：${esc(media.title)}${ep.episodeNo != null ? ' · 第' + ep.episodeNo + '集' : ''}`;
    if (searchEl) searchEl.value = media.title;
    engineEl.textContent = '引擎检测中…';
    engineEl.className = 'bt-engine';
    listEl.innerHTML = '<div style="color:var(--text-faint);padding:14px">搜索候选…</div>';
    modal.hidden = false;
    refreshBtSelectedBar();
    btLoadEngineState().then(() => btRunSearch());
}
async function btLoadEngineState() {
    const engineEl = document.getElementById('torrent-engine-state');
    try {
        const r = await fetch('/api/torrents/engine-status');
        if (r.ok) {
            const st = await r.json();
            if (torrentBtState) torrentBtState.engineOk = !!st.enabled && !!st.online;
            engineEl.textContent = !st.enabled
                ? '引擎 ⚠ 未启用：启动后端时设 QBITTORRENT_ENABLED=true'
                : (st.online ? `引擎 ● 在线${st.version ? ' · ' + st.version : ''}` : '引擎 ○ 离线：请先启动 qBittorrent');
            engineEl.classList.add(st.enabled ? (st.online ? 'ok' : 'warn') : 'warn');
        }
    } catch (err) {
        engineEl.textContent = '引擎状态不可用';
        engineEl.classList.add('warn');
    }
}
async function btRunSearch() {
    const st = torrentBtState;
    if (!st) return;
    const listEl = document.getElementById('torrent-candidate-list');
    const searchEl = document.getElementById('bt-search-input');
    const keyword = (searchEl && searchEl.value.trim()) || st.media.title;
    listEl.innerHTML = '<div style="color:var(--text-faint);padding:14px">搜索候选…</div>';
    try {
        const resp = await fetch('/api/torrents/candidates', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: keyword, aliases: btAliasesFor(st.media).filter(x => x !== keyword) })
        });
        st.list = resp.ok ? await resp.json() : [];
    } catch (err) {
        st.list = [];
    }
    st.selected.clear();
    renderBtCandidates();
    refreshBtSelectedBar();
}
function renderBtCandidates() {
    const st = torrentBtState;
    const listEl = document.getElementById('torrent-candidate-list');
    if (!st) return;
    const list = st.list;
    // 各家命中数显示到来源 chips（过滤是前端隐藏，不重新请求）
    const pname = { nyaa: 'Nyaa', mikan: '蜜柑', dmhy: '动漫花园' };
    document.querySelectorAll('#bt-source-chips label').forEach(lab => {
        const cb = lab.querySelector('input[type=checkbox]');
        if (!cb) return;
        const cnt = (list || []).filter(x => x.providerId === cb.dataset.p).length;
        const textNode = lab.childNodes[lab.childNodes.length - 1];
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            textNode.textContent = ` ${pname[cb.dataset.p] || cb.dataset.p}${cnt ? ' · ' + cnt : ''}`;
        }
    });
    const target = st.ep.episodeNo;
    if (!list.length) { listEl.innerHTML = '<span class="status">没有找到候选（站点不可达或标题未命中）</span>'; return; }
    // 来源过滤 chips
    const showProvider = new Set();
    document.querySelectorAll('#bt-source-chips input[type=checkbox]').forEach(cb => { if (cb.checked) showProvider.add(cb.dataset.p); });
    let shown = list.filter(c => showProvider.has(c.providerId));
    if (st.sortMode === 'seeds') {
        shown = shown.slice().sort((a, b) => (b.seeders || 0) - (a.seeders || 0)); // 稳定排序，未知(0)靠后
    } else if (st.sortMode === 'measured') {
        shown = shown.slice().sort((a, b) => ((st.measured && st.measured.get(btCandidateKey(b))) || -1) - ((st.measured && st.measured.get(btCandidateKey(a))) || -1));
    }
    const rows = [];
    for (const c of shown) {
        if (!showProvider.has(c.providerId)) continue;
        const isBatch = !!c.batch;
        if (isBatch && target == null) continue;
        if (!isBatch) {
            const nums = (c.episodes && c.episodes.length) ? c.episodes : (c.episodeNumber != null ? [c.episodeNumber] : []);
            if (target != null && nums.length && !nums.includes(target)) continue;
        }
        const key = btCandidateKey(c);
        const [label, cls] = btTierInfo(c.tier);
        const row = document.createElement('div');
        row.className = 'bt-cand';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'bt-pick';
        chk.disabled = !c.locator;
        chk.checked = st.selected.has(key);
        chk.addEventListener('change', () => {
            if (chk.checked) st.selected.set(key, c); else st.selected.delete(key);
            refreshBtSelectedBar();
        });
        const tier = document.createElement('span');
        tier.className = `bt-tier ${cls}`;
        tier.textContent = label;
        const body = document.createElement('span');
        body.className = 'bt-cand-body';
        let link = c.pageUrl ? `<a class="bt-link" href="${esc(c.pageUrl)}" target="_blank" rel="noopener">源站 ↗</a>` : '';
        const mb = (st.measured && st.measured.get(key)) || 0;
        body.innerHTML = `<b>${esc(c.title)}</b><small>${esc(c.providerName || c.providerId)} · ${esc(c.group || '?')}${c.resolution ? ' · ' + esc(c.resolution) : ''}${c.codec ? ' · ' + esc(c.codec) : ''}${c.seeders ? ' · 做种 ' + c.seeders : ''}${mb ? ' · 实测 ' + mb.toFixed(1) + ' MB/s' : ''}${isBatch ? ' · 合集包' : ''} ${link}</small>`;
        const dl = document.createElement('button');
        dl.type = 'button'; dl.className = 'btn-mini bt-dl';
        const packEp = torrentBtState.packChoice.get(key);
        const shownEp = isBatch ? (packEp != null ? packEp : target) : target;
        dl.disabled = !st.engineOk || !c.locator;
        dl.textContent = isBatch ? `只下第${shownEp}集` : '下载';
        dl.title = !c.locator ? '该候选无可下载地址（RSS 未带种子/磁力）' : (isBatch ? `合集包：只下载第 ${shownEp} 集的文件（其余不取）` : '下载并登记为该集本地源');
        dl.addEventListener('click', () => btQueueOne(c));
        row.appendChild(chk);
        row.appendChild(tier);
        row.appendChild(body);
        if (isBatch) {
            const sel = document.createElement('button');
            sel.type = 'button'; sel.className = 'btn-mini bt-sel';
            sel.textContent = packEp != null ? `选集(第${packEp}集)` : '选集';
            sel.disabled = !st.engineOk || !c.locator;
            sel.addEventListener('click', () => btOpenPackPicker(c));
            row.appendChild(sel);
        }
        row.appendChild(dl);
        rows.push(row);
    }
    listEl.innerHTML = '';
    if (!rows.length) {
        listEl.innerHTML = `<span class="status">第 ${target != null ? target : '?'} 集暂无候选（可换搜索词，或该集只有合集包且引擎离线）</span>`;
        return;
    }
    rows.forEach(r => listEl.appendChild(r));
}
async function btQueueOne(c) {
    const st = torrentBtState;
    const listEl = document.getElementById('torrent-candidate-list');
    const isBatch = !!c.batch;
    const key = btCandidateKey(c);
    const packEp = st.packChoice.get(key);
    const target = (isBatch && packEp != null) ? packEp : st.ep.episodeNo;
    try {
        const assetResp = await fetch(`/api/episodes/${st.ep.id}/video-assets`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetType: 'DOWNLOADED', displayName: c.title, stableLocator: c.locator })
        });
        if (!assetResp.ok) throw new Error('创建资产失败 HTTP ' + assetResp.status);
        const asset = await assetResp.json();
        const plan = { assetId: asset.id, mediaId: st.media.id, entryId: (st.ep.mediaEntryId || 0), episodeId: st.ep.id, locator: c.locator, maxBytes: 6 * 1024 * 1024 * 1024 };
        if (isBatch && target != null) plan.targetEpisode = target;
        const q = await fetch('/api/video-source-tasks/downloads', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plan)
        });
        if (!q.ok) throw new Error('入队失败 HTTP ' + q.status);
        const qj = await q.json();
        showToast(isBatch ? `已入队：合集只取第 ${target} 集（后台下载）` : `已入队 BT 下载「${c.title}」（后台下载）`);
        watchTorrentTask(qj.taskId, st.ep.id);
        st.selected.delete(btCandidateKey(c));
        refreshBtSelectedBar();
        renderBtCandidates();
    } catch (err) {
        showToast(err.message || '下载入队失败', 3500);
    }
}
function refreshBtSelectedBar() {
    const st = torrentBtState;
    const bar = document.getElementById('bt-selected-count');
    const go = document.getElementById('bt-download-selected');
    if (!bar || !st) return;
    bar.textContent = `已选 ${st.selected.size}`;
    if (go) {
        go.disabled = st.selected.size === 0;
        go.textContent = st.selected.size ? `下载所选 (${st.selected.size})` : '下载所选';
    }
}
async function btQueueSelected() {
    const st = torrentBtState;
    if (!st || !st.selected.size) return;
    const go = document.getElementById('bt-download-selected');
    go.disabled = true;
    const items = [...st.selected.values()];
    for (const c of items) {
        await btQueueOne(c);
    }
    go.disabled = st.selected.size === 0;
    go.textContent = st.selected.size ? `下载所选 (${st.selected.size})` : '下载所选';
}
function btOpenPackPicker(c) {
    const st = torrentBtState;
    if (!st || !st.engineOk || !c.locator) return;
    const picker = document.getElementById('bt-pack-picker');
    if (!picker) return;
    picker.hidden = false;
    picker.innerHTML = '<div style="color:var(--text-faint);padding:10px">读取包内容…（需连引擎列文件清单）</div>';
    fetch('/api/torrents/pack-episodes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locator: c.locator })
    }).then(resp => resp.json()).then(v => {
        const eps = (v && v.episodes) || [];
        if (!eps.length) {
            picker.innerHTML = '<div class="bt-pack-note">未能识别包内集号（文件名命名特殊或引擎离线）——可关闭后用其它合集/关键词</div>';
            return;
        }
        const key = btCandidateKey(c);
        const cur = st.packChoice.has(key) ? st.packChoice.get(key) : st.ep.episodeNo;
        const chosen = eps.includes(cur) ? cur : eps[0];
        st.packChoice.set(key, chosen);
        const radios = eps.map(e => `<label class="bt-pack-ep"><input type="radio" name="pk${st.ep.id}" value="${e}" ${e === chosen ? 'checked' : ''}>第 ${e} 集</label>`).join('');
        picker.innerHTML = `<div class="bt-pack-head">合集包内容 · 单选一集（默认第 ${chosen} 集）</div><div class="bt-pack-eps">${radios}</div><div class="bt-pack-actions"><button type="button" class="btn-mini bt-pack-ok">确定选集</button></div>`;
        picker.querySelectorAll('.bt-pack-ep input').forEach(inp => inp.addEventListener('change', () => st.packChoice.set(key, parseInt(inp.value, 10))));
        picker.querySelector('.bt-pack-ok').addEventListener('click', () => { picker.hidden = true; renderBtCandidates(); refreshBtSelectedBar(); });
    }).catch(err => {
        picker.innerHTML = '<div class="bt-pack-note">读取失败：' + (err.message || '网络错误') + '</div>';
    });
}


const btTierRank = { RAW: 0, SOFT: 1, UNKNOWN: 2, HARD: 3 };
function btVisibleForTarget() {
    const st = torrentBtState;
    if (!st) return [];
    const target = st.ep.episodeNo;
    const show = new Set();
    document.querySelectorAll('#bt-source-chips input[type=checkbox]').forEach(cb => { if (cb.checked) show.add(cb.dataset.p); });
    return (st.list || []).filter(c => {
        if (!show.has(c.providerId)) return false;
        if (c.batch) return target != null;
        const nums = (c.episodes && c.episodes.length) ? c.episodes : (c.episodeNumber != null ? [c.episodeNumber] : []);
        if (target != null && nums.length && !nums.includes(target)) return false;
        return true;
    });
}
async function btMeasureNow(maxN) {
    const st = torrentBtState;
    const btn = document.getElementById('bt-measure');
    if (!st || !st.engineOk) { showToast('引擎离线，无法测速', 3500); return; }
    const pool = btVisibleForTarget();
    if (!pool.length) { showToast('没有可测候选', 3500); return; }
    const items = pool.slice(0, maxN || 6);
    if (!st.measured) st.measured = new Map();
    if (btn) { btn.disabled = true; btn.textContent = '测速中…'; }
    try {
        const resp = await fetch('/api/torrents/measure', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locators: items.map(x => x.locator) })
        });
        const res = resp.ok ? await resp.json() : [];
        res.forEach((m, i) => {
            const c = items[i];
            if (c && c.locator) st.measured.set(btCandidateKey(c), m.mbps);
        });
        renderBtCandidates();
        showToast('测速完成：行上已标实测速度，可切「实测排」', 3500);
    } catch (err) {
        showToast('测速失败：' + (err.message || ''), 3500);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '实测速度(前6)'; }
    }
}
async function btSmartRecommend() {
    const st = torrentBtState;
    const btn = document.getElementById('bt-smart');
    if (!st) return;
    const pool = btVisibleForTarget();
    if (!pool.length) { showToast('没有候选可供推荐', 3500); return; }
    let bestTier = 99;
    pool.forEach(c => { const r = btTierRank[c.tier] != null ? btTierRank[c.tier] : 99; if (r < bestTier) bestTier = r; });
    const bestPool = pool.filter(c => (btTierRank[c.tier] != null ? btTierRank[c.tier] : 99) === bestTier);
    if (btn) { btn.disabled = true; btn.textContent = '智能判定中…'; }
    let chosen = null;
    let measuredMbps = null;
    try {
        const probeList = st.engineOk ? bestPool.slice(0, 5) : [];
        if (probeList.length) {
            if (!st.measured) st.measured = new Map();
            const resp = await fetch('/api/torrents/measure', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locators: probeList.map(x => x.locator) })
            });
            const res = resp.ok ? await resp.json() : [];
            res.forEach((m, i) => {
                const c = probeList[i];
                if (c && c.locator) st.measured.set(btCandidateKey(c), m.mbps);
            });
            let best = 0;
            for (const c of probeList) {
                const mb = st.measured.get(btCandidateKey(c)) || 0;
                if (mb > best) { best = mb; chosen = c; measuredMbps = mb; }
            }
            if (measuredMbps != null && measuredMbps <= 0) chosen = null;
        }
        if (!chosen) {
            const seeded = bestPool.filter(c => (c.seeders || 0) > 0);
            chosen = (seeded.length ? seeded : bestPool).slice().sort((a, b) => (b.seeders || 0) - (a.seeders || 0))[0];
        }
        if (!chosen) { showToast('未能找到推荐候选', 3500); return; }
        renderBtCandidates();
        const [tierLabel] = btTierInfo(chosen.tier);
        const speedNote = measuredMbps != null ? ` · 实测 ${measuredMbps.toFixed(1)} MB/s` : (chosen.seeders ? ` · 做种 ${chosen.seeders}` : '');
        showConfirm({
            title: '智能推荐下载',
            msg: `第 ${st.ep.episodeNo} 集推荐：${chosen.title}\n来源 ${chosen.providerName || chosen.providerId} · ${tierLabel} · ${chosen.group || '?'}${chosen.resolution ? ' · ' + chosen.resolution : ''}${chosen.batch ? ' · 合集只取该集' : ''}${speedNote}`,
            okText: '下载',
            onOk: () => btQueueOne(chosen)
        });
    } catch (err) {
        showToast('智能推荐失败：' + (err.message || ''), 3500);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '智能推荐下载'; }
    }
}
(function bindBtActionBar() {
    const m = document.getElementById('bt-measure');
    if (m) m.addEventListener('click', () => btMeasureNow(6));
    const s = document.getElementById('bt-smart');
    if (s) s.addEventListener('click', () => btSmartRecommend());
})();

/** 后台任务异步跟踪：入队即返回；完成后 toast + 刷新媒体详情资产，失败 toast 原因。 */
const torrentTaskWatchers = new Map();
function watchTorrentTask(taskId, epId) {
    if (!taskId || torrentTaskWatchers.has(taskId)) return;
    torrentTaskWatchers.set(taskId, true);
    if (epId != null) markLampRun(epId);
    const poll = async () => {
        let done = false;
        try {
            const resp = await fetch(`/api/video-source-tasks/${encodeURIComponent(taskId)}`);
            if (resp.ok) {
                const task = await resp.json();
                if (task.status === 'COMPLETED') {
                    done = true;
                    showToast('BT 下载完成，已登记为该集本地源');
                    refreshAllEpLamps();
                    refreshAllClipLamps();
                    if (currentMedia && currentMedia.id && activeView() === 'media-detail') refreshMediaDetail();
                } else if (task.status === 'FAILED') {
                    done = true;
                    showToast(`BT 下载失败：${task.message || ''}`, 5000);
                    refreshAllEpLamps();
                }
            }
        } catch (err) { /* 网络抖动：下一轮再试 */ }
        if (done) {
            torrentTaskWatchers.delete(taskId);
        } else {
            setTimeout(poll, 5000);
        }
    };
    setTimeout(poll, 4000);
}

/* ---- v0.25 集行/片段卡“灯”（绿=就绪 / 黄=进行中 / 红=无或失败） ---- */
let btProductCache = { at: 0, ids: null };
async function fetchClipProductIds(force) {
    const now = Date.now();
    if (!force && btProductCache.ids && now - btProductCache.at < 60000) return btProductCache.ids;
    try {
        const r = await fetch('/api/assets/clip-products');
        btProductCache.ids = r.ok ? await r.json() : (btProductCache.ids || []);
    } catch (e) {
        btProductCache.ids = btProductCache.ids || [];
    }
    btProductCache.at = now;
    return btProductCache.ids;
}
function enqueueClipLight(card) {
    const el = card && card.querySelector('.clip-light');
    if (!el) return;
    const id = Number(el.dataset.clip);
    el.title = '检查产物…';
    fetchClipProductIds().then(set => {
        const ok = set.includes(id);
        el.classList.toggle('on', ok);
        el.classList.toggle('off', !ok);
        el.title = ok ? '已剪出产物' : '未剪出产物';
    }).catch(() => { el.classList.add('off'); el.title = '产物未知'; });
}
async function refreshAllClipLamps() {
    const ids = await fetchClipProductIds(true);
    document.querySelectorAll('.clip-light').forEach(el => {
        const id = Number(el.dataset.clip);
        const ok = ids.includes(id);
        el.classList.toggle('on', ok);
        el.classList.toggle('off', !ok);
        el.title = ok ? '已剪出产物' : '未剪出产物';
    });
}
async function refreshAllEpLamps() {
    const els = [...document.querySelectorAll('.ep-light')];
    const ids = [...new Set(els.map(el => Number(el.dataset.ep)).filter(Boolean))];
    if (!ids.length) return;
    els.forEach(el => el.title = '本地源检查中…');
    try {
        const r = await fetch('/api/assets/lights?episodeIds=' + ids.join(','));
        const data = r.ok ? await r.json() : {};
        const eps = (data && data.episodes) || {};
        els.forEach(el => {
            const m = eps[el.dataset.ep];
            if (!m) { el.classList.remove('on', 'run', 'off'); el.title = '未知'; return; }
            el.classList.remove('on', 'run', 'off');
            if (m.state === 'available') { el.classList.add('on'); el.title = m.via === 'animeko-cache' ? '本地源就绪（Animeko 整集缓存，可回顾/剪辑）' : '本地源就绪（可回顾/剪辑）'; }
            else if (m.state === 'failed') { el.classList.add('off'); el.title = '下载失败：' + (m.failReason || ''); }
            else { el.classList.add('off'); el.title = '无本地源（可 BT 下载）'; }
        });
    } catch (e) { /* 忽略：保持“检查中” */ }
}
function markLampRun(epId) {
    if (!epId) return;
    document.querySelectorAll('.ep-light').forEach(el => {
        if (Number(el.dataset.ep) === epId) { el.classList.remove('on', 'off'); el.classList.add('run'); el.title = '下载进行中…'; }
    });
}

(function initBtModalEvents() {
    const closeBtn = document.getElementById('torrent-download-close');
    if (closeBtn) closeBtn.addEventListener('click', () => { const m = document.getElementById('torrent-download-modal'); if (m) m.hidden = true; });
    const go = document.getElementById('bt-search-go');
    const input = document.getElementById('bt-search-input');
    if (go) go.addEventListener('click', () => btRunSearch());
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); btRunSearch(); } });
    const chips = document.getElementById('bt-source-chips');
    if (chips) chips.addEventListener('change', () => renderBtCandidates());
    const sel = document.getElementById('bt-download-selected');
    if (sel) sel.addEventListener('click', () => btQueueSelected());
    const sortRow = document.querySelector('.bt-sort-row');
    if (sortRow) sortRow.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-sort]');
        if (!btn || !torrentBtState) return;
        torrentBtState.sortMode = btn.dataset.sort;
        sortRow.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
        renderBtCandidates();
    });
})();

// ---------- v0.20 高光制作工作台 ----------

async function openHighlightWorkbench() {
    if (!currentMedia || !currentMedia.id) return;
    try {
        highlightStatusEl.textContent = '正在创建或恢复制作稿…';
        const resp = await fetch(`/api/media/${currentMedia.id}/highlight-project`, { method: 'POST' });
        if (!resp.ok) throw new Error(await apiMessage(resp, '创建高光制作稿失败'));
        const project = await resp.json();
        pushView('highlight');
        await loadHighlightProject(project.id, project);
    } catch (err) {
        highlightStatusEl.textContent = '';
        showToast(err.message || '打开高光工作台失败');
    }
}

async function loadHighlightProject(id, knownProject = null) {
    try {
        if (!knownProject) {
            const resp = await fetch(`/api/highlight-projects/${id}`);
            if (!resp.ok) throw new Error(await apiMessage(resp, '加载制作稿失败'));
            knownProject = await resp.json();
        }
        currentHighlight = knownProject;
        restoreHighlightConfig();
        const clipsResp = await fetch(`/api/highlight-projects/${id}/clips`);
        if (!clipsResp.ok) throw new Error(await apiMessage(clipsResp, '加载可选片段失败'));
        highlightClips = await clipsResp.json();
        renderHighlightWorkbench();
        highlightStatusEl.textContent = '';
    } catch (err) {
        highlightStatusEl.textContent = err.message || '加载高光工作台失败';
    }
}

function restoreHighlightConfig() {
    let config = {};
    try { config = JSON.parse(currentHighlight?.configJson || '{}'); } catch (e) { config = {}; }
    highlightBgmStoredPath = typeof config.bgmPath === 'string' && config.bgmPath ? config.bgmPath : null;
    highlightBgmNameEl.textContent = highlightBgmStoredPath ? (config.bgmName || '已添加') : '未添加';
    highlightBgmVolumeEl.value = Number.isFinite(config.bgmVolume) ? Math.max(0, Math.min(100, config.bgmVolume)) : 24;
    highlightBgmVolumeValueEl.textContent = `${highlightBgmVolumeEl.value}%`;
    highlightModeEl.value = config.mode === 'SAFE' ? 'SAFE' : 'FULL';
    highlightResolutionEl.value = ['720P', '1080P', '4K'].includes(config.resolution) ? config.resolution : '1080P';
    highlightStylePresetEl.value = ['cinematic', 'energetic', 'minimal'].includes(config.stylePreset) ? config.stylePreset : 'cinematic';
    highlightTransitionEl.value = ['none', 'crossfade', 'fade-black'].includes(config.transition) ? config.transition : 'none';
    highlightCardsEnabledEl.checked = config.cardsEnabled !== false;
    highlightChaptersEnabledEl.checked = config.chaptersEnabled !== false;
}

function highlightConfigJson() {
    return JSON.stringify({
        bgmPath: highlightBgmStoredPath,
        bgmName: highlightBgmStoredPath ? highlightBgmNameEl.textContent : null,
        bgmVolume: Number(highlightBgmVolumeEl.value),
        mode: highlightModeEl.value,
        resolution: highlightResolutionEl.value,
        stylePreset: highlightStylePresetEl.value,
        transition: highlightTransitionEl.value,
        cardsEnabled: highlightCardsEnabledEl.checked,
        chaptersEnabled: highlightChaptersEnabledEl.checked
    });
}

function renderHighlightWorkbench() {
    if (!currentHighlight) return;
    const items = currentHighlight.items || [];
    highlightTitleEl.textContent = currentMedia?.title ? `${currentMedia.title} · 高光推荐` : currentHighlight.name || '高光推荐';
    highlightProjectMetaEl.textContent = `草稿 #${currentHighlight.id} · 自动保存`;
    highlightNameEl.value = currentHighlight.name || '高光推荐';
    if (!highlightBgmStoredPath) highlightBgmNameEl.textContent = '未添加';
    highlightLibraryCountEl.textContent = `${highlightClips.length} 条片段`;
    highlightTimelineCountEl.textContent = `${items.length} 段`;
    const selected = new Set(items.map(item => item.clipId));
    renderHighlightLibrary(selected);
    renderHighlightTimeline(items);
    renderHighlightEstimate(items);
    renderHighlightMissing(items);
    renderHighlightExports(currentHighlight.exports || []);
    const latestPreview = (currentHighlight.exports || []).find(e => e.preview && e.status === 'DONE' && e.outputUrl);
    if (latestPreview) {
        highlightPreviewPanelEl.hidden = false;
        highlightPreviewExportId = latestPreview.id;
        highlightPreviewVideoEl.src = latestPreview.outputUrl + '?v=' + encodeURIComponent(latestPreview.finishedAt || latestPreview.id);
        highlightPreviewStatusEl.textContent = latestPreview.partial ? '当前可用版预览' : '完整预览';
    }
}

function renderHighlightLibrary(selected) {
    highlightLibraryEl.innerHTML = '';
    if (!highlightClips.length) {
        highlightLibraryEl.innerHTML = '<div class="highlight-empty">该媒体还没有可选片段。先在视频中打标，再回来制作高光推荐。</div>';
        return;
    }
    const byEpisode = new Map();
    for (const clip of highlightClips) {
        const key = String(clip.episodeId || 'legacy');
        if (!byEpisode.has(key)) byEpisode.set(key, []);
        byEpisode.get(key).push(clip);
    }
    for (const clips of byEpisode.values()) {
        const section = document.createElement('section');
        section.className = 'highlight-library-group';
        const head = document.createElement('div');
        head.className = 'highlight-library-group-head';
        head.textContent = clips[0].title || `片段组 · ${clips.length} 段`;
        section.appendChild(head);
        for (const clip of clips) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'highlight-source-card' + (selected.has(clip.id) ? ' selected' : '');
            const cover = clip.coverPath || clip.detailCoverPath;
            card.innerHTML = `${cover ? `<img src="${esc(cover)}" alt="">` : '<span class="highlight-source-cover-placeholder">▶</span>'}
                <span class="highlight-source-info"><b></b><small></small><em>${selected.has(clip.id) ? '已加入' : '加入时间线'}</em></span>`;
            card.querySelector('b').textContent = clip.title || '未命名片段';
            card.querySelector('small').textContent = `${fmtTime(clip.timestampSec || 0)}${clip.endSec != null ? ` – ${fmtTime(clip.endSec)}` : ' · 未设终点'}${clip.tag ? ` · ${clip.tag}` : ''}`;
            card.addEventListener('click', () => selected.has(clip.id) ? focusHighlightItem(clip.id) : addHighlightItem(clip.id));
            section.appendChild(card);
        }
        highlightLibraryEl.appendChild(section);
    }
}

function renderHighlightTimeline(items) {
    highlightTimelineEl.innerHTML = '';
    highlightEmptyEl.hidden = items.length > 0;
    for (const item of items) {
        const clip = highlightClips.find(c => c.id === item.clipId) || {};
        const row = document.createElement('article');
        row.className = 'highlight-timeline-item';
        row.draggable = true;
        row.dataset.itemId = item.id;
        const cover = clip.coverPath || clip.detailCoverPath;
        const sourceState = item.sourceState || 'PENDING';
        const sourceLabel = { READY: '素材就绪', PREPARING: '准备中', PENDING: '待准备', UNAVAILABLE: '不可用', FAILED: '失败' }[sourceState] || sourceState;
        row.innerHTML = `<button type="button" class="highlight-drag" title="拖拽排序">⠿</button>
            <div class="highlight-item-cover">${cover ? `<img src="${esc(cover)}" alt="">` : '<span>▶</span>'}</div>
            <div class="highlight-item-body">
                <div class="highlight-item-title"><b></b><span class="highlight-source-state state-${esc(sourceState.toLowerCase())}">${sourceLabel}</span></div>
                <div class="highlight-item-controls">
                    <label>入点 <input class="highlight-in" type="number" min="0" step="0.1"></label>
                    <label>出点 <input class="highlight-out" type="number" min="0" step="0.1"></label>
                    <label>剧透 <select class="highlight-spoiler"><option value="PENDING">待确认</option><option value="SAFE">安全</option><option value="SPOILER">剧透</option></select></label>
                    <label>原声 <input class="highlight-volume" type="range" min="0" max="100"></label>
                </div>
                <input class="highlight-caption" maxlength="200" placeholder="可选：为这段高光写一句短标题">
                <div class="highlight-item-message"></div>
            </div>
            <div class="highlight-item-actions">
                <button type="button" class="btn-mini highlight-preview">预览</button>
                <button type="button" class="btn-mini highlight-prepare">${sourceState === 'READY' ? '重新准备' : '准备素材'}</button>
                <div class="highlight-direct-url"><input class="highlight-direct-url-input" type="url" placeholder="公开视频直链（可选）"><button type="button" class="btn-mini highlight-direct-url-submit">直链准备</button></div>
                <button type="button" class="btn-mini highlight-upload">上传</button>
                <input class="highlight-upload-file" type="file" accept="video/*" hidden>
                <button type="button" class="btn-mini danger highlight-remove">移除</button>
            </div>`;
        row.querySelector('.highlight-item-title b').textContent = clip.title || `片段 #${item.clipId || item.id}`;
        row.querySelector('.highlight-in').value = item.inSec ?? '';
        row.querySelector('.highlight-out').value = item.outSec ?? '';
        row.querySelector('.highlight-spoiler').value = item.spoilerState || 'PENDING';
        row.querySelector('.highlight-volume').value = item.originalVolume ?? 100;
        row.querySelector('.highlight-caption').value = item.caption || '';
        row.querySelector('.highlight-item-message').textContent = item.sourceMessage || '';
        const update = () => scheduleHighlightItemUpdate(item.id, {
            inSec: numberOrNull(row.querySelector('.highlight-in').value),
            outSec: numberOrNull(row.querySelector('.highlight-out').value),
            spoilerState: row.querySelector('.highlight-spoiler').value,
            caption: row.querySelector('.highlight-caption').value,
            originalVolume: Number(row.querySelector('.highlight-volume').value)
        });
        row.querySelectorAll('.highlight-in,.highlight-out,.highlight-spoiler,.highlight-caption,.highlight-volume').forEach(el => el.addEventListener(el.classList.contains('highlight-caption') ? 'input' : 'change', update));
        row.querySelector('.highlight-prepare').addEventListener('click', () => prepareHighlightItem(item.id));
        row.querySelector('.highlight-direct-url-submit').addEventListener('click', () => prepareHighlightDirectUrl(item.id, row.querySelector('.highlight-direct-url-input').value));
        row.querySelector('.highlight-preview').addEventListener('click', () => previewHighlightItem(item));
        row.querySelector('.highlight-upload').addEventListener('click', () => row.querySelector('.highlight-upload-file').click());
        row.querySelector('.highlight-upload-file').addEventListener('change', e => uploadHighlightItem(item.id, e.target.files?.[0]));
        row.querySelector('.highlight-remove').addEventListener('click', () => removeHighlightItem(item.id));
        row.addEventListener('dragstart', () => { highlightDraggedItemId = item.id; row.classList.add('dragging'); });
        row.addEventListener('dragend', () => { highlightDraggedItemId = null; row.classList.remove('dragging'); });
        row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drag-over'); });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('drag-over'); reorderHighlightItems(item.id); });
        highlightTimelineEl.appendChild(row);
    }
}

async function addHighlightItem(clipId) {
    await highlightRequest(`/api/highlight-projects/${currentHighlight.id}/items`, { method: 'POST', body: { clipId } });
}

function focusHighlightItem(clipId) {
    const item = (currentHighlight.items || []).find(x => x.clipId === clipId);
    document.querySelector(`[data-item-id="${item?.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function scheduleHighlightItemUpdate(itemId, body) {
    clearTimeout(highlightSaveTimer);
    highlightSaveTimer = setTimeout(() => highlightRequest(`/api/highlight-projects/${currentHighlight.id}/items/${itemId}`, { method: 'PUT', body }), 350);
}

async function removeHighlightItem(itemId) {
    await highlightRequest(`/api/highlight-projects/${currentHighlight.id}/items/${itemId}`, { method: 'DELETE' });
}

async function reorderHighlightItems(targetId) {
    if (!highlightDraggedItemId || highlightDraggedItemId === targetId) return;
    const ids = (currentHighlight.items || []).map(i => i.id);
    const from = ids.indexOf(highlightDraggedItemId), to = ids.indexOf(targetId);
    ids.splice(from, 1); ids.splice(to, 0, highlightDraggedItemId);
    await highlightRequest(`/api/highlight-projects/${currentHighlight.id}/items/reorder`, { method: 'POST', body: { itemIds: ids } });
}

async function prepareHighlightItem(itemId) {
    await highlightRequest(`/api/highlight-projects/${currentHighlight.id}/items/${itemId}/prepare`, { method: 'POST', body: null, keepStatus: true });
    pollHighlightProject();
}

async function prepareHighlightItems() {
    const pending = (currentHighlight.items || []).filter(item => item.sourceState !== 'READY' && item.sourceType === 'LOCAL_LIBRARY');
    if (!pending.length) return;
    highlightStatusEl.textContent = `正在准备 ${pending.length} 段本地素材…`;
    await Promise.all(pending.map(item => fetch(`/api/highlight-projects/${currentHighlight.id}/items/${item.id}/prepare`, { method: 'POST' }).catch(() => null)));
    for (let i = 0; i < 90; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await loadHighlightProject(currentHighlight.id);
        if (!(currentHighlight.items || []).some(item => item.sourceState === 'PREPARING')) break;
    }
    highlightStatusEl.textContent = '';
}

async function prepareHighlightDirectUrl(itemId, url) {
    const trimmed = url.trim();
    if (!trimmed) { showToast('请输入公开视频直链'); return; }
    await highlightRequest(`/api/highlight-projects/${currentHighlight.id}/items/${itemId}/direct-url`, { method: 'POST', body: { url: trimmed }, keepStatus: true });
    pollHighlightProject();
}

async function uploadHighlightItem(itemId, file) {
    if (!file) return;
    const form = new FormData(); form.append('file', file);
    try {
        highlightStatusEl.textContent = '正在上传素材…';
        const resp = await fetch(`/api/highlight-projects/${currentHighlight.id}/items/${itemId}/upload`, { method: 'POST', body: form });
        if (!resp.ok) throw new Error(await apiMessage(resp, '上传素材失败'));
        await loadHighlightProject(currentHighlight.id);
    } catch (err) { showToast(err.message || '上传素材失败'); }
    finally { highlightStatusEl.textContent = ''; }
}

function previewHighlightItem(item) {
    if (item.sourceState !== 'READY') { showToast('请先准备或上传该段素材'); return; }
    const url = `/api/highlight-projects/${currentHighlight.id}/items/${item.id}/preview`;
    const win = window.open('', '_blank');
    if (!win) { showToast('浏览器阻止了预览窗口'); return; }
    win.document.write(`<title>高光片段预览</title><style>body{margin:0;background:#05050a;display:grid;min-height:100vh;place-items:center}video{width:min(100vw,1280px);max-height:100vh}</style><video src="${esc(url)}" controls autoplay></video>`);
    win.document.close();
}

async function saveHighlightProject() {
    await highlightRequest(`/api/highlight-projects/${currentHighlight.id}`, { method: 'PUT', body: { name: highlightNameEl.value, configJson: highlightConfigJson() } });
}

function openSingleRecommendPreview() {
    if (!currentHighlight?.id) return;
    const win = window.open(`/api/highlight-projects/${currentHighlight.id}/single-preview`, '_blank');
    if (!win) showToast('浏览器阻止了模板预览窗口');
}

async function exportHighlightProject(allowPartial = false) {
    const items = currentHighlight.items || [];
    const safe = highlightModeEl.value === 'SAFE';
    const usable = safe ? items.filter(i => i.spoilerState === 'SAFE') : items;
    if (!usable.length) { showToast(safe ? '无剧透版至少需要一段标记为“安全”的片段' : '请先加入片段'); return; }
    const unready = usable.find(i => i.sourceState !== 'READY');
    if (unready && !allowPartial) { renderHighlightMissing(items); highlightMissingEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const total = highlightDuration(usable.filter(i => !allowPartial || i.sourceState === 'READY'));
    const start = () => highlightExportRequest(allowPartial);
    if (total > 20 * 60) {
        showConfirm({ title: '长成片确认', msg: `预计成片 ${fmtTime(total)}，导出可能占用较多磁盘和时间，仍要继续吗？`, okText: '继续导出', danger: false, onOk: start });
    } else start();
}

async function highlightExportRequest(allowPartial = false) {
    try {
        highlightStatusEl.textContent = '正在创建混剪导出任务…';
        const resp = await fetch(`/api/highlight-projects/${currentHighlight.id}/exports`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: highlightModeEl.value, resolution: highlightResolutionEl.value, bgmPath: highlightBgmStoredPath, bgmVolume: Number(highlightBgmVolumeEl.value), allowPartial })
        });
        if (!resp.ok) throw new Error(await apiMessage(resp, '创建混剪任务失败'));
        showToast('高光混剪已开始导出');
        await loadHighlightProject(currentHighlight.id);
        pollHighlightProject();
    } catch (err) { showToast(err.message || '创建混剪任务失败'); }
    finally { highlightStatusEl.textContent = ''; }
}

async function generateHighlightPreview() {
    const items = currentHighlight?.items || [];
    if (!items.length) { showToast('请先加入片段'); return; }
    highlightPreviewBtn.disabled = true;
    highlightPreviewPanelEl.hidden = false;
    highlightPreviewStatusEl.textContent = '准备素材中…';
    try {
        await saveHighlightProject();
        await prepareHighlightItems();
        const resp = await fetch(`/api/highlight-projects/${currentHighlight.id}/preview`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: highlightModeEl.value, bgmPath: highlightBgmStoredPath, bgmVolume: Number(highlightBgmVolumeEl.value) })
        });
        if (!resp.ok) throw new Error(await apiMessage(resp, '创建预览失败'));
        const preview = await resp.json();
        highlightPreviewExportId = preview.id;
        highlightPreviewStatusEl.textContent = preview.partial ? '正在生成可用素材版预览…' : '正在生成预览…';
        await loadHighlightProject(currentHighlight.id);
        await watchHighlightPreview(preview.id);
    } catch (err) { showToast(err.message || '生成预览失败'); highlightPreviewStatusEl.textContent = ''; }
    finally { highlightPreviewBtn.disabled = false; }
}

async function watchHighlightPreview(exportId) {
    for (let i = 0; i < 180; i++) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const resp = await fetch(`/api/highlight-projects/exports/${exportId}`);
        if (!resp.ok) continue;
        const data = await resp.json();
        highlightPreviewStatusEl.textContent = data.status === 'RUNNING' || data.status === 'PENDING' ? (data.stage || '正在生成预览…') : '';
        if (data.status === 'DONE') {
            highlightPreviewPanelEl.hidden = false;
            highlightPreviewVideoEl.src = data.outputUrl + '?v=' + encodeURIComponent(data.finishedAt || data.id);
            highlightPreviewStatusEl.textContent = data.partial ? '当前可用版预览' : '完整预览';
            await loadHighlightProject(currentHighlight.id);
            return;
        }
        if (data.status === 'ERROR' || data.status === 'CANCELLED') throw new Error(data.message || '预览生成失败');
    }
    throw new Error('预览生成超时，请查看导出记录');
}

let highlightPollTimer = null;
function pollHighlightProject() {
    if (highlightPollTimer) clearInterval(highlightPollTimer);
    highlightPollTimer = setInterval(async () => {
        if (!currentHighlight || activeView() !== 'highlight') { clearInterval(highlightPollTimer); highlightPollTimer = null; return; }
        await loadHighlightProject(currentHighlight.id);
        const active = (currentHighlight.exports || []).some(e => e.status === 'PENDING' || e.status === 'RUNNING')
            || (currentHighlight.items || []).some(i => i.sourceState === 'PREPARING');
        if (!active) { clearInterval(highlightPollTimer); highlightPollTimer = null; }
    }, 1800);
}

function renderHighlightEstimate(items) {
    const full = highlightDuration(items);
    const safe = highlightDuration(items.filter(i => i.spoilerState === 'SAFE'));
    const ready = items.filter(i => i.sourceState === 'READY').length;
    const groups = new Set(items.map(i => (highlightClips.find(c => c.id === i.clipId) || {}).episodeId).filter(v => v != null));
    const chapterHint = items.length >= 4 && groups.size >= 2 ? ' · 将按集显示章节' : '';
    highlightEstimateEl.innerHTML = `<b>制作概览</b><span>全量 ${fmtTime(full)} · 无剧透 ${fmtTime(safe)}</span><span>素材就绪 ${ready}/${items.length}${chapterHint}</span><span>默认输出 MP4 / 1080P · 超过 20 分钟只提醒，不自动删片。</span>`;
}

function renderHighlightMissing(items) {
    const missing = items.filter(i => i.sourceState !== 'READY');
    if (!missing.length) { highlightMissingEl.hidden = true; highlightMissingEl.innerHTML = ''; return; }
    const rows = missing.map(item => {
        const clip = highlightClips.find(c => c.id === item.clipId) || {};
        const title = clip.title || `片段 #${item.clipId || item.id}`;
        return `<li>${esc(title)} · ${esc(item.sourceMessage || ({ PREPARING: '正在准备', PENDING: '尚未准备', FAILED: '准备失败', UNAVAILABLE: '暂无可用素材' }[item.sourceState] || '素材不可用'))}</li>`;
    }).join('');
    highlightMissingEl.hidden = false;
    highlightMissingEl.innerHTML = `<strong>有 ${missing.length} 段未准备，预览将只使用已就绪素材</strong><ul class="highlight-missing-list">${rows}</ul><div class="highlight-missing-actions"><button type="button" class="btn-mini" data-highlight-partial>导出当前可用版</button><button type="button" class="btn-mini" data-highlight-complete>补齐素材后再导出</button></div>`;
    highlightMissingEl.querySelector('[data-highlight-partial]').addEventListener('click', async () => {
        const ok = await confirmAsync({ title: '导出当前可用版', msg: `仍有 ${missing.length} 段未准备，本次视频会明确排除这些片段。确定导出当前可用版吗？`, okText: '导出可用版' });
        if (ok) exportHighlightProject(true);
    });
    highlightMissingEl.querySelector('[data-highlight-complete]').addEventListener('click', () => highlightTimelineEl.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

function renderHighlightExports(exports) {
    highlightExportsEl.innerHTML = '';
    if (!exports.length) { highlightExportsEl.innerHTML = '<span class="highlight-empty-small">尚未导出成片</span>'; return; }
    for (const item of exports) {
        const row = document.createElement('div');
        row.className = 'highlight-export-row';
        const status = document.createElement('span');
        status.className = `state-${(item.status || '').toLowerCase()}`;
        status.textContent = item.status || 'UNKNOWN';
        const meta = document.createElement('span');
        const kind = item.preview ? '预览' : (item.partial ? '部分版' : '正式版');
        meta.textContent = `${kind} · ${item.mode === 'SAFE' ? '无剧透版' : '全量版'} · ${fmtDateTime(item.createdAt)}`;
        row.append(status, meta);
        if (item.outputUrl) {
            const open = document.createElement('a');
            open.href = item.outputUrl; open.target = '_blank'; open.textContent = '打开';
            row.appendChild(open);
        }
        if (item.status === 'PENDING' || item.status === 'RUNNING') {
            const cancel = document.createElement('button');
            cancel.type = 'button'; cancel.className = 'btn-mini danger'; cancel.textContent = '取消';
            cancel.addEventListener('click', () => cancelHighlightExport(item.id));
            row.appendChild(cancel);
        } else {
            const remove = document.createElement('button');
            remove.type = 'button'; remove.className = 'btn-mini danger'; remove.textContent = '删除';
            remove.addEventListener('click', () => deleteHighlightExport(item.id));
            row.appendChild(remove);
        }
        if (item.message || item.stage || item.sceneMessage) {
            const message = document.createElement('small');
            message.title = [item.stage, item.sceneMessage, item.message].filter(Boolean).join(' · ');
            message.textContent = [item.stage, item.sceneMessage, item.message].filter(Boolean).join(' · ');
            row.appendChild(message);
        }
        highlightExportsEl.appendChild(row);
    }
}

async function cancelHighlightExport(exportId) {
    await highlightRequest(`/api/highlight-projects/exports/${exportId}/cancel`, { method: 'POST', body: null });
}

async function deleteHighlightExport(exportId) {
    showConfirm({ title: '删除成片记录', msg: '将删除该次导出的成片文件，草稿不会受影响。', okText: '删除', danger: true,
        onOk: () => highlightRequest(`/api/highlight-projects/exports/${exportId}`, { method: 'DELETE', body: null }) });
}

async function highlightRequest(url, { method, body, keepStatus = false }) {
    try {
        if (!keepStatus) highlightStatusEl.textContent = '正在保存制作稿…';
        const resp = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
        if (!resp.ok) throw new Error(await apiMessage(resp, '保存制作稿失败'));
        if (method !== 'DELETE' || body) {
            const project = await resp.json().catch(() => null);
            if (project && project.items) { currentHighlight = project; renderHighlightWorkbench(); }
            else await loadHighlightProject(currentHighlight.id);
        } else await loadHighlightProject(currentHighlight.id);
    } catch (err) { showToast(err.message || '保存制作稿失败'); }
    finally { if (!keepStatus) highlightStatusEl.textContent = ''; }
}

function highlightDuration(items) {
    return items.reduce((total, item) => total + Math.max(0, Number(item.outSec || 0) - Number(item.inSec || 0)), 0);
}

function numberOrNull(value) { return value === '' ? null : Number(value); }

async function apiMessage(resp, fallback) {
    try { const body = await resp.json(); return body?.message || fallback; } catch (e) { return fallback; }
}

// ---------- 媒体格式 / 子分类 ----------

function formatName(code) {
    if (!code) return '';
    const f = formatsCache.find(x => x.code === code);
    return f ? f.name : code;
}

/** 媒体来源 → 完整展示名（详情 meta 用；角标用短名直接内联）。 */
function mediaSourceLabel(s) {
    if (s === 'BANGUMI') return 'Bangumi 同步';
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
    fillMediaFilterDict();
    fillCollYearFilter();
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

/**
 * 子分类筛选已在 2026-09-25 移除（用户拍板「删掉」）：真库里 `media.subcategory` 5254/5255 是 null，
 * 筛不出东西，是死选项（同理删掉了「待确认」—— confirmed 全库 5255 条全是 1）。
 *
 * 函数与两个调用点（loadFormats / selectFormatTab）保留为 no-op，以后数据长起来再挂回浮层。
 */
function fillSubcategoryFilter() {
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
    const known = eps.filter(ep => ep.episodeNo != null).sort((a, b) => (a.episodeNo || 0) - (b.episodeNo || 0));
    const unknown = eps.filter(ep => ep.episodeNo == null);
    if (known.length > 0) {
        const listEl = document.createElement('div');
        listEl.className = 'episode-group-list';
        for (const ep of known) listEl.appendChild(buildEpisodeRow(ep, false));
        episodeListEl.appendChild(listEl);
    }
    if (unknown.length > 0) {
        const groupEl = document.createElement('div');
        groupEl.className = 'episode-group unknown';
        const head = document.createElement('div');
        head.className = 'episode-group-head';
        head.innerHTML = '未识别集号 <span class="ep-unknown-tip">集号未识别，点击集进详情「编辑集号」修正</span>';
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
    row.className = 'episode-row' + (unknown ? ' ep-unknown' : '') + ' ep-compact';
    const no = unknown ? '？' : (ep.episodeNo != null ? `第${ep.episodeNo}集` : '?');
    const coverHtml = ep.coverPath
        ? `<div class="ep-cover"><img src="${ep.coverPath}" alt="" loading="lazy" onerror="this.parentElement.classList.add('broken')"></div>`
        : `<div class="ep-cover ep-cover-empty">${unknown ? '？' : (ep.episodeNo || '?')}</div>`;
    row.innerHTML = `
        <div class="ep-no"></div>
        ${coverHtml}
        <div class="ep-main">
            <div class="ep-title"></div>
            <div class="ep-meta"></div>
            <div class="ep-tags"></div>
        </div>
        <div class="ep-menu-wrap">
            <button type="button" class="ep-more" aria-label="更多操作">⋯</button>
            <div class="ep-menu">
                <button type="button" class="ep-menu-item ep-cover-btn">封面</button>
                <button type="button" class="ep-menu-item ep-tag-btn">打标签</button>
                <button type="button" class="ep-menu-item ep-time-btn">时间线</button>
                <button type="button" class="ep-menu-item ep-bt-btn">BT 下载</button>
                <button type="button" class="ep-menu-item ep-del-btn danger">删除</button>
            </div>
        </div>`;
    row.querySelector('.ep-no').textContent = no;
    row.querySelector('.ep-title').textContent = ep.title || '(未命名)';
    row.querySelector('.ep-meta').textContent = (ep.clipCount || 0) + ' 条片段'
        + (ep.latestAt ? ` · 最近标记 ${fmtDateTime(ep.latestAt)}` : '');
    if (ep.watchedAt) {
        const w = document.createElement('span');
        w.className = 'ep-watched';
        w.textContent = '✓ 已看';
        w.title = `看过：${fmtDateTime(ep.watchedAt)}`;
        row.querySelector('.ep-meta').appendChild(w);
    }
    const tagsEl = row.querySelector('.ep-tags');
    for (const t of (ep.tags || [])) {
        const chip = document.createElement('span');
        chip.className = 'ep-tag-chip';
        chip.textContent = String(t.name || '').slice(0, 12);
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
    // 按钮事件（收进 ⋯ 菜单，功能保持）
    row.querySelector('.ep-tag-btn').addEventListener('click', (e) => {
        e.stopPropagation(); openEpisodeTagModal(ep);
    });
    row.querySelector('.ep-cover-btn').addEventListener('click', (e) => {
        e.stopPropagation(); openEpisodeCoverModal(ep);
    });
    row.querySelector('.ep-time-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        fromMediaDetail = true;
        openTimeline({ fp: ep.videoFp, title: (currentMedia.title || '') + (unknown ? ' · 未识别' : ` · 第${ep.episodeNo}集`) });
    });
    row.querySelector('.ep-bt-btn')?.addEventListener('click', (e) => { e.stopPropagation(); if (currentMedia && currentMedia.id) openEpisodeBtDownloadModal(currentMedia, ep); });
    row.querySelector('.ep-del-btn').addEventListener('click', (e) => {
        e.stopPropagation(); deleteEpisode(ep);
    });
    // ⋯ 菜单开合（点外部关闭由全局处理）
    row.querySelector('.ep-more').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = row.querySelector('.ep-menu');
        document.querySelectorAll('.ep-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
        menu.classList.toggle('open');
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
    mediaSeasonInput.value = '1';
    mediaNoteInput.value = '';
    if (mediaAllowHardsub) mediaAllowHardsub.checked = false;
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
    mediaSeasonInput.value = d.season != null ? d.season : '1';
    mediaNoteInput.value = d.note || '';
    if (mediaAllowHardsub) mediaAllowHardsub.checked = !!d.allowHardsub;
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
        season: mediaSeasonInput.value === '' ? 1 : Number(mediaSeasonInput.value),
        note: mediaNoteInput.value.trim(),
        allowHardsub: mediaAllowHardsub ? mediaAllowHardsub.checked : false
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

function openRenameModal() {
    renameTitleInput.value = '';
    mergeSearchEl.value = '';
    mergeCandidatesEl.hidden = true;
    mergeCandidatesEl.innerHTML = '';
    mergeTargetId = null;
    mergeTargetTitle = '';
    renameModal.hidden = false;
    renameTitleInput.focus();
}

/** 合并目标搜索：输入防抖 300ms → /api/media?q= 模糊搜索候选（排除当前媒体），点选回填。 */
mergeSearchEl.addEventListener('input', () => {
    if (mergeSearchEl.value !== mergeTargetTitle) { mergeTargetId = null; mergeTargetTitle = ''; }
    clearTimeout(mergeSearchTimer);
    mergeSearchTimer = setTimeout(async () => {
        const q = mergeSearchEl.value.trim();
        if (!q) { mergeCandidatesEl.hidden = true; mergeCandidatesEl.innerHTML = ''; return; }
        try {
            const resp = await fetch(`/api/media?q=${encodeURIComponent(q)}&limit=8`);
            if (!resp.ok) return;
            const list = await resp.json();
            mergeCandidatesEl.innerHTML = '';
            const items = list.filter(a => a.id !== (currentMedia && currentMedia.id));
            if (items.length === 0) {
                mergeCandidatesEl.innerHTML = '<div class="merge-cand-empty">无匹配媒体</div>';
            }
            for (const a of items) {
                const item = document.createElement('div');
                item.className = 'merge-cand-item';
                const meta = [];
                if (a.year) meta.push(`${a.year} 年`);
                if (a.subcategory) meta.push(a.subcategory);
                item.innerHTML = `<span class="merge-cand-title">${esc(a.title)}</span>`
                    + (meta.length ? `<span class="merge-cand-meta">${meta.join(' · ')}</span>` : '');
                item.addEventListener('click', () => {
                    mergeTargetId = a.id;
                    mergeTargetTitle = a.title;
                    mergeSearchEl.value = a.title;
                    mergeCandidatesEl.hidden = true;
                });
                mergeCandidatesEl.appendChild(item);
            }
            mergeCandidatesEl.hidden = false;
        } catch (e) { /* 忽略 */ }
    }, 300);
});
mergeSearchEl.addEventListener('blur', () => setTimeout(() => { mergeCandidatesEl.hidden = true; }, 150));

async function saveRename() {
    if (!currentMedia) return;
    const title = renameTitleInput.value.trim();
    if (mergeTargetId) {
        // 优先合并
        await fetch(`/api/media/${currentMedia.id}/merge?into=${mergeTargetId}`, { method: 'POST' });
        renameModal.hidden = true;
        showView('media');
    } else if (title) {
        // 改名：先查重名（标题有变化才查），命中弹三选一
        if (title !== currentMedia.title) {
            const dup = await findExactDuplicate(title);
            if (dup) { showRenameDupe(dup, title); return; }
        }
        await doRename(title);
    } else {
        renameModal.hidden = true;
    }
}

/** 精确同名检测：/api/media?q= 模糊命中后精确比较 title，排除当前媒体。 */
async function findExactDuplicate(title) {
    try {
        const resp = await fetch(`/api/media?q=${encodeURIComponent(title)}&limit=20`);
        if (!resp.ok) return null;
        const list = await resp.json();
        return list.find(a => a.title === title && a.id !== currentMedia.id) || null;
    } catch (e) { return null; }
}

async function doRename(title) {
    await fetch(`/api/media/${currentMedia.id}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
    });
    renameModal.hidden = true;
    refreshMediaDetail();
}

function showRenameDupe(dup, title) {
    renameDupeMsg.textContent = `库中已有同名媒体「${dup.title}」${dup.year ? '（' + dup.year + ' 年）' : ''}，怎么处理？`;
    renameDupeResolve = { dup, title };
    renameDupeModal.hidden = false;
}

function deleteMedia() {
    if (!currentMedia) return;
    showConfirm({
        title: `删除媒体「${currentMedia.title}」`,
        msg: `将媒体「${currentMedia.title}」移入回收站？本地集、片段和标签会保留，但 Bangumi 关联将释放；恢复后需重新关联。`,
        okText: '删除',
        onOk: async () => {
            await fetch(`/api/media/${currentMedia.id}`, { method: 'DELETE' });
            // 从哪来回哪去：详情页来源已由 pushView 入栈，删除后返回来源视图并自动刷新（收藏夹/媒体/搜索/时间线）
            // 栈空（深链/刷新后无来源）兜底回媒体页
            if (viewHistory.length > 0) goBack();
            else showView('media');
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
/** 标签页：词条数就几十~几百，所以“过滤 + 排序 + 分页”全在本地做 —— 排序/开关即时生效，不用等后端。 */
function tagRefCount(t) { return (t.mediaCount || 0) + (t.episodeCount || 0) + (t.clipCount || 0); }
function tagIsOrphan(t) { return tagRefCount(t) === 0; }

/** 媒体作用域 chips（可单个 × 掉） */
function renderTagScopeChips() {
    if (!tagScopeChipsEl) return;
    tagScopeChipsEl.innerHTML = '';
    if (tagScopeMediaId == null) return;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.title = '移除媒体条件';
    chip.innerHTML = `<span>媒体：${esc(tagScopeMediaName || ('#' + tagScopeMediaId))}</span><span class="fc-x">×</span>`;
    chip.addEventListener('click', () => setTagScope(null, ''));
    tagScopeChipsEl.appendChild(chip);
}

/** 设置媒体作用域（null = 全量词表） */
function setTagScope(mediaId, mediaName) {
    tagScopeMediaId = mediaId == null ? null : Number(mediaId);
    tagScopeMediaName = mediaName || '';
    tagPage = 1;
    renderTagScopeChips();
    loadTags();
}

/** 过滤 + 排序 + 分页（本地）→ 写入 tagListCache / tagTotal */
function applyTagPipeline() {
    const q = tagFilterEl.value.trim().toLowerCase();
    let rows = tagAllRows.slice();
    if (q) rows = rows.filter(t => t.name.toLowerCase().includes(q));
    if (tagOnlyOrphanFilter) rows = rows.filter(tagIsOrphan);
    const dir = tagSortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
        let r;
        if (tagSort === 'name') r = a.name.localeCompare(b.name, 'zh-Hans-CN');
        else if (tagSort === 'created') r = (a.createdAt || 0) - (b.createdAt || 0);
        else r = tagRefCount(a) - tagRefCount(b);
        if (r === 0) r = a.id - b.id;   // 全序：分页才不跳行
        return r * dir;
    });
    tagTotal = rows.length;
    const pages = Math.max(1, Math.ceil(tagTotal / tagPageSize));
    if (tagPage > pages) tagPage = pages;
    const from = (tagPage - 1) * tagPageSize;
    tagListCache = rows.slice(from, from + tagPageSize);
    // 勾选只保留本页仍在列表里的
    const ids = new Set(tagListCache.map(t => t.id));
    for (const id of [...tagSelected]) if (!ids.has(id)) tagSelected.delete(id);
}

/** 统计条：总数 / 已引用 / 未引用（未引用才是本页要盯的治理指标） */
function renderTagStats() {
    if (!tagStatsEl) return;
    const total = tagAllRows.length;
    const orphan = tagAllRows.filter(tagIsOrphan).length;
    tagStatsEl.innerHTML = '';
    const add = (label, value, cls) => {
        const s = document.createElement('span');
        s.className = 'tag-stat' + (cls ? ' ' + cls : '');
        s.innerHTML = `<b>${value}</b>${label}`;
        tagStatsEl.appendChild(s);
    };
    add(' 个词条', total);
    add(' 已引用', total - orphan);
    add(' 未引用', orphan, orphan > 0 ? 'warn' : '');
}

async function loadTags() {
    tagSelected.clear();
    updateTagBatchBtn();
    if (tagCheckAll) tagCheckAll.checked = false;
    tagStatusEl.textContent = '加载中…';
    try {
        const params = new URLSearchParams({ size: '10000' });
        if (tagScopeMediaId != null) params.set('mediaId', String(tagScopeMediaId));
        const resp = await fetch(`/api/tags/manage?${params.toString()}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        tagAllRows = data.items || [];
        tagStatusEl.textContent = '';
        renderTagStats();
        applyTagPipeline();
        renderTagList();
        updateTagPager();
    } catch (err) {
        const msg = String((err && err.message) || err || '未知错误');
        tagStatusEl.textContent = /Failed to fetch|NetworkError|Load failed|Network request failed/i.test(msg)
            ? `加载失败：后端未响应（${msg}）`
            : `加载失败：${msg}`;
        if (window.console) console.error('[loadTags]', err);
    }
}

function updateTagPager() {
    if (!tagPager) return;
    const pages = Math.max(1, Math.ceil(tagTotal / tagPageSize));
    tagPager.hidden = tagTotal <= tagPageSize;
    if (tagCheckAllWrap) tagCheckAllWrap.hidden = tagListCache.length === 0;
    tagPageInfo.textContent = `第 ${Math.min(tagPage, pages)} / ${pages} 页 · 共 ${tagTotal} 个`;
    tagPagePrev.disabled = tagPage <= 1;
    tagPageNext.disabled = tagPage >= pages;
}

/** 空态：两种 —— 词表为空（引导怎么建词条）/ 筛选无结果（一键清条件） */
function renderTagEmpty() {
    tagListEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'tag-empty';
    const filtered = tagFilterEl.value.trim() !== '' || tagOnlyOrphanFilter || tagScopeMediaId != null;
    if (filtered) {
        box.innerHTML = '<b>没有命中的词条</b><span>换个关键词，或者把筛选条件清掉。</span>';
        const clear = document.createElement('button');
        clear.type = 'button'; clear.className = 'btn-mini'; clear.textContent = '清空筛选';
        clear.addEventListener('click', () => {
            tagFilterEl.value = '';
            tagOnlyOrphanEl.checked = false;
            tagOnlyOrphanFilter = false;
            setTagScope(null, '');
        });
        box.appendChild(clear);
    } else {
        box.innerHTML = '<b>词表还是空的</b><span>词条在打标时创建：在媒体 / 集 / 片段上打标 → 输入新名字 → 选「＋新建词条并打上」；'
            + '也可以在这里批量新增（一行一个、或逗号分隔）。</span>';
        const add = document.createElement('button');
        add.type = 'button'; add.className = 'btn-mini'; add.textContent = '＋ 新增词条';
        add.addEventListener('click', openTagAdd);
        box.appendChild(add);
    }
    tagListEl.appendChild(box);
}

function renderTagList() {
    tagListEl.innerHTML = '';
    if (tagListCache.length === 0) {
        renderTagEmpty();
        return;
    }
    const q = tagFilterEl.value.trim();
    for (const t of tagListCache) {
        tagListEl.appendChild(buildTagRow(t, q));
    }
}

/** 单行：复选框（仅孤儿可勾）+ 名称（双击就地改名）+ 三级计数（点开使用位置）+ 行内操作 */
function buildTagRow(t, q) {
    const orphan = tagIsOrphan(t);
    const row = document.createElement('div');
    row.className = 'tag-row' + (orphan ? ' orphan' : '') + (tagExpandedId === t.id ? ' expanded' : '');
    row.dataset.tagId = String(t.id);

    // 复选框：被引用的词条**当场禁掉**，不用等到提交才整体拒绝
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'tag-check';
    cb.disabled = !orphan;
    cb.checked = tagSelected.has(t.id);
    cb.title = orphan ? '勾选后可批量删除' : '仍被引用，不能删除';
    cb.addEventListener('change', () => {
        if (cb.checked) tagSelected.add(t.id); else tagSelected.delete(t.id);
        updateTagBatchBtn();
    });
    row.appendChild(cb);

    // 展开箭头 + 名称（双击就地改名）
    const caret = document.createElement('button');
    caret.type = 'button';
    caret.className = 'tag-caret';
    caret.textContent = tagExpandedId === t.id ? '▾' : '▸';
    caret.title = '展开/收起 使用位置';
    caret.addEventListener('click', (e) => { e.stopPropagation(); toggleTagUsage(t); });
    row.appendChild(caret);

    const names = document.createElement('span');
    names.className = 'tag-names-wrap';
    const name = document.createElement('span');
    name.className = 'tag-name';
    if (q) name.innerHTML = hl(t.name, q); else name.textContent = t.name;
    name.title = '双击改名';
    name.addEventListener('dblclick', () => startInlineTagRename(t, name));
    names.appendChild(name);
    if (orphan) {
        const badge = document.createElement('span');
        badge.className = 'tag-orphan';
        badge.textContent = '未引用';
        names.appendChild(badge);
    }
    row.appendChild(names);

    const counts = document.createElement('span');
    counts.className = 'tag-counts';
    counts.title = '点开看“谁在用”';
    counts.addEventListener('click', () => toggleTagUsage(t));
    for (const [label, value] of [['媒体', t.mediaCount], ['集', t.episodeCount], ['片段', t.clipCount]]) {
        const s = document.createElement('span');
        s.className = 'stat-' + tagStatTier(value || 0);
        s.textContent = `${label} ${value || 0}`;
        counts.appendChild(s);
    }
    row.appendChild(counts);

    const actions = document.createElement('span');
    actions.className = 'tag-actions';
    const btnRename = document.createElement('button');
    btnRename.type = 'button'; btnRename.className = 'btn-mini'; btnRename.textContent = '改名';
    btnRename.addEventListener('click', () => openTagRename(t));
    const btnMerge = document.createElement('button');
    btnMerge.type = 'button'; btnMerge.className = 'btn-mini'; btnMerge.textContent = '合并到…';
    btnMerge.addEventListener('click', () => openTagMerge(t));
    const btnDel = document.createElement('button');
    btnDel.type = 'button'; btnDel.className = 'btn-mini danger'; btnDel.textContent = '删除';
    btnDel.disabled = !orphan;
    btnDel.title = orphan ? '删除这个词条' : '仍被引用：先合并到别的词条，或把关联摘掉';
    btnDel.addEventListener('click', () => confirmTagDelete(t));
    actions.append(btnRename, btnMerge, btnDel);
    row.appendChild(actions);

    if (tagExpandedId === t.id) row.appendChild(buildTagUsageInline(t));
    return row;
}

/** 行内展开的使用位置（三组；媒体条目可点 → 跳媒体页按该标签筛选） */
function buildTagUsageInline(t) {
    const box = document.createElement('div');
    box.className = 'tag-usage-inline';
    const cached = tagUsageCache.get(t.id);
    if (!cached) {
        box.innerHTML = '<div class="status">读取使用位置…</div>';
        fetch(`/api/tags/usage?tagId=${t.id}`)
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (data) tagUsageCache.set(t.id, data);
                const fresh = tagListEl.querySelector(`.tag-row[data-tag-id="${t.id}"] .tag-usage-inline`);
                if (fresh) fresh.replaceWith(buildTagUsageInline(t));
            })
            .catch(() => {});
        return box;
    }
    const group = (label, items, render) => {
        const g = document.createElement('div');
        g.className = 'tag-usage-group';
        const head = document.createElement('div');
        head.className = 'tag-usage-head';
        head.textContent = `${label} · ${items.length}`;
        g.appendChild(head);
        if (items.length > 0) {
            const list = document.createElement('div');
            list.className = 'tag-usage-list';
            items.forEach(item => list.appendChild(render(item)));
            g.appendChild(list);
        }
        return g;
    };
    const chipBtn = (text, title, onClick) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-mini'; b.textContent = text; b.title = title;
        b.addEventListener('click', onClick);
        return b;
    };
    box.append(
        group('媒体', cached.media || [], m => chipBtn(m.title || ('#' + m.id), '去媒体页按这个词筛选',
            () => jumpToMediaTagFilter(t))),
        group('集', cached.episodes || [], e => {
            const s = document.createElement('span'); s.className = 'chip'; s.textContent = e.title || ('集 #' + e.id); return s;
        }),
        group('片段', cached.clips || [], c => {
            const s = document.createElement('span'); s.className = 'chip'; s.textContent = c.title || ('片段 #' + c.id); return s;
        }));
    if ((cached.total || 0) === 0) {
        const note = document.createElement('div');
        note.className = 'status';
        note.textContent = '这个词还没被任何地方引用 —— 要么合并到别的词条，要么删掉。';
        box.appendChild(note);
    }
    return box;
}

/** 展开/收起某行的使用位置（手风琴：一次只展开一行，列表高度不抖） */
function toggleTagUsage(t) {
    tagExpandedId = tagExpandedId === t.id ? null : t.id;
    renderTagList();
}

/** 跳媒体页并按该标签筛选（媒体视角：三级任一层命中即算） */
function jumpToMediaTagFilter(t) {
    /*
     * 先设状态再切视图：`showView('media')` 自己会 loadMedia，这样那一笔就带着新筛选。
     *
     * ⚠️ 必须把媒体页的 tab 切回「全部媒体」（2026-10-02 用户报「从标签点媒体跳转失败」）：
     * 默认 tab 是「最近观看」→ `mediaMode='recent'` → 走 `/api/media/recent?latest=true`，
     * 会把这个标签的媒体**再交一次**「看过/打过标记」——实测性转 19 部只剩 **1 部**，
     * 看着就像没跳成功。跳转语义是「看**所有**用这个词的媒体」（标签页上写的也是 19）。
     */
    mediaMode = 'all';
    document.querySelectorAll('.media-tabs .atab').forEach(b => b.classList.toggle('active', b.dataset.mediaTab === 'all'));
    mediaFilter.tagIds = [String(t.id)];
    mediaFilter.mode.tagIds = 'AND';
    mediaFilter.collectionId = [];
    renderFilterChips();
    showView('media');
    // 之前可能停在回收站 → 恢复主区（内部那次 loadMedia 也带着已设好的筛选；序号保护保证结果正确）
    backToMedia();
    showToast(`已按标签「${t.name}」筛选媒体（全部媒体）`);
}

/** 双击名称就地改名（Enter 保存 / Esc 取消；撞名引导去合并） */
async function startInlineTagRename(t, nameEl) {
    const input = document.createElement('input');
    input.className = 'tag-name-input';
    input.value = t.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = async (save) => {
        if (done) return;
        done = true;
        const next = input.value.trim();
        if (!save || !next || next === t.name) { renderTagList(); return; }
        try {
            const resp = await fetch(`/api/tags/${t.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: next })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                showToast((err && err.message) || '改名失败', 3500);
                renderTagList();
                return;
            }
            invalidateTagPool();
            tagUsageCache.delete(t.id);
            await loadTags();
        } catch (e) {
            showToast('请求失败', 3000);
            renderTagList();
        }
    };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
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
    const impactEl = document.getElementById('tag-merge-impact');
    if (impactEl) { impactEl.hidden = true; impactEl.textContent = ''; }
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

/** 合并影响面预览（v0.31）：先把“源几处 / 目标几处 → 合并后几处”给人看明白（合并不可撤销）。 */
async function refreshTagMergeImpact() {
    const impactEl = document.getElementById('tag-merge-impact');
    const toId = Number(tagMergeIntoEl.value);
    if (!impactEl) return;
    if (!toId) { impactEl.hidden = true; impactEl.textContent = ''; return; }
    impactEl.hidden = false;
    impactEl.textContent = '读取影响面…';
    try {
        const resp = await fetch(`/api/tags/impact?fromId=${tagMergeId}&toId=${toId}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        impactEl.textContent = `影响面：源「${data.from.name}」${data.from.total} 处`
            + ` ＋ 目标「${data.to.name}」${data.to.total} 处`
            + ` → 合并后共 ${data.from.total + data.to.total} 处（源词条将被删除）`;
    } catch (e) {
        impactEl.textContent = `影响面读取失败：${e.message}`;
    }
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

/** 懒加载全量词库 name→id（新增实时去重用、打标「名字→tagId」用；词条变化后清空重拉）。 */
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
/** 批量删除按钮与选中数提示：没有可删的就不显示（被引用的词条根本勾不上） */
function updateTagBatchBtn() {
    const n = tagSelected.size;
    if (tagBatchDelBtn) {
        tagBatchDelBtn.hidden = n === 0;
        tagBatchDelBtn.textContent = `🗑 批量删除(${n})`;
    }
    if (tagSelectedInfoEl) {
        tagSelectedInfoEl.textContent = n === 0 ? '' : `已选 ${n} 个`;
    }
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

/**
 * v0.31 受控词表：把输入框里的**名字**解析成 tagId。
 *
 * 规则（与后端一致：打标接口只收 tagId，不自动建词条）：
 * - 词库里有同名 → 直接用；
 * - 词库里没有 → 弹确认「先新建词条再打上」（**不静默造词**），确认后 POST /api/tags；
 * - 用户取消 / 名为空 → 返回 null（调用方直接放弃本次保存）。
 */
async function resolveTagId(inputEl) {
    const name = (inputEl && inputEl.value ? inputEl.value : '').trim();
    if (!name) return null;
    await ensureTagPool();
    const hit = tagPoolByName.get(name);
    if (hit) return { id: hit, name };
    const ok = await confirmAsync({
        title: '词库里还没有这个标签',
        msg: `标签已改为受控词表：先新建词条「${name}」，再把它打上？`,
        okText: '新建并打上',
        danger: false
    });
    if (!ok) return null;
    const resp = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    if (!resp.ok) {
        showToast('新建词条失败', 3000);
        return null;
    }
    const created = await resp.json().catch(() => null);
    if (created && created.id) {
        tagPoolByName.set(name, created.id);
        return { id: created.id, name };
    }
    showToast('新建词条失败', 3000);
    return null;
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
document.getElementById('media-batch-op').addEventListener('click', toggleMediaBatchMode);
document.getElementById('media-batch-cancel').addEventListener('click', toggleMediaBatchMode);
document.getElementById('media-batch-confirm').addEventListener('click', () => openBatchDelModal([...mediaSelected]));

/**
 * 批量打标签（v0.31）：专用弹窗 + **词库自动提示**（datalist，与单条打标同一套补全）。
 * 名称 → 受控词表 tagId（没有则问一句再新建）→ 一次事务端点。
 * 只作用于**已勾选**的媒体（可跨页累积）；不做「按筛选条件全库应用」。
 */
const batchTagModal = document.getElementById('batch-tag-modal');
const batchTagInput = document.getElementById('batch-tag-input');
const batchTagHintEl = document.getElementById('batch-tag-hint');
let batchTagIds = [];

document.getElementById('media-batch-tag').addEventListener('click', () => {
    batchTagIds = [...mediaSelected];
    if (batchTagIds.length === 0) return;
    document.getElementById('batch-tag-target').textContent = `将作用于已勾选的 ${batchTagIds.length} 部媒体`;
    batchTagInput.value = '';
    batchTagHintEl.innerHTML = '';
    batchTagModal.hidden = false;
    batchTagInput.focus();
    // 词库惰性缓存：首开时拉一次，命中/新建的提示才准确
    ensureTagPool().then(refreshBatchTagHint);
});

/** 输入即提示：命中词库 = 直接用；未命中 = 会问你是否新建（此处只预告，不弹窗） */
function refreshBatchTagHint() {
    const name = batchTagInput.value.trim();
    batchTagHintEl.innerHTML = '';
    if (!name) return;
    const hit = tagPoolByName.has(name);
    const chip = document.createElement('span');
    chip.className = 'chip ' + (hit ? 'chip-ok' : 'chip-warn');
    chip.textContent = hit ? `✓ 词库里已有「${name}」，将直接使用` : `⚠ 词库里没有「${name}」，保存时会问你是否新建`;
    batchTagHintEl.appendChild(chip);
}

async function submitBatchTag(action) {
    const picked = await resolveTagId(batchTagInput);
    if (!picked) return;
    const ids = batchTagIds;
    try {
        const resp = await fetch('/api/media/tags/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mediaIds: ids, tagIds: [picked.id], action })
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json().catch(() => ({}));
        const verb = action === 'add' ? '已加标签' : '已移除标签';
        // 后端重启前旧实例不返回 changed/touched → 此时只说动作，**不瞎报 0 处**
        const hasCount = data && (data.changed != null || data.touched != null);
        const changed = Number(data && (data.changed != null ? data.changed : data.touched));
        showToast(!hasCount ? `${verb}「${picked.name}」`
            : changed === 0 ? `「${picked.name}」本来就是这个状态（${ids.length} 部都没有变化）`
                : `${verb}「${picked.name}」· 实际变更 ${changed} 处`);
        batchTagModal.hidden = true;
        exitMediaBatchMode();
        loadMedia();
    } catch (e) {
        showToast('批量打标签失败：' + e.message, 3500);
    }
}

// 补全接线 + 输入提示（受控词表：候选只来自已存在词条，不会凭空造词）
attachTagSuggest(batchTagInput, () => null);
let batchTagHintTimer = null;
batchTagInput.addEventListener('input', () => {
    clearTimeout(batchTagHintTimer);
    batchTagHintTimer = setTimeout(refreshBatchTagHint, 180);
});
batchTagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitBatchTag('add'); } });
document.getElementById('batch-tag-add').addEventListener('click', () => submitBatchTag('add'));
document.getElementById('batch-tag-remove').addEventListener('click', () => submitBatchTag('remove'));
document.getElementById('batch-tag-cancel').addEventListener('click', () => { batchTagModal.hidden = true; });
batchTagModal.addEventListener('click', (e) => { if (e.target === batchTagModal) batchTagModal.hidden = true; });
/* ⋯ 更多下拉：收纳 同步番剧/补下封面/管理格式，点击外部关闭 */
const mediaMoreMenu = document.getElementById('media-more-menu');
document.getElementById('media-more-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    mediaMoreMenu.hidden = !mediaMoreMenu.hidden;
});
document.addEventListener('click', () => { mediaMoreMenu.hidden = true; });
// 番剧同步：入口改指新的「从 Bangumi 同步」弹窗（bgm-sync.js）
document.getElementById('media-sync').addEventListener('click', () => window.openBgmSyncModal());
// 全选本页 / 媒体列表分页（页大小 / 上页 / 下页）
document.getElementById('media-batch-select-all').addEventListener('click', selectAllCurrent);
mediaPageSizeEl.addEventListener('change', () => { mediaPageSize = Number(mediaPageSizeEl.value); loadMedia(); });
mediaPagePrevEl.addEventListener('click', () => { if (mediaPage > 1) { mediaPage--; loadMedia(false); } });
mediaPageNextEl.addEventListener('click', () => { mediaPage++; loadMedia(false); });
collPageSizeEl.addEventListener('change', () => { collPageSize = Number(collPageSizeEl.value); if (collSelectedId != null) loadCollMedia(collSelectedId); });
collGroupSizeEl.addEventListener('change', () => {
    collGroupPerPage = collGroupSizeEl.value === 'inf' ? Infinity : Number(collGroupSizeEl.value);
    collGroupPage = 1;   // 档位变 → 页结构重排，回到第 1 页
    if (collSelectedId != null) loadCollMedia(collSelectedId);
});
collPagePrevEl.addEventListener('click', () => {
    if (collSelectedId == null) return;
    if (collGrouped) { if (collGroupPage > 1) { collGroupPage--; renderCollGroupPage(); } }
    else { if (collPage > 1) { collPage--; loadCollMedia(collSelectedId, false); } }
});
collPageNextEl.addEventListener('click', () => {
    if (collSelectedId == null) return;
    if (collGrouped) { if (collGroupPage < collGroupTotalPages) { collGroupPage++; renderCollGroupPage(); } }
    else { collPage++; loadCollMedia(collSelectedId, false); }
});
/* 媒体页批量加入收藏夹：勾选媒体 → 选收藏夹 → 批量加入 */
document.getElementById('media-batch-fav-confirm').addEventListener('click', openMediaFavPick);
document.getElementById('mf-collection').addEventListener('change', () => {
    document.getElementById('mf-confirm').disabled = !document.getElementById('mf-collection').value;
});
document.getElementById('mf-cancel').addEventListener('click', () => { document.getElementById('media-fav-pick-modal').hidden = true; });
document.getElementById('mf-confirm').addEventListener('click', confirmMediaFavPick);
document.getElementById('batch-del-cancel').addEventListener('click', () => { batchDelModal.hidden = true; batchDelIds = []; });
document.getElementById('batch-del-confirm').addEventListener('click', confirmBatchDelete);
document.getElementById('confirm-modal-cancel').addEventListener('click', closeConfirmModal);
document.getElementById('confirm-modal-ok').addEventListener('click', () => {
    const fn = confirmModalAction;
    closeConfirmModal();
    if (fn) fn();
});
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

// v0.24 M3 详情页：外部简介折叠展开（点击切换 .expanded；仅命中折叠态简介）
document.addEventListener('click', (e) => {
    const desc = e.target && e.target.closest && e.target.closest('.external-description');
    if (!desc) return;
    const isClamped = !desc.classList.contains('expanded');
    desc.classList.toggle('expanded', isClamped);
});
window.addEventListener('scroll', () => { if (favOverlay) closeFavPicker(); }, true);
mediaFormatManageBtn.addEventListener('click', openMediaFormatModal);
// v0.24 M2：Animeko 现场打标入口（浏览器无全局热键 → 独立小窗/页）
document.getElementById('nav-animeko-tag')?.addEventListener('click', () => {
    window.open('/animeko-tag.html', '_blank', 'width=420,height=640');
});
// v0.24 媒体详情：集行「⋯」菜单点击外部收起
window.addEventListener('click', (e) => {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('.ep-more') || e.target.closest('.ep-menu')) return;
    document.querySelectorAll('.ep-menu.open').forEach(m => m.classList.remove('open'));
});
document.getElementById('back-to-media').addEventListener('click', goBack);

// ---------- v0.24.1 详情页统一布局：视图切换（☰ 列表 / ▦2-4 卡片列数，默认列表，localStorage 记忆） ----------
const VT_COLS_TARGETS = {
    'episode-clips': '#episode-detail-clips',
    'clip-siblings': '#clip-detail-siblings',
    'media-episodes': '#episode-list .ep-list',
    'materialize': '#materialize-clip-list',
};
function viewStored(key) {
    const v = localStorage.getItem('vt-view-' + key);
    return (v === '2' || v === '3' || v === '4') ? v : 'list';
}
function applyView(key, v) {
    const sel = VT_COLS_TARGETS[key];
    if (!sel) return;
    const list = document.querySelector(sel);
    if (!list) return;
    list.classList.remove('view-list', 'view-2', 'view-3', 'view-4');
    list.classList.add('view-' + v);
    document.querySelectorAll(`.view-switch[data-view-key="${key}"] button`).forEach(b => b.classList.toggle('active', b.dataset.v === v));
}
/** 初始化/恢复页面上全部视图切换控件（含动态渲染后调用）。 */
function initViewSwitches() {
    Object.keys(VT_COLS_TARGETS).forEach(key => applyView(key, viewStored(key)));
}
document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('.view-switch button') : null;
    if (!btn) return;
    const sw = btn.closest('.view-switch');
    if (!sw) return;
    const v = btn.dataset.v || 'list';
    localStorage.setItem('vt-view-' + sw.dataset.viewKey, v);
    applyView(sw.dataset.viewKey, v);
});
// 页面加载即应用各列表的记忆/默认视图（☰ 列表）；媒体列表在 renderMediaDetail 后再次调用
initViewSwitches();

// 详情页「打开本地文件夹」：优先桌面壳 vtDesktop.showInFolder；Web/无壳兑底本机后端调资源管理器
document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-open-folder]') : null;
    if (!btn) return;
    const p = btn.dataset.openFolder || '';
    if (!p) { showToast('无本地路径'); return; }
    const done = r => { if (!r || !r.ok) showToast((r && r.message) || '打开文件夹失败'); };
    if (window.vtDesktop && window.vtDesktop.showInFolder) {
        window.vtDesktop.showInFolder(p).then(done);
        return;
    }
    // Web / 无桌面壳兑底：本机后端调系统资源管理器定位
    fetch('/api/shell/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p }) })
        .then(r => r.json().catch(() => ({ ok: false, message: '后端接口不可用（HTTP ' + r.status + '，请重启后端）' })))
        .then(done)
        .catch(() => showToast('打开本地文件夹失败：后端未响应', 4000));
});
/** 渲染本地源面板行（渠道 + 路径 + 打开文件夹 + 删除本地源）。remove={kind:'episode'|'clip', id}。 */
function sourceRowHtml(chan, filePath, extra, remove) {
    const name = filePath ? filePath.split(/[\\\/]/).pop() : '';
    const delBtn = remove && filePath
        ? `<button type="button" class="btn-mini folder-btn" data-remove-source data-remove-kind="${remove.kind}" data-remove-id="${remove.id}" data-remove-channel="${esc(chan || '')}" title="解除本地源关联（应用受管目录内的文件会一并删除；手动登记在别处的原文件不动）">🗑 删除</button>`
        : '';
    return `<div class="src-chan ${chan ? 'ok' : ''}">${chan ? '✓ ' + esc(chan) + ' · ' + esc(name) : esc(extra || '')}</div>`
        + (filePath ? `<div class="src-path" title="${esc(filePath)}">${esc(filePath)}</div>` : '')
        + (filePath ? `<button type="button" class="btn-mini folder-btn" data-open-folder="${esc(filePath)}">📂 打开文件夹</button>${delBtn}` : '')
        + (extra && chan ? `<div class="src-extra">${esc(extra)}</div>` : '');
}

/** 删除本地源按钮：项目统一确认弹窗（showConfirm），确认后调后端删文件清关联并刷新面板。 */
document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-remove-source]') : null;
    if (!btn) return;
    const kind = btn.dataset.removeKind;
    const id = Number(btn.dataset.removeId || 0);
    const chan = btn.dataset.removeChannel || '';
    if (!kind || !id) return;
    const isAnimeko = chan === 'C2';
    const title = isAnimeko ? '删除 Animeko 缓存整集' : '删除本地素材文件';
    const msg = isAnimeko
        ? '将删除 Animeko 缓存整集文件并释放磁盘。Animeko 内再次播放该集会重新缓存。'
        : '将解除该本地源关联；文件在应用受管目录（video-assets）内会一并删除，你手动登记在别处的原文件只解除关联、不会被删。';
    showConfirm({ title, msg, okText: '删除', danger: true, onOk: () => deleteLocalSource(kind, id) });
});

/** 执行本地源删除：删文件清关联 → 刷新所在面板。 */
async function deleteLocalSource(kind, id) {
    try {
        const endpoint = kind === 'episode'
            ? `/api/episodes/${id}/material/source-delete`
            : `/api/clips/${id}/material/source-delete`;
        const resp = await fetch(endpoint, { method: 'POST' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
        showToast((data && data.message) || '已删除本地源');
        if (kind === 'episode') {
            if (typeof currentEpisode !== 'undefined' && currentEpisode && currentEpisode.id === id) syncEpisodeAvailability(currentEpisode);
        } else {
            renderClipDetail(id);
        }
    } catch (err) {
        showToast('删除本地源失败：' + (err.message || '后端未响应'), 4000);
    }
}

/** 本地源登记块：给「自己下载好文件、只想让系统认到路径」的场景（2026-09-30）。 */
function localRegisterHtml() {
    return `<div class="src-register">`
        + `<input class="src-register-input" type="text" placeholder="粘贴已下载文件的完整路径，如 D:\\Anime\\ep01.mkv" autocomplete="off" spellcheck="false">`
        + `<button type="button" class="btn-mini folder-btn" data-register-local title="只登记路径：不复制文件、不转码">📁 登记本地文件</button>`
        + `</div>`;
}

/** 手动登记本地源：登记为 C1 资产（UPLOADED/PRIMARY/AVAILABLE），只记路径。 */
async function registerLocalSource(episodeId, panel) {
    const input = panel.querySelector('.src-register-input');
    const path = (input && input.value ? input.value : '').trim().replace(/^"|"$/g, '');
    if (!path) { showToast('请先粘贴本地文件的完整路径', 3000); return; }
    const name = path.split(/[\\\/]/).pop() || 'local-source';
    try {
        const resp = await fetch(`/api/episodes/${episodeId}/video-assets`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assetType: 'UPLOADED', assetRole: 'PRIMARY', availabilityState: 'AVAILABLE',
                storagePath: path, displayName: name
            })
        });
        if (!resp.ok) throw new Error(await apiMessage(resp, 'HTTP ' + resp.status));
        const ext = (name.split('.').pop() || '').toLowerCase();
        const playable = ['mp4', 'webm', 'mkv', 'mov', 'm4v', 'ts'].includes(ext);
        showToast(playable ? '已登记本地源：' + name : `已登记 ${name}（.${ext} 浏览器不能直接预览，仍可用于剪辑与推荐渲染）`, playable ? 3000 : 5500);
        if (typeof refreshAllEpLamps === 'function') refreshAllEpLamps();
        if (typeof currentEpisode !== 'undefined' && currentEpisode && currentEpisode.id === episodeId) syncEpisodeAvailability(currentEpisode);
    } catch (err) {
        showToast(err.message || '登记本地源失败', 4000);
    }
}

/** 集详情：去原视频/本地回顾可用态 + 左栏「本地源」面板（渠道求值）。 */
async function syncEpisodeAvailability(ep) {
    const jumpBtn = document.getElementById('ep-detail-jump');
    if (jumpBtn) {
        const url = ep.url && ep.url !== 'null' ? String(ep.url) : '';
        const can = !!url || !!(ep.watchedAt || ep.animekoSource);
        jumpBtn.disabled = !can;
        jumpBtn.classList.toggle('live', can);
        jumpBtn.title = can ? '去原视频（网页引用 / 唤起 Animeko）' : '无原视频来源';
    }
    const revBtn = document.getElementById('ep-detail-review');
    const srcPanel = document.getElementById('episode-detail-source');
    if (!revBtn && !srcPanel) return;
    try {
        const resp = await fetch(`/api/episodes/${ep.id}/material/channels`);
        const ev = await resp.json().catch(() => ({}));
        const present = ev.state === 'PRESENT';
        if (revBtn) {
            revBtn.disabled = !present;
            revBtn.classList.toggle('live', present);
            revBtn.title = present ? `本地回顾整集（${ev.channel || ''}）` : (ev.message || '无本地源');
        }
        if (srcPanel) {
            srcPanel.innerHTML = (present && ev.filePath
                ? sourceRowHtml(ev.channel, ev.filePath, null, { kind: 'episode', id: ep.id })
                : `<span class="source-muted">${esc(ev.message || '无本地源，可先在 Animeko 显式缓存该集')}</span>`)
                + localRegisterHtml();
            const reg = srcPanel.querySelector('[data-register-local]');
            if (reg) reg.addEventListener('click', () => registerLocalSource(ep.id, srcPanel));
        }
    } catch (err) {
        if (revBtn) { revBtn.disabled = true; revBtn.classList.remove('live'); }
        if (srcPanel) srcPanel.innerHTML = '<span class="source-muted">渠道求值失败</span>';
    }
}

/** 片段详情：左栏「素材来源」面板（渠道/产物/源坐标 + 路径打开）。 */
function renderClipSourcePanel(clip, ev) {
    const el = document.getElementById('clip-detail-source');
    if (!el) return;
    const present = ev && ev.state === 'PRESENT';
    const ready = clip.materialState === 'READY' && clip.videoAssetId != null;
    const parts = [];
    parts.push(`<div class="src-fact">物化状态</div><div class="src-fact-val ${ready ? 'ok' : ''}">${ready ? '✓ 已剪出（产物在本地）' : '整集引用 · 未剪出'}</div>`);
    if (clip.videoAssetId != null) parts.push(`<div class="src-fact">资产</div><div class="src-fact-val mono">videoAsset #${esc(clip.videoAssetId)}</div>`);
    if (present && ev.filePath) {
        parts.push(`<div class="src-fact">本地渠道</div><div class="src-fact-val">${sourceRowHtml(ev.channel, ev.filePath, null, { kind: 'clip', id: clip.id })}</div>`);
    } else {
        parts.push(`<div class="src-fact">本地渠道</div><div class="src-fact-val source-muted">${esc((ev && ev.message) || '无本地文件源')}</div>`);
    }
    const range = clip.endSec != null ? `${fmtTime(clip.timestampSec)} – ${fmtTime(clip.endSec)}` : fmtTime(clip.timestampSec);
    parts.push(`<div class="src-fact">源坐标</div><div class="src-fact-val mono">${esc(range)}${clip.sourceStartMs != null ? `（物化前起点 ${fmtTime(clip.sourceStartMs / 1000)}）` : ''}</div>`);
    if (!ready) {
        parts.push(`<button type="button" class="btn-mini folder-btn" data-prepare-material>⚙ 准备素材</button>`);
    }
    el.innerHTML = parts.join('');
    const prep = el.querySelector('[data-prepare-material]');
    if (prep) prep.addEventListener('click', () => handleClipPrepare(clip, el));
}

// v0.24 媒体详情按钮：事件委托（#media-detail 渲染后才存在）
document.addEventListener('click', (e) => {
    const id = e.target && e.target.id;
    // 标题右侧 Bangumi 状态徽标 = 关联条目入口
    const badge = e.target && e.target.closest ? e.target.closest('.hero-link-badge') : null;
    if (badge) { openMetadataLinkModal(); return; }
    if (id === 'detail-edit') openEditMedia();
    else if (id === 'detail-rename') openRenameModal();
    else if (id === 'detail-cover') openCoverModal();
    else if (id === 'detail-materialize-batch') openMaterializeModal();
    else if (id === 'detail-confirm') { if (currentMedia) fetch(`/api/media/${currentMedia.id}/confirm`, { method: 'POST' }).then(() => refreshMediaDetail()); }
    else if (id === 'detail-delete') deleteMedia();
});

// ---------- v0.24 关联条目（Bangumi 查询 → 点选 → 绑定/换绑，弹窗；旧集默认保留） ----------
let metadataLinkState = { mediaId: 0, candidates: [], selected: null, currentWork: null };

function openMetadataLinkModal() {
    if (!currentMedia || !currentMedia.id) { showToast('请先打开媒体详情'); return; }
    const modal = document.getElementById('metadata-link-modal');
    if (!modal) return;
    metadataLinkState = { mediaId: currentMedia.id, candidates: [], selected: null, currentWork: null };
    const input = document.getElementById('mdl-search-input');
    const statusEl = document.getElementById('mdl-status');
    const listEl = document.getElementById('mdl-candidates');
    const curEl = document.getElementById('mdl-current');
    const confirmBtn = document.getElementById('mdl-confirm');
    const selEl = document.getElementById('mdl-selected');
    if (input) input.value = currentMedia.title || '';
    if (listEl) listEl.innerHTML = '';
    if (selEl) selEl.innerHTML = '';
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '关联并同步'; }
    if (curEl) { curEl.hidden = true; curEl.classList.remove('has-link'); }
    if (statusEl) statusEl.textContent = '正在读取当前关联…';
    modal.hidden = false;
    fetch(`/api/media/${currentMedia.id}/metadata`).then(async r => {
        let work = null;
        try { work = (await r.json()).work || null; } catch (e) { work = null; }
        metadataLinkState.currentWork = work;
        if (curEl) {
            if (work) {
                curEl.classList.add('has-link');
                curEl.innerHTML = `当前关联：<b>${esc(work.canonicalTitle || work.nativeTitle || '')}</b> <span class="mdl-cur-id">#${esc(work.externalId || '')}</span> · 换绑会重建旧条目同步的集与片段，含用户数据的集会二次确认`;
            } else {
                curEl.innerHTML = '尚未关联外部条目 · 搜索后点选一条完成绑定';
            }
            curEl.hidden = false;
        }
        if (statusEl) statusEl.textContent = '';
        syncMdlConfirm();
        if (input) input.focus();
    }).catch(() => { if (statusEl) statusEl.textContent = '当前关联读取失败，仍可搜索绑定'; });
}

function closeMetadataLinkModal() {
    const modal = document.getElementById('metadata-link-modal');
    if (modal) modal.hidden = true;
}

/** 根据「当前关联 + 已选候选」同步确认按钮：选中当前条目 = 重新拉取资料，其余 = 关联/换绑。 */
function syncMdlConfirm() {
    const confirmBtn = document.getElementById('mdl-confirm');
    const statusEl = document.getElementById('mdl-status');
    if (!confirmBtn) return;
    const cur = metadataLinkState.currentWork;
    const selected = metadataLinkState.selected;
    const same = !!(cur && selected && String(cur.externalId) === String(selected));
    confirmBtn.textContent = same ? '重新拉取资料' : '关联并同步';
    if (same && statusEl) statusEl.textContent = '该条目已是当前关联；点「重新拉取资料」会用 Bangumi 最新资料刷新本地缓存（不会重复建集）。';
}

document.addEventListener('submit', (e) => {
    if (!e.target || e.target.id !== 'mdl-search-form') return;
    e.preventDefault();
    const mediaId = metadataLinkState.mediaId;
    if (!mediaId) return;
    const input = document.getElementById('mdl-search-input');
    const statusEl = document.getElementById('mdl-status');
    const listEl = document.getElementById('mdl-candidates');
    const keyword = (input && input.value || '').trim();
    if (!keyword) { if (statusEl) statusEl.textContent = '请输入关键词'; return; }
    metadataLinkState.selected = null;
    const confirmBtn = document.getElementById('mdl-confirm');
    const selEl = document.getElementById('mdl-selected');
    if (confirmBtn) confirmBtn.disabled = true;
    if (selEl) selEl.innerHTML = '';
    if (statusEl) statusEl.textContent = '搜索中…';
    if (listEl) listEl.innerHTML = '<div class="mdl-loading">正在搜索 Bangumi…</div>';
    fetch(`/api/media/${mediaId}/metadata-search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword }) })
        .then(async r => { const data = await r.json().catch(() => ([])); if (!r.ok) throw new Error('HTTP ' + r.status); return data; })
        .then(renderMetadataLinkCandidates)
        .catch(err => { if (statusEl) statusEl.textContent = '搜索失败：' + (err.message || '后端未响应'); if (listEl) listEl.innerHTML = ''; });
});

function renderMetadataLinkCandidates(items) {
    const listEl = document.getElementById('mdl-candidates');
    const statusEl = document.getElementById('mdl-status');
    metadataLinkState.candidates = items || [];
    if (!listEl) return;
    if (!metadataLinkState.candidates.length) {
        listEl.innerHTML = '<div class="mdl-empty">没有匹配候选 · 换关键词再试</div>';
        if (statusEl) statusEl.textContent = '';
        return;
    }
    if (statusEl) statusEl.textContent = `${metadataLinkState.candidates.length} 条候选 · 点选后底部确认`;
    listEl.innerHTML = metadataLinkState.candidates.map(c => {
        const meta = [c.titleCn || c.title || c.nativeTitle, c.year, c.format, c.episodeCount != null ? `${c.episodeCount} 集` : ''].filter(Boolean).join(' · ');
        const locked = c.matchType === 'EXTERNAL_ID' && c.targetMediaId && c.targetMediaId !== metadataLinkState.mediaId;
        return `<label class="mdl-cand ${locked ? 'locked' : ''}">
            <input type="radio" name="mdl-cand" value="${esc(c.externalId)}" ${locked ? 'disabled' : ''}>
            <span class="mdl-cand-main">
                <strong>${esc(c.titleCn || c.title || c.nativeTitle || '')}</strong>
                <small>${esc(meta)}</small>
                <em>${locked ? '已关联其他媒体，不可选' : esc(c.matchReason || '')}</em>
            </span>
            <span class="mdl-cand-id">#${esc(c.externalId)}</span>
        </label>`;
    }).join('');
}

document.addEventListener('change', (e) => {
    if (!e.target || e.target.name !== 'mdl-cand') return;
    metadataLinkState.selected = e.target.value;
    const confirmBtn = document.getElementById('mdl-confirm');
    const selEl = document.getElementById('mdl-selected');
    if (confirmBtn) confirmBtn.disabled = false;
    if (selEl) {
        const c = metadataLinkState.candidates.find(x => String(x.externalId) === String(e.target.value));
        selEl.innerHTML = c ? `已选：<b>${esc(c.titleCn || c.title || c.nativeTitle || '')}</b> <span class="mdl-cur-id">#${esc(c.externalId)}</span>` : '';
    }
    syncMdlConfirm();
});

document.getElementById('mdl-confirm').addEventListener('click', async () => {
    const mediaId = metadataLinkState.mediaId;
    const externalId = metadataLinkState.selected;
    if (!mediaId || !externalId) return;
    const btn = document.getElementById('mdl-confirm');
    const statusEl = document.getElementById('mdl-status');
    const cur = metadataLinkState.currentWork;
    if (cur && String(cur.externalId) === String(externalId)) {
        // 选中当前已关联条目：不做换绑，改为重新拉取该条目资料（幂等，不重复建集）
        if (btn) btn.disabled = true;
        if (statusEl) statusEl.textContent = '该条目已是当前关联，正在重新拉取资料…';
        try {
            const resp = await fetch(`/api/media/${mediaId}/metadata-refresh`, { method: 'POST' });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
            showToast(`资料更新完成：新增 ${data.added || 0}，更新 ${data.updated || 0}`);
            if (statusEl) statusEl.textContent = '资料已重新拉取并更新，可关闭弹窗查看详情。';
            refreshMediaDetail();
        } catch (err) {
            if (statusEl) statusEl.textContent = '资料更新失败：' + (err.message || '后端未响应');
            showToast('资料更新失败：' + (err.message || '后端未响应'));
        } finally {
            if (btn) btn.disabled = false;
        }
        return;
    }
    if (btn) btn.disabled = true;
    if (!cur) {
        // 首次关联（本媒体无外部主条目）：直接拉取并绑定
        if (statusEl) statusEl.textContent = '正在关联并拉取资料…';
        try {
            const resp = await fetch(`/api/media/${mediaId}/metadata-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId, mode: 'PRIMARY' }) });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
            showToast(`关联完成：新增 ${data.added || 0}，更新 ${data.updated || 0}`);
            closeMetadataLinkModal();
            refreshMediaDetail();
        } catch (err) {
            if (statusEl) statusEl.textContent = '关联失败：' + (err.message || '后端未响应');
            if (btn) btn.disabled = false;
        }
        return;
    }
    // 换绑：先预览将删除的旧集与资产，再按有无用户数据分档确认
    if (statusEl) statusEl.textContent = '正在读取换绑影响预览…';
    try {
        const previewResp = await fetch(`/api/media/${mediaId}/metadata-link-preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId, mode: 'REPLACE' }) });
        const preview = await previewResp.json().catch(() => ({}));
        if (!previewResp.ok) throw new Error(preview.message || `HTTP ${previewResp.status}`);
        const eps = Array.isArray(preview.episodes) ? preview.episodes : [];
        const assets = eps.filter(e => e && e.protectedItem);
        const clipTotal = eps.reduce((s, e) => s + (e && e.clipCount ? e.clipCount : 0), 0);
        const targetTitle = mdlCandidateTitle(externalId);
        if (!eps.length) {
            showConfirm({ title: '更换主关联', msg: `将改绑到「${targetTitle}」并同步资料（旧条目没有本地集，无需清理）。确定？`, okText: '确认换绑', onOk: () => executeRebind(mediaId, externalId, false) });
        } else if (!assets.length) {
            showConfirm({ title: '更换主关联', msg: `将删除旧条目同步的 ${eps.length} 个本地集（无用户数据），改绑到「${targetTitle}」并同步新条目资料。确定？`, okText: '确认换绑', onOk: () => executeRebind(mediaId, externalId, false) });
        } else {
            showConfirm({ title: '⚠ 换绑将删除用户数据', msg: `将删除旧条目同步的 ${eps.length} 个本地集，其中 ${assets.length} 个含${clipTotal ? ` ${clipTotal} 个片段、` : ''}标签/备注/本地视频/观看记录等用户数据（永久删除，不可恢复），随后改绑到「${targetTitle}」并同步新条目。确定继续？`, okText: '确认删除并换绑', onOk: () => executeRebind(mediaId, externalId, true) });
        }
    } catch (err) {
        if (statusEl) statusEl.textContent = '换绑预览失败：' + (err.message || '后端未响应');
        if (btn) btn.disabled = false;
    }
});

/** 换绑执行（预览确认后回调）：confirmProtected=true 表示已确认删除含用户数据的旧集。 */
async function executeRebind(mediaId, externalId, confirmProtected) {
    const btn = document.getElementById('mdl-confirm');
    const statusEl = document.getElementById('mdl-status');
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = '正在更换主关联并同步新条目…';
    try {
        const resp = await fetch(`/api/media/${mediaId}/metadata-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalId, mode: 'REPLACE', confirmProtected }) });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
        showToast(`换绑完成：新增 ${data.added || 0}，更新 ${data.updated || 0}`);
        closeMetadataLinkModal();
        refreshMediaDetail();
    } catch (err) {
        if (statusEl) statusEl.textContent = '换绑失败：' + (err.message || '后端未响应');
        if (btn) btn.disabled = false;
    }
}

function mdlCandidateTitle(externalId) {
    const c = metadataLinkState.candidates.find(x => String(x.externalId) === String(externalId));
    return c ? (c.titleCn || c.title || c.nativeTitle || externalId) : externalId;
}

document.getElementById('mdl-close').addEventListener('click', closeMetadataLinkModal);
document.getElementById('metadata-link-modal').addEventListener('click', (e) => { if (e.target && e.target.id === 'metadata-link-modal') closeMetadataLinkModal(); });

// ---------- v0.24 批量物化（延迟物化） ----------
let materializeClips = [];
const materializeSel = new Set();

async function openMaterializeModal() {
    if (!currentMedia || !currentMedia.id) { showToast('请先打开媒体详情'); return; }
    materializeSel.clear();
    const listEl = document.getElementById('materialize-clip-list');
    const statusEl = document.getElementById('materialize-status');
    listEl.innerHTML = '<div class="status">加载片段…</div>';
    statusEl.textContent = '';
    document.getElementById('materialize-modal').hidden = false;
    try {
        const resp = await fetch(`/api/clips/media/${currentMedia.id}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        materializeClips = await resp.json();
        renderMaterializeList();
    } catch (e) {
        statusEl.textContent = '加载失败：' + e.message;
    }
}

function fmtClipRange(c) {
    if (c.startMs != null) {
        const s = Math.floor(c.startMs / 1000);
        const e = c.endMs != null ? Math.floor(c.endMs / 1000) : null;
        return e && e > s ? `${fmtT(s)}–${fmtT(e)}` : fmtT(s);
    }
    return c.timestampSec != null ? fmtT(c.timestampSec) : '';
}
function fmtT(sec) {
    const p = n => String(n).padStart(2, '0');
    return `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}`;
}

function renderMaterializeList() {
    const listEl = document.getElementById('materialize-clip-list');
    if (!materializeClips.length) {
        listEl.innerHTML = '<div class="status">该媒体还没有片段。</div>';
        document.getElementById('materialize-run').disabled = true;
        return;
    }
    listEl.innerHTML = materializeClips.map(c => {
        const ready = c.materialState === 'READY';
        const epNo = c.episodeNo != null ? `第${c.episodeNo}集` : '';
        const range = fmtClipRange(c);
        const meta = [epNo, c.tag || '', range].filter(Boolean).join(' · ');
        const thumb = (c.coverPath || c.detailCoverPath)
            ? `<span class="mz-thumb"><img src="${esc(c.coverPath || c.detailCoverPath)}" alt="" loading="lazy" onerror="this.remove()"></span>`
            : `<span class="mz-thumb mz-empty">${esc((c.title || '片').slice(0, 1))}</span>`;
        return `<label class="mz-row">
            <input type="checkbox" data-mz="${c.id}" ${materializeSel.has(c.id) ? 'checked' : ''}>
            ${thumb}
            <span class="mz-body"><b class="mz-title">${esc(c.title || '(未命名)')}</b><small class="mz-meta">${esc(meta)}</small></span>
            <span class="mz-badge ${ready ? 'ready' : ''}">${ready ? '✓ 已剪出' : '未剪出'}</span>
        </label>`;
    }).join('');
    listEl.querySelectorAll('[data-mz]').forEach(cb => cb.addEventListener('change', () => {
        if (cb.checked) materializeSel.add(Number(cb.dataset.mz)); else materializeSel.delete(Number(cb.dataset.mz));
        updateMaterializeCount();
    }));
    updateMaterializeCount();
}

function updateMaterializeCount() {
    const n = materializeSel.size;
    document.getElementById('materialize-count').textContent = `已选 ${n}`;
    document.getElementById('materialize-run').disabled = n === 0;
}

/** v0.25：缺源集自动最优下载 → 完成后统一剪出勾选片段。 */
async function materializeRunAuto(ids, statusEl, runBtn) {
    statusEl.className = 'status';
    statusEl.textContent = '执行中：缺源集自动下载 + ffmpeg 剪出，可能需要几分钟…（可看 集行黄灯/qB）';
    try {
        const resp = await fetch('/api/materialize-auto/run', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clipIds: ids })
        });
        const r = await resp.json();
        if (!resp.ok) throw new Error((r && r.message) || `HTTP ${resp.status}`);
        const dl = r.downloads || [];
        const dlOk = dl.filter(x => x.ok);
        const dlFail = dl.filter(x => !x.ok);
        const mz = r.materialize || { results: [], prefetchNeeded: [], okCount: 0 };
        const ok = (mz.results || []).filter(x => x.ok);
        const fail = (mz.results || []).filter(x => !x.ok && !x.prefetch);
        let html = '';
        if (dlOk.length) html += `<span style="color:var(--green)">⬇ 已自动下载 ${dlOk.length} 个缺源集</span><br>`;
        if (dlFail.length) html += dlFail.map(x => `<span style="color:#ff5d6d">✗ 下载失败 第${x.episodeNo}集：${esc(x.reason || '')}</span><br>`).join('');
        if (ok.length) html += `<span style="color:var(--green)">✓ ${ok.length} 条片段已剪出产物</span><br>`;
        if (fail.length) html += `<span style="color:#ff5d6d">✗ ${fail.length} 条剪出失败：${esc(fail[0] ? (fail[0].message || '') : '')}</span><br>`;
        if ((mz.prefetchNeeded || []).length) html += `<span style="color:#fbbf24">⚠ ${mz.prefetchNeeded.length} 集仍缺素材（请先 BT 下载）</span><br>`;
        statusEl.innerHTML = html || '完成';
        statusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        refreshAllEpLamps();
        refreshAllClipLamps();
        renderMaterializeList();
    } catch (e) {
        statusEl.className = 'status';
        statusEl.textContent = '执行失败：' + e.message;
    } finally {
        if (runBtn) runBtn.disabled = materializeSel.size === 0;
    }
}

document.getElementById('materialize-close').addEventListener('click', () => { document.getElementById('materialize-modal').hidden = true; });
document.getElementById('materialize-select-all').addEventListener('click', () => { materializeClips.forEach(c => materializeSel.add(c.id)); renderMaterializeList(); });
document.getElementById('materialize-select-none').addEventListener('click', () => { materializeSel.clear(); renderMaterializeList(); });
document.getElementById('materialize-run').addEventListener('click', async () => {
    const runBtn = document.getElementById('materialize-run');
    const statusEl = document.getElementById('materialize-status');
    const ids = [...materializeSel];
    // v0.25：缺源集自动最优下载（先预览确认，无缺源则直接走原物化）
    try {
        const pv = await fetch('/api/materialize-auto/preview', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clipIds: ids })
        });
        if (pv.ok) {
            const needs = (await pv.json()).needs || [];
            if (needs.length) {
                const lines = needs.slice(0, 8).map(n =>
                    `• 第${n.episodeNo}集「${n.recommendTitle || '无候选'}」${n.providerName ? `（${n.providerName} · ${n.tier || ''}${n.seeders ? ' · 做种' + n.seeders : ''}${n.batch ? ' · 合集取该集' : ''}）` : `（${n.reason || '无可用候选'}）`}`).join('\n');
                const more = needs.length > 8 ? `\n…还有 ${needs.length - 8} 集` : '';
                statusEl.className = 'status';
                showConfirm({
                    title: `缺本地源 ${needs.length} 集，将自动最优下载后剪出`,
                    msg: lines + more + '\n\n下载完成会自动剪出勾选的片段。',
                    okText: '自动下载并剪出',
                    cancelText: '取消',
                    onOk: () => materializeRunAuto(ids, statusEl, runBtn),
                    onCancel: () => { runBtn.disabled = false; statusEl.className = 'status'; statusEl.textContent = '已取消（可先 BT 下载缺源集再试）'; }
                });
                return;
            }
        }
    } catch (e) { /* 预览接口异常则退回原流程 */ }
    runBtn.disabled = true;
    statusEl.className = 'status';
    statusEl.textContent = `正在物化 ${ids.length} 条…（文件在场的会 ffmpeg 裁剪，可能较慢）`;
    try {
        const resp = await fetch('/api/clips/materialize-batch', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clipIds: ids })
        });
        const r = await resp.json();
        if (!resp.ok) throw new Error(r.message || `HTTP ${resp.status}`);
        const ok = r.results.filter(x => x.ok);
        const fail = r.results.filter(x => !x.ok && !x.prefetch);
        const prefetch = r.prefetchNeeded || [];
        let html = '';
        if (ok.length) html += `<span style="color:var(--green)">✓ ${ok.length} 条已剪出产物</span><br>`;
        if (fail.length) html += `<span style="color:#ff5d6d">✗ ${fail.length} 条失败：${esc(fail[0] ? (fail[0].message || '') : '')}</span><br>`;
        if (prefetch.length) {
            html += `<span style="color:#fbbf24">⚠ ${prefetch.length} 个集需先缓存整集：</span><br>` +
                `<code style="font-size:11px;line-height:1.9;display:block">${prefetch.map(p =>
                    `<b>subject ${esc(p.subjectId)}</b> / ep ${esc(p.episodeId)}`).join('<br>')}</code>`;
            html += `<p class="detail-section-note">在 Animeko 中显式缓存这些集（或 fork CLI 批量预取）后，再回来勾选执行即可。</p>`;
        }
        statusEl.className = 'status';
        statusEl.innerHTML = html || '完成';
        statusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
        statusEl.className = 'status';
        statusEl.textContent = '物化失败：' + e.message;
    } finally {
        runBtn.disabled = materializeSel.size === 0;
    }
});


/* 筛选浮层：⚙ 开关；点外部或 Esc 关（取值点选即时生效，面板保持打开可连加条件） */
filterOpenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (filterPopEl.hidden) openFilterPop(); else closeFilterPop();
});
document.addEventListener('mousedown', (e) => {
    if (filterPopEl.hidden) return;
    // ⚠️ 用 mousedown 而不是 click 判外部点击（2026-09-25 浏览器实测踩到）：
    // 取值点选会触发 setDim → renderFilterPop 把取值节点**整块重建**，等 click 冒泡到 document 时
    // 目标已脱离 DOM —— 此时 `contains(e.target)` 和 `composedPath()` **都不再包含浮层**，
    // 结果刚开的浮层被自己关掉。mousedown 早于 click，DOM 还是完整的。
    if (filterPopEl.contains(e.target) || filterOpenBtn.contains(e.target)) return;
    closeFilterPop();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !filterPopEl.hidden) closeFilterPop(); });
filterClearEl.addEventListener('click', () => {
    for (const d of MEDIA_DIMS) mediaFilter[d.key] = [];
    renderFilterChips();
    if (!filterPopEl.hidden) renderFilterPop();
    loadMedia();
});
/* 标题模糊搜索（300ms 防抖） */
const filterQEl = document.getElementById('filter-q');
let filterQTimer = null;
filterQEl.addEventListener('input', () => {
    clearTimeout(filterQTimer);
    filterQTimer = setTimeout(() => { mediaFilter.q = filterQEl.value.trim(); loadMedia(); }, 300);
});
// 来源筛选已改由外部资料关联派生，当前界面不开放旧来源控件。
filterSortEl.addEventListener('change', () => { mediaFilter.sort = filterSortEl.value; loadMedia(); });
filterOrderBtn.addEventListener('click', () => {
    mediaFilter.order = mediaFilter.order === 'desc' ? 'asc' : 'desc';
    filterOrderBtn.textContent = mediaFilter.order === 'desc' ? '↓' : '↑';
    filterOrderBtn.title = mediaFilter.order === 'desc' ? '当前降序，点击切换升序' : '当前升序，点击切换降序';
    loadMedia();
});
/* 收藏夹 tab 内容筛选：标题模糊搜索（300ms 防抖）/ 年份 / 排序维度 + 升降序 */
let collQTimer = null;
collQEl.addEventListener('input', () => {
    clearTimeout(collQTimer);
    collQTimer = setTimeout(() => { collFilter.q = collQEl.value.trim(); if (collSelectedId != null) loadCollMedia(collSelectedId); }, 300);
});
collYearEl.addEventListener('change', () => { collFilter.year = collYearEl.value; if (collSelectedId != null) loadCollMedia(collSelectedId); });
collSortEl.addEventListener('change', () => { collFilter.sort = collSortEl.value; if (collSelectedId != null) loadCollMedia(collSelectedId); });
collOrderBtn.addEventListener('click', () => {
    collFilter.order = collFilter.order === 'desc' ? 'asc' : 'desc';
    collOrderBtn.textContent = collFilter.order === 'desc' ? '↓' : '↑';
    collOrderBtn.title = collFilter.order === 'desc' ? '当前降序，点击切换升序' : '当前升序，点击切换降序';
    if (collSelectedId != null) loadCollMedia(collSelectedId);
});
/** 分组开关联动分页条：分组模式显示「分组每页上限」档位 select、隐藏平铺每页条数 select（反之亦然）。 */
function syncCollGroupControls() {
    collGroupSizeEl.hidden = !collGrouped;
    collPageSizeEl.hidden = collGrouped;
}
collGroupedEl.addEventListener('change', () => {
    collGrouped = collGroupedEl.checked;
    syncCollGroupControls();
    if (collSelectedId != null) loadCollMedia(collSelectedId);
});
/* 去底/回顶智能导航：屏幕右缘垂直居中单按钮，滚动后出现；
 *  箭头随位置：近顶 ↓（点→去底）/ 近底 ↑（点→回顶）/ 中间 ↕（点→去更远那端） */
const backNavBtn = document.getElementById('back-nav');
const NEAR_EDGE = 800;   // 距顶/距底 < 此值判定「近顶/近底」，其余为中间显示双向
function setBackNav(dir, icon, tip) {
    backNavBtn.dataset.dir = dir;
    if (backNavBtn.textContent !== icon) backNavBtn.textContent = icon;
    if (backNavBtn.title !== tip) { backNavBtn.title = tip; backNavBtn.setAttribute('aria-label', tip); }
}
window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (y > 400 && maxScroll > 0) {
        backNavBtn.classList.add('show');
        const distBottom = maxScroll - y;
        if (distBottom < NEAR_EDGE) setBackNav('top', '↑', '回到顶部');        // 近底 → 回顶
        else if (y < NEAR_EDGE) setBackNav('bottom', '↓', '去底部');           // 近顶 → 去底
        else setBackNav('both', '↕', '上下滚动');                               // 中间 → 双向
    } else {
        backNavBtn.classList.remove('show');
    }
}, { passive: true });
backNavBtn.addEventListener('click', () => {
    const dir = backNavBtn.dataset.dir || 'bottom';
    const y = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    // 单向箭头直接去目标；中间 ↕ 去更远那端
    const goTop = dir === 'top' || (dir === 'both' && y > maxScroll / 2);
    window.scrollTo({ top: goTop ? 0 : maxScroll, behavior: 'smooth' });
});
/* 全局卡片/列表视图切换：单个按钮，图标随状态变；媒体页/收藏夹/推荐页共用同一偏好 */
function syncViewToggleButtons() {
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.textContent = displayView === 'card' ? '☰ 列表' : '▦ 卡片';
        btn.title = displayView === 'card' ? '切换到列表视图' : '切换到卡片视图';
    });
}
function toggleDisplayView() {
    displayView = displayView === 'card' ? 'list' : 'card';
    syncViewToggleButtons();
    if (currentViewName === 'media') loadMedia(false);
    else if (currentViewName === 'collections') { if (collSelectedId != null) loadCollMedia(collSelectedId, false); }
}
// 分组开关初始态同步（collGrouped 默认开 → 显示分组档位、隐藏平铺每页条数）
syncCollGroupControls();
document.querySelectorAll('.view-toggle-btn').forEach(btn => btn.addEventListener('click', toggleDisplayView));
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
/* 重名处理弹窗：合并到它 / 仅改名 / 取消 */
document.getElementById('rename-dupe-merge').addEventListener('click', async () => {
    if (!renameDupeResolve) return;
    const { dup } = renameDupeResolve;
    renameDupeModal.hidden = true;
    renameModal.hidden = true;
    renameDupeResolve = null;
    await fetch(`/api/media/${currentMedia.id}/merge?into=${dup.id}`, { method: 'POST' });
    showView('media');
});
document.getElementById('rename-dupe-keep').addEventListener('click', async () => {
    if (!renameDupeResolve) return;
    const { title } = renameDupeResolve;
    renameDupeModal.hidden = true;
    renameDupeResolve = null;
    await doRename(title);
});
document.getElementById('rename-dupe-cancel').addEventListener('click', () => { renameDupeModal.hidden = true; renameDupeResolve = null; });
renameDupeModal.addEventListener('click', (e) => { if (e.target === renameDupeModal) { renameDupeModal.hidden = true; renameDupeResolve = null; } });
episodeTagModal.addEventListener('click', (e) => { if (e.target === episodeTagModal) episodeTagModal.hidden = true; });
document.getElementById('episode-tag-cancel').addEventListener('click', () => { episodeTagModal.hidden = true; });
document.getElementById('episode-tag-save').addEventListener('click', saveEpisodeTag);
episodeTagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveEpisodeTag(); } });
episodeCoverModal.addEventListener('click', (e) => { if (e.target === episodeCoverModal) { episodeCoverModal.hidden = true; coverEpisode = null; } });
document.getElementById('episode-cover-cancel').addEventListener('click', () => { episodeCoverModal.hidden = true; coverEpisode = null; });
document.getElementById('episode-cover-save').addEventListener('click', saveEpisodeCoverUpload);

// ---------- 高光制作工作台事件 ----------
highlightBackBtn?.addEventListener('click', goBack);
highlightSinglePreviewBtn?.addEventListener('click', openSingleRecommendPreview);
highlightSaveBtn?.addEventListener('click', saveHighlightProject);
highlightPreviewBtn?.addEventListener('click', generateHighlightPreview);
highlightExportBtn?.addEventListener('click', () => exportHighlightProject(false));
highlightNameEl?.addEventListener('change', saveHighlightProject);
highlightBgmVolumeEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightModeEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightResolutionEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightStylePresetEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightTransitionEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightCardsEnabledEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightChaptersEnabledEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightBgmPickBtn?.addEventListener('click', () => highlightBgmFileEl.click());
highlightBgmFileEl?.addEventListener('change', async () => {
    const file = highlightBgmFileEl.files?.[0];
    if (!file || !currentHighlight) return;
    const form = new FormData(); form.append('file', file);
    try {
        highlightStatusEl.textContent = '正在上传背景音乐…';
        const resp = await fetch(`/api/highlight-projects/${currentHighlight.id}/bgm`, { method: 'POST', body: form });
        if (!resp.ok) throw new Error(await apiMessage(resp, '上传背景音乐失败'));
        const data = await resp.json();
        highlightBgmStoredPath = data.path;
        highlightBgmNameEl.textContent = file.name;
        await saveHighlightProject();
        showToast('背景音乐已添加');
    } catch (err) { showToast(err.message || '上传背景音乐失败'); }
    finally { highlightStatusEl.textContent = ''; highlightBgmFileEl.value = ''; }
});

// ---------- 片段详情操作 ----------
document.getElementById('back-from-clip').addEventListener('click', goBack);
document.getElementById('clip-detail-jump').addEventListener('click', () => { if (currentClip) jump(currentClip); });
document.getElementById('clip-detail-edit').addEventListener('click', () => { if (currentClip) openEditModal(currentClip); });
document.getElementById('clip-detail-delete').addEventListener('click', () => { if (currentClip) confirmDelete(currentClip); });

// ---------- 集详情操作 ----------
document.getElementById('back-from-episode').addEventListener('click', goBack);
document.getElementById('ep-detail-review')?.addEventListener('click', async () => {
    if (!currentEpisode) return;
    const btn = document.getElementById('ep-detail-review');
    const orig = btn.textContent;
    btn.textContent = '定位本地源…';
    try {
        const resp = await fetch(`/api/episodes/${currentEpisode.id}/review-source`);
        if (!resp.ok) throw new Error('无本地源（需本地资产或 Animeko 显式缓存该集）');
        const blob = await resp.blob();
        openLocalVideoPlayer(blob, {
            title: currentEpisode.title || '整集回顾',
            materialState: 'REFERENCE_ONLY',   // 播整集从头（非产物）
            timestampSec: 0,
            endSec: null,
            tag: ''
        }, {
            mode: 'create',
            episodeId: currentEpisode.id,
            onSaved: () => openEpisodeDetail(currentEpisode.id)
        });
    } catch (e) { showToast('本地回顾不可用：' + e.message, 3500); }
    finally { btn.textContent = orig; }
});

// v0.24 G6：v0.23 自建播放/片源 UI 默认隐藏（引擎保留；Animeko 接管播放）
async function applyUiConfig() {
    try {
        const resp = await fetch('/api/app/ui-config');
        if (!resp.ok) return;
        const cfg = await resp.json();
        if (cfg.showV023Player === false) {
            document.querySelectorAll('.settings-cat[data-settings-cat="video-sources"]').forEach(el => el.hidden = true);
            const settingsSection = document.getElementById('settings-section-video-sources');
            if (settingsSection) settingsSection.hidden = true;
            const quickPlay = document.getElementById('ep-detail-quick-play');
            if (quickPlay) quickPlay.hidden = true;
            // 兜底：即便有残留入口，点击也提示被隐藏
            const panel = document.getElementById('ep-quick-play-panel');
            if (panel) panel.hidden = true;
            // v022 动态渲染的「管理片源」入口：标记隐藏并清除（含未来渲染的由 MutationObserver 处理）
            window.__vtHideV023Player = true;
            document.querySelectorAll('[data-v023-entry]').forEach(el => { el.remove(); });
            const sheet = new CSSStyleSheet();
            sheet.replaceSync('[data-v023-entry]{display:none!important}');
            document.adoptedStyleSheets.push(sheet);
        }
        // v0.24 素材化接管后：旧「导出视频/单帧/连续截图」按钮退役（截图移入本地回顾播放器）；引擎与 API 保留
        if (cfg.showV023Export === false) {
            ['clip-export-video', 'clip-export-frame', 'clip-export-sequence', 'clip-record-browser'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.hidden = true;
            });
        }
    } catch (e) { /* 配置拉取失败不阻断 */ }
}
applyUiConfig();

document.getElementById('ep-detail-quick-play')?.addEventListener('click', () => {
    if (currentEpisode) window.v023QuickPlayEpisode?.(currentEpisode.id, currentEpisode.title || '本集');
});
document.getElementById('ep-detail-cover').addEventListener('click', () => { if (currentEpisode) openEpisodeCoverModal(currentEpisode); });
document.getElementById('ep-detail-timeline').addEventListener('click', () => {
    if (!currentEpisode) return;
    fromEpisodeDetail = true;
    openTimeline({ fp: currentEpisode.videoFp, title: currentEpisode.title || '时间线' });
});
document.getElementById('ep-detail-jump').addEventListener('click', () => {
    if (currentEpisode) jump({ url: currentEpisode.url, watchedAt: currentEpisode.watchedAt, title: currentEpisode.title || '目标番剧/集', timestampSec: 0 });
});
document.getElementById('ep-detail-delete').addEventListener('click', () => { if (currentEpisode) deleteEpisode(currentEpisode); });

// ---------- 标签管理事件（v0.31 重设计：单一列表 + 客户端筛选/排序/分页） ----------
tagPagePrev.addEventListener('click', () => { if (tagPage > 1) { tagPage--; applyTagPipeline(); renderTagList(); updateTagPager(); } });
tagPageNext.addEventListener('click', () => { tagPage++; applyTagPipeline(); renderTagList(); updateTagPager(); });
tagPageSizeSel.addEventListener('change', () => { tagPageSize = Number(tagPageSizeSel.value); tagPage = 1; applyTagPipeline(); renderTagList(); updateTagPager(); });
tagSortEl.addEventListener('change', () => { tagSort = tagSortEl.value; tagPage = 1; applyTagPipeline(); renderTagList(); updateTagPager(); });
tagOrderBtn.addEventListener('click', () => {
    tagSortDir = tagSortDir === 'desc' ? 'asc' : 'desc';
    tagOrderBtn.textContent = tagSortDir === 'desc' ? '↓' : '↑';
    tagOrderBtn.title = tagSortDir === 'desc' ? '当前降序，点击切换升序' : '当前升序，点击切换降序';
    applyTagPipeline(); renderTagList(); updateTagPager();
});
tagOnlyOrphanEl.addEventListener('change', () => {
    tagOnlyOrphanFilter = tagOnlyOrphanEl.checked;
    tagPage = 1;
    applyTagPipeline(); renderTagList(); updateTagPager();
});
tagCheckAll.addEventListener('change', () => {
    // 只能勾可删的（孤儿）；被引用的行本来就没得选
    for (const t of tagListCache) {
        if (!tagIsOrphan(t)) continue;
        if (tagCheckAll.checked) tagSelected.add(t.id); else tagSelected.delete(t.id);
    }
    renderTagList();
    updateTagBatchBtn();
});
tagFilterEl.addEventListener('input', () => {
    clearTimeout(tagFilterTimer);
    tagFilterTimer = setTimeout(() => {
        tagPage = 1;
        applyTagPipeline();
        renderTagList();
        updateTagPager();
    }, 250);
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
tagMergeIntoEl.addEventListener('change', refreshTagMergeImpact);
const tagUsageModal = document.getElementById('tag-usage-modal');
if (tagUsageModal) {
    document.getElementById('tag-usage-close').addEventListener('click', () => { tagUsageModal.hidden = true; });
    tagUsageModal.addEventListener('click', (e) => { if (e.target === tagUsageModal) tagUsageModal.hidden = true; });
}
document.getElementById('tag-merge-save').addEventListener('click', saveTagMerge);

// ---------- 打标输入补全接线 ----------
// 片段编辑：mediaId 经 episode 惰性解析（clip 不含 mediaId，缓存复用）
attachTagSuggest(editTag, () => editingClip ? resolveEpisodeMediaId(editingClip.episodeId) : Promise.resolve(null));
// 集打标：当前集自带 mediaId
attachTagSuggest(episodeTagInput, () => (currentEpisode && currentEpisode.mediaId) || null);

// 启动加载格式字典（格式 tab / 各筛选下拉）
loadFormats();

// ========== 设置：网站背景图（多图轮播） ==========
let siteBgTimer = null, siteBgIndex = 0;

async function loadSettings(apply) {
    try {
        const resp = await fetch('/api/settings');
        if (!resp.ok) return;
        const s = await resp.json();
        bgSettingsCache = {
            bgImages: s.bgImages || [],
            rotationSec: s.rotationSec ?? 15,
            opacity: s.opacity ?? 0.6,
            blur: s.blur ?? 30,
            brightness: s.brightness ?? 50,
        };
        if (apply) applySiteBackground(bgSettingsCache);
        renderSettingsForm();
    } catch (e) { /* 加载失败保持默认 */ }
}

function renderSettingsForm() {
    const preview = document.getElementById('bg-preview');
    const first = bgSettingsCache.bgImages[0];
    if (first) {
        preview.style.backgroundImage = "url('" + first + "')";
        const empty = preview.querySelector('.bg-preview-empty');
        if (empty) empty.remove();
    } else {
        preview.style.backgroundImage = '';
        preview.innerHTML = '<span class="bg-preview-empty">未设置背景图</span>';
    }
    const listEl = document.getElementById('bg-list');
    listEl.innerHTML = '';
    bgSettingsCache.bgImages.forEach((src, i) => {
        const item = document.createElement('div');
        item.className = 'bg-list-item';
        item.innerHTML = '<img src="' + esc(src) + '" alt="" loading="lazy"><button type="button" class="bg-rm" title="移除">×</button>';
        item.querySelector('.bg-rm').addEventListener('click', () => removeBgImage(i));
        listEl.appendChild(item);
    });
    document.getElementById('bg-rotation').value = bgSettingsCache.rotationSec;
    document.getElementById('bg-rotation-val').textContent = bgSettingsCache.rotationSec + 's';
    document.getElementById('bg-opacity').value = Math.round(bgSettingsCache.opacity * 100);
    document.getElementById('bg-opacity-val').textContent = Math.round(bgSettingsCache.opacity * 100) + '%';
    document.getElementById('bg-blur').value = bgSettingsCache.blur;
    document.getElementById('bg-blur-val').textContent = bgSettingsCache.blur + '%';
    document.getElementById('bg-brightness').value = bgSettingsCache.brightness ?? 50;
    document.getElementById('bg-brightness-val').textContent = (bgSettingsCache.brightness ?? 50) + '%';
    document.getElementById('bg-clear-btn').hidden = bgSettingsCache.bgImages.length === 0;
}

async function uploadBgImages() {
    const input = document.getElementById('bg-file');
    const files = [...(input.files || [])].filter(f => f.size <= 8 * 1024 * 1024);
    if (!files.length) { showToast('未选择背景图（单张需 ≤8MB）'); input.value = ''; return; }
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    try {
        const resp = await fetch('/api/settings/bg', { method: 'POST', body: fd });
        if (!resp.ok) throw new Error();
        const s = await resp.json();
        bgSettingsCache = { bgImages: s.bgImages || [], rotationSec: s.rotationSec ?? 15, opacity: s.opacity ?? 0.6, blur: s.blur ?? 30, brightness: s.brightness ?? 50 };
        applySiteBackground(bgSettingsCache);
        renderSettingsForm();
        showToast('已添加 ' + files.length + ' 张背景图');
    } catch (e) { showToast('背景图上传失败'); }
    input.value = '';
}

async function removeBgImage(i) {
    const src = bgSettingsCache.bgImages[i];
    if (!src) return;
    const name = src.split('/').pop();
    try {
        const resp = await fetch('/api/settings/bg/' + encodeURIComponent(name), { method: 'DELETE' });
        if (!resp.ok) throw new Error();
        const s = await resp.json();
        bgSettingsCache = { bgImages: s.bgImages || [], rotationSec: s.rotationSec ?? 15, opacity: s.opacity ?? 0.6, blur: s.blur ?? 30 };
        applySiteBackground(bgSettingsCache);
        renderSettingsForm();
    } catch (e) { showToast('移除失败'); }
}

function clearAllBgImages() {
    if (!bgSettingsCache.bgImages.length) return;
    showConfirm({
        title: '移除全部背景图',
        msg: '移除全部背景图，恢复默认深色背景？',
        okText: '移除全部',
        danger: true,
        onOk: async () => {
            for (const src of [...bgSettingsCache.bgImages]) {
                const name = src.split('/').pop();
                await fetch('/api/settings/bg/' + encodeURIComponent(name), { method: 'DELETE' }).catch(() => { });
            }
            loadSettings(true);
        },
    });
}

function previewBgChange() {
    bgSettingsCache.rotationSec = Number(document.getElementById('bg-rotation').value);
    bgSettingsCache.opacity = Number(document.getElementById('bg-opacity').value) / 100;
    bgSettingsCache.blur = Number(document.getElementById('bg-blur').value);
    bgSettingsCache.brightness = Number(document.getElementById('bg-brightness').value);
    document.getElementById('bg-rotation-val').textContent = bgSettingsCache.rotationSec + 's';
    document.getElementById('bg-opacity-val').textContent = Math.round(bgSettingsCache.opacity * 100) + '%';
    document.getElementById('bg-blur-val').textContent = bgSettingsCache.blur + '%';
    document.getElementById('bg-brightness-val').textContent = bgSettingsCache.brightness + '%';
    applySiteBackground(bgSettingsCache);
}

async function saveSiteSettings() {
    try {
        const resp = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rotationSec: bgSettingsCache.rotationSec, opacity: bgSettingsCache.opacity, blur: bgSettingsCache.blur, brightness: bgSettingsCache.brightness ?? 50 }),
        });
        if (!resp.ok) throw new Error();
        showToast('设置已保存');
        document.getElementById('settings-modal').hidden = true;
    } catch (e) { showToast('保存失败'); }
}

/** 背景层应用：多图定时轮播 + 深色遮罩 + 模糊。 */
function applySiteBackground(cfg) {
    const wrap = document.getElementById('site-bg');
    if (!wrap) return;
    wrap.innerHTML = '';
    const imgs = cfg.bgImages || [];
    if (siteBgTimer) { clearInterval(siteBgTimer); siteBgTimer = null; }
    if (!imgs.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    /* 遮罩放 ::after（壁纸之上），透明度越大遮罩越浅 */
    wrap.style.setProperty('--mask-opacity', (1 - (cfg.opacity ?? 0.6)).toFixed(2));
    const blur = cfg.blur || 0;
    const brightness = cfg.brightness ?? 50;
    imgs.forEach((src, i) => {
        const div = document.createElement('div');
        div.className = 'site-bg-item' + (i === 0 ? ' active' : '');
        div.style.backgroundImage = "url('" + src + "')";
        const filters = [];
        if (brightness !== 50) filters.push('brightness(' + (0.2 + brightness * 0.016) + ')');
        if (blur > 0) filters.push('blur(' + blur + 'px)');
        div.style.filter = filters.length ? filters.join(' ') : 'none';
        wrap.appendChild(div);
    });
    if (imgs.length > 1) {
        const rot = Math.max(5, cfg.rotationSec || 15) * 1000;
        siteBgIndex = 0;
        siteBgTimer = setInterval(() => {
            const items = wrap.querySelectorAll('.site-bg-item');
            if (!items.length) return;
            items[siteBgIndex].classList.remove('active');
            siteBgIndex = (siteBgIndex + 1) % items.length;
            items[siteBgIndex].classList.add('active');
        }, rot);
    }
}

/* 设置弹窗事件绑定 + 页面加载应用已保存背景
   web 顶栏 ⚙(settings-btn) 与桌面侧栏设置(settings-btn-side) 都绑 openSettings（双布局） */
/** 打开设置弹窗（恢复位置：这里的函数体一度被重构时删掉，只留下调用 → 初始化即 ReferenceError，
 *  把本文后面的所有顶层绑定（设置/背景图/推荐编辑器挂载/导出徐标轮询）全部干掉。2026-10-02 修复）。 */
function openSettings() {
    document.getElementById('settings-modal').hidden = false;
    loadSettings(true);
}

document.querySelectorAll('.settings-btn').forEach(b => b.addEventListener('click', openSettings));
document.getElementById('settings-cancel').addEventListener('click', () => {
    document.getElementById('settings-modal').hidden = true;
    loadSettings(true); // 丢弃未保存改动，恢复已存背景
});
document.getElementById('settings-save').addEventListener('click', saveSiteSettings);
document.getElementById('bg-add-btn').addEventListener('click', () => document.getElementById('bg-file').click());
document.getElementById('bg-file').addEventListener('change', uploadBgImages);
document.getElementById('bg-clear-btn').addEventListener('click', clearAllBgImages);
['bg-rotation', 'bg-opacity', 'bg-blur', 'bg-brightness'].forEach(id =>
    document.getElementById(id).addEventListener('input', previewBgChange));
loadSettings(true); // 页面加载应用背景

/* ========== 推荐工作台（v0.28）：编辑器由 Remotion 工程构建（`npm run build:editor` → dist-editor/） ==========
   方式 A：同页挂载（无 iframe）——本页以 ESM 加载 editor.js，应用挂进 #recommend-editor-root。
   未构建时给出可复制命令，不阻断其余功能。 */
let recommendEditorMounted = false;

function mountRecommendEditor() {
    const root = document.getElementById('recommend-editor-root');
    if (!root || recommendEditorMounted) return;
    if (!window.VTRecommendEditor) {
        root.innerHTML = '<div class="vt-editor-missing">推荐工作台未构建：请在 <code>backend/remotion</code> 执行 '
            + '<code>npm run build:editor</code> 后刷新页面。</div>';
        window.addEventListener('load', () => { if (!recommendEditorMounted) mountRecommendEditor(); }, { once: true });
        return;
    }
    window.VTRecommendEditor.mount(root);
    recommendEditorMounted = true;
}

function unmountRecommendEditor() {
    if (!recommendEditorMounted || !window.VTRecommendEditor) return;
    window.VTRecommendEditor.unmount();   // 会话回收在编辑器卸载副作用里
    recommendEditorMounted = false;
}

/* 状态栏导出任务计数（原由向导的 loadExportTasks 维护；v0.28 起任务列表在编辑器内） */
function refreshExportBadge() {
    fetch('/api/recommend/video/tasks')
        .then(r => (r.ok ? r.json() : []))
        .then(list => {
            const el = document.getElementById('sb-export');
            if (el) el.textContent = `导出任务 ${Array.isArray(list) ? list.length : 0} 个`;
        })
        .catch(() => { /* 忽略 */ });
}
refreshExportBadge();
setInterval(refreshExportBadge, 15000);

if (RECOMMEND_DESKTOP_MODE) {
    const mediaTab = document.querySelector('.nav .tab[data-view="media"]');
    if (mediaTab) mediaTab.lastChild.textContent = ' 素材库';
    document.title = '推荐视频导出工具';
    showView('media');
}

