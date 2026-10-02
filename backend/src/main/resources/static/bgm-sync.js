/**
 * 从 Bangumi 同步（2026-09-21 简化版 · 交互重设计）。
 *
 * 设计规格：`docs/superpowers/specs/2026-09-21-video-tagger-v030-bangumi-sync-simplify-design.md`。
 *
 * 交互三条原则（用户 2026-09-21 要求「方便直观、操作简单、没有歧义」后重定）：
 * ① **一个同步入口**：底部只有「同步勾选的 N 部」。原来的「直接同步全部」已删 ——
 *    它同时带来三重歧义（不看勾选 / 不看"只选 TV" / 包含列表没渲染出来的条目）。
 * ② **选择与执行分离**：「全选 / 只选 TV / 清空」只是**选择工具**，永不触发写库；
 *    要同步什么，永远等于"列表里勾着的那些"，没有第二种真相。
 * ③ **点之前就知道结果**：实时预告「将新增 x · 更新 y · 跳过 z」，按钮上直接写数量。
 *
 * 流程：① 选范围（年/季/月/地区多选）→ 拉取候选（逐段，只读）→ ② 挑作品 → ③ 同步勾选的。
 *
 * 另有两条快捷路径：
 * - **标题查询**（2026-09-24）：直接拿标题查 Bangumi 关键词接口，不受年份/地区限制，命中后可用行尾「同步」单独入库；
 * - **单项同步**：每行一个「同步」按钮（等价于只勾那一条的批量同步，后端 `/commit` 本就逐项独立事务）。
 */
(function () {
    'use strict';

    const BATCH_SIZE = 12;            // 每批同步多少部（每部后端要拉详情+集，约 2 个请求）
    const MAX_ROWS = 400;             // 一次最多渲染多少行（纯渲染上限，不影响"勾选=同步范围"）
    const STORE_KEY = 'vt-bgm-sync-pick';
    const LAST_KEY = 'vt-bgm-sync-last';   // 上次同步结果（持久化，重开弹窗/刷新页面都看得到）
    const LAST_MAX_ITEMS = 500;            // 只存前 500 条明细，防 localStorage 膨胀

    const modal = document.getElementById('bgm-sync-modal');
    if (!modal) return;

    const el = (id) => document.getElementById(id);
    const yearGrid = el('bgm-year-grid');
    const seasonGrid = el('bgm-season-grid');
    const monthGrid = el('bgm-month-grid');
    const regionEl = el('bgm-region');
    const titleInput = el('bgm-title-input');
    const hintEl = el('bgm-sync-hint');
    const statusEl = el('bgm-sync-status');
    const listEl = el('bgm-sync-list');
    const progressEl = el('bgm-sync-progress');
    const pullBtn = el('bgm-sync-start');        // ① 里的「拉取候选 / 重新拉取」
    const commitBtn = el('bgm-sync-commit');     // ③ 里唯一的同步入口
    const pickStep = el('bgm-pick-step');
    const totalEl = el('bgm-sync-total');
    const selectedEl = el('bgm-sync-selected');
    const previewEl = el('bgm-sync-preview');
    const categoryGrid = el('bgm-category-grid');
    const xBtn = el('bgm-sync-x');
    const floatEl = el('bgm-sync-float');
    const floatTextEl = el('bgm-sync-float-text');
    const lastEl = el('bgm-last-sync');
    const lastSummaryEl = el('bgm-last-summary');
    const lastListEl = el('bgm-last-list');
    const cancelBtn = el('bgm-sync-cancel');

    const SEASONS = [['WINTER', '冬 1–3'], ['SPRING', '春 4–6'], ['SUMMER', '夏 7–9'], ['FALL', '秋 10–12']];
    /** 分类 = Bangumi 公共标签 `meta_tags`（服务端过滤，实测值，不是杜撰的枚举）。
     *  Bangumi 网页上那个「其他」**不是**标签（查恒为 0），故意不列。 */
    const CATEGORIES = ['TV', 'WEB', 'OVA', '剧场版', '动态漫画'];

    let candidates = [];      // 拉取并去重后的候选（唯一数据源）
    let results = null;       // 提交结果（Map externalId → item）
    let busy = false;
    let mode = '';            // '' | 'pull'（拉取/标题查）| 'commit'（同步）—— 决定关闭时算什么
    let pullAbort = null;     // 只在 pull 期间存在
    let cancelRequested = false;
    let fromKeyword = false;  // 候选来自「标题查询」→ 默认只勾第一条（用户意图就是同步那一条）

    // ---------- 范围选择（localStorage 记忆） ----------

    function loadPick() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
            return {
                years: Array.isArray(saved.years) ? saved.years.map(Number) : [new Date().getFullYear()],
                seasons: Array.isArray(saved.seasons) ? saved.seasons : [],
                months: Array.isArray(saved.months) ? saved.months.map(Number) : [],
                region: typeof saved.region === 'string' ? saved.region : '',
                category: typeof saved.category === 'string' ? saved.category : ''
            };
        } catch (e) {
            return { years: [new Date().getFullYear()], seasons: [], months: [], region: '', category: '' };
        }
    }

    let pick = loadPick();

    function savePick() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(pick)); } catch (e) { /* 隐私模式无所谓 */ }
    }

    function chip(label, on, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bgm-chip';
        button.classList.toggle('on', on);
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    function buildChips() {
        const now = new Date().getFullYear();
        yearGrid.textContent = '';
        for (let year = now; year >= 2000; year -= 1) {
            yearGrid.appendChild(chip(String(year), pick.years.includes(year), () => {
                pick.years = pick.years.includes(year)
                    ? pick.years.filter((value) => value !== year)
                    : pick.years.concat([year]).sort((a, b) => b - a);
                savePick();
                buildChips();
            }));
        }
        seasonGrid.textContent = '';
        for (const [code, label] of SEASONS) {
            seasonGrid.appendChild(chip(label, pick.seasons.includes(code), () => {
                pick.seasons = pick.seasons.includes(code)
                    ? pick.seasons.filter((value) => value !== code) : pick.seasons.concat([code]);
                savePick();
                buildChips();
            }));
        }
        monthGrid.textContent = '';
        for (let month = 1; month <= 12; month += 1) {
            monthGrid.appendChild(chip(String(month), pick.months.includes(month), () => {
                pick.months = pick.months.includes(month)
                    ? pick.months.filter((value) => value !== month) : pick.months.concat([month]).sort((a, b) => a - b);
                savePick();
                buildChips();
            }));
        }
        categoryGrid.textContent = '';
        categoryGrid.appendChild(chip('全部', !pick.category, () => {
            pick.category = '';
            savePick();
            buildChips();
        }));
        for (const name of CATEGORIES) {
            categoryGrid.appendChild(chip(name, pick.category === name, () => {
                pick.category = pick.category === name ? '' : name;
                savePick();
                buildChips();
            }));
        }
        regionEl.value = pick.region || '';
        updateHint();
    }

    function updateHint() {
        const parts = [`年份：${pick.years.length ? pick.years.join(' / ') : '未选'}`];
        if (pick.seasons.length) parts.push(`季度：${pick.seasons.length} 个`);
        if (pick.months.length) parts.push(`月份：${pick.months.map((month) => month + '月').join(' ')}`);
        if (pick.category) parts.push(`分类：${pick.category}`);
        if (pick.region) parts.push(`地区：${pick.region}`);
        if (!pick.seasons.length && !pick.months.length) parts.push('（未选季度/月份 = 整年，会自动按季拆分查）');
        hintEl.textContent = parts.join(' · ');
    }

    // ---------- 进度 / 忙碌态 ----------

    function setProgress(ratio) {
        if (ratio == null) {
            progressEl.hidden = true;
            return;
        }
        progressEl.hidden = false;
        const fill = progressEl.firstElementChild;
        if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    }

    function setBusy(value) {
        busy = value;
        pullBtn.disabled = value;
        commitBtn.disabled = value || countPicked() === 0;
        if (value) commitBtn.textContent = '同步中…';
        updateFloat();
        updateCancelButton();
    }

    /** 同步进度文案（弹窗里的主按钮 + 后台 pill 共用一份，不会两边不一致）。 */
    function setSyncLabel(text) {
        commitBtn.textContent = text;
        floatTextEl.textContent = `后台${text}`;
    }

    /** 后台同步指示器：只在「弹窗已关 + 正在同步 + 没按取消」时出现。
     *  按了取消就不该再弹个“后台同步中”出来（已停，只是等当前一批跑完）。 */
    function updateFloat() {
        const show = busy && mode === 'commit' && modal.hidden && !cancelRequested;
        floatEl.hidden = !show;
    }

    // ---------- 关闭：停操作 / 关面板（两件事，不要混） ----------

    /**
     * 底部左侧那个按钮——**文案随状态变，因为它干的事不一样**：
     * 空闲时它是「关闭」（退出口），有任务在跑时它是「停止拉取 / 停止同步」。
     *
     * 2026-09-25 用户拍板：原来它叫「取消」但两种状态下含义相反（空闲→关面板；
     * 忙碌→既停操作又关面板），而“停到哪了”恰恰是要看的时候，面板不能关。
     */
    function updateCancelButton() {
        if (!busy) {
            cancelBtn.textContent = '关闭';
            cancelBtn.disabled = false;
            return;
        }
        cancelBtn.textContent = mode === 'pull' ? '停止拉取'
            : mode === 'commit' ? (cancelRequested ? '停止中…' : '停止同步')
                : '关闭';
        cancelBtn.disabled = cancelRequested;   // 按过一次就不让重复按
    }

    /** 只停当前操作，**面板不动**（留着看停到哪了 / 改条件重来）。 */
    function stopCurrent() {
        if (!busy) return;
        cancelRequested = true;
        if (mode === 'pull') {
            if (pullAbort) pullAbort.abort();   // 只读，随便掐
            showToast('已取消拉取');
        } else if (mode === 'commit') {
            showToast('正在停止同步…当前这一批跑完即停');
        }
        updateCancelButton();
    }

    /** 关面板（右上 × / Esc / 点遮罩 / 空闲时的「关闭」）。
     *  忙碌时：拉取掐断；同步**转后台**继续跑（写库不该被手滑关掉）。 */
    function closePanel() {
        if (mode === 'pull') {
            cancelRequested = true;
            if (pullAbort) pullAbort.abort();
            showToast('已取消拉取');
        }
        modal.hidden = true;
        updateFloat();
    }

    // ---------- 上次同步结果（持久化） ----------

    const STATUS_LABEL = { ADDED: '新增', UPDATED: '更新', LINKED: '更新', SKIPPED: '跳过', FAILED: '失败' };

    function relativeTime(ms) {
        const d = new Date(ms);
        const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
        if (days <= 0) return `今天 ${hm}`;
        if (days === 1) return `昨天 ${hm}`;
        return `${d.getMonth() + 1}-${d.getDate()} ${hm}`;
    }

    const titleOf = (externalId) => {
        const candidate = candidates.find((item) => item.externalId === externalId);
        return (candidate && (candidate.titleCn || candidate.title)) || externalId;
    };

    function saveLastResult(interrupted, totals) {
        if (!totals.total) return;   // 一条都没落（比如第一批就网络失败）→ 不写，免得盖掉上一次的真结果
        const items = [...(results || new Map()).entries()]
            .slice(0, LAST_MAX_ITEMS)
            .map(([externalId, item]) => ({ t: titleOf(externalId), s: item.status }));
        try {
            localStorage.setItem(LAST_KEY, JSON.stringify({ at: Date.now(), interrupted, ...totals, items }));
        } catch (e) { /* 隐私模式 / 配额满：无所谓，下次再看 */ }
        renderLastResult();
    }

    function renderLastResult() {
        let data = null;
        try { data = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) { data = null; }
        if (!data || typeof data !== 'object') { lastEl.hidden = true; return; }
        lastEl.hidden = false;
        const head = [`上次同步 · ${relativeTime(data.at)}`];
        if (data.interrupted) head.push('⚠ 已中断');
        head.push(`新增 ${data.added || 0} · 更新 ${data.updated || 0}`);
        if (data.skipped) head.push(`跳过 ${data.skipped}`);
        if (data.failed) head.push(`失败 ${data.failed}`);
        lastSummaryEl.textContent = head.join(' · ');
        // 先列有问题的（失败/跳过），再列成功的；都没明细就给句话
        const items = Array.isArray(data.items) ? data.items : [];
        const bad = items.filter((x) => x.s === 'FAILED' || x.s === 'SKIPPED');
        const good = items.filter((x) => x.s !== 'FAILED' && x.s !== 'SKIPPED');
        const ordered = bad.concat(good);
        lastListEl.innerHTML = ordered.length
            ? ordered.map((x) => `<span class="bgm-last-item ${x.s === 'FAILED' ? 'fail' : x.s === 'SKIPPED' ? 'skip' : ''}"><span class="bgm-last-name">${esc(x.t)}</span><i>${STATUS_LABEL[x.s] || x.s}</i></span>`).join('')
            : '<span class="bgm-last-item">（本次没有留逐条明细）</span>';
    }

    // ---------- ① 拉取候选（只读） ----------

    async function pull() {
        if (busy) return;
        if (!pick.years.length) { statusEl.textContent = '请至少选择一个年份'; return; }
        mode = 'pull';
        cancelRequested = false;
        pullAbort = new AbortController();
        const signal = pullAbort.signal;
        setBusy(true);
        results = null;
        candidates = [];
        fromKeyword = false;
        pickStep.hidden = true;
        statusEl.textContent = '正在规划查询区间…';
        setProgress(0);
        try {
            const planResp = await fetch('/api/metadata-sync/discover/plan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
                body: JSON.stringify({ years: pick.years, seasons: pick.seasons, months: pick.months })
            });
            const plan = await planResp.json().catch(() => ({}));
            if (!planResp.ok) throw new Error(plan.message || `HTTP ${planResp.status}`);
            const ranges = plan.ranges || [];
            if (!ranges.length) { statusEl.textContent = '没有可查询的区间'; setProgress(null); return; }

            const merged = new Map();
            const truncated = [];
            for (let i = 0; i < ranges.length; i += 1) {
                if (cancelRequested) break;      // 每段之间都能停
                const range = ranges[i];
                statusEl.textContent = `正在获取第 ${i + 1}/${ranges.length} 段：${range.label}…`;
                const resp = await fetch('/api/metadata-sync/discover/fetch', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
                    body: JSON.stringify({ from: range.from, to: range.to, region: pick.region || null, category: pick.category || null })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
                if (data.truncated) truncated.push(range.label);
                for (const candidate of data.candidates || []) {
                    if (!candidate.externalId || merged.has(candidate.externalId)) continue;
                    merged.set(candidate.externalId, candidate);
                }
                setProgress((i + 1) / ranges.length);
            }
            if (cancelRequested) { statusEl.textContent = '已取消拉取'; return; }
            candidates = [...merged.values()];
            statusEl.textContent = truncated.length
                ? `⚠️ ${truncated.join('、')} 超过 Bangumi 1000 条上限，建议改选月份后重新拉取`
                : `来自 ${ranges.map((range) => range.label).join('、')}`;
            renderList();
            pullBtn.textContent = '重新拉取';
            pullBtn.className = 'btn-mini';   // 拉完后主操作是底部的「同步勾选的 N 部」，这里降级
        } catch (e) {
            if (cancelRequested || e.name === 'AbortError') {
                statusEl.textContent = '已取消拉取';
                return;
            }
            statusEl.textContent = `拉取失败：${e.message || '后端未响应'}`;
            setProgress(null);
        } finally {
            pullAbort = null;
            mode = '';
            setBusy(false);
            updateCounts();
            setTimeout(() => setProgress(null), 800);
        }
    }

    // ---------- ①′ 按标题查（Bangumi 关键词，不受年份/季节/地区限制） ----------

    async function searchByTitle() {
        if (busy) return;
        const keyword = titleInput.value.trim();
        if (!keyword) { statusEl.textContent = '请输入要查的标题'; titleInput.focus(); return; }
        mode = 'pull';
        cancelRequested = false;
        pullAbort = new AbortController();
        setBusy(true);
        results = null;
        candidates = [];
        fromKeyword = true;
        pickStep.hidden = true;
        statusEl.textContent = `正在按标题「${keyword}」查询 Bangumi…`;
        setProgress(null);
        try {
            const resp = await fetch('/api/metadata-sync/preview', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: pullAbort.signal,
                body: JSON.stringify({ mode: 'WORK', keyword, limit: 20 })
            });
            const data = await resp.json().catch(() => null);
            if (!resp.ok) throw new Error((data && data.message) || `HTTP ${resp.status}`);
            candidates = Array.isArray(data) ? data : [];
            statusEl.textContent = candidates.length
                ? `标题「${keyword}」命中 ${candidates.length} 条（按相关度，默认只勾第一条；用行尾「同步」单独入库）`
                : `标题「${keyword}」没有命中动画条目`;
            renderList();
        } catch (e) {
            statusEl.textContent = (cancelRequested || e.name === 'AbortError')
                ? '已取消查询'
                : `查询失败：${e.message || '后端未响应'}`;
        } finally {
            pullAbort = null;
            mode = '';
            setBusy(false);
            updateCounts();
        }
    }

    // ---------- ② 挑作品 ----------

    /** 命中的本地媒体多于 1 个 → 一律跳过（避免误关联），可选但默认不勾。 */
    const isConflict = (candidate) => candidate.matchType === 'CONFLICT';
    /**
     * 默认勾选：**全选**，只把冲突项留给人工。
     *
     * 2026-09-25 用户拍板：原来这里是「只勾 TV」。但「分类」筛选已经把“只要 TV”
     * 接管了（而且是**服务端**过滤），勾选侧再默默过滤一遍就是第二层隐式规则 → 删掉。
     */
    const defaultChecked = (candidate) => !isConflict(candidate);

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /** 候选 → 提交项（与后端 SyncActionDecider 同一套规则）。 */
    function toItem(candidate) {
        if (!candidate) return null;
        const action = candidate.matchType === 'EXTERNAL_ID' ? 'UPDATE'
            : candidate.matchType === 'TITLE' ? 'LINK'
                : candidate.matchType === 'NONE' ? 'CREATE' : 'SKIP';
        return { externalId: candidate.externalId, action, mediaId: candidate.targetMediaId || null };
    }

    const rowsOf = () => [...listEl.querySelectorAll('.bgm-row')];

    function countPicked() {
        return rowsOf().filter((row) => row.querySelector('input').checked).length;
    }

    function renderList() {
        pickStep.hidden = false;
        if (!candidates.length) {
            listEl.innerHTML = fromKeyword
                ? '<div class="bgm-empty">没有匹配到动画条目，换个关键词再试（标题查询只查动画）。</div>'
                : '<div class="bgm-empty">没有找到符合条件的作品，换年份/季度/月份再拉一次试试。</div>';
            listEl.hidden = false;
            totalEl.textContent = '共 0 部';
            return;
        }
        const rows = candidates.slice(0, MAX_ROWS);
        // 标题查询结果的意图就是「同步那一条」→ 默认只勾最相关的那条，其余留给行尾按钮。
        const autoPick = fromKeyword ? rows.findIndex((candidate) => !isConflict(candidate)) : -1;
        listEl.innerHTML = rows.map((candidate, index) => {
            const subtitle = [candidate.nativeTitle, candidate.romajiTitle, candidate.englishTitle]
                .filter(Boolean).filter((value, index, all) => all.indexOf(value) === index && value !== candidate.titleCn)
                .join(' · ');
            const meta = [
                candidate.year ? String(candidate.year) : '',
                candidate.format || '',
                candidate.episodeCount != null ? `${candidate.episodeCount} 集` : '',
                candidate.airDate || ''
            ].filter(Boolean).map((value) => `<span>${esc(value)}</span>`).join('');
            const badge = isConflict(candidate)
                ? '<span class="bgm-badge skip">跳过</span>'
                : candidate.matchType === 'NONE'
                    ? '<span class="bgm-badge new">新增</span>'
                    : `<span class="bgm-badge upd">更新 #${candidate.targetMediaId}</span>`;
            return `
            <label class="bgm-row" data-external-id="${esc(candidate.externalId)}">
                <input type="checkbox" ${(fromKeyword ? index === autoPick : defaultChecked(candidate)) ? 'checked' : ''}>
                <span class="bgm-cover">${candidate.coverUrl
                    ? `<img src="${esc(candidate.coverUrl)}" alt="" loading="lazy">`
                    : esc((candidate.titleCn || candidate.title || '?').slice(0, 1))}</span>
                <span class="bgm-copy">
                    <span class="bgm-title">${esc(candidate.titleCn || candidate.title || candidate.externalId)}</span>
                    ${subtitle ? `<span class="bgm-sub">${esc(subtitle)}</span>` : ''}
                    <span class="bgm-meta">${meta}</span>
                </span>
                ${badge}
                ${isConflict(candidate) ? ''
                    : `<button type="button" class="btn-mini bgm-row-sync" data-sync="${esc(candidate.externalId)}">同步</button>`}
                ${resultLine(candidate)}
            </label>`;
        }).join('');
        listEl.hidden = false;
        totalEl.textContent = candidates.length > MAX_ROWS
            ? `共 ${candidates.length} 部（只显示前 ${MAX_ROWS} 部）`
            : `共 ${candidates.length} 部`;
        rowsOf().forEach((row) => {
            row.querySelector('input').addEventListener('change', updateCounts);
            const syncBtn = row.querySelector('[data-sync]');
            if (syncBtn) syncBtn.addEventListener('click', (event) => {
                event.preventDefault();      // 行本身是 <label>：不拦住会顺手把复选框切一下
                event.stopPropagation();
                void commitOne(row.dataset.externalId);
            });
        });
        updateCounts();
    }

    /** 结果状态（提交后显示在行尾）。 */
    function resultLine(candidate) {
        const item = results && results.get(candidate.externalId);
        if (!item) return '';
        if (item.status === 'FAILED') return `<span class="bgm-result fail">✗ ${esc(item.error || '失败')}</span>`;
        if (item.status === 'SKIPPED') return '<span class="bgm-result">— 已跳过</span>';
        return `<span class="bgm-result">✓ ${item.status === 'ADDED' ? '已新增' : '已更新'}</span>`;
    }

    /** 勾选/可选集合变化 → 刷新计数、实时预告、主按钮文案（点之前就知道结果）。 */
    function updateCounts() {
        const rows = rowsOf();
        const pickedRows = rows.filter((row) => row.querySelector('input').checked);
        const picked = pickedRows.length;
        selectedEl.textContent = `已选 ${picked} / ${rows.length}`;
        const items = pickedRows
            .map((row) => toItem(candidates.find((item) => item.externalId === row.dataset.externalId)))
            .filter(Boolean);
        const willCreate = items.filter((item) => item.action === 'CREATE').length;
        const willUpdate = items.filter((item) => item.action === 'LINK' || item.action === 'UPDATE').length;
        const willSkip = items.filter((item) => item.action === 'SKIP').length;
        previewEl.textContent = picked === 0
            ? '勾选要同步的作品（点上面的「全选」快速勾）'
            : `将新增 ${willCreate} · 更新 ${willUpdate}${willSkip ? ` · 跳过 ${willSkip}` : ''}`;
        if (!busy) {
            commitBtn.disabled = picked === 0;
            commitBtn.textContent = picked === 0 ? '未勾选作品' : `同步勾选的 ${picked} 部`;
        }
    }

    /** 批量改勾选：只动复选框，绝不触发同步。 */
    function setChecked(predicate) {
        rowsOf().forEach((row) => {
            const candidate = candidates.find((item) => item.externalId === row.dataset.externalId);
            if (candidate) row.querySelector('input').checked = predicate(candidate);
        });
        updateCounts();
    }

    // ---------- ③ 同步勾选的 ----------

    function pickedItems() {
        return rowsOf()
            .filter((row) => row.querySelector('input').checked)
            .map((row) => toItem(candidates.find((item) => item.externalId === row.dataset.externalId)))
            .filter(Boolean);
    }

    async function commit(items, append) {
        if (busy || !items.length) return;
        mode = 'commit';
        cancelRequested = false;
        setBusy(true);
        const totals = { total: 0, added: 0, updated: 0, skipped: 0, failed: 0 };
        if (!append || !results) results = new Map();   // 单项同步累加行尾结果，不抹掉前面已同步的 ✓
        let interrupted = false;
        try {
            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                // 在**批次边界**停：当前这一批发完才 break，不掐断正在写库的请求。
                if (cancelRequested) { interrupted = true; break; }
                const batch = items.slice(i, i + BATCH_SIZE);
                setSyncLabel(`同步中 ${i}/${items.length}…`);
                statusEl.textContent = `正在同步第 ${i + 1}–${Math.min(i + BATCH_SIZE, items.length)} 部…`;
                setProgress(i / items.length);
                const resp = await fetch('/api/metadata-sync/commit', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: batch })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
                totals.total += data.total || 0;
                totals.added += data.added || 0;
                totals.updated += data.updated || 0;
                totals.skipped += data.skipped || 0;
                totals.failed += data.failed || 0;
                for (const item of data.items || []) results.set(item.externalId, item);
            }
            if (interrupted) {
                setProgress(null);
                statusEl.textContent = `已中断：已同步 ${totals.total} 部（已写入，可重开补齐剩余）`;
                showToast(`同步已中断：已写入 ${totals.total} 部`);
            } else {
                setProgress(1);
                statusEl.textContent = `完成：新增 ${totals.added} · 更新 ${totals.updated}`
                    + `${totals.skipped ? ` · 跳过 ${totals.skipped}` : ''}${totals.failed ? ` · 失败 ${totals.failed}` : ''}`
                    + `（共 ${totals.total} 条）`;
                showToast(`Bangumi 同步完成：新增 ${totals.added}、更新 ${totals.updated}`);
            }
            renderList();
            if (typeof loadMedia === 'function') loadMedia();
        } catch (e) {
            statusEl.textContent = `同步中断：${e.message || '后端未响应'}（已完成的批次已写入，可再次点同步补齐剩余）`;
            renderList();
        } finally {
            saveLastResult(interrupted, totals);
            mode = '';
            setBusy(false);
            updateCounts();
            setTimeout(() => setProgress(null), 1200);
        }
    }

    /** 单项同步：只提交这一行（后端 `/commit` 本就逐项独立事务，1 项 = 单条同步）。 */
    async function commitOne(externalId) {
        if (busy) return;
        const item = toItem(candidates.find((candidate) => candidate.externalId === externalId));
        if (!item) return;
        if (item.action === 'SKIP') {
            statusEl.textContent = '该项命中多个本地媒体，已跳过；请到媒体详情页手动确认关联';
            return;
        }
        await commit([item], true);
    }

    // ---------- 打开 / 关闭 / 绑定 ----------

    window.openBgmSyncModal = function openBgmSyncModal() {
        modal.hidden = false;
        updateFloat();
        renderLastResult();
        // 后台同步中重开：**保留现场**（候选/勾选/进度/行尾结果），只把弹窗显示出来
        if (busy) return;
        pick = loadPick();
        candidates = [];
        results = null;
        fromKeyword = false;
        titleInput.value = '';
        buildChips();
        pickStep.hidden = true;
        listEl.hidden = true;
        listEl.textContent = '';
        statusEl.textContent = '';
        previewEl.textContent = '';
        pullBtn.textContent = '拉取候选';
        pullBtn.className = 'btn-primary';   // 首屏只有这一个动作 → 它就是主按钮
        commitBtn.disabled = true;
        commitBtn.textContent = '未勾选作品';
        setProgress(null);
        updateCancelButton();
        reconSummary();
        reconLoadLatest();
        fullsyncRow.hidden = true;
        fullsyncLoadLatest();
    };

    el('bgm-fullsync').addEventListener('click', () => {
        fullsyncRow.hidden = false;
        fullsyncRenderHint();
    });
    el('bgm-fullsync-abort').addEventListener('click', () => { fullsyncRow.hidden = true; fullsyncStatusEl.textContent = ''; });
    el('bgm-fullsync-go').addEventListener('click', () => {
        fullsyncRow.hidden = true;
        fullsyncStart();
    });

    // ---------- 全量同步（跳过拉取候选，直接同步符合条件的全部）----------
    // 逻辑与弹窗逐条勾选**同源**：后端用同一个 SyncActionDecider + 同一个 commit，所以幂等。

    const FULLSYNC = '/api/media/full-sync';
    const fullsyncRow = el('bgm-fullsync-row');
    const fullsyncStatusEl = el('bgm-fullsync-status');
    let fullsyncTimer = null;

    function fullsyncHint() {
        const parts = [`年份 ${pick.years.length ? pick.years.join('/') : '未选'}`];
        if (pick.seasons.length) parts.push(`季度 ${pick.seasons.length} 个`);
        if (pick.months.length) parts.push(`月份 ${pick.months.length} 个`);
        if (pick.category) parts.push(`分类 ${pick.category}`);
        if (pick.region) parts.push(`地区 ${pick.region}`);
        return parts.join(' · ');
    }

    function fullsyncRenderHint() {
        if (!pick.years.length) { fullsyncStatusEl.textContent = '请至少选择一个年份'; return; }
        fullsyncStatusEl.textContent = `将同步：${fullsyncHint()}（不拉候选，直接同步；后台跑，可取消）`;
    }

    function fullsyncRender(job) {
        if (!job) { return; }
        const line = `范围 ${job.doneRanges}/${job.totalRanges} 段 · 已处理 ${job.doneItems} 条`
            + `（新增 ${job.added} · 更新 ${job.updated} · 跳过 ${job.skipped}`
            + (job.failed ? ` · 失败 ${job.failed}` : '') + '）';
        fullsyncStatusEl.textContent = job.message ? `${line}\n${job.message}` : `${line}\n${job.phase || ''}`;
        const running = job.status === 'RUNNING' || job.status === 'PENDING';
        const showPill = running && modal.hidden;
        floatEl.hidden = !showPill;
        if (showPill) {
            floatTextEl.textContent = `全量同步 ${job.doneRanges}/${job.totalRanges} 段 · ${job.doneItems} 条…`;
        }
    }

    function fullsyncStopPoll() { if (fullsyncTimer) { clearInterval(fullsyncTimer); fullsyncTimer = null; } }

    function fullsyncPoll(jobId) {
        fullsyncStopPoll();
        const tick = () => {
            fetch(`${FULLSYNC}/job/${jobId}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((job) => {
                    if (!job) return;
                    fullsyncRender(job);
                    if (['DONE', 'FAILED', 'CANCELLED', 'INTERRUPTED'].includes(job.status)) {
                        fullsyncStopPoll();
                        showToast(job.status === 'DONE'
                            ? `全量同步完成：新增 ${job.added}、更新 ${job.updated}`
                            : `全量同步${job.status === 'CANCELLED' ? '已取消' : '异常结束'}`);
                        if (typeof loadMedia === 'function') loadMedia();
                    }
                })
                .catch(() => { /* 下一轮再来 */ });
        };
        tick();
        fullsyncTimer = setInterval(tick, 2000);
    }

    function fullsyncStart() {
        if (!pick.years.length) { fullsyncRenderHint(); return; }
        fullsyncStatusEl.textContent = '正在创建任务…';
        fetch(`${FULLSYNC}/start`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                years: pick.years, seasons: pick.seasons, months: pick.months,
                region: pick.region || null, category: pick.category || null
            })
        }).then(async (r) => {
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
            return body;
        }).then((job) => {
            fullsyncRender(job);
            fullsyncPoll(job.id);
        }).catch((e) => { fullsyncStatusEl.textContent = `启动失败：${e.message}`; });
    }

    function fullsyncLoadLatest() {
        fetch(`${FULLSYNC}/job/latest`)
            .then((r) => (r.ok ? r.json() : null))
            .then((job) => {
                if (!job) { fullsyncStatusEl.textContent = ''; return; }
                fullsyncRender(job);
                if (job.status === 'RUNNING' || job.status === 'PENDING') fullsyncPoll(job.id);
            })
            .catch(() => { /* 后端旧版本没这接口也不报错 */ });
    }

    pullBtn.addEventListener('click', () => { void pull(); });
    el('bgm-title-search').addEventListener('click', () => { void searchByTitle(); });
    titleInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); void searchByTitle(); }
    });
    regionEl.addEventListener('change', () => { pick.region = regionEl.value; savePick(); updateHint(); });
    commitBtn.addEventListener('click', () => { void commit(pickedItems()); });
    el('bgm-pick-all').addEventListener('click', () => setChecked(() => true));
    el('bgm-pick-none').addEventListener('click', () => setChecked(() => false));
    el('bgm-sync-cancel').addEventListener('click', () => { if (busy) stopCurrent(); else closePanel(); });
    xBtn.addEventListener('click', () => closePanel());
    // 忙碌时点遮罩**不关**：防手滑把 40 秒的拉取、或者一批写库请求点没。
    // （真要关就走 × / Esc，那里有拉取/同步的分别处理）
    modal.addEventListener('click', (event) => { if (event.target === modal && !busy) closePanel(); });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) { event.preventDefault(); closePanel(); }
    });
    floatEl.addEventListener('click', () => { window.openBgmSyncModal(); });

    // ---------- 清理未关联（对账）----------
    // 规则（用户 2026-09-25 拍板）：无 Bangumi 关联且无引用痕迹 → 删；有引用且能关联 → 关联；
    // 剩余（有引用但关联不上）→ 也删。所以界面上只有「干跑」与「执行清理」两个动作。

    const RECON = '/api/media/reconcile';
    const RECON_TERMINAL = ['DONE', 'FAILED', 'CANCELLED', 'INTERRUPTED'];
    const cleanTotalEl = el('bgm-clean-total');
    const cleanStatusEl = el('bgm-clean-status');
    const cleanDryBtn = el('bgm-clean-dry');
    const cleanLiveBtn = el('bgm-clean-live');
    const cleanTokenRow = el('bgm-clean-token-row');
    const cleanTokenInput = el('bgm-clean-token');
    let reconTimer = null;
    let reconHadDryDone = false;

    function reconSummary() {
        fetch(RECON + '/summary')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d) cleanTotalEl.textContent = `未关联 ${d.unlinkedTotal} 条`; })
            .catch(() => { /* 后端没起也不影响别的功能 */ });
    }

    function reconRender(job) {
        if (!job) { cleanStatusEl.textContent = '还没跑过。建议先干跑看一眼会删多少。'; return; }
        const counts = `扫描 ${job.done}/${job.total} · 关联 ${job.linked} · 合并 ${job.merged}`
            + (job.mode === 'live' ? ` · 已删 ${job.purged}` : ` · 将删 ${job.purged}`)
            + (job.skipped ? ` · 跳过 ${job.skipped}` : '')
            + (job.failed ? ` · 失败 ${job.failed}` : '');
        cleanStatusEl.textContent = job.message ? `${counts}\n${job.message}` : counts;
        if (job.mode === 'dry' && job.status === 'DONE') reconHadDryDone = true;
        const running = job.status === 'RUNNING' || job.status === 'PENDING';
        cleanDryBtn.disabled = running;
        cleanLiveBtn.disabled = running || !reconHadDryDone;
        cleanDryBtn.textContent = running ? '进行中…' : '① 干跑（只报告）';
        // 后台进度复用底部 pill（只在弹窗关着时显示）
        const showPill = running && modal.hidden;
        floatEl.hidden = !showPill;
        if (showPill) {
            floatTextEl.textContent = `${job.mode === 'dry' ? '干跑' : '清理'}中 ${job.done}/${job.total}…`;
        }
    }

    function reconStopPoll() { if (reconTimer) { clearInterval(reconTimer); reconTimer = null; } }

    function reconPoll(jobId) {
        reconStopPoll();
        const tick = () => {
            fetch(`${RECON}/job/${jobId}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((job) => {
                    if (!job) return;
                    reconRender(job);
                    if (RECON_TERMINAL.includes(job.status)) {
                        reconStopPoll();
                        reconSummary();
                        showToast(job.mode === 'dry' ? '干跑完成（未写库）' : '清理完成');
                        if (typeof loadMedia === 'function') loadMedia();
                    }
                })
                .catch(() => { /* 轮询失败下一轮再来 */ });
        };
        tick();
        reconTimer = setInterval(tick, 2000);
    }

    function reconLoadLatest() {
        fetch(RECON + '/job/latest')
            .then((r) => (r.ok ? r.json() : null))
            .then((job) => {
                if (!job) { reconRender(null); return; }
                reconRender(job);
                if (job.status === 'RUNNING' || job.status === 'PENDING') reconPoll(job.id);
            })
            .catch(() => { /* 后端旧版本没这个接口也不报错 */ });
    }

    function reconStart(mode, token) {
        fetch(`${RECON}/start`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, confirmToken: token })
        }).then(async (r) => {
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(body.message || `HTTP ${r.status}`);
            return body;
        }).then((job) => { reconPoll(job.id); })
            .catch((e) => { cleanStatusEl.textContent = `启动失败：${e.message}`; });
    }

    cleanDryBtn.addEventListener('click', () => { cleanTokenRow.hidden = true; reconStart('dry'); });
    cleanLiveBtn.addEventListener('click', () => { cleanTokenRow.hidden = false; cleanTokenInput.focus(); });
    el('bgm-clean-confirm').addEventListener('click', () => {
        const token = cleanTokenInput.value.trim();
        if (token !== 'DELETE') { cleanStatusEl.textContent = '确认词不对，请输入 DELETE'; return; }
        cleanTokenRow.hidden = true;
        cleanTokenInput.value = '';
        reconStart('live', token);
    });
    el('bgm-year-all').addEventListener('click', () => {
        const now = new Date().getFullYear();
        pick.years = [];
        for (let year = now; year >= 2000; year -= 1) pick.years.push(year);
        savePick();
        buildChips();
    });
    el('bgm-year-clear').addEventListener('click', () => {
        pick.years = [];
        savePick();
        buildChips();
    });
})();
