/* ═══ v0.32 媒体趋势统计（第一部分）══════════════════════════════════════════════════
   规格：docs/superpowers/specs/2026-10-03-video-tagger-v032-design.md（第一部分）

   语义（规格 §3）：
   - **一条线 = 一个筛选条件的命中集按首播年份计数**；多线 = 多个筛选**快照**（不是「媒体挂了几个标签」）。
   - 横轴：`year` 维度有勾选 → 用勾选年份；否则全库年份区间。刻度由后端给，多线取并集后对齐。
   - 缺年补 0；未选任何筛选 → **什么都不画**（C3）。
   - 合计/占比：占比分母 = **全库当年总量**（固定基准，不随筛选变）。

   与媒体页的关系（规格 §5.2 + 2026-10-04 用户澄清：「筛选和媒体一致，但是勾选还是在统计这勾选，不把媒体筛选带过来」）：
   **维度/取值字典与语义共用**（同一批 `MEDIA_DIMS` / `dimValues` / 同一套且或开关），但**勾选状态各自独立** ——
   统计页用自己的 `trendFilter`；与媒体页共用一份的后果是「媒体页已勾上了→进统计页它已经是勾上的→再点变成取消」，
   用户看到的就是「勾选无效 / 切不了」。

   为什么独立成文件：`app.js` 已 415KB，新板块一律另开（与既有 v022 / v023 那批拆分文件同一做法）。
   依赖 app.js 的全局：MEDIA_DIMS / renderFilterPop / renderFilterChips / mediaFilterParams / dimActive /
   dimLabel / setDim / dimValues / mediaCoverAttrs / esc / showToast / openMediaDetail / currentViewName。
   ══════════════════════════════════════════════════════════════════════════════════════ */

const TREND_MAX_LINES = 5;
const TREND_PALETTE = ['#cba6f7', '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8'];
const TREND_SCORE_LABEL = { mixed: '混合（个人优先）', bgm: 'Bangumi 评分', personal: '个人评分' };

const trendState = {
    lines: [],            // [{ id, name, color, filter(快照), visible, total, points, years }]
    nextId: 1,
    chart: 'line',        // line | bar
    view: 'count',        // count | ratio
    theme: 'light',       // light（白底亮色，默认）| dark（旧深色）
    scoreSource: 'mixed',
    baseline: null,       // { [year]: 全库当年总数 }，占比分母
    /** 联动 A（2026-10-04 用户选）：**实时线** = 当前筛选条件本身，改筛选它立刻变；
     *  点「＋固定为一条线」才把快照固化下来（已固定的线不受后续筛选影响）。 */
    live: { active: false, visible: true, name: '当前筛选（实时）', points: [], years: [], total: 0, filter: null },
    liveKey: '',
};

let trendMounted = false;

/**
 * 统计页**自己的**筛选状态（用户 2026-10-04：「筛选和媒体一致，但是勾选还是在统计这勾选，不把媒体筛选带过来」）。
 *
 * 维度/取值字典与媒体页完全共用（`MEDIA_DIMS` / `dimValues` / 同一套且或语义），但**勾选互不影响**。
 * 之前与媒体页共用 `mediaFilter` 的后果：媒体页已经勾了「异世界」，进统计页它就是**已勾上**的状态，
 * 再点一下变成**取消** → 用户看到的就是「勾选无效 / 切不了」（2026-10-04 用户报的就是这个）。
 */
const trendFilter = {
    q: '', format: '', subcategoryId: '', unconfirmed: false, sort: '', order: 'desc',
    genres: [], tagIds: [], status: [], year: [], season: [], collectionId: [],
    mode: { genres: 'OR', tagIds: 'AND', collectionId: 'OR' },
};

/** 统计页筛选变更后的统一刷新（改完只刷趋势，不碰媒体页的列表与条件）。 */
function trendFilterChanged() {
    renderTrendChips();
    if (trendEl('trend-filter-pop') && !trendEl('trend-filter-pop').hidden) {
        renderFilterPop('trend-fp-dims', 'trend-fp-vals', trendFilter, trendFilterChanged);
    }
    if (currentViewName === 'stats') renderTrendPanel();
    trendSyncLive();
}

const trendEl = (id) => document.getElementById(id);

/**
 * 绑事件前先看元素在不在。
 *
 * 为什么（2026-10-04 用户报「筛选无法切换」后加）：统计页的 JS 是独立文件、HTML 是另一份资源，
 * 两者版本一旦不一致（浏览器拿新 JS + 旧 HTML），trendEl('trend-theme') 就是 null →
 * null.addEventListener 抛异常 → trendWire() 后面**所有**绑定全不执行，表现就是
 * 「这些按钮有的能用、有的没反应」，极难定位。改成缺元素就跳过并在控制台点名：
 * 版本不一致只影响那一个控件，而不是静默干掉一半交互。
 */
function onTrendEl(id, event, fn) {
    const el = trendEl(id);
    if (!el) {
        if (window.console) console.warn('[stats-trend] 缺少元素 #' + id + '（HTML 与 JS 版本可能不一致，刷一下页面）');
        return null;
    }
    el.addEventListener(event, fn);
    return el;
}

/** 统计视图每次进入都会调（showView 里挂的钩子）。 */
function trendMount() {
    // HTML/JS 版本不一致时（页面上根本没这个板块）静默跳过，别把 showView 搞崩
    if (!trendEl('trend-chart') || !trendEl('trend-legend')) {
        if (window.console) console.warn('[stats-trend] 统计页缺少趋势板块容器（HTML 与 JS 版本不一致，刷一下页面）');
        return;
    }
    if (!trendMounted) {
        trendMounted = true;
        trendWire();
    }
    if (!trendState.baseline) trendLoadBaseline();
    trendSyncLive();
    renderTrendChips();
    renderTrendPanel();
}
/**
 * 联动 A（用户 2026-10-04 选）：同步「实时线」——它就是**当前筛选条件**，不是快照。
 * 改筛选 / 清空筛选 → 这里重拉；未选任何条件 → 不画（与 C3 一致）。
 * 另：若当前筛选与某条已固定线完全等价，就不重复画实时线（两根完全重合的线看着就像 bug）。
 */
async function trendSyncLive(force = false) {
    const live = trendState.live;
    const snap = trendSnapshot(trendFilter);
    if (!trendHasFilter(snap)) {
        live.active = false;
        live.points = [];
        live.years = [];
        live.total = 0;
        live.filter = null;
        live.name = '当前筛选（实时）';
        trendState.liveKey = '';
        return;
    }
    live.name = `当前筛选（实时）：${trendLabelOf(snap)}`;
    const key = JSON.stringify(snap);
    if (!force && key === trendState.liveKey) return;
    trendState.liveKey = key;
    live.active = true;
    live.filter = snap;
    try {
        const p = new URLSearchParams();
        mediaFilterParams(p, snap);
        const resp = await fetch(`/api/stats/media-trend?${p.toString()}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const d = await resp.json();
        live.points = d.points || [];
        live.years = d.years || [];
        live.total = d.total || 0;
    } catch (e) {
        live.active = false;
        if (window.console) console.error('[trend live]', e);
    }
    if (currentViewName === 'stats') renderTrendPanel();
}

/** 实时线跟某条固定线是不是一模一样（筛选快照逐字相等）。 */
function trendLiveDuplicatesFixed() {
    const live = trendState.live;
    if (!live.active || !live.filter) return false;
    const key = JSON.stringify(live.filter);
    return trendState.lines.some(l => JSON.stringify(l.filter) === key);
}

/** 实时线是否应当出现在图上。 */
function trendLiveShown() {
    return trendState.live.active && trendState.live.visible && !trendLiveDuplicatesFixed();
}

/** 图上的全部线（固定线 + 实时线）；实时线排最后，颜色用固定 hex（SVG 属性里写 `var(--x)` 不生效）。 */
const TREND_LIVE_COLOR = '#ff4d8d';

function trendSeriesForChart() {
    const out = trendState.lines.filter(l => l.visible);
    if (trendLiveShown()) {
        out.push({
            name: trendState.live.name, color: TREND_LIVE_COLOR, points: trendState.live.points,
            years: trendState.live.years, total: trendState.live.total, live: true, visible: true,
        });
    }
    return out;
}

/* ── 事件接线 ─────────────────────────────────────────────────────────────── */

function trendWire() {
    const open = trendEl('trend-filter-open');
    const pop = trendEl('trend-filter-pop');
    const closePop = () => { pop.hidden = true; open.setAttribute('aria-expanded', 'false'); };

    onTrendEl('trend-filter-open', 'click', (e) => {
        e.stopPropagation();
        if (!pop.hidden) { closePop(); return; }
        renderFilterPop('trend-fp-dims', 'trend-fp-vals', trendFilter, trendFilterChanged);
        pop.hidden = false;
        open.setAttribute('aria-expanded', 'true');
    });
    document.addEventListener('click', (e) => {
        if (pop.hidden) return;
        if (pop.contains(e.target) || open.contains(e.target)) return;
        closePop();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) closePop(); });
    onTrendEl('trend-clear', 'click', () => {
        for (const d of MEDIA_DIMS) trendFilter[d.key] = [];
        trendFilterChanged();
    });

    onTrendEl('trend-add-line', 'click', () => trendAddLine());
    onTrendEl('trend-chart-mode', 'change', (e) => {
        trendState.chart = e.target.value;
        renderTrendPanel();
        trendRefreshPreviewIfOpen();
    });
    onTrendEl('trend-view-mode', 'change', (e) => {
        trendState.view = e.target.value;
        renderTrendPanel();
    });
    onTrendEl('trend-theme', 'change', (e) => {
        trendState.theme = e.target.value === 'dark' ? 'dark' : 'light';
        trendRefreshPreviewIfOpen();
    });
    onTrendEl('trend-score-source', 'change', (e) => {
        trendState.scoreSource = e.target.value;
        closeTrendPop();
        renderTrendPanel();
        trendRefreshPreviewIfOpen();
    });
    onTrendEl('trend-video', 'click', () => trendStartVideo());
    onTrendEl('trend-preview-open', 'click', () => trendOpenPreview());
    onTrendEl('trend-preview-close', 'click', () => trendClosePreview());
    onTrendEl('trend-preview-render', 'click', () => { trendClosePreview(); trendStartVideo(); });
    onTrendEl('trend-preview-modal', 'click', (e) => {
        if (e.target === trendEl('trend-preview-modal')) trendClosePreview();
    });
    // 小卡（#trend-pop）：点页面上别处 / Esc 就关（之前只能“点另一个点”或删线才关，会一直杵着）
    document.addEventListener('click', (e) => {
        const pop = document.getElementById('trend-pop');
        if (!pop) return;
        if (pop.contains(e.target)) return;
        // 点是图里的数据点/命中带 → 交给它们自己重开，不先关（否则会闪一下）
        if (e.target && e.target.closest && e.target.closest('.trend-dot-pt, .trend-bar, .trend-hit')) return;
        closeTrendPop();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        trendClosePreview();
        closeTrendPop();
    });

    window.addEventListener('resize', () => { if (currentViewName === 'stats') trendPositionPop(); });
}

/** 统计页顶部的条件 chips（点 × 直接清掉该维度）—— 只反映 `trendFilter`，不碰媒体页。 */
function renderTrendChips() {
    const host = trendEl('trend-filter-chips');
    if (!host) return;
    host.innerHTML = '';
    let n = 0;
    for (const d of MEDIA_DIMS) {
        if (!dimActive(d.key, trendFilter)) continue;
        n += (trendFilter[d.key] || []).length;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'filter-chip';
        chip.title = `移除「${d.label}」条件`;
        const text = document.createElement('span');
        text.textContent = `${d.label} ${dimLabel(d.key, trendFilter)}`;
        const x = document.createElement('span');
        x.className = 'fc-x';
        x.textContent = '×';
        chip.append(text, x);
        chip.addEventListener('click', () => setDim(d.key, null, trendFilter, trendFilterChanged));
        host.appendChild(chip);
    }
    const clearBtn = trendEl('trend-clear');
    if (clearBtn) clearBtn.hidden = n === 0;
}

/* ── 线：快照 / 取名 / 增删 ───────────────────────────────────────────────── */

function trendHasFilter(f) {
    return !!(f.q || f.format || f.subcategoryId || f.unconfirmed
        || MEDIA_DIMS.some(d => (f[d.key] || []).length));
}

function trendSnapshot(f = trendFilter) {
    // ⚠️ 空串要给 **null**：Java 侧字段是包装类型（Long/Integer），`subcategoryId: ''` 会在 Jackson 反序列化时报错。
    return JSON.parse(JSON.stringify({
        q: f.q || null, format: f.format || null,
        subcategoryId: f.subcategoryId ? Number(f.subcategoryId) : null,
        unconfirmed: !!f.unconfirmed, sort: '', order: 'desc',
        genres: f.genres || [], tagIds: f.tagIds || [], status: f.status || [],
        year: (f.year || []).map(Number), season: f.season || [], collectionId: (f.collectionId || []).map(Number),
        mode: { genres: f.mode.genres, tagIds: f.mode.tagIds, collectionId: f.mode.collectionId },
    }));
}

/** 快照的可读名（默认线名；`dimValues` 拿的是库里的显示名）。 */
function trendLabelOf(f) {
    const parts = MEDIA_DIMS.filter(d => (f[d.key] || []).length > 0).map(d => {
        const or = !isModeDim(d.key) || (f.mode[d.key] || 'OR') === 'OR';
        const names = f[d.key].map(v => {
            const hit = dimValues(d.key).find(o => String(o.value) === String(v));
            return hit ? hit.label : v;
        });
        return `${d.label} ${names.join(or ? ' 或 ' : ' 且 ')}`;
    });
    if (f.q) parts.unshift(`搜索「${f.q}」`);
    return parts.join(' · ') || '全部媒体';
}

async function trendAddLine() {
    const snap = trendSnapshot();
    if (!trendHasFilter(snap)) {
        showToast('先选个筛选条件（题材 / 标签 / 状态…），再把它固定成一条线', 3500);
        return;
    }
    if (trendState.lines.length >= TREND_MAX_LINES) {
        showToast(`最多 ${TREND_MAX_LINES} 条线（再多就成一团了）`, 3000);
        return;
    }
    const line = {
        id: trendState.nextId++,
        name: trendLabelOf(snap),
        color: TREND_PALETTE[trendState.lines.length % TREND_PALETTE.length],
        filter: snap, visible: true, total: 0, points: [], years: [],
    };
    trendState.lines.push(line);
    await trendReload();
}

/** 重拉全部线（并发；失败不清空其他线）。 */
async function trendReload() {
    const status = trendEl('trend-status');
    renderTrendPanel();
    if (trendState.lines.length === 0) { status.textContent = ''; return; }
    status.textContent = '加载中…';
    trendState.loading = true;
    const results = await Promise.all(trendState.lines.map(async (l) => {
        try {
            const p = new URLSearchParams();
            mediaFilterParams(p, l.filter);
            const resp = await fetch(`/api/stats/media-trend?${p.toString()}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const d = await resp.json();
            return { id: l.id, points: d.points || [], years: d.years || [], total: d.total || 0 };
        } catch (e) {
            return { id: l.id, error: e };
        }
    }));
    trendState.loading = false;
    let fail = 0;
    for (const r of results) {
        const line = trendState.lines.find(l => l.id === r.id);
        if (!line) continue;
        if (r.error) { fail += 1; continue; }
        line.points = r.points; line.years = r.years; line.total = r.total;
    }
    status.textContent = fail ? `${fail} 条线加载失败（后端可能未重启）` : '';
    renderTrendPanel();
}

function trendYears() {
    const set = new Set();
    for (const l of trendState.lines) for (const y of (l.years || [])) set.add(y);
    if (trendState.live.active) for (const y of (trendState.live.years || [])) set.add(y);
    if (set.size === 0 && trendState.baseline) for (const y of Object.keys(trendState.baseline)) set.add(Number(y));
    return [...set].sort((a, b) => a - b);
}

function trendValue(line, year) {
    const hit = (line.points || []).find(p => p.year === year);
    const n = hit ? hit.count : 0;
    if (trendState.view === 'count') return n;
    const base = (trendState.baseline || {})[year] || 0;
    return base > 0 ? n / base : 0;
}

function trendFmt(v) {
    if (trendState.view === 'count') return String(v);
    return `${(v * 100).toFixed(1)}%`;
}

/* ── 渲染：图例 + 图 ──────────────────────────────────────────────────────── */

function renderTrendPanel() {
    const legend = trendEl('trend-legend');
    const chart = trendEl('trend-chart');
    const hint = trendEl('trend-hint');
    legend.innerHTML = '';
    chart.innerHTML = '';

    const addLineBtn = trendEl('trend-add-line');
    if (addLineBtn) addLineBtn.disabled = trendState.lines.length >= TREND_MAX_LINES;
    // 线数 ≥3 时柱状置灰（5 条线 × 44 年 = 220 根柱子，横轴会糊成马赛克）
    const tooManyForBar = trendSeriesForChart().length >= 3;
    const chartSel = trendEl('trend-chart-mode');
    const barOpt = chartSel ? chartSel.querySelector('option[value="bar"]') : null;
    if (barOpt) {
        barOpt.disabled = tooManyForBar;
        barOpt.title = tooManyForBar ? '线数 ≥3 时柱状会挤成一片，先隐藏几条线再切' : '';
    }
    if (tooManyForBar && trendState.chart === 'bar') trendState.chart = 'line';
    if (chartSel) chartSel.value = trendState.chart;
    const viewSel = trendEl('trend-view-mode');
    if (viewSel) viewSel.value = trendState.view;
    const srcSel = trendEl('trend-score-source');
    if (srcSel) srcSel.value = trendState.scoreSource;
    const themeSel = trendEl('trend-theme');
    if (themeSel) themeSel.value = trendState.theme;

    if (trendState.lines.length === 0 && !trendLiveShown()) {
        hint.hidden = false;
        hint.textContent = trendHasFilter(trendFilter)
            ? '当前筛选条件已在上面；图上的实时线就是它——点「＋ 固定为一条线」可以把当前条件固化下来做对比。'
            : '还没有筛选条件：上面的「⚙ 筛选」里选一个维度（比如 标签 → 异世界），图会实时跟着变。';
        return;
    }
    hint.hidden = true;

    if (trendLiveShown()) {
        const row = document.createElement('span');
        row.className = 'trend-legend-item live' + (trendState.live.visible ? '' : ' off');
        const dot = document.createElement('span');
        dot.className = 'trend-dot dashed';
        const name = document.createElement('span');
        name.className = 'trend-legend-name';
        name.textContent = trendState.live.name;
        name.title = '跟随当前筛选条件实时变化（点一下隐藏 / 显示）';
        const num = document.createElement('span');
        num.className = 'trend-legend-total';
        num.textContent = `${trendState.live.total} 部`;
        row.append(dot, name, num);
        const toggle = () => { trendState.live.visible = !trendState.live.visible; renderTrendPanel(); };
        row.addEventListener('click', toggle);
        legend.appendChild(row);
    }

    for (const line of trendState.lines) {
        const row = document.createElement('span');
        row.className = 'trend-legend-item' + (line.visible ? '' : ' off');
        const dot = document.createElement('span');
        dot.className = 'trend-dot';
        dot.style.background = line.color;
        const name = document.createElement('span');
        name.className = 'trend-legend-name';
        name.textContent = line.name;
        name.title = '点击切换显示 / 双击改名';
        const num = document.createElement('span');
        num.className = 'trend-legend-total';
        num.textContent = `${line.total} 部`;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'trend-legend-del';
        del.textContent = '×';
        del.title = '删掉这条线';
        row.append(dot, name, num, del);

        dot.addEventListener('click', () => { line.visible = !line.visible; renderTrendPanel(); });
        name.addEventListener('click', () => { line.visible = !line.visible; renderTrendPanel(); });
        name.addEventListener('dblclick', () => trendRename(line, name));
        del.addEventListener('click', () => {
            trendState.lines = trendState.lines.filter(l => l.id !== line.id);
            closeTrendPop();
            renderTrendPanel();
        });
        legend.appendChild(row);
    }
    trendDraw(chart);
}

function trendRename(line, nameEl) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'trend-legend-input';
    input.value = line.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
        const v = input.value.trim();
        if (v) line.name = v;
        renderTrendPanel();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); renderTrendPanel(); }
    });
}

const TREND_SVG_NS = 'http://www.w3.org/2000/svg';
const TREND_COL_W = 34;
const TREND_PAD_L = 54;
const TREND_PAD_R = 14;
const TREND_H = 230;

function trendDraw(host) {
    const years = trendYears();
    const lines = trendSeriesForChart();
    if (years.length === 0 || lines.length === 0) {
        host.textContent = trendHasFilter(trendFilter)
            ? '正在取当前筛选的数据…'
            : '还没有筛选条件：上面的「⚙ 筛选」里选一个维度，图会实时跟着变';
        return;
    }
    const width = TREND_PAD_L + years.length * TREND_COL_W + TREND_PAD_R;
    const maxV = Math.max(1e-9, ...years.flatMap(y => lines.map(l => trendValue(l, y))));
    const svg = document.createElementNS(TREND_SVG_NS, 'svg');
    svg.setAttribute('class', 'trend-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${TREND_H}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(TREND_H));

    // y 轴刻度 + 网格
    for (let i = 0; i <= 4; i++) {
        const v = maxV * i / 4;
        const y = TREND_H - 30 - (TREND_H - 48) * (i / 4);
        const grid = document.createElementNS(TREND_SVG_NS, 'line');
        grid.setAttribute('x1', String(TREND_PAD_L - 6));
        grid.setAttribute('x2', String(width - TREND_PAD_R));
        grid.setAttribute('y1', String(y));
        grid.setAttribute('y2', String(y));
        grid.setAttribute('stroke', '#313244');
        grid.setAttribute('stroke-width', '1');
        svg.appendChild(grid);
        const lab = document.createElementNS(TREND_SVG_NS, 'text');
        lab.setAttribute('x', String(TREND_PAD_L - 10));
        lab.setAttribute('y', String(y + 3));
        lab.setAttribute('text-anchor', 'end');
        lab.setAttribute('font-size', '10');
        lab.setAttribute('fill', '#a6adc8');
        lab.textContent = trendFmt(v);
        svg.appendChild(lab);
    }

    const yOf = (v) => TREND_H - 30 - (TREND_H - 48) * (maxV > 0 ? v / maxV : 0);
    const xOf = (i) => TREND_PAD_L + i * TREND_COL_W + TREND_COL_W / 2;
    const labelEvery = Math.max(1, Math.ceil(years.length / 16));

    years.forEach((year, i) => {
        if (i % labelEvery !== 0 && i !== years.length - 1) return;
        const t = document.createElementNS(TREND_SVG_NS, 'text');
        t.setAttribute('x', String(xOf(i)));
        t.setAttribute('y', String(TREND_H - 12));
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-size', '10');
        t.setAttribute('fill', '#a6adc8');
        t.textContent = String(year);
        svg.appendChild(t);
    });

    if (trendState.chart === 'line') {
        lines.forEach((line) => {
            const pts = years.map((y, i) => `${xOf(i)},${yOf(trendValue(line, y))}`).join(' ');
            const poly = document.createElementNS(TREND_SVG_NS, 'polyline');
            poly.setAttribute('points', pts);
            poly.setAttribute('fill', 'none');
            poly.setAttribute('stroke', line.color);
            poly.setAttribute('stroke-width', line.live ? '2' : '2');
            poly.setAttribute('stroke-linejoin', 'round');
            if (line.live) {
                poly.setAttribute('stroke-dasharray', '7 5');
                poly.setAttribute('opacity', '0.95');
            }
            svg.appendChild(poly);
        });
    }

    const perYearW = TREND_COL_W / Math.max(1, lines.length + 0.6);
    years.forEach((year, i) => {
        // 悬停用的纵向命中带（每年一条，便于点空白也能开小卡）
        const hit = document.createElementNS(TREND_SVG_NS, 'rect');
        hit.setAttribute('x', String(TREND_PAD_L + i * TREND_COL_W));
        hit.setAttribute('y', '8');
        hit.setAttribute('width', String(TREND_COL_W));
        hit.setAttribute('height', String(TREND_H - 40));
        hit.setAttribute('fill', 'transparent');
        hit.setAttribute('class', 'trend-hit');
        hit.addEventListener('click', (e) => trendOpenPop(lines[0], year, e));
        const tip = document.createElementNS(TREND_SVG_NS, 'title');
        tip.textContent = [`${year} 年`, ...lines.map(l => `${l.name}：${trendFmt(trendValue(l, year))}`)].join('\n');
        hit.appendChild(tip);
        svg.appendChild(hit);

        lines.forEach((line, j) => {
            const v = trendValue(line, year);
            if (trendState.chart === 'bar') {
                const h = Math.max(2, (TREND_H - 48) * (maxV > 0 ? v / maxV : 0));
                const rect = document.createElementNS(TREND_SVG_NS, 'rect');
                rect.setAttribute('x', String(TREND_PAD_L + i * TREND_COL_W + 0.3 * perYearW + j * perYearW));
                rect.setAttribute('y', String(TREND_H - 30 - h));
                rect.setAttribute('width', String(Math.max(2, perYearW - 2)));
                rect.setAttribute('height', String(h));
                rect.setAttribute('rx', '2');
                rect.setAttribute('fill', line.color);
                if (line.live) rect.setAttribute('opacity', '0.5');
                rect.setAttribute('class', 'trend-bar');
                rect.addEventListener('click', (e) => { e.stopPropagation(); trendOpenPop(line, year, e); });
                svg.appendChild(rect);
            } else {
                const dot = document.createElementNS(TREND_SVG_NS, 'circle');
                dot.setAttribute('cx', String(xOf(i)));
                dot.setAttribute('cy', String(yOf(v)));
                if (line.live) {
                    dot.setAttribute('r', '4.5');
                    dot.setAttribute('fill', '#11111b');
                    dot.setAttribute('stroke', line.color);
                    dot.setAttribute('stroke-width', '2');
                } else {
                    dot.setAttribute('r', '3');
                    dot.setAttribute('fill', v > 0 ? line.color : '#45475a');
                }
                dot.setAttribute('class', 'trend-dot-pt');
                dot.addEventListener('click', (e) => { e.stopPropagation(); trendOpenPop(line, year, e); });
                svg.appendChild(dot);
            }
        });
    });

    host.appendChild(svg);
}

/* ── 代表作小卡（点数据点弹出；数据按需拉） ─────────────────────────────── */

let trendPopAnchor = null;

function closeTrendPop() {
    const old = document.getElementById('trend-pop');
    if (old) old.remove();
    trendPopAnchor = null;
}

function trendPositionPop() {
    const pop = document.getElementById('trend-pop');
    if (!pop || !trendPopAnchor) return;
    const pad = 10;
    let x = trendPopAnchor.x + 12;
    let y = trendPopAnchor.y + 8;
    const w = pop.offsetWidth || 300;
    const h = pop.offsetHeight || 240;
    if (x + w > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - w - pad);
    if (y + h > window.innerHeight - pad) y = Math.max(pad, window.innerHeight - h - pad);
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
}

async function trendOpenPop(line, year, ev) {
    closeTrendPop();
    const pop = document.createElement('div');
    pop.id = 'trend-pop';
    pop.className = 'trend-pop';
    pop.innerHTML = `<div class="trend-pop-head"><b>${esc(line.name)}</b> · ${year} 年
        <span class="trend-pop-score">${esc(TREND_SCORE_LABEL[trendState.scoreSource] || '')}</span></div>
        <div class="trend-pop-body">加载中…</div>`;
    document.body.appendChild(pop);
    trendPopAnchor = { x: ev.clientX, y: ev.clientY };
    trendPositionPop();

    const p = new URLSearchParams({
        year: String(year), scoreSource: trendState.scoreSource, limit: '5',
    });
    mediaFilterParams(p, line.filter);
    const body = pop.querySelector('.trend-pop-body');
    try {
        const resp = await fetch(`/api/stats/media-trend/refs?${p.toString()}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const items = await resp.json();
        if (!items.length) {
            body.textContent = trendState.scoreSource === 'personal'
                ? '这一年没有个人评分的作品（个人评分全库只有 23 部）'
                : '这一年没有符合条件的代表作（Bangumi 口径要求 ≥100 票）';
            trendPositionPop();
            return;
        }
        body.innerHTML = '';
        for (const m of items) {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'trend-pop-card';
            const img = document.createElement('img');
            img.className = 'trend-pop-cover';
            img.alt = '';
            const chain = mediaCoverSources(m);
            if (chain.length) {
                img.src = chain[0];
                if (chain.length > 1) {
                    img.dataset.coverChain = chain.join('|');
                    img.onerror = function () {
                        const c = this.dataset.coverChain.split('|');
                        const i = +(this.dataset.i || 0) + 1;
                        if (i < c.length) { this.dataset.i = i; this.src = c[i]; } else { this.remove(); }
                    };
                } else {
                    img.onerror = function () { this.remove(); };
                }
            } else {
                img.remove();
            }
            const info = document.createElement('span');
            info.className = 'trend-pop-info';
            const title = document.createElement('span');
            title.className = 'trend-pop-title';
            title.textContent = `${m.title}${m.year ? `（${m.year}）` : ''}`;
            const meta = document.createElement('span');
            meta.className = 'trend-pop-meta';
            const bits = [];
            if (m.bgmScore != null && Number(m.bgmScore) > 0) {
                bits.push(`BGM ${Number(m.bgmScore).toFixed(1)}${m.bgmVotes ? `（${m.bgmVotes} 票）` : ''}`);
            }
            if (m.personalRating != null) bits.push(`个人 ★${Number(m.personalRating)}`);
            if (m.episodeCount) bits.push(`${m.episodeCount} 集`);
            bits.push(`${m.clipCount} 片段`);
            meta.textContent = bits.join(' · ');
            info.append(title, meta);
            card.append(img, info);
            card.addEventListener('click', () => { closeTrendPop(); openMediaDetail(m.id); });
            body.appendChild(card);
        }
        trendPositionPop();
    } catch (e) {
        body.textContent = `加载失败：${(e && e.message) || e}`;
        trendPositionPop();
    }
}

/* ── 生成统计视频（第二部分：Remotion 渲染 + 轮询进度） ──────────────────────── */

/* ── 页内预览（渲染前先看，构建产物 `dist-trend/trend-preview.js`） ──────────────
   为什么要有：44 年 × 1.5s/年 ≈ 2070 帧，正式渲染要 4~8 分钟；改一个参数就等一轮渲太费。
   预览用 `@remotion/player` 在浏览器里逐帧实时渲染**同一份 composition** → 所改即所见，只有分辨率/码率不同。 */

/** 预览/渲染共用的输入（与后端 `StatsTrendVideoService.buildInput` 同形状）。 */
async function trendBuildPreviewInput() {
    const lines = trendSeriesForChart();
    const years = [...new Set(lines.flatMap(l => l.years || []))].sort((a, b) => a - b);
    const refs = years.length ? await trendPreviewRefs(lines[0], years[years.length - 1]) : [];
    const yearCovers = years.length ? await trendPreviewYearCovers(lines[0], years) : [];
    return {
        title: lines.length === 1 ? `媒体趋势 · ${lines[0].name}` : `媒体趋势 · ${lines.length} 条筛选对比`,
        chartType: trendState.chart,
        theme: trendState.theme,
        secPerYear: trendVideoSecPerYear(),
        holdSec: 3,
        years,
        lines: lines.map(l => ({
            name: l.name, color: l.color,
            points: (l.points || []).map(p => ({ year: p.year, count: p.count })),
        })),
        refs,
        yearCovers,
    };
}

/** 封面预检缓存（同一张图不重复探；探一次要等最多 6s）。 */
const trendCoverProbeCache = new Map();

/**
 * 每年「当年第一名」的封面小头像（与正式渲染同一套数据：**同一份 filter + 同一份评分口径**）。
 * 封面在浏览器侧逐张预检，加载不到的丢弃 —— 没封面的年份就不贴头像（绝不把坏图塞给 Remotion）。
 */
async function trendPreviewYearCovers(line, years) {
    const p = new URLSearchParams({ scoreSource: trendState.scoreSource });
    mediaFilterParams(p, line.filter);
    try {
        const resp = await fetch(`/api/stats/media-trend/year-refs?${p.toString()}`);
        if (!resp.ok) return [];
        const wanted = new Set(years);
        const rows = (await resp.json()).filter(r => wanted.has(r.year)).slice(0, 44);
        const urls = await Promise.all(rows.map(r => {
            const u = r.externalCoverUrl;
            if (!trendCoverProbeCache.has(u)) trendCoverProbeCache.set(u, trendProbeCover(u));
            return trendCoverProbeCache.get(u);
        }));
        return rows.map((r, i) => (urls[i] ? { year: r.year, url: urls[i] } : null)).filter(Boolean);
    } catch (e) {
        return [];
    }
}

/** 定格代表作：拿横轴最后一年的 Top5；封面**预检**，加载不到的不要塞给 Remotion。 */
async function trendPreviewRefs(line, year) {
    const p = new URLSearchParams({ year: String(year), scoreSource: trendState.scoreSource, limit: '5' });
    mediaFilterParams(p, line.filter);
    try {
        const resp = await fetch(`/api/stats/media-trend/refs?${p.toString()}`);
        if (!resp.ok) return [];
        const items = (await resp.json()).slice(0, 5);
        const covers = await Promise.all(items.map(m => trendProbeCover(m.externalCoverUrl)));
        return items.map((m, i) => ({
            title: m.title, coverUrl: covers[i],
            bgmScore: m.bgmScore, bgmVotes: m.bgmVotes,
            personalRating: m.personalRating, clipCount: m.clipCount,
        }));
    } catch (e) {
        return [];
    }
}

/**
 * 封面预检：浏览器自己都加载不到的图，**绝不能**塞给 Remotion。
 * 原因（实测）：Remotion 的 `<Img>` 会 `delayRender` 等图 → 一张超时封面能把整支片拖到 28s 超时失败。
 * 加载不到就返回 null → 卡片退化成纯文字（预览与正式渲染同一行为）。
 */
function trendProbeCover(url) {
    return new Promise((resolve) => {
        if (!url || !/^https?:/.test(url)) { resolve(null); return; }
        const img = new Image();
        const timer = setTimeout(() => { img.src = ''; resolve(null); }, 6000);
        img.onload = () => { clearTimeout(timer); resolve(url); };
        img.onerror = () => { clearTimeout(timer); resolve(null); };
        img.src = url;
    });
}

let trendPreviewPaintTimer = null;

/**
 * 等 Player 画出第一帧再把“预览：…”写回提示。
 * 为什么需要：预览包 594KB + Player 建时间轴，实测（headless）**首帧要 6 秒多**才出来；
 * 不给反馈的话弹层会先空白几秒，看着像卡死（这个项目里已经被同类问题坑过好几次）。
 */
function trendWaitFirstPaint(summary) {
    clearInterval(trendPreviewPaintTimer);
    const t0 = Date.now();
    trendPreviewPaintTimer = setInterval(() => {
        const root = trendEl('trend-preview-root');
        if ((root && root.querySelector('svg')) || Date.now() - t0 > 15000) {
            clearInterval(trendPreviewPaintTimer);
            trendPreviewPaintTimer = null;
            trendEl('trend-preview-hint').textContent = summary;
        }
    }, 300);
}

async function trendOpenPreview() {
    const modal = trendEl('trend-preview-modal');
    const root = trendEl('trend-preview-root');
    const hint = trendEl('trend-preview-hint');
    if (trendSeriesForChart().length === 0) {
        showToast('先选个筛选条件（或固定一条线），再预览', 3000);
        return;
    }
    modal.hidden = false;
    if (!window.VTTrendPreview) {
        hint.textContent = '预览未构建：请在 backend/remotion 执行 npm run build:trend-preview，然后刷新页面。';
        return;
    }
    hint.textContent = '取预览数据…';
    const input = await trendBuildPreviewInput();
    const summary = `预览：${input.years.length} 年 × ${input.lines.length} 条线 · ${input.secPerYear} 秒/年 · 总长约 ${Math.round(input.years.length * input.secPerYear + input.holdSec)} 秒（正式渲染 1920×1080 / 30fps）`;
    hint.textContent = 'Player 正在画第一帧…（首次要加载预览包，几秒钟）';
    window.VTTrendPreview.mount(root, input);
    trendWaitFirstPaint(summary);
}

function trendClosePreview() {
    const modal = trendEl('trend-preview-modal');
    if (!modal || modal.hidden) return;
    clearInterval(trendPreviewPaintTimer);
    trendPreviewPaintTimer = null;
    if (window.VTTrendPreview) window.VTTrendPreview.unmount();
    trendEl('trend-preview-root').innerHTML = '';
    modal.hidden = true;
}

/** 预览开着时改了参数（折线↔柱状 / 秒年 / 评分口径）→ 实时刷新（不重建 root）。 */
async function trendRefreshPreviewIfOpen() {
    const modal = trendEl('trend-preview-modal');
    if (!modal || modal.hidden || !window.VTTrendPreview) return;
    const input = await trendBuildPreviewInput();
    trendEl('trend-preview-hint').textContent = `预览：${input.years.length} 年 × ${input.lines.length} 条线 · ${input.secPerYear} 秒/年 · 总长约 ${Math.round(input.years.length * input.secPerYear + input.holdSec)} 秒（正式渲染 1920×1080 / 30fps）`;
    window.VTTrendPreview.update(input);
}
let trendVideoTimer = null;
const TREND_VIDEO_TIMEOUT_MS = 10 * 60 * 1000;   // 轮询上限（内存态进度重启即丢，不能死轮）

async function trendStartVideo() {
    const lines = trendSeriesForChart();
    if (lines.length === 0) {
        showToast('先固定至少一条线，再生成视频', 3000);
        return;
    }
    const btn = trendEl('trend-video');
    const status = trendEl('trend-video-status');
    btn.disabled = true;
    status.textContent = '提交渲染…';
    trendEl('trend-video-player').hidden = true;
    try {
        const resp = await fetch('/api/stats/media-trend/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: lines.length === 1 ? `媒体趋势 · ${lines[0].name}` : `媒体趋势 · ${lines.length} 条筛选对比`,
                chartType: trendState.chart,
                secPerYear: trendVideoSecPerYear(),
                scoreSource: trendState.scoreSource,
                theme: trendState.theme,
                lines: lines.map(l => ({ name: l.name, color: l.color, filter: l.filter })),
            }),
        });
        if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));
            throw new Error(body.message || `HTTP ${resp.status}`);
        }
        const task = await resp.json();
        trendPollVideo(task.id, Date.now());
    } catch (e) {
        btn.disabled = false;
        status.textContent = `起渲染失败：${(e && e.message) || e}`;
    }
}

/** 秒/年：**自由输入**（规格 Q24），非法/越界回落默认 1.5（与 Remotion 侧同一套边界）。 */
function trendVideoSecPerYear() {
    const el = trendEl('trend-video-sec');
    const n = Number(el.value);
    if (!Number.isFinite(n) || n < 0.25 || n > 10) {
        el.value = '1.5';
        return 1.5;
    }
    return n;
}

function trendPollVideo(taskId, startedAt) {
    clearTimeout(trendVideoTimer);
    const btn = trendEl('trend-video');
    const status = trendEl('trend-video-status');
    const tick = async () => {
        if (Date.now() - startedAt > TREND_VIDEO_TIMEOUT_MS) {
            btn.disabled = false;
            status.textContent = '渲染超时（超过 10 分钟没等到结果，后端重启会丢任务）';
            return;
        }
        try {
            const resp = await fetch(`/api/stats/media-trend/video/${taskId}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const t = await resp.json();
            if (t.status === 'DONE') {
                btn.disabled = false;
                status.textContent = `完成：${t.outputPath}`;
                const player = trendEl('trend-video-player');
                player.hidden = false;
                player.innerHTML = '';
                const video = document.createElement('video');
                video.controls = true;
                video.src = `${t.url}?t=${Date.now()}`;
                video.className = 'trend-video-el';
                const link = document.createElement('a');
                link.href = video.src;
                link.download = `${taskId}.mp4`;
                link.textContent = '⬇ 下载 mp4';
                link.className = 'btn-mini';
                player.append(video, link);
                return;
            }
            if (t.status === 'ERROR') {
                btn.disabled = false;
                status.textContent = `渲染失败：${t.error || '未知错误'}`;
                return;
            }
            status.textContent = `渲染中 ${Math.round((t.progress || 0) * 100)}%（${t.message || ''}）`;
            trendVideoTimer = setTimeout(tick, 2000);
        } catch (e) {
            btn.disabled = false;
            status.textContent = `查询进度失败：${(e && e.message) || e}`;
        }
    };
    trendVideoTimer = setTimeout(tick, 1500);
}

/* ── 占比分母（全库当年总量）：进统计页拉一次并缓存 ───────────────────────── */

async function trendLoadBaseline() {
    try {
        const resp = await fetch('/api/stats/media-trend');
        if (!resp.ok) return;
        const d = await resp.json();
        const map = {};
        for (const pt of (d.points || [])) map[pt.year] = pt.count;
        trendState.baseline = map;
        if (currentViewName === 'stats' && trendState.view === 'ratio') renderTrendPanel();
    } catch (e) { /* 拿不到就当分母为 0（占比线会是 0），不影响数量视图 */ }
}
