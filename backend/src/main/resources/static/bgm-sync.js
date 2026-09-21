/**
 * 从 Bangumi 同步（2026-09-21 简化版）：选条件 → 勾选 → 直接同步。
 *
 * 设计规格：`docs/superpowers/specs/2026-09-21-bangumi-sync-simplify-design.md`。
 *
 * 与旧版的区别：不再是独立审核工作区、不建后台任务、不存草稿；年/季/月全多选；
 * 一个按钮拉取、一个按钮同步、顶部直接给「新增 / 更新 / 跳过 / 失败」条数。
 *
 * 后端接口：`/discover/plan`（多选→区间）→ `/discover/fetch`（逐段取候选，只读）→ `/commit`（分批写库）。
 */
(function () {
    'use strict';

    const BATCH_SIZE = 12;            // 每批同步多少部（每部后端要拉详情+集，约 2 个请求）
    const MAX_ROWS = 400;             // 一次最多渲染多少行（避免 DOM 过大）
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
    const startBtn = el('bgm-sync-start');
    const allBtn = el('bgm-sync-all');

    const SEASONS = [['WINTER', '冬 1–3'], ['SPRING', '春 4–6'], ['SUMMER', '夏 7–9'], ['FALL', '秋 10–12']];

    let ranges = [];          // 区间计划
    let candidates = [];      // 合并去重后的候选
    let results = null;       // 提交结果（Map externalId → item result）
    let busy = false;

    // ---------- 选择状态（localStorage 记忆，下次打开不用重选） ----------

    function loadPick() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
            return {
                years: Array.isArray(saved.years) ? saved.years.map(Number) : [new Date().getFullYear()],
                seasons: Array.isArray(saved.seasons) ? saved.seasons : [],
                months: Array.isArray(saved.months) ? saved.months.map(Number) : [],
                onlyTv: saved.onlyTv !== false
            };
        } catch (e) {
            return { years: [new Date().getFullYear()], seasons: [], months: [], onlyTv: true };
        }
    }

    let pick = loadPick();

    function savePick() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(pick)); } catch (e) { /* 隐私模式无所谓 */ }
    }

    // ---------- 条件 chips ----------

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
        const parts = [];
        parts.push(`年份：${pick.years.length ? pick.years.join(' / ') : '未选'}`);
        if (pick.seasons.length) parts.push(`季度：${pick.seasons.length} 个`);
        if (pick.months.length) parts.push(`月份：${pick.months.map((m) => m + '月').join(' ')}`);
        if (!pick.seasons.length && !pick.months.length) parts.push('（未选季度/月份 = 整年，会自动按季拆分）');
        hintEl.textContent = parts.join(' · ');
    }

    // ---------- 拉取候选 ----------

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
        startBtn.disabled = value;
        allBtn.disabled = value;
    }

    async function pull() {
        if (busy) return;
        if (!pick.years.length) { statusEl.textContent = '请至少选择一个年份'; return; }
        setBusy(true);
        results = null;
        candidates = [];
        listEl.hidden = true;
        listEl.textContent = '';
        statusEl.textContent = '正在规划区间…';
        setProgress(0);
        try {
            const planResp = await fetch('/api/metadata-sync/discover/plan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ years: pick.years, seasons: pick.seasons, months: pick.months })
            });
            const plan = await planResp.json().catch(() => ({}));
            if (!planResp.ok) throw new Error(plan.message || `HTTP ${planResp.status}`);
            ranges = plan.ranges || [];
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
                ? `共 ${candidates.length} 部；⚠️ ${truncated.join('、')} 超过 Bangumi 1000 条上限，建议改选月份`
                : `共 ${candidates.length} 部（${ranges.length} 段）`;
            renderList();
        } catch (e) {
            statusEl.textContent = `拉取失败：${e.message || '后端未响应'}`;
            setProgress(null);
        } finally {
            setBusy(false);
        }
    }

    // ---------- 列表 ----------

    const isTv = (candidate) => String(candidate.format || '').toUpperCase() === 'TV';

    function defaultChecked(candidate) {
        if (candidate.matchType === 'CONFLICT') return false;   // 命中多个 → 跳过，交人工
        if (!pick.onlyTv) return true;
        return isTv(candidate);
    }

    function actionLabel(candidate) {
        switch (candidate.matchType) {
            case 'EXTERNAL_ID': return `更新（已关联 #${candidate.targetMediaId}）`;
            case 'TITLE': return `更新（标题命中 #${candidate.targetMediaId}）`;
            case 'CONFLICT': return `跳过（本地有 ${(candidate.localMatches || []).length} 条同名，请到媒体详情处理）`;
            default: return '新增';
        }
    }

    /** 未使用但保留：给未来的「悬停看匹配理由」留口（当前紧凑行不展示）。 */
    void actionLabel;

    /** 结果状态覆盖在卡片上（提交后调用）。 */
    function resultLine(candidate) {
        const item = results && results.get(candidate.externalId);
        if (!item) return '';
        if (item.status === 'FAILED') return `<span class="bgm-result fail">✗ ${esc(item.error || '失败')}</span>`;
        if (item.status === 'SKIPPED') return '';
        return `<span class="bgm-result">✓ ${item.status === 'ADDED' ? '已新增' : '已更新'}</span>`;
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function renderList() {
        if (!candidates.length) {
            listEl.innerHTML = '<div class="bgm-empty">没有找到符合条件的作品，可以换年份/季度/月份再试。</div>';
            listEl.hidden = false;
            startBtn.textContent = '拉取候选';
            return;
        }
        const rows = candidates.slice(0, MAX_ROWS);
        const head = `
            <div class="bgm-chips" style="padding:2px 6px 6px">
                <label class="bgm-label"><input type="checkbox" id="bgm-select-all" checked> 全选</label>
                <label class="bgm-label"><input type="checkbox" id="bgm-only-tv" ${pick.onlyTv ? 'checked' : ''}> 只选 TV</label>
                <span class="bgm-label" id="bgm-selected-count"></span>
                ${candidates.length > MAX_ROWS ? `<span class="bgm-label">（只显示前 ${MAX_ROWS} 部，其余可用「直接同步全部」）</span>` : ''}
            </div>`;
        const body = rows.map((candidate) => {
            const subtitle = [candidate.nativeTitle, candidate.romajiTitle, candidate.englishTitle]
                .filter(Boolean).filter((value, index, all) => all.indexOf(value) === index && value !== candidate.titleCn)
                .join(' · ');
            const meta = [
                candidate.year ? String(candidate.year) : '',
                candidate.format || '', candidate.episodeCount != null ? `${candidate.episodeCount} 集` : '',
                candidate.airDate ? candidate.airDate : ''
            ].filter(Boolean).map((value) => `<span>${esc(value)}</span>`).join('');
            const badge = candidate.matchType === 'CONFLICT'
                ? `<span class="bgm-badge skip">跳过</span>`
                : candidate.matchType === 'NONE'
                    ? `<span class="bgm-badge new">新增</span>`
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
        listEl.innerHTML = head + body;
        listEl.hidden = false;
        startBtn.textContent = '重新拉取';
        allBtn.textContent = '直接同步全部';

        const allBox = el('bgm-select-all');
        if (allBox) {
            allBox.addEventListener('change', () => {
                listEl.querySelectorAll('.bgm-row input').forEach((box) => { box.checked = allBox.checked; });
                updateCount();
            });
        }
        const tvBox = el('bgm-only-tv');
        if (tvBox) {
            tvBox.addEventListener('change', () => {
                pick.onlyTv = tvBox.checked;
                savePick();
                listEl.querySelectorAll('.bgm-row').forEach((row) => {
                    const candidate = candidates.find((item) => item.externalId === row.dataset.externalId);
                    const box = row.querySelector('input');
                    if (candidate && box) box.checked = defaultChecked(candidate);
                });
                updateCount();
            });
        }
        listEl.querySelectorAll('.bgm-row input').forEach((box) => box.addEventListener('change', updateCount));
        updateCount();
    }

    function updateCount() {
        const rows = [...listEl.querySelectorAll('.bgm-row')];
        const picked = rows.filter((row) => row.querySelector('input').checked).length;
        const label = el('bgm-selected-count');
        if (label) label.textContent = `已选 ${picked} / ${rows.length}`;
    }

    function pickedItems() {
        return [...listEl.querySelectorAll('.bgm-row')]
            .filter((row) => row.querySelector('input').checked)
            .map((row) => toItem(candidates.find((item) => item.externalId === row.dataset.externalId)))
            .filter(Boolean);
    }

    /** 候选 → 提交项（匹配类型决定动作，与后端 SyncActionDecider 同一套规则）。 */
    function toItem(candidate) {
        if (!candidate) return null;
        const action = candidate.matchType === 'EXTERNAL_ID' ? 'UPDATE'
            : candidate.matchType === 'TITLE' ? 'LINK'
                : candidate.matchType === 'NONE' ? 'CREATE' : 'SKIP';
        return { externalId: candidate.externalId, action, mediaId: candidate.targetMediaId || null };
    }

    // ---------- 提交 ----------

    async function commit(items, label) {
        if (busy) return;
        if (!items.length) { statusEl.textContent = '没有可同步的条目'; return; }
        setBusy(true);
        const totals = { total: 0, added: 0, updated: 0, skipped: 0, failed: 0 };
        results = new Map();
        try {
            for (let i = 0; i < items.length; i += BATCH_SIZE) {
                const batch = items.slice(i, i + BATCH_SIZE);
                statusEl.textContent = `${label}：已处理 ${i}/${items.length}…`;
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
            statusEl.textContent = `同步完成：新增 ${totals.added} · 更新 ${totals.updated} · 跳过 ${totals.skipped} · 失败 ${totals.failed}（共 ${totals.total} 条）`;
            showToast(`Bangumi 同步完成：新增 ${totals.added}、更新 ${totals.updated}`);
            renderList();
            if (typeof loadMedia === 'function') loadMedia();
        } catch (e) {
            statusEl.textContent = `${label}失败：${e.message || '后端未响应'}`;
            renderList();
        } finally {
            setBusy(false);
            setTimeout(() => setProgress(null), 1500);
        }
    }

    // ---------- 打开/关闭 ----------

    window.openBgmSyncModal = function openBgmSyncModal() {
        pick = loadPick();
        ranges = [];
        candidates = [];
        results = null;
        buildChips();
        listEl.hidden = true;
        listEl.textContent = '';
        statusEl.textContent = '';
        startBtn.textContent = '拉取候选';
        allBtn.textContent = '直接同步全部';
        setProgress(null);
        modal.hidden = false;
    };

    startBtn.addEventListener('click', () => {
        if (candidates.length && !results) {
            commit(pickedItems(), '同步选中');
            return;
        }
        void pull();
    });
    allBtn.addEventListener('click', async () => {
        if (!candidates.length) { await pull(); }
        if (!candidates.length) return;
        // 免勾选：按同一套匹配规则全量同步（跳过 CONFLICT）
        const items = candidates.map((candidate) => ({
            externalId: candidate.externalId,
            action: candidate.matchType === 'EXTERNAL_ID' ? 'UPDATE'
                : candidate.matchType === 'TITLE' ? 'LINK'
                    : candidate.matchType === 'NONE' ? 'CREATE' : 'SKIP',
            mediaId: candidate.targetMediaId || null
        }));
        void commit(items, '直接同步全部');
    });
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
