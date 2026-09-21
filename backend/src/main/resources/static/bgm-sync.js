/**
 * 从 Bangumi 同步（2026-09-21 简化版 · 交互重设计）。
 *
 * 设计规格：`docs/superpowers/specs/2026-09-21-bangumi-sync-simplify-design.md`。
 *
 * 交互三条原则（用户 2026-09-21 要求「方便直观、操作简单、没有歧义」后重定）：
 * ① **一个同步入口**：底部只有「同步勾选的 N 部」。原来的「直接同步全部」已删 ——
 *    它同时带来三重歧义（不看勾选 / 不看"只选 TV" / 包含列表没渲染出来的条目）。
 * ② **选择与执行分离**：「全选 / 只选 TV / 清空」只是**选择工具**，永不触发写库；
 *    要同步什么，永远等于"列表里勾着的那些"，没有第二种真相。
 * ③ **点之前就知道结果**：实时预告「将新增 x · 更新 y · 跳过 z」，按钮上直接写数量。
 *
 * 流程：① 选范围（年/季/月多选）→ 拉取候选（逐段，只读）→ ② 挑作品 → ③ 同步勾选的。
 */
(function () {
    'use strict';

    const BATCH_SIZE = 12;            // 每批同步多少部（每部后端要拉详情+集，约 2 个请求）
    const MAX_ROWS = 400;             // 一次最多渲染多少行（纯渲染上限，不影响"勾选=同步范围"）
    const STORE_KEY = 'vt-bgm-sync-pick';

    const modal = document.getElementById('bgm-sync-modal');
    if (!modal) return;

    const el = (id) => document.getElementById(id);
    const yearGrid = el('bgm-year-grid');
    const seasonGrid = el('bgm-season-grid');
    const monthGrid = el('bgm-month-grid');
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

    const SEASONS = [['WINTER', '冬 1–3'], ['SPRING', '春 4–6'], ['SUMMER', '夏 7–9'], ['FALL', '秋 10–12']];

    let candidates = [];      // 拉取并去重后的候选（唯一数据源）
    let results = null;       // 提交结果（Map externalId → item）
    let busy = false;

    // ---------- 范围选择（localStorage 记忆） ----------

    function loadPick() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
            return {
                years: Array.isArray(saved.years) ? saved.years.map(Number) : [new Date().getFullYear()],
                seasons: Array.isArray(saved.seasons) ? saved.seasons : [],
                months: Array.isArray(saved.months) ? saved.months.map(Number) : []
            };
        } catch (e) {
            return { years: [new Date().getFullYear()], seasons: [], months: [] };
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
        updateHint();
    }

    function updateHint() {
        const parts = [`年份：${pick.years.length ? pick.years.join(' / ') : '未选'}`];
        if (pick.seasons.length) parts.push(`季度：${pick.seasons.length} 个`);
        if (pick.months.length) parts.push(`月份：${pick.months.map((month) => month + '月').join(' ')}`);
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
    }

    // ---------- ① 拉取候选（只读） ----------

    async function pull() {
        if (busy) return;
        if (!pick.years.length) { statusEl.textContent = '请至少选择一个年份'; return; }
        setBusy(true);
        results = null;
        candidates = [];
        pickStep.hidden = true;
        statusEl.textContent = '正在规划查询区间…';
        setProgress(0);
        try {
            const planResp = await fetch('/api/metadata-sync/discover/plan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ years: pick.years, seasons: pick.seasons, months: pick.months })
            });
            const plan = await planResp.json().catch(() => ({}));
            if (!planResp.ok) throw new Error(plan.message || `HTTP ${planResp.status}`);
            const ranges = plan.ranges || [];
            if (!ranges.length) { statusEl.textContent = '没有可查询的区间'; setProgress(null); return; }

            const merged = new Map();
            const truncated = [];
            for (let i = 0; i < ranges.length; i += 1) {
                const range = ranges[i];
                statusEl.textContent = `正在获取第 ${i + 1}/${ranges.length} 段：${range.label}…`;
                const resp = await fetch('/api/metadata-sync/discover/fetch', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ from: range.from, to: range.to })
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
            candidates = [...merged.values()];
            statusEl.textContent = truncated.length
                ? `⚠️ ${truncated.join('、')} 超过 Bangumi 1000 条上限，建议改选月份后重新拉取`
                : `来自 ${ranges.map((range) => range.label).join('、')}`;
            renderList();
            pullBtn.textContent = '重新拉取';
            pullBtn.className = 'btn-mini';   // 拉完后主操作是底部的「同步勾选的 N 部」，这里降级
        } catch (e) {
            statusEl.textContent = `拉取失败：${e.message || '后端未响应'}`;
            setProgress(null);
        } finally {
            setBusy(false);
            updateCounts();
            setTimeout(() => setProgress(null), 800);
        }
    }

    // ---------- ② 挑作品 ----------

    const isTv = (candidate) => String(candidate.format || '').toUpperCase() === 'TV';
    /** 命中的本地媒体多于 1 个 → 一律跳过（避免误关联），可选但默认不勾。 */
    const isConflict = (candidate) => candidate.matchType === 'CONFLICT';
    /** 默认勾选：TV（这次同步的主目标），冲突项留给人工。 */
    const defaultChecked = (candidate) => isTv(candidate) && !isConflict(candidate);

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
            listEl.innerHTML = '<div class="bgm-empty">没有找到符合条件的作品，换年份/季度/月份再拉一次试试。</div>';
            listEl.hidden = false;
            totalEl.textContent = '共 0 部';
            return;
        }
        const rows = candidates.slice(0, MAX_ROWS);
        listEl.innerHTML = rows.map((candidate) => {
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
                <input type="checkbox" ${defaultChecked(candidate) ? 'checked' : ''}>
                <span class="bgm-cover">${candidate.coverUrl
                    ? `<img src="${esc(candidate.coverUrl)}" alt="" loading="lazy">`
                    : esc((candidate.titleCn || candidate.title || '?').slice(0, 1))}</span>
                <span class="bgm-copy">
                    <span class="bgm-title">${esc(candidate.titleCn || candidate.title || candidate.externalId)}</span>
                    ${subtitle ? `<span class="bgm-sub">${esc(subtitle)}</span>` : ''}
                    <span class="bgm-meta">${meta}</span>
                </span>
                ${badge}
                ${resultLine(candidate)}
            </label>`;
        }).join('');
        listEl.hidden = false;
        totalEl.textContent = candidates.length > MAX_ROWS
            ? `共 ${candidates.length} 部（只显示前 ${MAX_ROWS} 部）`
            : `共 ${candidates.length} 部`;
        rowsOf().forEach((row) => row.querySelector('input').addEventListener('change', updateCounts));
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
            ? '勾选要同步的作品（点上面的「全选」或「只选 TV」快速勾）'
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

    async function commit(items) {
        if (busy || !items.length) return;
        setBusy(true);
        const totals = { total: 0, added: 0, updated: 0, skipped: 0, failed: 0 };
        results = new Map();
        try {
            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                const batch = items.slice(i, i + BATCH_SIZE);
                commitBtn.textContent = `同步中 ${i}/${items.length}…`;
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
            setProgress(1);
            statusEl.textContent = `完成：新增 ${totals.added} · 更新 ${totals.updated}`
                + `${totals.skipped ? ` · 跳过 ${totals.skipped}` : ''}${totals.failed ? ` · 失败 ${totals.failed}` : ''}`
                + `（共 ${totals.total} 条）`;
            showToast(`Bangumi 同步完成：新增 ${totals.added}、更新 ${totals.updated}`);
            renderList();
            if (typeof loadMedia === 'function') loadMedia();
        } catch (e) {
            statusEl.textContent = `同步中断：${e.message || '后端未响应'}（已完成的批次已写入，可再次点同步补齐剩余）`;
            renderList();
        } finally {
            setBusy(false);
            updateCounts();
            setTimeout(() => setProgress(null), 1200);
        }
    }

    // ---------- 打开 / 关闭 / 绑定 ----------

    window.openBgmSyncModal = function openBgmSyncModal() {
        pick = loadPick();
        candidates = [];
        results = null;
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
        modal.hidden = false;
    };

    pullBtn.addEventListener('click', () => { void pull(); });
    commitBtn.addEventListener('click', () => { void commit(pickedItems()); });
    el('bgm-pick-all').addEventListener('click', () => setChecked(() => true));
    el('bgm-pick-tv').addEventListener('click', () => setChecked((candidate) => isTv(candidate)));
    el('bgm-pick-none').addEventListener('click', () => setChecked(() => false));
    el('bgm-sync-cancel').addEventListener('click', () => { modal.hidden = true; });
    modal.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true; });
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
