(function () {
    const state = { mediaId: null, data: null, mode: null, candidates: [], selected: null, expanded: null, preview: null, status: '' };

    window.v022LoadMediaMetadata = async function (mediaId) {
        const panel = document.getElementById('external-metadata-panel');
        if (!panel) return;
        if (state.mediaId !== mediaId) reset(mediaId);
        panel.hidden = false;
        if (!state.data) panel.innerHTML = loadingCard('正在读取本地外部资料缓存…');
        try {
            const response = await fetch(`/api/media/${mediaId}/metadata`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            state.data = await response.json();
            state.mode = state.data.work ? null : 'PRIMARY';
            state.preview = null;
            state.status = '';
            render();
        } catch (error) {
            panel.innerHTML = emptyCard('外部资料读取失败', error.message || '后端未响应');
        }
    };

    window.v022HandleMediaMetadataAction = async function (mediaId, button) {
        if (state.mediaId !== mediaId || !state.data) await window.v022LoadMediaMetadata(mediaId);
        if (!state.data || !state.data.work) {
            state.mode = 'PRIMARY';
            render();
            document.getElementById('md-search-input')?.focus();
            return;
        }
        button.disabled = true;
        const previous = state.status;
        state.status = '正在按稳定 Bangumi ID 刷新，旧资料会保留到成功为止…';
        render();
        try {
            const response = await fetch(`/api/media/${mediaId}/metadata-refresh`, { method: 'POST' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
            showToast(`资料刷新完成：新增 ${data.added || 0}，更新 ${data.updated || 0}`);
            await refreshMediaDetail();
        } catch (error) {
            state.status = `刷新失败：${error.message || '后端未响应'}。旧资料未变。`;
            render();
            showToast(state.status);
        } finally {
            button.disabled = false;
            if (!state.status) state.status = previous;
        }
    };

    function reset(mediaId) {
        state.mediaId = mediaId;
        state.data = null;
        state.mode = null;
        state.candidates = [];
        state.selected = null;
        state.expanded = null;
        state.preview = null;
        state.status = '';
    }

    function render() {
        const panel = document.getElementById('external-metadata-panel');
        if (!panel || !state.data) return;
        panel.hidden = false;
        if (state.preview) renderReplacePreview(panel);
        else if (state.mode) renderSearch(panel);
        else if (state.data.work) renderArchive(panel);
        else renderSearch(panel);
        bind(panel);
    }

    function renderArchive(panel) {
        const work = state.data.work;
        const works = Array.isArray(state.data.works) ? state.data.works : [work];
        const aliases = parseMetadataList(work.aliasesJson);
        const genres = parseMetadataList(work.genresJson);
        const episodes = Array.isArray(state.data.episodes) ? state.data.episodes : [];
        const relations = Array.isArray(state.data.relations) ? state.data.relations : [];
        panel.innerHTML = `
            <header class="md-archive-head">
                <div><span class="detail-kicker">EXTERNAL ARCHIVE / PRIMARY</span><h3>外部资料</h3><p>主条目用于常规刷新；OVA、特别篇可作为附加条目独立保存。</p></div>
                <div class="md-head-actions"><button type="button" class="btn-mini" data-v023-entry="${esc(work.mediaEntryId || '')}" data-v023-title="${esc(work.canonicalTitle || work.nativeTitle || '')}">管理片源</button><span class="metadata-provider-badge">${esc(work.provider || 'BANGUMI')}</span><button type="button" class="btn-mini" data-md-action="add">添加其他条目</button><button type="button" class="btn-mini" data-md-action="replace">更换关联</button></div>
            </header>
            <article class="md-primary-card">
                <div class="md-cover">${cover(work.coverUrl, work.canonicalTitle || work.nativeTitle)}</div>
                <div class="md-primary-copy"><div class="md-title-line"><h4>${esc(work.canonicalTitle || work.nativeTitle || '未命名作品')}</h4><span>ID ${esc(work.externalId || '—')}</span></div><p class="md-native-title">${esc(uniqueTitles(work).join(' · '))}</p>${factRow(work)}<div class="md-description">${esc(work.description || '暂无外部简介')}</div>${chipRow(genres, '题材')}${chipRow(aliases, '别名')}</div>
            </article>
            ${works.length > 1 ? `<section class="md-secondary"><div class="md-subhead"><b>附加条目</b><span>${works.length - 1} 条</span></div><div class="md-secondary-grid">${works.slice(1).map(secondaryWork).join('')}</div></section>` : ''}
            ${episodes.length ? `<section class="md-episodes"><div class="md-subhead"><b>主条目集索引</b><span>${episodes.length} 集资料</span></div><div class="external-episode-list">${episodes.map(episodeRow).join('')}</div></section>` : ''}
            ${relations.length ? `<section class="md-relations"><div class="md-subhead"><b>关联作品</b><span>${relations.length} 条</span></div><div class="external-relation-list">${relations.map(relation => `<span>${esc(relation.relationType || '关联')} · ${esc(relation.title || relation.relatedExternalId || '')}</span>`).join('')}</div></section>` : ''}
            ${syncState(work)}`;
    }

    function renderSearch(panel) {
        const mode = state.mode || 'PRIMARY';
        const labels = mode === 'ADD'
            ? ['添加外部条目', '为本媒体补充 OVA、特别篇或其他 Bangumi 条目。']
            : mode === 'REPLACE'
                ? ['查找新的主条目', '先选择新候选，再预览旧集处理清单。旧集默认全部保留。']
                : ['关联 Bangumi 资料', '搜索框已填入本地标题，但只有点击搜索才会联网。'];
        const keyword = document.getElementById('md-search-input')?.value || currentTitle();
        panel.innerHTML = `
            <header class="md-archive-head md-search-head"><div><span class="detail-kicker">MATCH CURRENT MEDIA</span><h3>${labels[0]}</h3><p>${labels[1]}</p></div>${state.data.work ? '<button type="button" class="btn-mini" data-md-action="cancel">取消</button>' : '<span class="md-local-only">打开详情不联网</span>'}</header>
            <form class="md-search-form" id="md-search-form"><label><span>Bangumi 作品关键词</span><div><input id="md-search-input" type="search" value="${esc(keyword)}" maxlength="120" autocomplete="off" placeholder="输入标题后主动搜索"><button type="submit" class="btn-primary">搜索</button></div></label><small>最多返回 20 条，不分页；结果过多时请收窄关键词。</small></form>
            <div class="md-search-status" aria-live="polite">${esc(state.status)}</div>
            ${candidateResults(mode)}`;
    }

    function candidateResults(mode) {
        if (!state.candidates.length) return `<div class="md-search-empty"><b>${state.status ? '没有可展示的候选' : '等待主动搜索'}</b><span>${state.status ? '尝试更换关键词。' : '不会自动选择，也不会自动创建或改动媒体。'}</span></div>`;
        const selected = state.candidates.find(item => item.externalId === state.selected);
        const expanded = state.candidates.find(item => item.externalId === state.expanded);
        return `<div class="md-candidate-summary"><b>${state.candidates.length} 条候选</b><span>${state.candidates.length === 20 ? '已显示上限 20 条，可修改关键词缩小范围' : '点击正文查看详情；单选框只负责选择'}</span></div>
            <div class="md-candidate-list">${state.candidates.map(candidateCard).join('')}</div>
            ${expanded ? candidateDetail(expanded) : ''}
            <footer class="md-search-actions"><span>${selected ? `已选择：${esc(candidateTitle(selected))}` : '尚未选择候选'}</span><button type="button" class="btn-primary" data-md-action="confirm" ${selected ? '' : 'disabled'}>${mode === 'ADD' ? '添加并同步' : mode === 'REPLACE' ? '预览更换影响' : '关联并同步'}</button></footer>`;
    }

    function candidateCard(item) {
        const unavailable = item.matchType === 'EXTERNAL_ID' && item.targetMediaId && item.targetMediaId !== state.mediaId;
        const selected = item.externalId === state.selected;
        const expanded = item.externalId === state.expanded;
        return `<article class="md-candidate ${selected ? 'selected' : ''} ${expanded ? 'expanded' : ''} ${unavailable ? 'unavailable' : ''}"><label class="md-candidate-radio"><input type="radio" name="md-candidate" value="${esc(item.externalId)}" ${selected ? 'checked' : ''} ${unavailable ? 'disabled' : ''}><span></span></label><button type="button" class="md-candidate-body" data-md-expand="${esc(item.externalId)}"><strong>${esc(candidateTitle(item))}</strong><small>${esc([item.nativeTitle, item.year, item.format, item.episodeCount != null ? `${item.episodeCount} 集` : ''].filter(Boolean).join(' · '))}</small><em>${esc(unavailable ? '已关联其他媒体，不能从这里迁移' : item.matchReason || '点击查看候选详情')}</em></button><span class="md-candidate-id">#${esc(item.externalId)}</span></article>`;
    }

    function candidateDetail(item) {
        return `<article class="md-candidate-detail"><div class="md-cover">${cover(item.coverUrl, candidateTitle(item))}</div><div><span class="detail-kicker">CANDIDATE DETAIL / #${esc(item.externalId)}</span><h4>${esc(candidateTitle(item))}</h4><p>${esc([item.nativeTitle, item.romajiTitle, item.englishTitle].filter(Boolean).join(' · '))}</p><div class="md-facts"><span>${esc(item.year || '年份未知')}</span><span>${esc(item.season || '季度未知')}</span><span>${esc(item.format || '格式未知')}</span><span>${item.episodeCount == null ? '集数未知' : `${esc(item.episodeCount)} 集`}</span></div><div class="md-description">${esc(item.description || '暂无简介')}</div>${chipRow(item.genres || [], '题材')}${chipRow(item.aliases || [], '别名')}</div></article>`;
    }

    function renderReplacePreview(panel) {
        const preview = state.preview;
        const episodes = Array.isArray(preview.episodes) ? preview.episodes : [];
        panel.innerHTML = `<header class="md-archive-head"><div><span class="detail-kicker">RELINK SAFETY REVIEW</span><h3>确认更换主关联</h3><p>旧外部缓存会解除主关联；下列旧集默认全部保留。</p></div><button type="button" class="btn-mini" data-md-action="preview-back">返回候选</button></header>
            <div class="md-replace-pair"><div><small>当前主条目</small><b>${esc(preview.currentWork.canonicalTitle || preview.currentWork.nativeTitle || preview.currentWork.externalId)}</b><span>#${esc(preview.currentWork.externalId)}</span></div><i>→</i><div><small>新的主条目</small><b>${esc(candidateTitle(preview.candidate))}</b><span>#${esc(preview.candidate.externalId)}</span></div></div>
            <section class="md-old-episodes"><div class="md-subhead"><b>旧集处理清单</b><span>不勾选 = 保留</span></div>${episodes.length ? episodes.map(protectionRow).join('') : '<div class="md-search-empty"><b>当前条目没有旧集</b><span>可以直接更换关联。</span></div>'}</section>
            <div id="md-protected-confirm" class="md-danger-confirm" hidden><b>高等级确认</b><span>选中了含本地视频、用户编辑、标签或封面的受保护集。输入“删除旧集”后才能继续。</span><input id="md-protected-phrase" type="text" autocomplete="off" placeholder="删除旧集"></div>
            <footer class="md-search-actions"><span>含 Clip 的集已锁定，任何更换都不会移动或删除 Clip。</span><button type="button" class="btn-primary danger" data-md-action="replace-submit">确认更换关联</button></footer>`;
        updateProtectionConfirm(panel);
    }

    function protectionRow(item) {
        const badges = [];
        if (item.clipCount) badges.push(`${item.clipCount} Clip`);
        if (item.localVideo) badges.push('本地视频');
        if (item.userTitle) badges.push('用户标题');
        if (item.note) badges.push('备注');
        if (item.tagCount) badges.push(`${item.tagCount} 标签`);
        if (item.cover) badges.push('封面');
        return `<label class="md-protection-row ${item.protectedItem ? 'protected' : ''} ${item.clipCount ? 'locked' : ''}"><input type="checkbox" data-delete-episode value="${item.episodeId}" data-protected="${item.protectedItem}" ${item.clipCount ? 'disabled' : ''}><span class="md-protection-check"></span><div><b>${item.episodeNo == null ? '未编号' : `第 ${esc(item.episodeNo)} 集`} · ${esc(item.title || '未命名集')}</b><small>${badges.length ? badges.map(badge => `<em>${esc(badge)}</em>`).join('') : '<em>无保护内容</em>'}</small></div><strong>${item.clipCount ? '必须保留' : '保留'}</strong></label>`;
    }

    function bind(panel) {
        panel.querySelector('#md-search-form')?.addEventListener('submit', search);
        panel.querySelectorAll('input[name="md-candidate"]').forEach(input => input.addEventListener('change', () => { state.selected = input.value; render(); }));
        panel.querySelectorAll('[data-delete-episode]').forEach(input => input.addEventListener('change', () => { input.closest('.md-protection-row').querySelector('strong').textContent = input.checked ? '删除' : input.disabled ? '必须保留' : '保留'; updateProtectionConfirm(panel); }));
        panel.querySelectorAll('[data-md-expand]').forEach(button => button.addEventListener('click', () => {
            state.expanded = button.dataset.mdExpand;
            render();
        }));
        panel.querySelectorAll('[data-md-action]').forEach(button => button.addEventListener('click', actionClick));
        panel.querySelectorAll('[data-v023-entry]').forEach(button => button.addEventListener('click', () => window.v023OpenVideoSources?.(Number(button.dataset.v023Entry), button.dataset.v023Title)));
    }

    async function actionClick(event) {
        const action = event.target.closest('[data-md-action]')?.dataset.mdAction;
        if (!action) return;
        if (action === 'add' || action === 'replace') { state.mode = action === 'add' ? 'ADD' : 'REPLACE'; clearSearch(); render(); return; }
        if (action === 'cancel') { state.mode = null; clearSearch(); render(); return; }
        if (action === 'preview-back') { state.preview = null; state.mode = 'REPLACE'; render(); return; }
        if (action === 'confirm') await confirmCandidate();
        if (action === 'replace-submit') await submitReplace();
    }

    async function search(event) {
        event.preventDefault();
        const input = document.getElementById('md-search-input');
        const keyword = input.value.trim();
        if (!keyword) { state.status = '请输入 Bangumi 作品关键词'; render(); return; }
        state.status = '正在查询 Bangumi，最多读取前 20 条…';
        state.candidates = [];
        state.selected = null;
        state.expanded = null;
        render();
        try {
            const response = await fetch(`/api/media/${state.mediaId}/metadata-search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword }) });
            const data = await response.json().catch(() => ([]));
            if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
            state.candidates = Array.isArray(data) ? data.slice(0, 20) : [];
            state.status = state.candidates.length ? `查询完成：${state.candidates.length} 条候选，未自动选择。` : '没有找到候选，请调整关键词。';
        } catch (error) { state.status = `查询失败：${error.message || '后端未响应'}`; }
        render();
    }

    async function confirmCandidate() {
        if (!state.selected) return;
        const button = document.querySelector('[data-md-action="confirm"]');
        if (button) button.disabled = true;
        try {
            if (state.mode === 'REPLACE') {
                const response = await fetch(`/api/media/${state.mediaId}/metadata-link-preview`, request({ externalId: state.selected, mode: 'REPLACE' }));
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
                state.preview = data;
                render();
                return;
            }
            const endpoint = state.mode === 'ADD' ? 'metadata-entries' : 'metadata-link';
            const response = await fetch(`/api/media/${state.mediaId}/${endpoint}`, request({ externalId: state.selected, mode: state.mode === 'ADD' ? 'ADD' : 'PRIMARY' }));
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
            showToast(state.mode === 'ADD' ? '附加条目已添加' : 'Bangumi 资料已关联');
            await refreshMediaDetail();
        } catch (error) { state.status = `操作失败：${error.message || '后端未响应'}`; render(); showToast(state.status); }
    }

    async function submitReplace() {
        const selected = [...document.querySelectorAll('[data-delete-episode]:checked')];
        const protectedSelected = selected.some(input => input.dataset.protected === 'true');
        const phrase = document.getElementById('md-protected-phrase')?.value.trim();
        if (protectedSelected && phrase !== '删除旧集') { showToast('请输入“删除旧集”完成高等级确认'); document.getElementById('md-protected-phrase')?.focus(); return; }
        const button = document.querySelector('[data-md-action="replace-submit"]');
        if (button) button.disabled = true;
        try {
            const response = await fetch(`/api/media/${state.mediaId}/metadata-link`, request({ externalId: state.preview.candidate.externalId, mode: 'REPLACE', deleteEpisodeIds: selected.map(input => Number(input.value)), confirmProtected: protectedSelected }));
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
            showToast(`主关联已更换，保留 ${state.preview.episodes.length - selected.length} 个旧集`);
            await refreshMediaDetail();
        } catch (error) { showToast(`更换失败：${error.message || '后端未响应'}`); if (button) button.disabled = false; }
    }

    function updateProtectionConfirm(panel) {
        const visible = [...panel.querySelectorAll('[data-delete-episode]:checked')].some(input => input.dataset.protected === 'true');
        const box = panel.querySelector('#md-protected-confirm');
        if (box) box.hidden = !visible;
    }

    function clearSearch() { state.candidates = []; state.selected = null; state.expanded = null; state.preview = null; state.status = ''; }
    function request(body) { return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
    function currentTitle() { return typeof currentMedia !== 'undefined' && currentMedia?.title ? currentMedia.title : ''; }
    function candidateTitle(item) { return item.titleCn || item.title || item.nativeTitle || item.externalId || '未命名作品'; }
    function uniqueTitles(work) { return [work.nativeTitle, work.romajiTitle, work.englishTitle].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index && value !== work.canonicalTitle); }
    function cover(url, title) { return url ? `<img src="${esc(url)}" alt="" loading="lazy">` : `<span>${esc((title || '◇').slice(0, 1))}</span>`; }
    function chipRow(values, label) { return values?.length ? `<div class="external-chip-row"><span class="external-chip-label">${esc(label)}</span>${values.map(value => `<span>${esc(value)}</span>`).join('')}</div>` : ''; }
    function factRow(work) { return `<div class="md-facts">${[work.year, work.season, work.format, work.episodeCount != null ? `${work.episodeCount} 集` : null, work.airDate].filter(Boolean).map(value => `<span>${esc(value)}</span>`).join('')}</div>`; }
    function secondaryWork(work) { return `<article><div class="md-cover small">${cover(work.coverUrl, work.canonicalTitle || work.nativeTitle)}</div><div><b>${esc(work.canonicalTitle || work.nativeTitle || '未命名条目')}</b><span>${esc([work.format, work.year, `#${work.externalId}`].filter(Boolean).join(' · '))}</span><button type="button" class="btn-mini" data-v023-entry="${esc(work.mediaEntryId || '')}" data-v023-title="${esc(work.canonicalTitle || work.nativeTitle || '')}">管理片源</button></div></article>`; }
    function episodeRow(ep) { const stateName = (ep.syncState || 'ACTIVE').toLowerCase(); return `<article class="external-episode-row state-${esc(stateName)}"><div class="external-episode-no">${ep.episodeNo == null ? '未编号' : `第${esc(ep.episodeNo)}集`}</div><div class="external-episode-copy"><div class="external-episode-title">${esc(ep.titleCn || ep.title || '未命名集')}</div>${ep.description ? `<div class="external-episode-description">${esc(ep.description)}</div>` : ''}<div class="external-episode-meta">${[ep.airDate, ep.durationSec ? `${Math.round(ep.durationSec / 60)} 分钟` : '', ep.episodeId ? '已绑定本地集' : '待绑定本地集'].filter(Boolean).map(value => `<span>${esc(value)}</span>`).join('')}</div></div><span class="external-episode-state">${esc(ep.syncState || 'ACTIVE')}</span></article>`; }
    function syncState(work) { const label = `同步 ${work.syncState || '未知'} · ${work.lastSuccessAt ? new Date(work.lastSuccessAt).toLocaleString() : '暂无成功记录'}`; return `<div class="external-sync-state ${work.lastError ? 'error' : ''}">${esc(state.status || (work.lastError ? `${label} · ${work.lastError}` : label))}</div>`; }
    function loadingCard(text) { return `<div class="md-loading"><span class="ms-live-dot"></span><b>${esc(text)}</b></div>`; }
    function emptyCard(title, text) { return `<div class="md-search-empty"><b>${esc(title)}</b><span>${esc(text)}</span></div>`; }
})();
