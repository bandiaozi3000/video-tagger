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
const filterStatusEl = document.getElementById('filter-status');
const filterSubcategoryEl = document.getElementById('filter-subcategory');
const filterCollectionEl = document.getElementById('filter-collection');
const filterUnconfirmedEl = document.getElementById('filter-unconfirmed');
const filterYearEl = document.getElementById('filter-year');
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
const detailHighlightBtn = document.getElementById('detail-highlight');
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
const highlightExportBtn = document.getElementById('highlight-export');
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
const mediaNoteInput = document.getElementById('media-note');
const mediaSyncModal = document.getElementById('media-sync-modal');
const syncYearGridEl = document.getElementById('sync-year-grid');
const mediaSyncStatusEl = document.getElementById('media-sync-status');
const mediaSyncStartBtn = document.getElementById('media-sync-start');
const mediaSyncProgressEl = document.getElementById('media-sync-progress');
const syncSourceChips = document.querySelectorAll('#media-sync-modal [data-sync-mode]');
const syncSourceHintEl = document.getElementById('sync-source-hint');
const syncWorkBoxEl = document.getElementById('sync-work-box');
const syncCategoryGridEl = document.getElementById('sync-category-grid');
const syncSeasonGridEl = document.getElementById('sync-season-grid');
const syncSeasonBoxEl = document.getElementById('sync-season-box');
const syncYearBoxEl = document.getElementById('sync-year-box');
const syncWorkInputEl = document.getElementById('sync-work-input');
const metadataSyncCandidatesEl = document.getElementById('metadata-sync-candidates');
let syncMode = 'YEAR';
let metadataSyncCandidates = [];
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
const recommendSourceEl = document.getElementById('recommend-source');
const recommendYearEl = document.getElementById('recommend-year');
const recommendGroupedEl = document.getElementById('recommend-grouped');
const recommendGroupSizeEl = document.getElementById('recommend-group-size');
const recommendOnlySelectedEl = document.getElementById('recommend-only-selected');
const recommendPaginationEl = document.getElementById('recommend-pagination');
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
let mediaFilter = { q: '', status: '', format: '', subcategoryId: '', collectionId: '', unconfirmed: false, year: '', sort: '', order: 'desc' };
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
let recommendPage = 1;               // 推荐向导来源网格分页
let recommendPageSize = 30;
let recommendTotal = 0;
let recommendGroupPage = 1;        // 推荐页分组视图当前页（组打包分页）
let recommendGroupPerPage = 500;   // 分组每页媒体数上限（档位，同上）
let recommendGroupPages = [];
let recommendGroupTotalPages = 1;
let recommendGroupNav = {};
let recommendGroupNavYears = [];
let recommendSourceType = '';        // 推荐来源过滤：'' | 'collection'
let recommendSourceId = null;
let recommendTagId = null;           // 标签过滤（已解析的 tag id）
let recommendTagName = '';           // 已应用的标签名（防 Enter+blur 双触发）
let currentRecommendList = [];       // 推荐向导当前页媒体（全选本页用）
let recommendYear = '';       // 推荐页年份筛选（空=全部）
let recommendGrouped = true;  // 推荐页分组显示（按首播年份，默认开）
let recommendOnlySelected = false;  // 仅显示已勾选：网格只列出 recommendSelected 里的媒体（无视来源/标签/年份筛选）
let recommendBoxSelect = false;     // 框选模式：拖拽画框批量取消/勾选（Alt=勾选）
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
    if (currentViewName === 'recommend' && name !== 'recommend') saveRecommendPosition();   // 离开推荐前记录页码+滚动+模式
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
    if (name === 'recommend') {
        fillRecommendSources();
        restoreRecommendPosition();              // 刷新/切走后恢复页码+模式（sessionStorage）
        loadRecommend(recommendRestoreScrollY > 0 ? false : true);   // 有恢复位置 → 不重置页码
        if (recommendRestoreScrollY > 0) restoreListScroll(recommendRestoreScrollY, 'recommend');
    }
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

/** 返回需恢复滚动的列表视图（媒体/收藏夹/推荐：showView 会自动重新加载列表）。 */
const SCROLL_RESTORE_VIEWS = new Set(['media', 'collections', 'recommend']);

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
        : viewName === 'collections' ? '#coll-media-grid'
        : '#recommend-grid';
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

/* ========== 推荐页位置持久化（刷新/切走后回到之前的页码+滚动+模式） ========== */
let recommendRestoreScrollY = 0;
function saveRecommendPosition() {
    try {
        sessionStorage.setItem('recommend-pos', JSON.stringify({
            page: recommendGrouped ? recommendGroupPage : recommendPage,
            scrollY: window.scrollY,
            onlySelected: recommendOnlySelected,
            grouped: recommendGrouped
        }));
    } catch (e) { /* 忽略 */ }
}
function restoreRecommendPosition() {
    recommendRestoreScrollY = 0;
    try {
        const raw = sessionStorage.getItem('recommend-pos');
        if (!raw) return;
        const pos = JSON.parse(raw);
        if (typeof pos.onlySelected === 'boolean') {
            recommendOnlySelected = pos.onlySelected;
            if (recommendOnlySelectedEl) recommendOnlySelectedEl.checked = pos.onlySelected;
        }
        if (typeof pos.grouped === 'boolean') {
            recommendGrouped = pos.grouped;
            if (recommendGroupedEl) recommendGroupedEl.checked = pos.grouped;
        }
        if (recommendGrouped) recommendGroupPage = Math.max(1, pos.page || 1);
        else recommendPage = Math.max(1, pos.page || 1);
        recommendRestoreScrollY = Number(pos.scrollY) || 0;
    } catch (e) { /* 忽略 */ }
}
window.addEventListener('pagehide', () => {
    if (currentViewName === 'recommend') saveRecommendPosition();   // 刷新/关页前抓当前滚动
});

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
            <div class="cd-source-provenance"></div>
            ${clip.note ? '<div class="cd-note"></div>' : ''}
            ${nav.length ? `<div class="cd-nav">${nav.join('')}</div>` : ''}
        </div>`;
    clipDetailHeadEl.querySelector('.ad-title').textContent = clip.title || '(未命名)';
    const range = clip.endSec != null ? `${fmtTime(clip.timestampSec)} – ${fmtTime(clip.endSec)}` : fmtTime(clip.timestampSec);
    clipDetailHeadEl.querySelector('.ad-meta').textContent = `片段 · ${range} · ${clip.tag}`;
    const provenance = clipDetailHeadEl.querySelector('.cd-source-provenance');
    provenance.innerHTML = `<span class="clip-channel-badge">资产 ${clip.videoAssetId ?? '未绑定'} · ${esc(clip.materialState || 'REFERENCE_ONLY')}</span> <button class="nav-link" data-channel-state></button><button class="nav-link" data-prepare-material>准备素材</button> <button class="nav-link" data-play-source>本地回顾</button>`;
    // v0.24 M3：渠道求值（C1 本地/C2 Animeko/C3 直链/C4 录屏）展示 + 素材化/回顾入口
    const channelState = provenance.querySelector('[data-channel-state]');
    const prepBtn = provenance.querySelector('[data-prepare-material]');
    const playBtn = provenance.querySelector('[data-play-source]');
    channelState.textContent = '求值渠道…';
    (async () => {
        try {
            const resp = await fetch(`/api/clips/${clip.id}/material/channels`);
            const ev = await resp.json();
            if (!resp.ok) throw new Error(ev.message || `HTTP ${resp.status}`);
            channelState.textContent = ev.state === 'PRESENT'
                ? `✓ ${ev.channel} ${ev.filePath ? ev.filePath.split(/[\\\/]/).pop() : ''}`
                : ev.state === 'PENDING' ? `${ev.channel} 待定：${(ev.message || '').slice(0, 46)}` : `渠道不可用`;
            channelState.title = ev.message || ev.strategy || '';
        } catch (e) {
            channelState.textContent = '渠道求值失败';
        }
    })();
    prepBtn.addEventListener('click', async () => {
        provenance.textContent = '正在求值素材渠道…';
        try {
            const chResp = await fetch(`/api/clips/${clip.id}/material/channels/refresh`);
            const ev = await chResp.json();
            if (!chResp.ok) throw new Error(ev.message || `HTTP ${chResp.status}`);
            if (ev.state === 'PRESENT' && ev.strategy === 'TRIM_LOCAL_ASSET') {
                provenance.textContent = '本地资产在场，正在裁剪…';
                const resp = await fetch(`/api/clips/${clip.id}/material`, { method: 'POST' });
                const result = await resp.json();
                if (!resp.ok) throw new Error(result.message || `HTTP ${resp.status}`);
                await renderClipDetail(clip.id);
            } else if (ev.state === 'PRESENT' && ev.strategy === 'TRIM_EXTERNAL_FILE' && ev.filePath) {
                provenance.textContent = 'Animeko/外部文件在场，正在裁剪…';
                const resp = await fetch(`/api/clips/${clip.id}/material/materialize-from-file?path=${encodeURIComponent(ev.filePath)}`, { method: 'POST' });
                const result = await resp.json();
                if (!resp.ok) throw new Error(result.message || `HTTP ${resp.status}`);
                await renderClipDetail(clip.id);
            } else {
                provenance.textContent = ev.message || '无可用本地素材源，可回退浏览器录制或先显式缓存该集';
                playBtn.hidden = true;
            }
        } catch (e) { provenance.textContent = `素材准备失败：${e.message}`; }
    });
    playBtn.addEventListener('click', async () => {
        try {
            const resp = await fetch(`/api/clips/${clip.id}/material/play-source`);
            if (!resp.ok) throw new Error('无可用本地文件源，请回退原网页');
            const blob = await resp.blob();
            openLocalVideoPlayer(blob, clip);
        } catch (e) { showToast(e.message); }
    });
    if (clip.note) clipDetailHeadEl.querySelector('.cd-note').textContent = `备注：${clip.note}`;
    clipDetailHeadEl.querySelector('[data-nav="episode"]')?.addEventListener('click', () => openEpisodeDetail(ep.id));
    clipDetailHeadEl.querySelector('[data-nav="media"]')?.addEventListener('click', () => openMediaDetail(media.id));
    renderClipTags(clip, media ? media.id : null);
    bindClipExportActions(clip);
}

/** v0.24 M3：本地回顾播放——blob 弹窗播放素材源，并 seek 到片段起点（本地精确回顾）。 */
function openLocalVideoPlayer(blob, clip) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '1000';
    overlay.innerHTML = `
        <div class="modal modal-wide">
            <div class="modal-head"><h2>本地回顾 · ${esc(clip.title || '片段')}</h2><button type="button" class="btn-mini danger modal-close">✕</button></div>
            <video controls autoplay style="width:100%;max-height:68vh;border-radius:12px;background:#000"></video>
            <p class="detail-section-note">区间 ${fmtTime(clip.timestampSec)}${clip.endSec != null ? ' – ' + fmtTime(clip.endSec) : ''}（时间码 ${clip.tag || ''}）。仅回放验证，导出仍走「准备素材→裁剪」。</p>
        </div>`;
    document.body.appendChild(overlay);
    const url = URL.createObjectURL(blob);
    const video = overlay.querySelector('video');
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
        if (clip.timestampSec != null && video.duration) video.currentTime = Math.max(0, Math.min(clip.timestampSec, video.duration - 0.1));
    });
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
            <div class="cd-source-provenance"></div>
            <button type="button" class="btn-mini ep-no-edit-btn">编辑季/集</button>
            ${mediaNav}
        </div>`;
    episodeDetailHeadEl.querySelector('.ad-title').textContent = ep.title || '(未命名)';
    const meta = [no, `${ep.clipCount || 0} 条片段`];
    if (ep.watchedAt) meta.push(`✓ 已看 ${fmtDateTime(ep.watchedAt)}`);
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
    editTag.value = r.tag;
    editNote.value = r.note || '';
    editTime.value = r.timestampSec;
    editEndTime.value = r.endSec != null ? r.endSec : '';
    editModal.hidden = false;
    editTitle.focus();
}

async function saveEdit() {
    if (!editingClip) return;
    const payload = {
        title: editTitle.value.trim() || editingClip.title,
        url: editingClip.url,
        timestampSec: parseFloat(editTime.value),
        endSec: editEndTime.value === '' ? null : parseFloat(editEndTime.value),
        tag: editTag.value.trim(),
        note: editNote.value.trim()
    };
    if (!Number.isFinite(payload.timestampSec) || payload.timestampSec < 0 ||
        (payload.endSec != null && (!Number.isFinite(payload.endSec) || payload.endSec <= payload.timestampSec)) || !payload.tag) {
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
        if (mediaFilter.q) p.set('q', mediaFilter.q);
        if (mediaFilter.status) p.set('status', mediaFilter.status);
        if (mediaFilter.format) p.set('format', mediaFilter.format);
        if (mediaFilter.subcategoryId) p.set('subcategoryId', mediaFilter.subcategoryId);
        if (mediaFilter.unconfirmed) p.set('confirmed', '0');
        if (mediaFilter.year) p.set('year', mediaFilter.year);
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

/** 推荐页年份筛选下拉：库中已有的首播年份（降序）。 */
async function fillRecommendYearFilter() {
    try {
        const resp = await fetch('/api/media/years');
        if (!resp.ok) return;
        const years = await resp.json();
        const cur = recommendYearEl.value;
        recommendYearEl.innerHTML = '<option value="">全部年份</option>';
        for (const y of years) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = `${y} 年`;
            recommendYearEl.appendChild(opt);
        }
        recommendYearEl.value = cur;
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
    if (displayView === 'list') { renderMediaRow(list, container, mode); return; }
    container.classList.remove('media-list');   // 卡片视图：清掉列表视图残留 class，恢复 grid 布局
    for (const a of list) {
        mediaById.set(a.id, a);
        const card = document.createElement('div');
        card.className = 'media-card' + (mediaBatchMode ? ' batch-mode' : '') + (mediaSelected.has(a.id) ? ' selected' : '');
        const cover = (a.coverPath || a.fallbackCoverPath || a.externalCoverUrl)
            ? `<img src="${esc(a.coverPath || a.fallbackCoverPath || a.externalCoverUrl)}" alt="" onerror="this.style.display='none'">`
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
        const cover = (a.coverPath || a.fallbackCoverPath || a.externalCoverUrl)
            ? `<img src="${esc(a.coverPath || a.fallbackCoverPath || a.externalCoverUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
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
    showToast(`已将 ${ids.length} 个媒体移入回收站，可随时撤回`);
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
/** 开场代表秀子集：步骤2「自定义开局封面」勾选后由用户指定（否则自动评分 top10）。 */
const openingSelected = new Set();
/** v0.21 推荐片段配置：mediaId -> { order: [clipId], badge: {...} }。 */
const recommendMediaClips = new Map();
let recommendClipModalMediaId = null;
let recommendClipModalItems = [];
let recommendClipModalAllItems = [];
let recommendStep = 1;            // 向导当前步骤 1/2/3
let recommendDstHandle = null;    // File System Access API 保存句柄（选过保存位置后非空）

/** 拉取推荐用媒体列表并渲染到向导网格（复用媒体列表接口；收藏夹/标签过滤 + offset 分页，勾选跨页保留）。 */
async function loadRecommend(resetPage = true) {
    if (resetPage) recommendPage = 1;
    recommendGridEl.innerHTML = '';
    try {
        if (recommendOnlySelected) {
            // 仅显示已勾选：按 id 精确圈选（无视来源/标签/年份筛选）
            // 分组走组打包分页；平铺前端切片分页（复用分页条）——不再一次渲染全部勾选
            if (recommendSelected.size === 0) {
                recommendPaginationEl.hidden = true;
                recommendTotal = 0;
                renderRecommendPagination(1);
                renderRecommendEmpty();
                return;
            }
            const all = await loadRecommendByIds([...recommendSelected]);
            recommendTotal = all.length;
            recommendPaginationEl.hidden = false;
            if (recommendGrouped) { renderRecommendGrouped(all); return; }
            const totalPages = Math.max(1, Math.ceil(all.length / recommendPageSize));
            if (recommendPage > totalPages) recommendPage = 1;
            if (recommendPage < 1) recommendPage = 1;
            renderRecommendGrid(all.slice((recommendPage - 1) * recommendPageSize, recommendPage * recommendPageSize));
            renderRecommendPagination(totalPages);
            return;
        }
        if (recommendGrouped) {
            // 分组视图：拉全量 → 组打包分页（每页媒体数 ≤ 上限、组不跨页切碎；巨型组切片），复用分页条
            const all = await loadAllRecommend();
            recommendTotal = all.length;
            recommendPaginationEl.hidden = false;
            if (all.length === 0) {
                recommendGroupPages = []; recommendGroupTotalPages = 1; recommendGroupPage = 1;
                renderRecommendGroupPagination();
                return;
            }
            renderRecommendGrouped(all);
            return;
        }
        recommendPaginationEl.hidden = false;
        recommendGridEl.className = 'media-grid';   // 复位容器（分组模式改成 coll-group-wrap）
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
        if (recommendYear) {
            params.set('year', String(recommendYear));
            filters.set('year', String(recommendYear));
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

/** 推荐页分组视图全量拉取：循环按 200/页 取完（带收藏夹/标签/年份筛选）。 */
async function loadAllRecommend() {
    const all = [];
    const size = 200;
    for (let offset = 0; ; offset += size) {
        const params = new URLSearchParams({ limit: String(size), offset: String(offset) });
        if (recommendSourceType === 'collection') params.set('collectionId', String(recommendSourceId));
        if (recommendTagId) params.set('tagId', String(recommendTagId));
        if (recommendYear) params.set('year', String(recommendYear));
        const resp = await fetch(`/api/media?${params.toString()}`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const list = await resp.json();
        all.push(...list);
        if (list.length < size) break;
    }
    return all;
}

/** 仅显示已勾选：按 id 分页拉取所选媒体（listFiltered 的 ids 过滤；服务端 limit 上限 200，超出分页取全）。 */
async function loadRecommendByIds(ids) {
    const all = [];
    const size = 200;
    for (let offset = 0; offset < ids.length; offset += size) {
        const chunk = ids.slice(offset, offset + size);
        // ids 已精确圈定本 chunk，offset 必须为 0——否则 ids 过滤后结果集 ≤200 再 offset 会整段跳空（勾选 >200 丢失）
        const resp = await fetch(`/api/media?ids=${chunk.join(',')}&limit=${size}&offset=0`);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const list = await resp.json();
        all.push(...list);
    }
    return all;
}

/** 仅显示已勾选且勾选为空：网格空态提示。 */
function renderRecommendEmpty() {
    recommendGridEl.innerHTML = '<div class="recommend-empty">暂无勾选的媒体，去上方勾选一些吧</div>';
}

/** 推荐页分组视图：组打包分页（打包全部组 → 渲染当前页 + 分组分页条）；渲染后保持 currentRecommendList。 */
function renderRecommendGrouped(list) {
    currentRecommendList = list;
    const { pages, yearToPage, years } = buildGroupedPages(list, recommendGroupPerPage);
    recommendGroupPages = pages;
    recommendGroupTotalPages = pages.length;
    recommendGroupNav = yearToPage;
    recommendGroupNavYears = years;
    if (recommendGroupPage > recommendGroupTotalPages) recommendGroupPage = 1;
    renderRecommendGroupPage();
}

/** 渲染推荐页分组当前页（onDone 回调用于导航跨页后滚动）。 */
function renderRecommendGroupPage(onDone) {
    const page = recommendGroupPages[recommendGroupPage - 1];
    renderGroupedPage(recommendGridEl, page, {
        idPrefix: 'rgrp-',
        navYears: recommendGroupNavYears,
        currentPageYears: new Set((page || []).map(g => g.year)),
        onNavYear: (year) => gotoGroupYear(year, recommendGroupNav[year], recommendGroupPage, (pg, y) => {
            recommendGroupPage = pg;
            renderRecommendGroupPage(() => document.getElementById('rgrp-' + y)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }, recommendGridEl),
        itemRenderer: (group, wrap) => renderRecommendGrid(group, wrap),
        groupActions: {
            selectAll: (g) => applyGroupSelect(g, true),
            selectNone: (g) => applyGroupSelect(g, false),
        },
    });
    renderRecommendGroupPagination();
    if (onDone) requestAnimationFrame(onDone);
}

/** 推荐页分组分页条（复用推荐分页条 DOM；info 显示「分组第 X/N 页」）。 */
function renderRecommendGroupPagination() {
    recommendTotalEl.textContent = `共 ${recommendTotal} 部`;
    recommendPageInfoEl.textContent = `分组第 ${recommendGroupPage}/${recommendGroupTotalPages} 页`;
    recommendPagePrevEl.disabled = recommendGroupPage <= 1;
    recommendPageNextEl.disabled = recommendGroupPage >= recommendGroupTotalPages;
}

/** 分组头「全选/取消本组」：批量勾/取消该组可见媒体，就地更新勾选态（仅显示已勾选时重载保持页）。批量改动先确认再执行。 */
function applyGroupSelect(g, select) {
    const act = () => {
        let n = 0;
        g.items.forEach(a => {
            if (select && !recommendSelected.has(a.id)) { recommendSelected.add(a.id); n++; }
            else if (!select && recommendSelected.has(a.id)) { recommendSelected.delete(a.id); n++; }
        });
        if (n === 0) return;
        updateRecommendCount();
        markRecommendDirty(true);
        if (recommendOnlySelected) {
            loadRecommend(false);   // 仅显示已勾选：取消本组后重载（保持当前页）
        } else {
            const sec = document.getElementById('rgrp-' + g.year);   // 就地更新本组卡片勾选态，不整页重绘（保持滚动）
            if (sec) {
                sec.querySelectorAll('.media-card, .media-row').forEach(card => {
                    const id = Number(card.dataset.id);
                    const on = recommendSelected.has(id);
                    card.classList.toggle('selected', on);
                    const cb = card.querySelector('.media-batch-cb');
                    if (cb) cb.checked = on;
                });
            }
        }
        showToast(`已${select ? '勾选' : '取消勾选'}本组 ${n} 部`);
    };
    showConfirm({
        title: `分组${select ? '全选' : '取消勾选'}`,
        msg: `确定${select ? '勾选' : '取消勾选'}「${g.year} 年」本组的 ${g.items.length} 部媒体吗？`,
        okText: '确定',
        danger: !select,
        onOk: act,
    });
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
function renderRecommendGrid(list, container = recommendGridEl) {
    if (displayView === 'list') { renderRecommendRow(list, container); return; }
    container.classList.remove('media-list');
    currentRecommendList = list;
    const grid = container;
    grid.innerHTML = '';
    for (const a of list) {
        mediaById.set(a.id, a);
        const card = document.createElement('div');
        card.className = 'media-card' + (recommendSelected.has(a.id) ? ' selected' : '');
        card.dataset.id = a.id;   // 框选批量操作按 data-id 定位
        const cover = (a.coverPath || a.fallbackCoverPath || a.externalCoverUrl)
            ? `<img src="${esc(a.coverPath || a.fallbackCoverPath || a.externalCoverUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<span class="cover-placeholder">${esc(a.title).slice(0, 1)}</span>`;
        const fmtBadge = a.mediaFormat
            ? `<span class="media-format-badge fmt-${esc(a.mediaFormat)}">${esc(formatName(a.mediaFormat))}</span>`
            : '';
        const srcBadge = a.source === 'BANGUMI'
            ? '<span class="media-source-badge">Bangumi</span>'
            : '';
        card.innerHTML = `
            <div class="media-cover">${fmtBadge}${srcBadge}${cover}
                <input type="checkbox" class="media-batch-cb" title="勾选后进入推荐导出" ${recommendSelected.has(a.id) ? 'checked' : ''}>
                <button type="button" class="media-fav-btn${(a.collectionCount || 0) > 0 ? ' fav-active' : ''}" title="收藏到收藏夹">${(a.collectionCount || 0) > 0 ? '❤' : '♡'}</button>
                <button type="button" class="recommend-clip-entry${recommendMediaClips.has(a.id) ? ' configured' : ''}" title="配置推荐片段">${recommendMediaClips.has(a.id) ? '片段 ' + recommendMediaClips.get(a.id).order.length + ' 段' : '选片段'}</button>
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
        cb.addEventListener('change', (e) => {
            e.stopPropagation();   // 单勾选改立即保存，拦截冒泡到 view-recommend 的防抖保存（避免双存）
            if (cb.checked) { recommendSelected.add(a.id); card.classList.add('selected'); }
            else { recommendSelected.delete(a.id); card.classList.remove('selected'); }
            updateRecommendCount();
            markRecommendDirty(true);   // 单勾选/取消立即存草稿——刷新/返回不丢（全选走程序化赋值不触发此处）
            if (recommendOnlySelected) loadRecommend(false);   // 仅显示已勾选：取消勾选后从网格移除（保持当前页不跳回第1页）
        });
        card.querySelector('.media-fav-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openFavPicker(a.id, e.currentTarget);
        });
        card.querySelector('.recommend-clip-entry').addEventListener('click', (e) => {
            e.stopPropagation();
            openRecommendClipModal(a);
        });
        card.addEventListener('click', () => openMediaDetail(a.id));
        grid.appendChild(card);
    }
}

/** 推荐勾选页列表视图：缩略图 + 标题/元信息 + 收藏；勾选跨页保留。 */
function renderRecommendRow(list, container = recommendGridEl) {
    currentRecommendList = list;
    const grid = container;
    grid.innerHTML = '';
    grid.classList.add('media-list');
    for (const a of list) {
        mediaById.set(a.id, a);
        const row = document.createElement('div');
        row.className = 'media-row' + (recommendSelected.has(a.id) ? ' selected' : '');
        row.dataset.id = a.id;   // 框选批量操作按 data-id 定位
        const cover = (a.coverPath || a.fallbackCoverPath || a.externalCoverUrl)
            ? `<img src="${esc(a.coverPath || a.fallbackCoverPath || a.externalCoverUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<span class="cover-placeholder">${esc(a.title).slice(0, 1)}</span>`;
        const fmtBadge = a.mediaFormat
            ? `<span class="media-format-badge fmt-${esc(a.mediaFormat)}">${esc(formatName(a.mediaFormat))}</span>`
            : '';
        const srcBadge = a.source === 'BANGUMI'
            ? '<span class="media-source-badge">Bangumi</span>'
            : '';
        row.innerHTML = `
            <div class="row-thumb">${fmtBadge}${srcBadge}${cover}
                <input type="checkbox" class="media-batch-cb" title="勾选后进入推荐导出" ${recommendSelected.has(a.id) ? 'checked' : ''}>
            </div>
            <div class="row-body">
                <div class="row-title"></div>
                <div class="row-meta"></div>
            </div>
            <div class="row-actions">
                <button type="button" class="row-btn fav${(a.collectionCount || 0) > 0 ? ' active' : ''}" title="收藏到收藏夹">${(a.collectionCount || 0) > 0 ? '❤' : '♡'}</button>
                <button type="button" class="btn-mini recommend-clip-entry${recommendMediaClips.has(a.id) ? ' configured' : ''}" title="配置推荐片段">${recommendMediaClips.has(a.id) ? '片段 ' + recommendMediaClips.get(a.id).order.length + ' 段' : '选片段'}</button>
            </div>`;
        row.querySelector('.row-title').textContent = a.title;
        const meta = [];
        if (a.status) meta.push(MEDIA_STATUS_LABEL[a.status] || a.status);
        meta.push(`${a.clipCount || 0} 条片段`);
        row.querySelector('.row-meta').textContent = meta.join(' · ');
        const cb = row.querySelector('.media-batch-cb');
        cb.addEventListener('click', (e) => e.stopPropagation());
        cb.addEventListener('change', (e) => {
            e.stopPropagation();   // 单勾选改立即保存，拦截冒泡到 view-recommend 的防抖保存（避免双存）
            if (cb.checked) { recommendSelected.add(a.id); row.classList.add('selected'); }
            else { recommendSelected.delete(a.id); row.classList.remove('selected'); }
            updateRecommendCount();
            markRecommendDirty(true);   // 单勾选/取消立即存草稿——刷新/返回不丢（全选走程序化赋值不触发此处）
            if (recommendOnlySelected) loadRecommend(false);   // 仅显示已勾选：取消勾选后从列表移除（保持当前页不跳回第1页）
        });
        row.querySelector('.row-btn.fav').addEventListener('click', (e) => { e.stopPropagation(); openFavPicker(a.id, e.currentTarget); });
        row.querySelector('.recommend-clip-entry').addEventListener('click', (e) => { e.stopPropagation(); openRecommendClipModal(a); });
        grid.appendChild(row);
    }
}

/** 自动预选开场子集：按评分从高到低取前 10，无评分随机补足。 */
function autoOpeningIds() {
    const rated = [...recommendSelected].map(id => ({ id, r: Number((mediaById.get(id) || {}).rating) || 0 }));
    const hasScore = rated.filter(x => x.r > 0).sort((a, b) => b.r - a.r);
    const noScore = rated.filter(x => x.r <= 0);
    for (let i = noScore.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [noScore[i], noScore[j]] = [noScore[j], noScore[i]]; }
    return [...hasScore, ...noScore].slice(0, 10).map(x => x.id);
}

/** 当前开局封面 id 列表：步骤2「自定义」勾选 → 用户指定；否则自动评分 top10。 */
function currentOpeningIds() {
    return document.getElementById('recommend-opening-toggle').checked ? [...openingSelected] : autoOpeningIds();
}

/** 初始化「开局封面」：自定义 toggle + 选择器弹窗。 */
function initRecommendOpening() {
    const toggle = document.getElementById('recommend-opening-toggle');
    const pickBtn = document.getElementById('recommend-opening-pick');
    toggle.addEventListener('change', () => {
        pickBtn.hidden = !toggle.checked;
        updateOpeningStatus();
    });
    /* 封面选择弹窗：标题搜索（仅标题）+ 按年份分组（降序，无年份→未知年份）+ 组可折叠 + 仅显示已勾选 */
    const openingSearch = document.getElementById('recommend-opening-search');
    const openingOnlySel = document.getElementById('recommend-opening-only-selected');
    let openingPicked = new Set();      // 弹窗内勾选源（确认时写回 openingSelected）
    let openingCollapsed = new Set();   // 折叠的组名集合（跨重渲染保留）
    function renderOpeningGrid() {
        const grid = document.getElementById('recommend-opening-grid');
        const q = (openingSearch.value || '').trim().toLowerCase();
        const onlyPicked = openingOnlySel.checked;   // 仅显示已勾选：只看 openingPicked 里已勾的
        let items = [...recommendSelected]
            .map(id => ({ id, a: mediaById.get(id) }))
            .filter(x => x.a)
            .filter(x => !q || (x.a.title || '').toLowerCase().includes(q));
        if (onlyPicked) items = items.filter(it => openingPicked.has(it.id));
        const groups = new Map();
        for (const it of items) {
            const key = it.a.year ? `${it.a.year} 年` : '未知年份';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(it);
        }
        const keys = [...groups.keys()].sort((a, b) => {
            const pa = /^(\d{4}) 年$/.exec(a), pb = /^(\d{4}) 年$/.exec(b);
            if (pa && pb) return Number(pb[1]) - Number(pa[1]);
            if (pa) return -1; if (pb) return 1;
            return 0;
        });
        grid.innerHTML = '';
        if (!items.length) {
            const emptyMsg = onlyPicked ? '暂无已勾选的封面' : (q ? '无匹配标题的媒体' : '暂无可选媒体');
            grid.innerHTML = '<div class="opening-empty">' + emptyMsg + '</div>';
            return;
        }
        keys.forEach(g => {
            const list = groups.get(g);
            const head = document.createElement('button');
            head.type = 'button';
            head.className = 'opening-group-head';
            head.textContent = `${g} · ${list.length} 部${openingCollapsed.has(g) ? ' ▸' : ' ▾'}`;
            head.dataset.gkey = g;
            grid.appendChild(head);
            const wrap = document.createElement('div');
            wrap.className = 'opening-group' + (openingCollapsed.has(g) ? ' collapsed' : '');
            list.forEach(({ id, a }) => {
                const cover = (a.coverPath || a.fallbackCoverPath)
                    ? `<img src="${a.coverPath || a.fallbackCoverPath}" alt="" onerror="this.style.display='none'">`
                    : '';
                const c = document.createElement('label');
                c.className = 'opening-pick-item' + (openingPicked.has(id) ? ' on' : '');
                c.innerHTML = `${cover}<span class="opening-pick-name">${esc(a.title)}</span>
                    <input type="checkbox" ${openingPicked.has(id) ? 'checked' : ''} data-id="${id}">`;
                wrap.appendChild(c);
            });
            grid.appendChild(wrap);
        });
        grid.querySelectorAll('.opening-group-head').forEach(h => h.addEventListener('click', () => {
            const g = h.dataset.gkey;
            if (openingCollapsed.has(g)) openingCollapsed.delete(g); else openingCollapsed.add(g);
            renderOpeningGrid();
        }));
        grid.querySelectorAll('input[data-id]').forEach(cb => cb.addEventListener('change', e => {
            const id = Number(cb.dataset.id);
            if (cb.checked) openingPicked.add(id); else openingPicked.delete(id);
            e.target.closest('.opening-pick-item').classList.toggle('on', cb.checked);
            if (openingOnlySel.checked) renderOpeningGrid();   // 仅显示已勾选：取消后从网格移除
        }));
    }
    pickBtn.addEventListener('click', async () => {
        if (recommendSelected.size === 0) { showToast('请先在步骤1勾选推荐媒体'); return; }
        await ensureMediaByIds([...recommendSelected]);   // 草稿恢复/跨页勾选的媒体可能不在 mediaById，先补齐
        openingSearch.value = '';                          // 每次打开从头搜/从头看
        openingOnlySel.checked = false;                    // 仅显示已勾选重置为关（默认看全部）
        openingPicked = new Set(openingSelected);          // 自定义模式：已有勾选回显，无勾选就是空（不回退自动 top10）
        renderOpeningGrid();
        document.getElementById('recommend-opening-modal').hidden = false;
    });
    openingSearch.addEventListener('input', renderOpeningGrid);
    openingOnlySel.addEventListener('change', renderOpeningGrid);
    document.getElementById('recommend-opening-cancel').addEventListener('click', () => {
        document.getElementById('recommend-opening-modal').hidden = true;
    });
    document.getElementById('recommend-opening-confirm').addEventListener('click', () => {
        openingSelected.clear();
        openingPicked.forEach(id => openingSelected.add(id));
        document.getElementById('recommend-opening-modal').hidden = true;
        toggle.checked = true;
        pickBtn.hidden = false;
        updateOpeningStatus();
        markRecommendDirty(true);   // 开局封面离散操作：立即存草稿（否则刷新丢）
        showToast(`开局封面已设为 ${openingSelected.size} 张`);
    });
    updateOpeningStatus();
}

/** 框选取消：开启后在推荐网格拖拽画框，松开把框内已勾选媒体批量取消勾选（按住 Alt 拖拽 = 框选勾选）。 */
function initRecommendBoxSelect() {
    const btn = document.getElementById('recommend-box-select');
    if (!btn) return;
    let drag = false, startPt = null, overlay = null;
    btn.addEventListener('click', () => {
        recommendBoxSelect = !recommendBoxSelect;
        btn.classList.toggle('active', recommendBoxSelect);
        btn.textContent = recommendBoxSelect ? '✂ 框选(开)' : '✂ 框选取消';
        recommendGridEl.classList.toggle('boxing', recommendBoxSelect);
    });
    /* 框选模式下拦截网格内点击：不打开详情（勾选框/收藏按钮走各自 handler） */
    document.addEventListener('click', (e) => {
        if (recommendBoxSelect && e.target.closest('#recommend-grid')) e.stopPropagation();
    }, true);
    recommendGridEl.addEventListener('mousedown', (e) => {
        if (!recommendBoxSelect || e.button !== 0) return;
        if (e.target.closest('.media-batch-cb')) return;   // 点勾选框本身 → 正常单个切换
        drag = true; startPt = { x: e.clientX, y: e.clientY };
        overlay = document.createElement('div');
        overlay.className = 'recommend-box-overlay';
        overlay.style.left = e.clientX + 'px';
        overlay.style.top = e.clientY + 'px';
        document.body.appendChild(overlay);
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!drag || !overlay || !startPt) return;
        const x = Math.min(startPt.x, e.clientX), y = Math.min(startPt.y, e.clientY);
        overlay.style.left = x + 'px'; overlay.style.top = y + 'px';
        overlay.style.width = Math.abs(e.clientX - startPt.x) + 'px';
        overlay.style.height = Math.abs(e.clientY - startPt.y) + 'px';
    });
    document.addEventListener('mouseup', (e) => {
        if (!drag) return;
        drag = false;
        if (overlay) { overlay.remove(); overlay = null; }
        if (!startPt) return;
        const r = { l: Math.min(startPt.x, e.clientX), t: Math.min(startPt.y, e.clientY),
                    r: Math.max(startPt.x, e.clientX), b: Math.max(startPt.y, e.clientY) };
        startPt = null;
        const check = !!e.altKey;   // Alt=勾选；默认取消勾选
        /* 收集框内卡片 id（不立即改动，先确认再执行，防误拖摘错一片） */
        const ids = [];
        recommendGridEl.querySelectorAll('.media-card, .media-row').forEach(card => {
            const b = card.getBoundingClientRect();
            if (b.right < r.l || b.bottom < r.t || b.left > r.r || b.top > r.b) return;
            const id = Number(card.dataset.id);
            if (id) ids.push(id);
        });
        if (!ids.length) return;
        const act = () => {
            let n = 0;
            ids.forEach(id => {
                if (check) { if (!recommendSelected.has(id)) { recommendSelected.add(id); n++; } }
                else if (recommendSelected.has(id)) { recommendSelected.delete(id); n++; }
            });
            if (n === 0) return;
            updateRecommendCount();
            markRecommendDirty(true);
            if (recommendOnlySelected) loadRecommend(false);   // 仅显示已勾选：移除后重载保持当前页
            showToast(`框选${check ? '勾选' : '取消勾选'} ${n} 部`);
        };
        showConfirm({
            title: `框选${check ? '勾选' : '取消勾选'}`,
            msg: `框选了 ${ids.length} 部媒体，确定要${check ? '勾选' : '取消勾选'}吗？`,
            okText: '确定',
            danger: !check,
            onOk: act,
        });
    });
}

/** 确保 mediaById 含这些 id 的媒体数据（推荐网格未加载的，从后端逐个补——草稿恢复/跨页勾选场景）。 */
async function ensureMediaByIds(ids) {
    const missing = ids.filter(id => !mediaById.has(id));
    await Promise.all(missing.map(async id => {
        try {
            const resp = await fetch(`/api/media/${id}`);
            if (resp.ok) {
                const d = await resp.json();
                mediaById.set(id, d);
            }
        } catch (e) { /* 忽略 */ }
    }));
}

/** 步骤2 开局封面状态：自动 N 张 / 自定义 N 张。 */
function updateOpeningStatus() {
    const toggle = document.getElementById('recommend-opening-toggle');
    const n = currentOpeningIds().length;
    document.getElementById('recommend-opening-count').textContent =
        toggle.checked ? `自定义 ${n} 张` : `自动 ${n} 张`;
}

/** 勾选数 → 计数 + 开场秀子集 + 下一步按钮可用态。 */
function updateRecommendCount() {
    const n = recommendSelected.size;
    [...openingSelected].forEach(id => { if (!recommendSelected.has(id)) openingSelected.delete(id); });
    document.getElementById('recommend-picked').innerHTML =
        `已选 <b>${n}</b> 部 · 开场秀 <b>${currentOpeningIds().length}</b> 个封面`;
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
    if (recommendOnlySelected) { loadRecommend(); showToast('已清空全部勾选'); return; }   // 仅显示已勾选：本页全勾即全清，重载成空态
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
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`wizard-pane-${i}`).hidden = i !== step;
    }
    /* 进入步骤3（页面·交互）时刷新开局封面计数（基于已勾选媒体） */
    if (step === 3) updateOpeningStatus();
    /* 进入步骤4（预览导出）时刷新导出任务列表 */
    if (step === 4) loadExportTasks();
}

/** 推荐页标题（主题）当前值，空 → 默认。 */
function recommendTitle() {
    const t = document.getElementById('recommend-title').value.trim();
    return t === '' ? '我的番剧推荐' : t;
}

/** 左上角角标文案（可空；空 → 后端用默认「我的番剧推荐」）。 */
function recommendBrandTitle() {
    return document.getElementById('recommend-brand-title').value.trim();
}

/** 分组方式：none/year/subcategory/collection（步骤2下拉）。 */
function recommendGroupBy() {
    return document.getElementById('recommend-group-by').value;
}

/** 推荐模板：chapter/clip；旧草稿的 stream/overview 统一回退章节式。 */
function recommendGroupStyle() {
    if (RECOMMEND_DESKTOP_MODE) return 'chapter';
    const value = document.getElementById('recommend-group-style').value;
    return value === 'clip' ? 'clip' : 'chapter';
}

/** 每屏同时展示 N 部：1-10 滑块（步骤3；1 = 逐部展示）。 */
function recommendPerScreen() {
    return Math.max(1, Math.min(10, Number(document.getElementById('recommend-per-screen').value) || 1));
}

/** 详情显示内容开关（状态/备注/标签）：预览弹窗勾选 → {detailShow:{...}}。 */
function recommendDetailShow() {
    return {
        detailShow: {
            status: document.getElementById('recommend-detail-status').checked,
            note: document.getElementById('recommend-detail-note').checked,
            tag: document.getElementById('recommend-detail-tag').checked,
        }
    };
}

/** 步骤3「每屏同时展示」滑块 → 值标签同步。 */
function syncRecommendPerScreenVal() {
    const el = document.getElementById('recommend-per-screen');
    const v = document.getElementById('recommend-per-screen-val');
    if (el && v) v.textContent = `${recommendPerScreen()} 部`;
}

/** 副标题（可空；空 → 模板隐藏副题）。 */
function recommendSubtitle() {
    return document.getElementById('recommend-subtitle').value.trim();
}

/** 开场封面大小：0-100 滑块（预览弹窗；50 = 中）。 */
function recommendCoverSize() {
    return document.getElementById('preview-cover-size').value;
}

/** 开场图片加载速度：0-100 滑块（50 = 当前）。 */
function recommendOpeningSpeed() {
    return document.getElementById('preview-opening-speed').value;
}

/** 结尾滚动速度：0-100 滑块（50 = 当前）。 */
function recommendEndingSpeed() {
    return document.getElementById('preview-ending-speed').value;
}

/** 分组排序：date-desc 新→旧 / date-asc 旧→新 / none 原序。 */
function recommendGroupSort() {
    return document.getElementById('preview-group-sort').value;
}

/** 主题简介（可空；空 → 模板不显示序言页）。 */
function recommendIntro() {
    return document.getElementById('recommend-intro').value.trim();
}

/** 结尾标题/文案（可空；空 → 模板用默认）。 */
function recommendEnding() {
    return {
        endingTitle: document.getElementById('recommend-ending-title').value.trim(),
        endingText: document.getElementById('recommend-ending-text').value.trim(),
    };
}

/** 序言标题（可空；空 → 模板用主标题）。 */
function recommendPrologueTitle() {
    return document.getElementById('recommend-prologue-title').value.trim();
}

/** 背景图 base64（自定义图片时用）。 */
let recommendBgImages = [];   // 自定义背景图多选（base64）

/** 背景设置：default/color/image → {bgColor | bgImages + 轮换/透明度/模糊度}（不选 → 空对象用默认）。 */
function recommendBg() {
    const t = document.getElementById('recommend-bg-type').value;
    if (t === 'color') return { bgColor: document.getElementById('recommend-bg-color').value };
    if (t === 'image' && recommendBgImages.length) {
        return {
            bgImages: recommendBgImages,
            bgRotationSec: Number(document.getElementById('recommend-bg-rotation').value) || 8,
            bgOpacity: Number(document.getElementById('recommend-bg-opacity').value),   // 0 也有效，勿用 || 默认
            bgBlur: Number(document.getElementById('recommend-bg-blur').value) || 0,
            bgBrightness: Number(document.getElementById('recommend-bg-brightness').value)   // 0 也有效，勿用 || 默认
        };
    }
    return {};
}

/** 音乐条样式：整体缩放 + 坐标 X/Y（视口百分比；0 也有效，勿用 || 默认）。 */
function recommendBgmStyle() {
    return {
        bgmScale: Number(document.getElementById('recommend-bgm-scale').value),
        bgmX: Number(document.getElementById('recommend-bgm-x').value),
        bgmY: Number(document.getElementById('recommend-bgm-y').value),
    };
}

/** 音乐条滑块值标签同步（缩放%）。 */
function syncBgmStyleLabels() {
    const map = {
        'recommend-bgm-scale': 'recommend-bgm-scale-val',
    };
    for (const [inputId, valId] of Object.entries(map)) {
        const el = document.getElementById(inputId), v = document.getElementById(valId);
        if (el && v) v.textContent = el.value + '%';
    }
}

/** 初始化音乐条配置（配置弹窗）：滑块 input → 实时预览 + 存草稿；X/Y 数字输入 change → 同上。 */
function initRecommendBgmStyle() {
    const regen = () => {
        syncBgmStyleLabels();
        if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty();
        markRecommendDirty();
    };
    ['recommend-bgm-scale'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', regen);
    });
    ['recommend-bgm-x', 'recommend-bgm-y'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', regen);
    });
    syncBgmStyleLabels();
}

/** 配置弹窗：四组折叠（默认全折叠，点标题展开/收起）+ 显示时长输入实时生效（同其他配置滑块）。 */
function initConfigGroups() {
    document.querySelectorAll('.config-group').forEach(g => {
        const t = g.querySelector('.config-group-title');
        if (t) t.addEventListener('click', () => g.classList.toggle('collapsed'));
    });
    ['recommend-dur-opening', 'recommend-dur-intro', 'recommend-dur-group', 'recommend-dur-detail', 'recommend-dur-ending'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty();
            markRecommendDirty();
            updateRecommendDuration();   // 时长改动即时重算总时长
        });
    });
}

/** 渲染背景图列表（多图，可移除）。 */
function renderRecommendBgList() {
    const el = document.getElementById('recommend-bg-images');
    if (!el) return;
    el.innerHTML = recommendBgImages.map((img, i) => `
        <span class="recommend-bg-thumb-wrap">${i + 1}<img src="${img}" class="recommend-bg-thumb" alt="">
            <button type="button" class="btn-mini danger" data-idx="${i}" title="移除">✕</button>
        </span>`).join('');
    el.querySelectorAll('[data-idx]').forEach(b => b.addEventListener('click', () => {
        recommendBgImages.splice(Number(b.dataset.idx), 1);
        renderRecommendBgList();
        if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty();
        markRecommendDirty();
    }));
}

/** 初始化背景（配置弹窗）：类型联动（仅自定义图片显示滑块）+ 多图上传 + 轮换/透明度/模糊度滑块。 */
function initRecommendBg() {
    const typeEl = document.getElementById('recommend-bg-type');
    const colorRow = document.getElementById('recommend-bg-color-row');
    const imageRow = document.getElementById('recommend-bg-image-row');
    const fileInput = document.getElementById('recommend-bg-file');
    const sync = () => {
        colorRow.hidden = typeEl.value !== 'color';
        imageRow.hidden = typeEl.value !== 'image';   // 联动：仅「自定义图片」显示图片配置（含滑块）
    };
    typeEl.addEventListener('change', () => {
        sync();
        if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty();
        markRecommendDirty();
    });
    /* 主题色 input：防抖实时预览（改颜色立即生效，不必切走再切回） */
    const colorInput = document.getElementById('recommend-bg-color');
    let colorPreviewTimer = null;
    if (colorInput) {
        colorInput.addEventListener('input', () => {
            clearTimeout(colorPreviewTimer);
            colorPreviewTimer = setTimeout(() => {
                if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty();
                markRecommendDirty();
            }, 200);
        });
    }
    document.getElementById('recommend-bg-image-pick').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        const files = [...(fileInput.files || [])].filter(f => f.size <= 8 * 1024 * 1024);
        if (!files.length) { showToast('未添加背景图（每张需 ≤8MB）'); fileInput.value = ''; return; }
        Promise.all(files.map(f => new Promise(res => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.readAsDataURL(f);
        }))).then(imgs => {
            recommendBgImages.push(...imgs);
            renderRecommendBgList();
            if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty();
            markRecommendDirty();
            showToast(`已添加 ${imgs.length} 张背景图`);
        });
        fileInput.value = '';
    });
    /* 轮换/透明度/模糊度滑块：值联动 + 预览弹窗开着时重生成 */
    const sliders = [
        ['recommend-bg-rotation', 'recommend-bg-rotation-val', v => v + 's'],
        ['recommend-bg-opacity', 'recommend-bg-opacity-val', v => v + '%'],
        ['recommend-bg-brightness', 'recommend-bg-brightness-val', v => v + '%'],
        ['recommend-bg-blur', 'recommend-bg-blur-val', v => String(v)]
    ];
    sliders.forEach(([id, valId, fmt]) => {
        const s = document.getElementById(id);
        const v = document.getElementById(valId);
        const upd = () => { if (v) v.textContent = fmt(Number(s.value)); };
        if (!s) return;
        s.addEventListener('input', upd);
        s.addEventListener('change', () => {
            upd();
            if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty();
            markRecommendDirty();
        });
        upd();
    });
    sync();
}

/** 显示时长（秒）：开局定格 / 序言 / 章节转场 / 详情 / 结尾。 */
function recommendDurations() {
    return {
        openingSec: Number(document.getElementById('recommend-dur-opening').value) || 10,
        introSec: Number(document.getElementById('recommend-dur-intro').value) || 5,
        groupSec: Number(document.getElementById('recommend-dur-group').value) || 5,
        detailSec: Number(document.getElementById('recommend-dur-detail').value) || 10,
        endingSec: Number(document.getElementById('recommend-dur-ending').value) || 5,
    };
}

/** 推荐背景音乐（多首可选）：[{name, base64}]，随 HTML/视频导出请求传递。 */
let recommendBgmList = [];

/** BGM 请求体追加字段（无 BGM 时空对象）。 */
function recommendBgmBody() {
    return recommendBgmList.length ? { bgmTracks: recommendBgmList } : {};
}

/** 初始化 BGM 选择：可多选 → 列表展示 + 单项移除；预览封面大小下拉 → 改选重新生成。 */
function initRecommendBgm() {
    const fileInput = document.getElementById('recommend-bgm-file');
    const listEl = document.getElementById('recommend-bgm-list');
    const countEl = document.getElementById('recommend-bgm-count');
    document.getElementById('recommend-bgm-pick').addEventListener('click', () => fileInput.click());
    const render = () => {
        countEl.textContent = recommendBgmList.length ? `🎵 ${recommendBgmList.length} 首` : '';
        listEl.innerHTML = recommendBgmList.map((t, i) => `
            <span class="recommend-bgm-item">${i + 1}. ${esc(t.name)}
                <button type="button" class="btn-mini danger" data-idx="${i}">✕</button>
            </span>`).join('');
        listEl.querySelectorAll('[data-idx]').forEach(b => b.addEventListener('click', () => {
            recommendBgmList.splice(Number(b.dataset.idx), 1);
            render();
        }));
    };
    fileInput.addEventListener('change', () => {
        const files = [...(fileInput.files || [])].filter(f => f.size <= 50 * 1024 * 1024);
        if (files.length === 0) { showToast('未添加 BGM（单首需 ≤50MB）'); fileInput.value = ''; return; }
        Promise.all(files.map(f => new Promise(res => {
            const r = new FileReader();
            r.onload = () => res({ name: f.name, base64: String(r.result).split(',')[1] || '' });
            r.readAsDataURL(f);
        }))).then(tracks => {
            /* BGM 总 base64 ≤100MB（后端 Jackson 单字符串上限 200MB、文档上限 200MB 兜底；单首 50MB 文件 base64 ~67MB） */
            const cur = recommendBgmList.reduce((s, t) => s + (t.base64?.length || 0), 0);
            const add = tracks.reduce((s, t) => s + (t.base64?.length || 0), 0);
            const MAX_BGM_B64 = 100 * 1024 * 1024;
            if (cur + add > MAX_BGM_B64) {
                showToast(`BGM 总量超过 100MB（当前 ${(cur / 1048576).toFixed(1)}MB + 新增 ${(add / 1048576).toFixed(1)}MB），请减少曲目`);
                return;
            }
            recommendBgmList.push(...tracks);
            render();
            showToast(`已添加 ${tracks.length} 首 BGM`);
        });
        fileInput.value = '';
    });
    /* 预览弹窗三滑块 + 分组排序：改值 → 重新生成预览（滑块值即时联动显示） */
    function bindPreviewSlider(sliderId, valId, fmt) {
        const s = document.getElementById(sliderId);
        const v = document.getElementById(valId);
        const upd = () => { v.textContent = fmt(Number(s.value)); updateRecommendDuration(); };   // 拖拽即时重算总时长
        s.addEventListener('input', upd);
        s.addEventListener('change', () => { if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty(); });
        upd();
    }
    bindPreviewSlider('preview-cover-size', 'preview-cover-val', n => n + ' · ' + (n < 34 ? '小' : n > 66 ? '大' : '中'));
    bindPreviewSlider('preview-opening-speed', 'preview-opening-val', n => String(n));
    bindPreviewSlider('preview-ending-speed', 'preview-ending-val', n => String(n));
    bindPreviewSlider('recommend-per-screen', 'recommend-per-screen-val', n => n + ' 部');
    document.getElementById('preview-group-sort').addEventListener('change', () => {
        if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty();
    });
    /* 详情显示内容开关：改值 → 重新生成预览 + 存草稿 */
    ['recommend-detail-status', 'recommend-detail-note', 'recommend-detail-tag'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            if (!document.getElementById('recommend-preview-modal').hidden) markPreviewDirty();
            markRecommendDirty();
        });
    });
    render();
}

/* ========== v0.21 推荐片段编排 ========== */
function recommendClipConfigObject() {
    const result = {};
    for (const [mediaId, value] of recommendMediaClips) result[mediaId] = value;
    return result;
}
function clipRangeText(c) {
    const start = Number(c.timestampSec);
    const end = c.endSec == null ? '结束' : Number(c.endSec).toFixed(1);
    return `${Number.isFinite(start) ? start.toFixed(1) : '?'}s — ${end}`;
}
function clipStatusText(c) {
    if (!c.videoFp) return ['缺少源指纹', 'bad'];
    if (c.endSec == null && c.videoDuration == null) return ['待补时长 · 播到源视频结束', 'warn'];
    return ['READY · 可准备', ''];
}
function renderRecommendClipCandidates() {
    const list = document.getElementById('recommend-clips-candidate-list');
    if (!list) return;
    const q = (document.getElementById('recommend-clips-search').value || '').trim().toLowerCase();
    const selected = new Set(recommendClipModalItems.map(c => c.id));
    const items = recommendClipModalAllItems;
    const filtered = items.filter(c => !q || [c.title, c.tag, c.note].some(v => String(v || '').toLowerCase().includes(q)));
    document.getElementById('recommend-clips-candidate-count').textContent = `${filtered.length}/${items.length}`;
    list.innerHTML = filtered.length ? filtered.map(c => {
        const [state, cls] = clipStatusText(c);
        const cover = c.coverPath ? `<img class="recommend-clip-thumb" src="${esc(c.coverPath)}" alt="">` : '<span class="recommend-clip-thumb">✦</span>';
        return `<div class="recommend-clip-row"><span>${cover}</span><span class="recommend-clip-copy"><b>${esc(c.title || `片段 #${c.id}`)}</b><small>${clipRangeText(c)} · ${esc(c.tag || c.note || '')}</small></span><span class="recommend-clip-state ${cls}">${selected.has(c.id) ? '已加入' : state}</span><button type="button" class="btn-mini" data-add-clip="${c.id}" ${selected.has(c.id) ? 'disabled' : ''}>${selected.has(c.id) ? '已加入' : '加入'}</button></div>`;
    }).join('') : '<div class="wizard-hint">没有匹配的片段</div>';
    list.querySelectorAll('[data-add-clip]').forEach(btn => btn.addEventListener('click', () => {
        const clip = items.find(c => c.id === Number(btn.dataset.addClip));
        if (clip) { recommendClipModalItems.push(clip); renderRecommendClipEditor(); }
    }));
}
function renderRecommendClipEditor() {
    const list = document.getElementById('recommend-clips-selected-list');
    if (!list) return;
    document.getElementById('recommend-clips-selected-count').textContent = `${recommendClipModalItems.length} 段`;
    list.innerHTML = recommendClipModalItems.length ? recommendClipModalItems.map((c, i) => {
        const [state, cls] = clipStatusText(c);
        const cover = c.coverPath ? `<img class="recommend-clip-thumb small" src="${esc(c.coverPath)}" alt="">` : '<span class="recommend-clip-thumb small">✦</span>';
        return `<div class="recommend-clip-row" draggable="true" data-selected-clip="${c.id}"><span class="recommend-clip-order">${String(i + 1).padStart(2, '0')}</span><span>${cover}</span><span class="recommend-clip-copy"><b>${esc(c.title || `片段 #${c.id}`)}</b><small>${clipRangeText(c)} · <em class="recommend-clip-state ${cls}">${state}</em></small></span><button type="button" class="btn-mini danger" data-remove-clip="${c.id}">移除</button></div>`;
    }).join('') : '<div class="wizard-hint">右侧还没有片段，点击左侧「加入」。</div>';
    list.querySelectorAll('[data-remove-clip]').forEach(btn => btn.addEventListener('click', () => { recommendClipModalItems = recommendClipModalItems.filter(c => c.id !== Number(btn.dataset.removeClip)); renderRecommendClipEditor(); }));
    let dragging = null;
    list.querySelectorAll('[data-selected-clip]').forEach(row => {
        row.addEventListener('dragstart', () => { dragging = Number(row.dataset.selectedClip); row.classList.add('dragging'); });
        row.addEventListener('dragend', () => { dragging = null; row.classList.remove('dragging'); });
        row.addEventListener('dragover', e => e.preventDefault());
        row.addEventListener('drop', e => { e.preventDefault(); const target = Number(row.dataset.selectedClip); const from = recommendClipModalItems.findIndex(c => c.id === dragging); const to = recommendClipModalItems.findIndex(c => c.id === target); if (from >= 0 && to >= 0 && from !== to) { const [item] = recommendClipModalItems.splice(from, 1); recommendClipModalItems.splice(to, 0, item); renderRecommendClipEditor(); } });
    });
    const total = recommendClipModalItems.reduce((sum, c) => sum + (c.endSec != null && c.timestampSec != null ? Math.max(0, c.endSec - c.timestampSec) : 0), 0);
    document.getElementById('recommend-clips-total').textContent = `预计已知时长 ${total.toFixed(1)} 秒${recommendClipModalItems.some(c => c.endSec == null && c.videoDuration == null) ? ' · 含自然结束片段' : ''}`;
    renderRecommendClipCandidates();
    updateRecommendBadgePreview();
}
function updateRecommendBadgePreview() {
    const out = document.getElementById('recommend-badge-preview');
    if (!out) return;
    const media = mediaById.get(recommendClipModalMediaId) || { title: '媒体标题' };
    const clip = recommendClipModalItems[0] || { title: '片段标题', note: '片段备注' };
    const parts = [];
    if (document.getElementById('recommend-badge-media').checked) parts.push(media.title);
    if (document.getElementById('recommend-badge-clip').checked) parts.push(clip.title);
    if (document.getElementById('recommend-badge-index').checked) parts.push('#1');
    if (document.getElementById('recommend-badge-note').checked && clip.note) parts.push(clip.note);
    let text = parts.join(' · '); const custom = document.getElementById('recommend-badge-custom-input').value;
    if (custom) text += (text ? ' · ' : '') + custom.replaceAll('{media}', media.title).replaceAll('{clip}', clip.title).replaceAll('{i}', '1');
    out.textContent = text || '预览角标为空';
}
async function openRecommendClipModal(media) {
    recommendClipModalMediaId = Number(media.id); recommendClipModalItems = [];
    const old = recommendMediaClips.get(recommendClipModalMediaId);
    try {
        const resp = await fetch(`/api/clips/media/${media.id}`);
        if (!resp.ok) throw new Error('加载片段失败');
        const all = await resp.json();
        recommendClipModalAllItems = all;
        const byId = new Map(all.map(c => [c.id, c]));
        const selectedItems = (old?.order || []).map(id => byId.get(Number(id))).filter(Boolean);
        recommendClipModalItems = selectedItems;
        const badge = old?.badge || {};
        document.getElementById('recommend-badge-media').checked = !!badge.mediaTitle;
        document.getElementById('recommend-badge-clip').checked = badge.clipTitle !== false;
        document.getElementById('recommend-badge-index').checked = !!badge.index;
        document.getElementById('recommend-badge-note').checked = !!badge.note;
        document.getElementById('recommend-badge-custom-input').value = badge.custom || '';
        document.getElementById('recommend-clips-subtitle').textContent = `${media.title} · ${all.length} 条片段`;
        document.getElementById('recommend-clips-alert').hidden = true;
        renderRecommendClipEditor(); document.getElementById('recommend-clips-modal').hidden = false;
    } catch (e) { showToast(e.message || '加载片段失败'); }
}
function saveRecommendClipModal() {
    if (!recommendClipModalMediaId) return;
    if (!recommendClipModalItems.length) recommendMediaClips.delete(recommendClipModalMediaId);
    else recommendMediaClips.set(recommendClipModalMediaId, { order: recommendClipModalItems.map(c => c.id), badge: { mediaTitle: document.getElementById('recommend-badge-media').checked, clipTitle: document.getElementById('recommend-badge-clip').checked, index: document.getElementById('recommend-badge-index').checked, note: document.getElementById('recommend-badge-note').checked, custom: document.getElementById('recommend-badge-custom-input').value.trim() } });
    document.getElementById('recommend-clips-modal').hidden = true; recommendClipModalMediaId = null; markRecommendDirty(true); loadRecommend(false); showToast('已保存片段播放顺序与角标设置');
}
(function initRecommendClipModal() {
    const modal = document.getElementById('recommend-clips-modal'); if (!modal) return;
    ['recommend-badge-media','recommend-badge-clip','recommend-badge-index','recommend-badge-note','recommend-badge-custom-input'].forEach(id => document.getElementById(id).addEventListener('input', updateRecommendBadgePreview));
    document.getElementById('recommend-clips-search').addEventListener('input', renderRecommendClipCandidates);
    document.getElementById('recommend-clips-save').addEventListener('click', saveRecommendClipModal);
    ['recommend-clips-close','recommend-clips-cancel'].forEach(id => document.getElementById(id).addEventListener('click', () => { modal.hidden = true; recommendClipModalMediaId = null; }));
})();



/** 收集当前推荐配置（含 BGM，草稿用）。 */
function collectRecommendConfig() {
    const durs = recommendDurations();
    const cfg = {
        ids: [...recommendSelected],
        title: recommendTitle(),
        brandTitle: recommendBrandTitle(),
        subtitle: recommendSubtitle(),
        intro: recommendIntro(),
        prologueTitle: recommendPrologueTitle(),
        groupBy: recommendGroupBy(),
        groupStyle: recommendGroupStyle(),
        perScreen: recommendPerScreen(),
        groupSort: recommendGroupSort(),
        coverSize: recommendCoverSize(),
        openingSpeed: recommendOpeningSpeed(),
        endingScrollSpeed: recommendEndingSpeed(),
        ...recommendEnding(),
        bgType: document.getElementById('recommend-bg-type').value,
        ...recommendBg(), ...recommendBgmStyle(),
        ...recommendDetailShow(),
        ...durs,
        openingIds: currentOpeningIds(),   // 开局封面（开场代表秀）：当前开场子集
        openingCustom: document.getElementById('recommend-opening-toggle').checked,
        mediaClips: recommendClipConfigObject()
    };
    /* 大体积素材不入草稿/模板（每次保存序列化+上传会卡主线程，实测 BGM 57MB→365ms、背景图 8.6MB→56ms）：
       勾选+设置照常保存刷新恢复，BGM/背景图由用户导出时现场重新添加。 */
    delete cfg.bgmTracks;
    delete cfg.bgImages;
    return cfg;
}

/** 模板配置：同草稿（不含 BGM——BGM 体积大，模板不应背上）。 */
function collectTemplateConfig() {
    return collectRecommendConfig();
}

function setCfgVal(id, v) {
    const el = document.getElementById(id);
    if (el && v != null && String(v) !== '') el.value = v;
}

function renderRecommendBgmList() {
    const countEl = document.getElementById('recommend-bgm-count');
    const listEl = document.getElementById('recommend-bgm-list');
    if (countEl) countEl.textContent = recommendBgmList.length ? `🎵 ${recommendBgmList.length} 首` : '';
    if (listEl) listEl.innerHTML = recommendBgmList.map((t, i) => `
        <span class="recommend-bgm-item">${i + 1}. ${esc(t.name)}
            <button type="button" class="btn-mini danger" data-idx="${i}">✕</button>
        </span>`).join('');
    if (listEl) listEl.querySelectorAll('[data-idx]').forEach(b => b.addEventListener('click', () => {
        recommendBgmList.splice(Number(b.dataset.idx), 1);
        renderRecommendBgmList();
        markRecommendDirty();
    }));
}

function syncPreviewSliders() {
    const cover = document.getElementById('preview-cover-size');
    const cv = document.getElementById('preview-cover-val');
    if (cover && cv) cv.textContent = Number(cover.value) + ' · ' + (Number(cover.value) < 34 ? '小' : Number(cover.value) > 66 ? '大' : '中');
    const os = document.getElementById('preview-opening-speed');
    const ov = document.getElementById('preview-opening-val');
    if (os && ov) ov.textContent = String(os.value);
    const es = document.getElementById('preview-ending-speed');
    const ev = document.getElementById('preview-ending-val');
    if (es && ev) ev.textContent = String(es.value);
}

/** 还原配置到推荐向导（草稿/模板载入共用）。返回是否成功应用。 */
function applyRecommendConfig(cfg) {
    if (!cfg) return false;
    recommendSelected.clear();
    (cfg.ids || []).forEach(id => recommendSelected.add(Number(id)));
    recommendMediaClips.clear();
    Object.entries(cfg.mediaClips || {}).forEach(([id, value]) => {
        if (value && Array.isArray(value.order)) recommendMediaClips.set(Number(id), { order: value.order.map(Number), badge: value.badge || {} });
    });
    setCfgVal('recommend-title', cfg.title);
    setCfgVal('recommend-brand-title', cfg.brandTitle);
    setCfgVal('recommend-subtitle', cfg.subtitle);
    setCfgVal('recommend-intro', cfg.intro);
    setCfgVal('recommend-prologue-title', cfg.prologueTitle);
    setCfgVal('recommend-ending-title', cfg.endingTitle);
    setCfgVal('recommend-ending-text', cfg.endingText);
    setCfgVal('recommend-group-by', cfg.groupBy);
    /* 旧草稿中的 stream/overview 由页面选择器统一映射为 chapter。 */
    const savedStyle = cfg.groupStyle === 'clip' ? 'clip' : 'chapter';
    setCfgVal('recommend-group-style', savedStyle);
    setCfgVal('recommend-per-screen', cfg.perScreen);
    syncRecommendPerScreenVal();
    setCfgVal('preview-group-sort', cfg.groupSort);
    setCfgVal('preview-cover-size', cfg.coverSize);
    setCfgVal('preview-opening-speed', cfg.openingSpeed);
    setCfgVal('preview-ending-speed', cfg.endingScrollSpeed);
    /* 详情显示内容开关：缺省未存 → 全开 */
    const ds = cfg.detailShow || {};
    [['recommend-detail-status', 'status'], ['recommend-detail-note', 'note'], ['recommend-detail-tag', 'tag']].forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.checked = ds[key] !== false;
    });
    setCfgVal('recommend-dur-opening', cfg.openingSec);
    setCfgVal('recommend-dur-intro', cfg.introSec);
    setCfgVal('recommend-dur-group', cfg.groupSec);
    setCfgVal('recommend-dur-detail', cfg.detailSec);
    setCfgVal('recommend-dur-ending', cfg.endingSec);
    setCfgVal('recommend-bg-type', cfg.bgType);
    setCfgVal('recommend-bg-color', cfg.bgColor);
    recommendBgmList = Array.isArray(cfg.bgmTracks) ? cfg.bgmTracks : [];
    /* 开局封面（开场代表秀）：还原自定义开场子集 + toggle 状态 */
    if (cfg.openingIds) {
        openingSelected.clear();
        cfg.openingIds.forEach(id => openingSelected.add(Number(id)));
        const ot = document.getElementById('recommend-opening-toggle');
        if (ot) ot.checked = !!cfg.openingCustom;
        /* 直接设 checked 不触发 change → 选择封面按钮可见性同步（避免恢复自定义模式后按钮仍隐藏） */
        const op = document.getElementById('recommend-opening-pick');
        if (op) op.hidden = !ot.checked;
        updateOpeningStatus();
    }
    recommendBgImages = Array.isArray(cfg.bgImages) ? cfg.bgImages : [];
    setCfgVal('recommend-bg-rotation', cfg.bgRotationSec);
    setCfgVal('recommend-bg-opacity', cfg.bgOpacity);
    setCfgVal('recommend-bg-blur', cfg.bgBlur);
    setCfgVal('recommend-bg-brightness', cfg.bgBrightness);
    setCfgVal('recommend-bgm-scale', cfg.bgmScale);
    setCfgVal('recommend-bgm-x', cfg.bgmX);
    setCfgVal('recommend-bgm-y', cfg.bgmY);
    syncBgmStyleLabels();
    renderRecommendBgList();
    renderRecommendBgmList();
    syncPreviewSliders();
    const typeEl = document.getElementById('recommend-bg-type');
    if (typeEl) typeEl.dispatchEvent(new Event('change'));   // 触发背景行显示
    if (currentViewName === 'recommend') { try { loadRecommend(); } catch (e) { /* 忽略 */ } }
    updateRecommendCount();
    return true;
}

/* 自动保存草稿（默认防抖 1s；saveNow=true 立即保存——单勾选/取消等离散操作立即落盘，避免刷新竞态丢改动）。
   recommendDraftReady：草稿异步恢复完成前禁止保存——否则恢复未完成时勾选会以空/部分状态覆盖草稿（漂移）。 */
let recommendDirtyTimer = null;
let recommendDraftReady = false;
function markRecommendDirty(saveNow) {
    if (!recommendDraftReady) return;   // 恢复完成前不保存（防覆盖）
    clearTimeout(recommendDirtyTimer);
    if (saveNow) { saveRecommendDraft(); return; }
    recommendDirtyTimer = setTimeout(saveRecommendDraft, 1000);
}
async function saveRecommendDraft() {
    try {
        const resp = await fetch('/api/recommend/draft', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: JSON.stringify(collectRecommendConfig()) })
        });
        if (resp.ok) {
            const st = document.getElementById('rec-draft-status');
            if (st) st.textContent = '已保存 ' + new Date().toTimeString().slice(0, 5);
        }
    } catch (e) { /* 忽略 */ }
}

async function restoreRecommendDraft(silent) {
    try {
        const resp = await fetch('/api/recommend/draft');
        if (!resp.ok) return false;
        const d = await resp.json();
        if (!d || !d.config) return false;
        const ok = applyRecommendConfig(JSON.parse(d.config));
        if (ok && !silent) showToast('已恢复推荐草稿');
        return ok;
    } catch (e) { return false; }
    finally {
        recommendDraftReady = true;   // 恢复完成（成功/失败/无草稿）后放行保存
    }
}

/* 模板：列表渲染 / 载入 / 删除 / 另存 */
async function renderRecommendTemplateList() {
    const el = document.getElementById('rec-template-list');
    if (!el) return;
    try {
        const resp = await fetch('/api/recommend/templates');
        if (!resp.ok) return;
        const list = await resp.json();
        el.innerHTML = '';
        if (!list.length) { el.innerHTML = '<div class="more-panel-empty">暂无模板</div>'; return; }
        list.forEach(t => {
            const row = document.createElement('div');
            row.className = 'more-panel-tpl';
            const name = document.createElement('span');
            name.className = 'tpl-name';
            name.textContent = t.name;
            row.appendChild(name);
            const loadBtn = document.createElement('button');
            loadBtn.type = 'button'; loadBtn.className = 'btn-mini'; loadBtn.textContent = '载入';
            loadBtn.addEventListener('click', async () => {
                try {
                    const r = await fetch(`/api/recommend/templates/${t.id}`);
                    const td = await r.json();
                    if (td.config && applyRecommendConfig(JSON.parse(td.config))) showToast(`已载入模板「${t.name}」`);
                } catch (e) { showToast('载入模板失败'); }
            });
            const delBtn = document.createElement('button');
            delBtn.type = 'button'; delBtn.className = 'btn-mini danger'; delBtn.textContent = '✕';
            delBtn.addEventListener('click', async () => {
                await fetch(`/api/recommend/templates/${t.id}`, { method: 'DELETE' });
                renderRecommendTemplateList();
            });
            const updBtn = document.createElement('button');
            updBtn.type = 'button'; updBtn.className = 'btn-mini'; updBtn.textContent = '更新';
            updBtn.title = '用当前推荐配置更新此模板';
            updBtn.addEventListener('click', () => {
                showConfirm({
                    title: `更新模板「${t.name}」`,
                    msg: '用当前推荐配置覆盖更新此模板？',
                    okText: '更新',
                    onOk: async () => {
                        try {
                            const resp = await fetch(`/api/recommend/templates/${t.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: t.name, config: JSON.stringify(collectTemplateConfig()) })
                            });
                            if (resp.ok) showToast(`已更新模板「${t.name}」`);
                        } catch (e) { showToast('更新模板失败'); }
                    }
                });
            });
            row.appendChild(loadBtn);
            row.appendChild(updBtn);
            row.appendChild(delBtn);
            el.appendChild(row);
        });
    } catch (e) { /* 忽略 */ }
}

/** 另存为模板：打开网站风格输入弹窗（替代原生 prompt，见记忆 ui-style-consistent）。 */
function saveRecommendAsTemplate() {
    document.getElementById('template-name-input').value = '';
    document.getElementById('template-save-modal').hidden = false;
    document.getElementById('template-name-input').focus();
}
document.getElementById('template-save-confirm').addEventListener('click', async () => {
    const name = document.getElementById('template-name-input').value.trim();
    if (!name) { showToast('请输入模板名'); return; }
    try {
        const resp = await fetch('/api/recommend/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, config: JSON.stringify(collectTemplateConfig()) })
        });
        if (resp.ok) { showToast(`已另存为模板「${name}」`); renderRecommendTemplateList(); }
        document.getElementById('template-save-modal').hidden = true;
    } catch (e) { showToast('另存模板失败'); }
});
document.getElementById('template-save-cancel').addEventListener('click', () => {
    document.getElementById('template-save-modal').hidden = true;
});

/* 「更多」面板：导出任务 / 草稿 / 模板；向导内改动自动存草稿 */
(function initRecMorePanel() {
    const btn = document.getElementById('rec-more-btn');
    const panel = document.getElementById('rec-more-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', e => { e.stopPropagation(); panel.hidden = !panel.hidden; });
    document.addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', e => e.stopPropagation());
    document.getElementById('rec-export-tasks').addEventListener('click', () => openExportTasks());
    document.getElementById('rec-restore-draft').addEventListener('click', async () => {
        const ok = await restoreRecommendDraft(false);
        if (!ok) showToast('暂无草稿');
    });
    document.getElementById('rec-save-template').addEventListener('click', saveRecommendAsTemplate);
    renderRecommendTemplateList();
    /* 推荐向导内任何改动 → 防抖自动存草稿 */
    document.getElementById('view-recommend').addEventListener('change', markRecommendDirty);
    document.getElementById('view-recommend').addEventListener('input', markRecommendDirty);
    /* 页面加载静默恢复草稿 */
    restoreRecommendDraft(true);
})();

/* 推荐配置弹窗（齿轮）：打开/关闭；打开时刷新滑块显示值 */
function refreshBgSliderVals() {
    const map = [
        ['recommend-bg-rotation', 'recommend-bg-rotation-val', v => v + 's'],
        ['recommend-bg-opacity', 'recommend-bg-opacity-val', v => v + '%'],
        ['recommend-bg-brightness', 'recommend-bg-brightness-val', v => v + '%'],
        ['recommend-bg-blur', 'recommend-bg-blur-val', v => String(v)]
    ];
    map.forEach(([id, valId, fmt]) => {
        const s = document.getElementById(id);
        const v = document.getElementById(valId);
        if (s && v) v.textContent = fmt(Number(s.value));
    });
}
document.getElementById('rec-config-btn').addEventListener('click', () => {
    syncPreviewSliders();
    refreshBgSliderVals();
    syncRecommendPerScreenVal();
    document.getElementById('recommend-config-modal').hidden = false;
});
document.getElementById('recommend-config-close').addEventListener('click', () => {
    document.getElementById('recommend-config-modal').hidden = true;
});

/* 预览配置「手动确认渲染」：配置改动只标记待渲染（按钮高亮），点击「确认渲染」才重新生成预览 */
let previewDirty = false;
function markPreviewDirty() {
    previewDirty = true;
    const btn = document.getElementById('preview-render-btn');
    if (btn) btn.classList.add('dirty');
}
function clearPreviewDirty() {
    previewDirty = false;
    const btn = document.getElementById('preview-render-btn');
    if (btn) btn.classList.remove('dirty');
}

async function generateRecommendPreview() {
    clearPreviewDirty();   // 渲染完成后清除「有待应用改动」标记
    const ids = [...recommendSelected];
    if (ids.length === 0) { showToast('请先勾选要推荐的媒体'); return; }
    const title = recommendTitle();
    const statusEl = document.getElementById('recommend-export-status');
    statusEl.textContent = '生成预览中…';
    try {
        const resp = await fetch('/api/recommend/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, title, coverMode: 'url', brandTitle: recommendBrandTitle(), subtitle: recommendSubtitle(), coverSize: recommendCoverSize(), intro: recommendIntro(), prologueTitle: recommendPrologueTitle(), groupBy: recommendGroupBy(), groupStyle: recommendGroupStyle(), perScreen: recommendPerScreen(), groupSort: recommendGroupSort(), openingSpeed: recommendOpeningSpeed(), endingScrollSpeed: recommendEndingSpeed(), openingIds: currentOpeningIds(), mediaClips: recommendClipConfigObject(), ...recommendEnding(), ...recommendBg(), ...recommendBgmStyle(), ...recommendDetailShow(), ...recommendDurations(), ...recommendBgmBody() }),
        });
        if (!resp.ok) {
            let detail = '';
            try { const body = await resp.json(); detail = body?.message || body?.error || ''; } catch (e) { detail = await resp.text().catch(() => ''); }
            throw new Error(detail || `生成失败 (${resp.status})`);
        }
        const html = await resp.text();
        const frame = document.getElementById('recommend-preview-frame');
        frame.srcdoc = html;
        /* 预览就绪后启用配置模式（BGM 条拖拽 + 右侧导航）+ 同步自动播放开关 */
        frame.onload = () => {
            try {
                frame.contentWindow.postMessage({ type: 'bgm-config', enable: true }, '*');
                frame.contentWindow.postMessage({ type: 'bgm-autoplay', on: document.getElementById('preview-autoplay').checked }, '*');
            } catch (e) { /* 忽略 */ }
        };
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
            body: JSON.stringify({ ids, title, brandTitle: recommendBrandTitle(), subtitle: recommendSubtitle(), coverSize: recommendCoverSize(), intro: recommendIntro(), prologueTitle: recommendPrologueTitle(), groupBy: recommendGroupBy(), groupStyle: recommendGroupStyle(), perScreen: recommendPerScreen(), groupSort: recommendGroupSort(), openingSpeed: recommendOpeningSpeed(), endingScrollSpeed: recommendEndingSpeed(), openingIds: currentOpeningIds(), mediaClips: recommendClipConfigObject(), ...recommendEnding(), ...recommendBg(), ...recommendBgmStyle(), ...recommendDetailShow(), ...recommendDurations(), ...recommendBgmBody() }),
        });
        if (!resp.ok) throw new Error(`生成失败 (${resp.status})`);
        const blob = await resp.blob();
        const stamp = stampNow();
        const isZip = (resp.headers.get('content-type') || '').includes('zip');
        downloadBlob(blob, `video-tagger-recommend-${stamp}.${isZip ? 'zip' : 'html'}`);
        showToast(`已生成，共 ${ids.length} 部${isZip ? '（含片段资源）' : ''}`);
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
    /* 导出文件名以导出弹窗「视频标题」为准（用户可改）；空则回退推荐主题标题 */
    const title = document.getElementById('video-filename').value.trim() || recommendTitle();
    const format = document.getElementById('video-format').value;
    const resolution = document.getElementById('video-resolution').value;
    try {
        const resp = await fetch('/api/recommend/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, title, format, resolution, mediaClips: recommendClipConfigObject(), brandTitle: recommendBrandTitle(), subtitle: recommendSubtitle(), coverSize: recommendCoverSize(), intro: recommendIntro(), prologueTitle: recommendPrologueTitle(), groupBy: recommendGroupBy(), groupStyle: recommendGroupStyle(), perScreen: recommendPerScreen(), groupSort: recommendGroupSort(), openingSpeed: recommendOpeningSpeed(), endingScrollSpeed: recommendEndingSpeed(), openingIds: currentOpeningIds(), ...recommendEnding(), ...recommendBg(), ...recommendBgmStyle(), ...recommendDetailShow(), ...recommendDurations(), ...recommendBgmBody() }),
        });
        if (!resp.ok) {
            let msg = `创建导出任务失败 (${resp.status})`;
            try { const e = await resp.json(); if (e && e.message) msg = e.message; } catch (e2) { }
            throw new Error(msg);
        }
        const data = await resp.json();
        /* 用户选过导出位置 → 任务完成后自动写入所选位置 */
        pendingExportSave = recommendDstHandle ? { taskId: data.taskId, handle: recommendDstHandle } : null;
        document.getElementById('recommend-video-modal').hidden = true;
        showToast(`已开始导出（任务 #${data.taskId}），完成后可打开文件`);
        loadExportTasks();
        startExportPoll();
    } catch (err) {
        showToast(err.message || '创建导出任务失败');
    }
}

/* ========== 导出任务列表（异步后台任务管理） ========== */
let exportPollTimer = null, lastExportTasks = [], exportTaskSelected = new Set();
let pendingExportSave = null; // {taskId, handle}：用户选过导出位置，任务完成后自动写入

/** 任务完成后，把 data/exports 产物写入用户所选位置（File System Access API）。 */
async function flushPendingExportSave(tasks) {
    if (!pendingExportSave) return;
    const t = tasks.find(x => x.id === pendingExportSave.taskId);
    if (!t || t.status !== 'DONE') return;
    const handle = pendingExportSave.handle;
    pendingExportSave = null;
    try {
        if (!handle || !handle.createWritable) { showToast('未选择保存位置，产物在任务列表中可打开'); return; }
        const fileName = String(t.filePath || '').split(/[\\/]/).pop();
        if (!fileName) return;
        const blobResp = await fetch('/exports/' + encodeURIComponent(fileName));
        if (!blobResp.ok) throw new Error('获取产物失败');
        const blob = await blobResp.blob();
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        showToast('已保存到所选位置');
    } catch (e) {
        /* File System Access API 授权可能因异步任务隔太久失效，降级提示从任务列表打开 */
        showToast('自动保存到位置失败（浏览器授权可能失效），可从任务列表「打开」查看');
    }
}

async function loadExportTasks() {
    try {
        const resp = await fetch('/api/recommend/video/tasks');
        if (!resp.ok) return;
        lastExportTasks = await resp.json();
        renderExportTasks();
    } catch (e) { /* 忽略 */ }
}

function renderExportTasks() {
    const el = document.getElementById('export-task-list');
    if (!el) return;
    const q = document.getElementById('export-task-search').value.trim().toLowerCase();
    const st = document.getElementById('export-task-status').value;
    const sort = document.getElementById('export-task-sort').value;
    let list = lastExportTasks.filter(t =>
        (!q || (t.title || '').toLowerCase().includes(q)) && (!st || t.status === st));
    if (sort === 'asc') list = [...list].reverse();
    const totalEl = document.getElementById('export-task-total');
    if (totalEl) totalEl.textContent = `共 ${lastExportTasks.length} 个任务`;
    if (!list.length) { el.innerHTML = '<p class="wizard-hint">暂无导出任务</p>'; return; }
    el.innerHTML = list.map(t => {
        const statusCls = t.status === 'DONE' ? 'done' : t.status === 'ERROR' ? 'error' : 'running';
        const statusTxt = t.status === 'DONE' ? '✓ 完成' : t.status === 'ERROR' ? '✗ 失败' : '进行中';
        const spin = t.status === 'RUNNING' ? '<span class="etr-spin"></span>' : '';
        const actions = t.status === 'DONE'
            ? `<button type="button" class="btn-mini" onclick="exportTaskOpen(${t.id}, false)">打开</button>
               <button type="button" class="btn-mini" onclick="exportTaskOpen(${t.id}, true)">文件夹</button>` : '';
        const fail = t.status === 'ERROR' && t.message
            ? `<span class="etr-msg" title="${esc(t.message)}">${esc(t.message.slice(0, 26))}…</span>` : '';
        return `<div class="export-task-row ${statusCls}">
            <input type="checkbox" class="etr-cb" data-task-id="${t.id}" ${exportTaskSelected.has(t.id) ? 'checked' : ''}>
            <span class="etr-status">${spin}${statusTxt}</span>
            <span class="etr-title">${esc(t.title)}</span>
            <span class="etr-fmt">${esc(t.format || 'MP4')}</span>
            <span class="etr-meta">${t.mediaCount} 部 · ${fmtExportTime(t.createdAt)}</span>${fail}
            <span class="etr-actions">${actions}
                <button type="button" class="btn-mini danger" onclick="exportTaskDelete(${t.id})">删除</button>
            </span>
        </div>`;
    }).join('');
    el.querySelectorAll('input[data-task-id]').forEach(cb => cb.addEventListener('change', () => {
        const id = Number(cb.dataset.taskId);
        if (cb.checked) exportTaskSelected.add(id); else exportTaskSelected.delete(id);
        updateExportTaskBatch();
    }));
    updateExportTaskBatch();
}

function updateExportTaskBatch() {
    const n = exportTaskSelected.size;
    const del = document.getElementById('export-task-batch-del');
    if (del) del.disabled = n === 0;
    const all = document.getElementById('export-task-all');
    if (all) all.checked = lastExportTasks.length > 0 && lastExportTasks.every(t => exportTaskSelected.has(t.id));
}

function exportTaskBatchDelete() {
    if (!exportTaskSelected.size) return;
    showConfirm({
        title: '批量删除导出任务',
        msg: `确定删除所选 ${exportTaskSelected.size} 个导出任务（含产物文件）？`,
        okText: '删除所选',
        onOk: async () => {
            for (const id of [...exportTaskSelected]) {
                try { await fetch(`/api/recommend/video/tasks/${id}`, { method: 'DELETE' }); } catch (e) { /* 忽略 */ }
            }
            exportTaskSelected.clear();
            showToast('已删除所选任务');
            loadExportTasks();
            updateExportTaskBatch();
        },
    });
}

function fmtExportTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function exportTaskOpen(id, folder) {
    try {
        const resp = await fetch(`/api/recommend/video/tasks/${id}/open${folder ? '?folder=true' : ''}`, { method: 'POST' });
        if (!resp.ok) { const e = await resp.json().catch(() => {}); showToast((e && e.message) || '打开失败'); }
    } catch (e) { showToast('打开失败'); }
}

function exportTaskDelete(id) {
    showConfirm({
        title: '删除导出任务',
        msg: '确定删除该导出任务？其产物文件将一并删除。',
        okText: '删除',
        onOk: async () => {
            try {
                const resp = await fetch(`/api/recommend/video/tasks/${id}`, { method: 'DELETE' });
                if (!resp.ok) { showToast('删除失败'); return; }
                loadExportTasks();
            } catch (e) { showToast('删除失败'); }
        },
    });
}

function startExportPoll() {
    if (exportPollTimer) clearInterval(exportPollTimer);
    exportPollTimer = setInterval(async () => {
        try {
            const resp = await fetch('/api/recommend/video/tasks');
            if (!resp.ok) { clearInterval(exportPollTimer); exportPollTimer = null; return; }
            lastExportTasks = await resp.json();
            renderExportTasks();
            flushPendingExportSave(lastExportTasks); // 任务完成 → 写入用户所选导出位置
            /* 弹窗已关且无进行中任务 → 停轮询 */
            if (document.getElementById('export-tasks-modal').hidden && !lastExportTasks.some(t => t.status === 'RUNNING')) {
                clearInterval(exportPollTimer); exportPollTimer = null;
            }
        } catch (e) { clearInterval(exportPollTimer); exportPollTimer = null; }
    }, 2500);
}

/** 打开导出任务弹窗（独立查看，不依赖勾选媒体）+ 轮询。 */
function openExportTasks() {
    document.getElementById('export-tasks-modal').hidden = false;
    loadExportTasks();
    startExportPoll();
}

function closeExportTasks() {
    document.getElementById('export-tasks-modal').hidden = true;
    if (exportPollTimer) { clearInterval(exportPollTimer); exportPollTimer = null; }
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
        loadExternalMetadata(detail.id);
        detailStatusEl.textContent = '';
    } catch (err) {
        detailStatusEl.textContent = '加载失败：后端未响应';
    }
}

async function loadExternalMetadata(mediaId) {
    if (window.v022LoadMediaMetadata) return window.v022LoadMediaMetadata(mediaId);
    const panel = document.getElementById('external-metadata-panel');
    if (!panel) return;
    panel.hidden = true;
    try {
        const resp = await fetch(`/api/metadata-sync/media/${mediaId}/metadata`);
        if (!resp.ok) return;
        const data = await resp.json();
        const work = data.work;
        if (!work) return;
        const aliases = parseMetadataList(work.aliasesJson);
        const genres = parseMetadataList(work.genresJson);
        const externalEpisodes = Array.isArray(data.episodes) ? data.episodes : [];
        const relations = Array.isArray(data.relations) ? data.relations : [];
        panel.innerHTML = `
            <div class="detail-section-head external-metadata-head">
                <div><span class="detail-kicker">EXTERNAL ARCHIVE</span><h3 class="stats-title">外部资料</h3></div>
                <span class="metadata-provider-badge">${esc(work.provider || '未知来源')}</span>
            </div>
            <div class="external-metadata-layout">
                <div class="external-cover-wrap">${work.coverUrl ? `<img src="${esc(work.coverUrl)}" alt="" loading="lazy">` : '<span class="cover-placeholder large">◇</span>'}</div>
                <div class="external-metadata-main">
                    <div class="external-title-stack"><h4></h4><p></p></div>
                    <div class="external-facts"></div>
                    <div class="external-description"></div>
                    <div class="external-chip-row external-genres" hidden></div>
                    <div class="external-chip-row external-aliases" hidden></div>
                </div>
            </div>
            <div class="external-episode-library" hidden>
                <div class="external-subhead"><span class="detail-kicker">EXTERNAL EPISODE INDEX</span><span class="external-episode-count"></span></div>
                <div class="external-episode-list"></div>
            </div>
            <div class="external-relations" hidden><span class="detail-kicker">RELATIONS</span><div class="external-relation-list"></div></div>`;
        panel.querySelector('.external-title-stack h4').textContent = work.canonicalTitle || work.nativeTitle || '未命名作品';
        panel.querySelector('.external-title-stack p').textContent = [work.nativeTitle, work.romajiTitle, work.englishTitle].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i && x !== work.canonicalTitle).join(' · ');
        const facts = [
            work.externalId ? `ID ${work.externalId}` : '',
            work.year ? `${work.year}${work.season ? ` · ${work.season}` : ''}` : '',
            work.format || '',
            work.episodeCount != null ? `${work.episodeCount} 集` : '',
            work.airDate || work.endDate ? `${work.airDate || '?'}${work.endDate ? ` — ${work.endDate}` : ''}` : ''
        ].filter(Boolean);
        panel.querySelector('.external-facts').innerHTML = facts.map(x => `<span>${esc(x)}</span>`).join('');
        panel.querySelector('.external-description').textContent = work.description || '暂无外部简介';
        renderMetadataChips(panel.querySelector('.external-genres'), '题材', genres);
        renderMetadataChips(panel.querySelector('.external-aliases'), '别名', aliases);
        const externalEpisodeLibrary = panel.querySelector('.external-episode-library');
        if (externalEpisodes.length) {
            externalEpisodeLibrary.hidden = false;
            panel.querySelector('.external-episode-count').textContent = `${externalEpisodes.length} 集资料`;
            panel.querySelector('.external-episode-list').innerHTML = externalEpisodes.map(ep => {
                const number = ep.episodeNo != null ? `第${ep.episodeNo}集` : '未编号';
                const secondaryTitle = ep.titleCn && ep.titleCn !== ep.title ? ep.titleCn : '';
                const meta = [ep.airDate, ep.durationSec ? `${Math.round(ep.durationSec / 60)} 分钟` : '', ep.episodeId ? '已绑定本地集' : '待绑定本地集'].filter(Boolean);
                const state = ep.syncState || 'ACTIVE';
                return `<article class="external-episode-row state-${esc(state.toLowerCase())}">
                    <div class="external-episode-no">${esc(number)}</div>
                    <div class="external-episode-copy">
                        <div class="external-episode-title">${esc(ep.title || secondaryTitle || '未命名集')}</div>
                        ${secondaryTitle ? `<div class="external-episode-secondary">${esc(secondaryTitle)}</div>` : ''}
                        ${ep.description ? `<div class="external-episode-description">${esc(ep.description)}</div>` : ''}
                        <div class="external-episode-meta">${meta.map(x => `<span>${esc(x)}</span>`).join('')}</div>
                    </div>
                    <span class="external-episode-state">${esc(state)}</span>
                </article>`;
            }).join('');
        }
        const episodeStateCounts = externalEpisodes.reduce((acc, ep) => { const state = ep.syncState || 'ACTIVE'; acc[state] = (acc[state] || 0) + 1; return acc; }, {});
        if (Object.keys(episodeStateCounts).length) {
            const episodeStates = document.createElement('div');
            episodeStates.className = 'external-episode-states';
            episodeStates.textContent = '集同步：' + Object.entries(episodeStateCounts).map(([state, count]) => `${state} ${count}`).join(' · ');
            panel.querySelector('.external-metadata-main').appendChild(episodeStates);
        }
        const relationWrap = panel.querySelector('.external-relations');
        if (relations.length) {
            relationWrap.hidden = false;
            panel.querySelector('.external-relation-list').innerHTML = relations.map(r => `<span>${esc(r.relationType || '相关作品')} · ${esc(r.title || r.relatedExternalId || '')}</span>`).join('');
        }
        const state = work.syncState || '未知';
        const syncLabel = `同步 ${state} · ${work.lastSuccessAt ? new Date(work.lastSuccessAt).toLocaleString() : '暂无成功记录'}`;
        const status = document.createElement('div');
        status.className = 'external-sync-state';
        status.textContent = work.lastError ? `${syncLabel} · ${work.lastError}` : syncLabel;
        panel.appendChild(status);
        panel.hidden = false;
    } catch (e) { /* 外部缓存缺失不影响本地详情 */ }
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

function renderMediaDetail(d, eps) {
    const cover = (d.coverPath || d.fallbackCoverPath || d.externalCoverUrl)
        ? `<img src="${esc(d.coverPath || d.fallbackCoverPath || d.externalCoverUrl)}" alt="">`
        : `<span class="cover-placeholder large">${esc(d.title).slice(0, 1)}</span>`;
    mediaDetailHeadEl.innerHTML = `
        <div class="ad-cover">${cover}</div>
        <div class="ad-info">
            <h2 class="ad-title"></h2>
            <div class="ad-meta"></div>
            <div class="cd-source-provenance"></div>
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
    renderDetailAliases(d);
    renderLocalDetailSummary(d, eps, isVideo);
    renderDetailProfile(d, isVideo);
    const epListTitle = document.getElementById('episode-list-title');
    episodeListEl.hidden = !isVideo;
    if (epListTitle) epListTitle.hidden = !isVideo;
    renderEpisodeList(eps);
    detailConfirmBtn.hidden = d.confirmed !== 0;
    if (detailHighlightBtn) detailHighlightBtn.hidden = !isVideo;
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
        cardsEnabled: highlightCardsEnabledEl.checked
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
    renderHighlightExports(currentHighlight.exports || []);
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

async function exportHighlightProject() {
    const items = currentHighlight.items || [];
    const safe = highlightModeEl.value === 'SAFE';
    const usable = safe ? items.filter(i => i.spoilerState === 'SAFE') : items;
    if (!usable.length) { showToast(safe ? '无剧透版至少需要一段标记为“安全”的片段' : '请先加入片段'); return; }
    const unready = usable.find(i => i.sourceState !== 'READY');
    if (unready) { showToast('存在未就绪素材，请先准备、上传或移除'); return; }
    const total = highlightDuration(usable);
    const start = () => highlightExportRequest();
    if (total > 20 * 60) {
        showConfirm({ title: '长成片确认', msg: `预计成片 ${fmtTime(total)}，导出可能占用较多磁盘和时间，仍要继续吗？`, okText: '继续导出', danger: false, onOk: start });
    } else start();
}

async function highlightExportRequest() {
    try {
        highlightStatusEl.textContent = '正在创建混剪导出任务…';
        const resp = await fetch(`/api/highlight-projects/${currentHighlight.id}/exports`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: highlightModeEl.value, resolution: highlightResolutionEl.value, bgmPath: highlightBgmStoredPath, bgmVolume: Number(highlightBgmVolumeEl.value) })
        });
        if (!resp.ok) throw new Error(await apiMessage(resp, '创建混剪任务失败'));
        showToast('高光混剪已开始导出');
        await loadHighlightProject(currentHighlight.id);
        pollHighlightProject();
    } catch (err) { showToast(err.message || '创建混剪任务失败'); }
    finally { highlightStatusEl.textContent = ''; }
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
    highlightEstimateEl.innerHTML = `<b>制作概览</b><span>全量 ${fmtTime(full)} · 无剧透 ${fmtTime(safe)}</span><span>素材就绪 ${ready}/${items.length}</span><span>超过 20 分钟导出前会再次确认；服务端安全上限为 120 分钟。</span>`;
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
        meta.textContent = `${item.mode === 'SAFE' ? '无剧透版' : '全量版'} · ${fmtDateTime(item.createdAt)}`;
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
    fillYearFilter();
    fillCollYearFilter();
    fillRecommendYearFilter();
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

function openMediaSyncModal() {
    syncMode = 'YEAR';
    metadataSyncCandidates = [];
    syncSourceChips.forEach(c => c.classList.toggle('on', c.dataset.syncMode === syncMode));
    syncYearGridEl.innerHTML = '';
    metadataSyncCandidatesEl.hidden = true;
    metadataSyncCandidatesEl.innerHTML = '';
    mediaSyncStatusEl.textContent = '';
    mediaSyncProgressEl.hidden = true;
    mediaSyncStartBtn.textContent = '预览同步';
    syncWorkInputEl.value = '';
    const now = new Date().getFullYear();
    for (let y = now; y >= 2000; y--) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sync-year-chip';
        chip.dataset.year = y;
        chip.textContent = y;
        chip.addEventListener('click', () => chip.classList.toggle('on'));
        syncYearGridEl.appendChild(chip);
    }
    syncSeasonGridEl.innerHTML = '';
    for (const season of [['WINTER', '冬'], ['SPRING', '春'], ['SUMMER', '夏'], ['FALL', '秋']]) {
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'sync-source-chip';
        chip.dataset.season = season[0]; chip.textContent = season[1];
        chip.addEventListener('click', () => {
            syncSeasonGridEl.querySelectorAll('.sync-source-chip').forEach(x => x.classList.remove('on'));
            chip.classList.add('on');
        });
        syncSeasonGridEl.appendChild(chip);
    }
    updateMetadataSyncMode();
    mediaSyncModal.hidden = false;
}

function updateMetadataSyncMode() {
    syncWorkBoxEl.hidden = syncMode !== 'WORK';
    syncSeasonBoxEl.hidden = syncMode !== 'YEAR_SEASON';
    syncYearBoxEl.hidden = syncMode === 'WORK';
    syncSourceHintEl.textContent = syncMode === 'WORK'
        ? '输入作品名后实时查询 Bangumi，预览候选，确认后才导入。'
        : syncMode === 'YEAR_SEASON'
            ? '选择年份和季度，预览本季度作品后一次确认导入。'
            : '选择年份，预览作品后一次确认导入。';
}

function setSyncMode(mode) {
    syncMode = mode;
    metadataSyncCandidates = [];
    syncSourceChips.forEach(c => c.classList.toggle('on', c.dataset.syncMode === mode));
    updateMetadataSyncMode();
    metadataSyncCandidatesEl.hidden = true;
    metadataSyncCandidatesEl.innerHTML = '';
    mediaSyncStatusEl.textContent = '';
    mediaSyncStartBtn.textContent = '预览同步';
}

function setSyncYears(on) {
    syncYearGridEl.querySelectorAll('.sync-year-chip').forEach(c => c.classList.toggle('on', on));
}

function syncQueryBody() {
    const body = { mode: syncMode, limit: 1000 };
    if (syncMode === 'WORK') {
        body.keyword = syncWorkInputEl.value.trim();
        if (!body.keyword) {
            mediaSyncStatusEl.textContent = '请输入番剧名称';
            return null;
        }
    } else {
        const years = [...syncYearGridEl.querySelectorAll('.sync-year-chip.on')].map(c => Number(c.dataset.year));
        if (years.length !== 1) {
            mediaSyncStatusEl.textContent = '请选择一个年份';
            return null;
        }
        body.year = years[0];
        if (syncMode === 'YEAR_SEASON') {
            const season = syncSeasonGridEl.querySelector('.sync-source-chip.on');
            if (!season) {
                mediaSyncStatusEl.textContent = '请选择季度';
                return null;
            }
            body.season = season.dataset.season;
        }
    }
    return body;
}

async function startMediaSync() {
    if (metadataSyncCandidates.length > 0) {
        await confirmMetadataSync();
        return;
    }
    const body = syncQueryBody();
    if (!body) return;
    mediaSyncStartBtn.disabled = true;
    mediaSyncProgressEl.hidden = false;
    mediaSyncStatusEl.textContent = '正在查询 Bangumi 资料…';
    try {
        const resp = await fetch('/api/metadata-sync/preview', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await resp.json().catch(() => []);
        if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
        metadataSyncCandidates = Array.isArray(data) ? data : [];
        renderMetadataSyncCandidates();
    } catch (e) {
        mediaSyncStatusEl.textContent = '预览失败：' + (e.message || 'Bangumi 不可用');
        mediaSyncProgressEl.hidden = true;
    } finally {
        mediaSyncStartBtn.disabled = false;
    }
}

function renderMetadataSyncCandidates() {
    metadataSyncCandidatesEl.innerHTML = metadataSyncCandidates.length ? metadataSyncCandidates.map(c => `
        <label class="sync-candidate-row" data-target-media-id="${c.targetMediaId || ''}" data-external-id="${esc(c.externalId)}">
            <input type="checkbox" checked data-external-id="${esc(c.externalId)}">
            <span class="sync-candidate-cover">${c.coverUrl ? `<img src="${esc(c.coverUrl)}" alt="" loading="lazy">` : esc((c.titleCn || c.title || '?').slice(0, 1))}</span>
            <span class="sync-candidate-copy">
                <span class="sync-candidate-title">${esc(c.titleCn || c.title || c.externalId)}</span>
                <span class="sync-candidate-native">${esc([c.nativeTitle, c.romajiTitle, c.englishTitle].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i && x !== (c.titleCn || c.title)).join(' · ') || (c.title && c.title !== c.titleCn ? c.title : ''))}</span>
                <span class="sync-candidate-meta">${[c.year ? `${c.year}${c.season ? ` · ${c.season}` : ''}` : '', c.format, c.episodeCount != null ? `${c.episodeCount} 集` : '', c.airDate ? `开播 ${c.airDate}` : ''].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</span>
                ${c.description ? `<span class="sync-candidate-description">${esc(c.description)}</span>` : ''}
                ${(c.genres || []).length ? `<span class="sync-candidate-genres">${c.genres.slice(0, 6).map(x => `<span>${esc(x)}</span>`).join('')}</span>` : ''}
                <span class="sync-candidate-match">${c.targetMediaId ? '已找到本地媒体 · 将关联更新' : '新作品 · 将创建本地媒体'}</span>
            </span>
        </label>
    `).join('') : '<div class="sync-empty">没有找到符合条件的作品，可以更换年份、季度或关键词后重试。</div>';
    metadataSyncCandidatesEl.hidden = false;
    mediaSyncProgressEl.hidden = true;
    mediaSyncStatusEl.textContent = `预览完成：${metadataSyncCandidates.length} 个候选，可勾选后确认或直接全部同步`;
    mediaSyncStartBtn.textContent = '确认导入选中作品';
}

async function syncAllMetadata() {
    const body = syncQueryBody();
    if (!body) return;
    body.importMode = 'ALL';
    mediaSyncStartBtn.disabled = true;
    mediaSyncProgressEl.hidden = false;
    mediaSyncStatusEl.textContent = '正在同步全部 Bangumi 资料…';
    try {
        const resp = await fetch('/api/metadata-sync/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
        mediaSyncCandidates = [];
        mediaSyncCandidatesEl.hidden = true;
        mediaSyncStatusEl.textContent = `完成：新增 ${data.added || 0}，更新 ${data.updated || 0}，失败 ${data.failed || 0}`;
        showToast('Bangumi 资料同步完成');
        loadMedia();
    } catch (e) {
        mediaSyncStatusEl.textContent = '同步失败：' + (e.message || '后端未响应');
    } finally {
        mediaSyncProgressEl.hidden = true;
        mediaSyncStartBtn.disabled = false;
    }
}

async function confirmMetadataSync() {
    const decisions = [...metadataSyncCandidatesEl.querySelectorAll('[data-external-id]')]
        .filter(input => input.matches('input'))
        .map(input => {
            const row = input.closest('.sync-candidate-row');
            return {
                externalId: input.dataset.externalId,
                action: input.checked ? (row?.dataset.targetMediaId ? 'LINK' : 'CREATE') : 'SKIP',
                mediaId: row?.dataset.targetMediaId ? Number(row.dataset.targetMediaId) : null
            };
        });
    if (!decisions.some(d => d.action !== 'SKIP')) {
        mediaSyncStatusEl.textContent = '请至少勾选一个作品';
        return;
    }
    mediaSyncStartBtn.disabled = true;
    mediaSyncStatusEl.textContent = '正在导入并补齐集资料…';
    try {
        const resp = await fetch('/api/metadata-sync/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ importMode: 'SELECTED', decisions })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
        metadataSyncCandidates = [];
        metadataSyncCandidatesEl.hidden = true;
        mediaSyncStatusEl.textContent = `完成：新增 ${data.added || 0}，更新 ${data.updated || 0}，失败 ${data.failed || 0}`;
        showToast('Bangumi 资料同步完成');
        loadMedia();
    } catch (e) {
        mediaSyncStatusEl.textContent = '导入失败：' + (e.message || '后端未响应');
    } finally {
        mediaSyncStartBtn.disabled = false;
    }
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
        msg: `删除媒体「${currentMedia.title}」？其下所有集与片段标签将一并删除！`,
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
document.getElementById('media-batch-op').addEventListener('click', toggleMediaBatchMode);
document.getElementById('media-batch-cancel').addEventListener('click', toggleMediaBatchMode);
document.getElementById('media-batch-confirm').addEventListener('click', () => openBatchDelModal([...mediaSelected]));
/* ⋯ 更多下拉：收纳 同步番剧/补下封面/管理格式，点击外部关闭 */
const mediaMoreMenu = document.getElementById('media-more-menu');
document.getElementById('media-more-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    mediaMoreMenu.hidden = !mediaMoreMenu.hidden;
});
document.addEventListener('click', () => { mediaMoreMenu.hidden = true; });
// 番剧同步（AniList）：按钮 → 弹窗 → 勾选年份 → 开始同步
document.getElementById('media-sync').addEventListener('click', () => window.openMetadataSyncWorkspace());
document.getElementById('media-sync-cancel').addEventListener('click', () => { mediaSyncModal.hidden = true; });
mediaSyncModal.addEventListener('click', (e) => { if (e.target === mediaSyncModal) mediaSyncModal.hidden = true; });
document.getElementById('sync-year-all').addEventListener('click', () => setSyncYears(true));
document.getElementById('sync-year-clear').addEventListener('click', () => setSyncYears(false));
document.getElementById('media-sync-start').addEventListener('click', startMediaSync);
document.getElementById('media-sync-all').addEventListener('click', syncAllMetadata);
// 同步来源单选 chips：切换即分流（AniList 同步阻塞 / omofuna 异步任务）
syncSourceChips.forEach(c => c.addEventListener('click', () => setSyncMode(c.dataset.syncMode)));
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
// 推荐向导来源网格：收藏夹过滤 / 标签过滤 / 页大小 / 翻页
recommendSourceEl.addEventListener('change', () => {
    const v = recommendSourceEl.value;
    recommendSourceType = v ? 'collection' : '';
    recommendSourceId = v ? Number(v) : null;
    loadRecommend();
});
recommendYearEl.addEventListener('change', () => { recommendYear = recommendYearEl.value; loadRecommend(); });
recommendGroupedEl.addEventListener('change', () => {
    recommendGrouped = recommendGroupedEl.checked;
    syncRecommendGroupControls();
    loadRecommend();
});
recommendOnlySelectedEl.addEventListener('change', () => { recommendOnlySelected = recommendOnlySelectedEl.checked; loadRecommend(); });
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
recommendGroupSizeEl.addEventListener('change', () => {
    recommendGroupPerPage = recommendGroupSizeEl.value === 'inf' ? Infinity : Number(recommendGroupSizeEl.value);
    recommendGroupPage = 1;   // 档位变 → 页结构重排，回到第 1 页
    loadRecommend();
});
recommendPagePrevEl.addEventListener('click', () => {
    if (recommendGrouped) { if (recommendGroupPage > 1) { recommendGroupPage--; renderRecommendGroupPage(); } }
    else if (recommendPage > 1) { recommendPage--; loadRecommend(false); }
});
recommendPageNextEl.addEventListener('click', () => {
    if (recommendGrouped) { if (recommendGroupPage < recommendGroupTotalPages) { recommendGroupPage++; renderRecommendGroupPage(); } }
    else { recommendPage++; loadRecommend(false); }
});
// 推荐标签输入框挂全局补全（复用打标输入补全的数据源 /api/tags?prefix=）
attachTagSuggest(recommendTagInputEl, () => null);
document.getElementById('recommend-select-all').addEventListener('click', selectRecommendAll);

// 推荐导出向导：步骤条 + 面板导航（1 勾选 → 2 内容·主题 → 3 页面·交互 → 4 预览导出）
document.querySelectorAll('.wizard-step').forEach(s => s.addEventListener('click', () => {
    if ((s.dataset.wstep === '3' || s.dataset.wstep === '4') && recommendSelected.size === 0) { showToast('请先勾选要推荐的媒体'); return; }
    showRecommendStep(Number(s.dataset.wstep));
}));
document.getElementById('recommend-step-1-next').addEventListener('click', () => showRecommendStep(2));
document.getElementById('recommend-step-2-back').addEventListener('click', () => showRecommendStep(1));
document.getElementById('recommend-step-2-next').addEventListener('click', () => showRecommendStep(3));
document.getElementById('recommend-step-3-back').addEventListener('click', () => showRecommendStep(2));
document.getElementById('recommend-step-3-next').addEventListener('click', () => {
    document.getElementById('recommend-export-title').textContent = recommendTitle();
    showRecommendStep(4);
});
document.getElementById('recommend-step-4-back').addEventListener('click', () => showRecommendStep(3));
document.getElementById('recommend-title').addEventListener('input', () => {
    document.getElementById('recommend-title-preview').textContent = recommendTitle();
});
// 预览导出
let recommendPreviewStructure = null;   // 模板上报的导览结构（须在任何 init 调用前声明，避免 TDZ——initRecommendBgm→bindPreviewSlider→updateRecommendDuration 会读它）
initConfigGroups(); // 配置弹窗四组折叠 + 显示时长实时生效
initRecommendBgmStyle(); // 音乐条样式（配置弹窗滑块/坐标，拖拽回填）
initRecommendBgm(); // BGM 选择（选本地音频 → base64 内嵌 HTML / 混入导出视频）
initRecommendOpening(); // 开局封面（步骤3 自定义 toggle + 选择器弹窗）
initRecommendBoxSelect(); // 框选取消（步骤1 网格拖拽画框批量取消/勾选）
initRecommendBg(); // 背景（步骤3 主题色/图片选择）

/* 预览 iframe 拖 BGM 条松手 → 回填 X/Y 输入并存草稿；缩放手柄松手 → 回填缩放滑块；模板上报结构 → 算总时长 */
window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'bgm-moved') {
        const x = Number(e.data.x), y = Number(e.data.y);
        if (Number.isFinite(x)) setCfgVal('recommend-bgm-x', String(x));
        if (Number.isFinite(y)) setCfgVal('recommend-bgm-y', String(y));
        markRecommendDirty();
    }
    if (e.data && e.data.type === 'bgm-scaled') {
        const s = Number(e.data.scale);
        if (Number.isFinite(s)) {
            setCfgVal('recommend-bgm-scale', String(s));
            syncBgmStyleLabels();
        }
        markRecommendDirty();
    }
    if (e.data && e.data.type === 'preview-structure') {
        recommendPreviewStructure = e.data;
        updateRecommendDuration();
    }
});

/* 预览总时长：模板上报结构后，按当前配置即时计算（与模板 playDevelop/startEnding 同口径，含开场/结尾速度）。改速度/时长滑块本地重算，秒出。 */
function computeRecommendDuration() {
    const s = recommendPreviewStructure;
    if (!s) return null;
    const v = id => document.getElementById(id).value;
    const openingSec = Number(v('recommend-dur-opening')) || 10;
    const introSec = Number(v('recommend-dur-intro')) || 5;
    const groupSec = Number(v('recommend-dur-group')) || 5;
    const detailSec = Number(v('recommend-dur-detail')) || 10;
    const endingSec = Number(v('recommend-dur-ending')) || 5;
    const openingSpeed = Number(v('preview-opening-speed')) || 50;
    const endingSpeed = Number(v('preview-ending-speed')) || 50;
    const spMult = (120 - openingSpeed) / 70;   // 与模板一致：50→1, 100→~0.29(快), 0→~1.71(慢)
    const flashMs = s.openingCount * (520 * spMult) + Math.max(0, s.openingCount - 1) * (40 * spMult) + 300;
    const endingStep = 0.8 + endingSpeed / 12;   // 结尾滚动 px/帧（模板 startEnding 同口径）
    const endingScrollMs = s.endingScroll > 0 ? s.endingScroll / endingStep * 16 : 0;
    const totalMs = flashMs
        + openingSec * 1000
        + (s.hasPrologue ? introSec * 1000 : 0)
        + s.chapterCount * groupSec * 1000
        + s.storyCount * detailSec * 1000
        + 1000   // 结尾落定后先停 1s 看清开头（模板 startEnding 同口径）
        + endingScrollMs
        + endingSec * 1000;
    return totalMs / 1000;
}
function fmtDur(sec) {
    const r = Math.max(0, Math.round(sec || 0));
    return Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0');
}
function updateRecommendDuration() {
    const el = document.getElementById('preview-duration');
    if (!el) return;
    const sec = computeRecommendDuration();
    el.textContent = sec == null ? '总时长 --:--' : '总时长 ' + fmtDur(sec);
}
loadExportTasks(); // 导出任务列表（异步后台任务管理）
/* 导出任务入口已收进「更多」面板（initRecMorePanel 里绑定 rec-export-tasks） */
document.getElementById('export-tasks-close').addEventListener('click', closeExportTasks);
document.getElementById('export-task-search').addEventListener('input', renderExportTasks);
document.getElementById('export-task-status').addEventListener('change', renderExportTasks);
document.getElementById('export-task-sort').addEventListener('change', renderExportTasks);
document.getElementById('export-task-all').addEventListener('change', e => {
    exportTaskSelected.clear();
    if (e.target.checked) lastExportTasks.forEach(t => exportTaskSelected.add(t.id));
    renderExportTasks();
    updateExportTaskBatch();
});
document.getElementById('export-task-batch-del').addEventListener('click', exportTaskBatchDelete);
/* 媒体页批量加入收藏夹：勾选媒体 → 选收藏夹 → 批量加入 */
document.getElementById('media-batch-fav-confirm').addEventListener('click', openMediaFavPick);
document.getElementById('mf-collection').addEventListener('change', () => {
    document.getElementById('mf-confirm').disabled = !document.getElementById('mf-collection').value;
});
document.getElementById('mf-cancel').addEventListener('click', () => { document.getElementById('media-fav-pick-modal').hidden = true; });
document.getElementById('mf-confirm').addEventListener('click', confirmMediaFavPick);
document.getElementById('recommend-gen-preview').addEventListener('click', generateRecommendPreview);
document.getElementById('preview-render-btn').addEventListener('click', generateRecommendPreview);   // 配置调整后手动「确认渲染」
document.getElementById('recommend-export-html').addEventListener('click', downloadRecommendHtml);
document.getElementById('recommend-export-video').addEventListener('click', openVideoExport);
// 预览弹窗
document.getElementById('preview-close').addEventListener('click', () => { document.getElementById('recommend-preview-modal').hidden = true; });
/* 自动播放开关（预览界面，默认开）：切换即同步到 iframe 导览 */
document.getElementById('preview-autoplay').addEventListener('change', () => {
    const frame = document.getElementById('recommend-preview-frame');
    try { frame.contentWindow.postMessage({ type: 'bgm-autoplay', on: document.getElementById('preview-autoplay').checked }, '*'); } catch (err) { /* 忽略 */ }
});
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
document.getElementById('back-to-media').addEventListener('click', goBack);
document.getElementById('detail-edit').addEventListener('click', openEditMedia);
document.getElementById('detail-rename').addEventListener('click', openRenameModal);
document.getElementById('detail-cover').addEventListener('click', openCoverModal);
document.getElementById('detail-sync-metadata').addEventListener('click', async () => {
    if (!currentMedia) return;
    const button = document.getElementById('detail-sync-metadata');
    if (window.v022HandleMediaMetadataAction) {
        await window.v022HandleMediaMetadataAction(currentMedia.id, button);
        return;
    }
    button.disabled = true;
    try {
        const resp = await fetch(`/api/metadata-sync/media/${currentMedia.id}`, { method: 'POST' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
        showToast(`资料同步完成：新增 ${data.added || 0}，更新 ${data.updated || 0}`);
        await refreshMediaDetail();
    } catch (e) {
        showToast('资料同步失败：' + (e.message || '后端未响应'));
    } finally {
        button.disabled = false;
    }
});
document.getElementById('detail-confirm').addEventListener('click', async () => {
    if (!currentMedia) return;
    await fetch(`/api/media/${currentMedia.id}/confirm`, { method: 'POST' });
    refreshMediaDetail();
});
document.getElementById('detail-delete').addEventListener('click', deleteMedia);
filterStatusEl.addEventListener('change', () => { mediaFilter.status = filterStatusEl.value; loadMedia(); });
filterSubcategoryEl.addEventListener('change', () => { mediaFilter.subcategoryId = filterSubcategoryEl.value; loadMedia(); });
/* 标题模糊搜索（300ms 防抖） */
const filterQEl = document.getElementById('filter-q');
let filterQTimer = null;
filterQEl.addEventListener('input', () => {
    clearTimeout(filterQTimer);
    filterQTimer = setTimeout(() => { mediaFilter.q = filterQEl.value.trim(); loadMedia(); }, 300);
});
filterCollectionEl.addEventListener('change', () => { mediaFilter.collectionId = filterCollectionEl.value; loadMedia(); });
filterUnconfirmedEl.addEventListener('change', () => { mediaFilter.unconfirmed = filterUnconfirmedEl.checked; loadMedia(); });
filterYearEl.addEventListener('change', () => { mediaFilter.year = filterYearEl.value; loadMedia(); });
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
function syncRecommendGroupControls() {
    recommendGroupSizeEl.hidden = !recommendGrouped;
    recommendPageSizeEl.hidden = recommendGrouped;
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
    else if (currentViewName === 'recommend' && currentRecommendList) {
        if (recommendGrouped) renderRecommendGroupPage();
        else renderRecommendGrid(currentRecommendList);
    }
}
// 分组开关初始态同步（collGrouped/recommendGrouped 默认开 → 显示分组档位、隐藏平铺每页条数）
syncCollGroupControls();
syncRecommendGroupControls();
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
detailHighlightBtn?.addEventListener('click', openHighlightWorkbench);
highlightBackBtn?.addEventListener('click', goBack);
highlightSaveBtn?.addEventListener('click', saveHighlightProject);
highlightExportBtn?.addEventListener('click', exportHighlightProject);
highlightNameEl?.addEventListener('change', saveHighlightProject);
highlightBgmVolumeEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightModeEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightResolutionEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightStylePresetEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightTransitionEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
highlightCardsEnabledEl?.addEventListener('change', () => { if (currentHighlight) saveHighlightProject(); });
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
document.getElementById('clip-detail-similar').addEventListener('click', () => clipDetailSimilarEl.scrollIntoView({ behavior: 'smooth' }));

// ---------- 集详情操作 ----------
document.getElementById('back-from-episode').addEventListener('click', goBack);
document.getElementById('ep-detail-quick-play').addEventListener('click', () => {
    if (currentEpisode) window.v023QuickPlayEpisode?.(currentEpisode.id, currentEpisode.title || '本集');
});
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

// ========== 设置：网站背景图（多图轮播） ==========
let siteBgTimer = null, siteBgIndex = 0;
let bgSettingsCache = { bgImages: [], rotationSec: 15, opacity: 0.6, blur: 30, brightness: 50 };

function openSettings() {
    document.getElementById('settings-modal').hidden = false;
    loadSettings(true);
}

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

if (RECOMMEND_DESKTOP_MODE) {
    const mediaTab = document.querySelector('.nav .tab[data-view="media"]');
    if (mediaTab) mediaTab.lastChild.textContent = ' 素材库';
    const groupStyleEl = document.getElementById('recommend-group-style');
    if (groupStyleEl) {
        groupStyleEl.value = 'chapter';
        groupStyleEl.disabled = true;
        groupStyleEl.title = '桌面推荐工具固定使用章节式模板';
    }
    document.title = '推荐视频导出工具';
    showView('media');
}
