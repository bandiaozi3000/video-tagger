(function () {
    const state = { management: null, tab: 'subscriptions', test: null, editingSourceId: null, quick: null, quickTimer: null, lockedCandidateId: null, quickTitle: '' };
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    try {
        const playerChannel = new BroadcastChannel('video-tagger-player');
        playerChannel.addEventListener('message', event => {
            if (event.data?.type === 'clip-saved' && event.data.episodeId) window.loadEpisodeDetail?.(event.data.episodeId);
        });
    } catch (_) {}

    async function api(url, options) {
        const response = await fetch(url, options);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
        return body;
    }

    function ensureManager() {
        let shell = document.getElementById('v023-source-manager');
        if (shell) return shell;
        shell = document.createElement('section');
        shell.id = 'v023-source-manager';
        shell.className = 'vsm-shell';
        shell.hidden = true;
        document.body.appendChild(shell);
        return shell;
    }

    window.v023OpenSourceManagement = async function () {
        const shell = ensureManager();
        shell.hidden = false;
        document.body.style.overflow = 'hidden';
        shell.innerHTML = '<div class="vsm-loading">正在读取数据源配置…</div>';
        try {
            state.management = await api('/api/video-source-management');
            renderManager();
        } catch (error) {
            shell.innerHTML = `<div class="vsm-loading">加载失败：${esc(error.message)} <button data-vsm="close">关闭</button></div>`;
            shell.querySelector('[data-vsm="close"]').onclick = closeManager;
        }
    };

    function closeManager() {
        ensureManager().hidden = true;
        document.body.style.overflow = '';
    }

    function subscriptionCards() {
        const subscriptions = state.management?.subscriptions || [];
        return `<section class="vsm-section"><div class="vsm-section-head"><div><span>DATA SOURCE SUBSCRIPTIONS</span><h3>数据源订阅</h3><p>订阅更新只修改来源定义，不覆盖启用状态、排序和播放偏好。</p></div><div><button data-vsm="recommended">推荐订阅</button><button class="primary" data-vsm="add-subscription">添加订阅</button></div></div>${subscriptions.length ? subscriptions.map(item => `<article class="vsm-sub-card"><div><b>${esc(item.displayName)}</b><code>${esc(item.url)}</code><small>${statusText(item.status)} · ${item.sourceCount || 0} 个数据源${item.lastSuccessAt ? ` · ${new Date(item.lastSuccessAt).toLocaleString()}` : ''}</small>${item.errorMessage ? `<em>${esc(item.errorMessage)}</em>` : ''}</div><div><button data-refresh-sub="${item.id}">刷新</button><button class="danger" data-disable-sub="${item.id}">停用</button></div></article>`).join('') : '<div class="vsm-empty">尚未添加订阅。可以一键添加推荐订阅，导入前会先显示兼容性。</div>'}</section>`;
    }

    function sourceCards() {
        const sources = state.management?.sources || [];
        return `<section class="vsm-section"><div class="vsm-section-head"><div><span>ENABLED SOURCES</span><h3>数据源列表</h3><p>先配置并测试来源，Episode 播放时只查询已启用的数据源。</p></div></div><div class="vsm-source-list">${sources.length ? sources.map((source, index) => `<article class="vsm-source-card ${source.enabled ? 'enabled' : ''}"><div class="vsm-source-icon">${esc((source.name || '?').slice(0, 1))}</div><div class="vsm-source-copy"><div><b>${esc(source.name)}</b><span class="vsm-badge">${esc(source.factoryId)}</span><span class="vsm-badge ${compatClass(source.compatibility)}">${compatText(source.compatibility)}</span></div><p>${esc(source.description || '暂无说明')}</p><small>${esc(source.healthState || 'UNTESTED')}${source.healthMessage ? ` · ${esc(source.healthMessage)}` : ''}${source.definitionStatus === 'REMOVED' ? ' · 订阅已移除' : ''}</small></div><div class="vsm-source-actions"><label><input type="checkbox" data-source-enabled="${source.instanceId}" ${source.enabled ? 'checked' : ''} ${source.definitionStatus === 'REMOVED' ? 'disabled' : ''}>启用</label><button data-source-move="${source.instanceId}" data-order="${Math.max(0, source.sortOrder - 10)}" ${index === 0 ? 'disabled' : ''}>↑</button><button data-source-move="${source.instanceId}" data-order="${source.sortOrder + 10}" ${index === sources.length - 1 ? 'disabled' : ''}>↓</button><button data-source-config="${source.instanceId}">配置</button><button data-source-test="${source.instanceId}">测试</button></div></article>`).join('') : '<div class="vsm-empty">暂无数据源，请先添加订阅。</div>'}</div>${state.editingSourceId ? sourceConfigPanel(sources.find(source => String(source.instanceId) === String(state.editingSourceId))) : ''}${state.test ? testPanel(state.test) : ''}</section>`;
    }

    function sourceConfigPanel(source) {
        if (!source) return '';
        const config = source.configuration || {};
        return `<aside class="vsm-config"><div class="vsm-section-head"><div><span>SOURCE CONFIG</span><h3>${esc(source.name)}</h3><p>保存后可直接测试，再到 Episode 中选择该来源播放。</p></div><button data-vsm="close-config">关闭</button></div><div class="vsm-config-grid"><label><span>启用来源</span><input type="checkbox" data-config-enabled ${source.enabled ? 'checked' : ''}></label><label><span>播放优先级</span><input type="number" min="0" step="10" data-config-order value="${source.sortOrder}"></label><label class="wide"><span>搜索地址</span><input value="${esc(config.searchUrl || '由 Provider 内部管理')}" readonly></label><label><span>作品解析</span><input value="${esc(config.subjectFormat || source.factoryId)}" readonly></label><label><span>剧集解析</span><input value="${esc(config.channelFormat || 'Provider 默认')}" readonly></label><label><span>默认清晰度</span><input value="${esc(config.defaultResolution || '自动')}" readonly></label><label><span>播放方式</span><input value="${config.directPlayback ? '优先直放，失败跳转源站' : '跳转源站或资源发现'}" readonly></label></div><div class="vsm-config-note">订阅中的 Cookie 和自定义请求头不会被转发；选择器配置会保留并在本地受限执行。</div><div class="vsm-config-actions"><button data-vsm="save-config">保存配置</button><button class="primary" data-vsm="save-test">保存并测试</button></div></aside>`;
    }

    function testPanel(result) {
        return `<aside class="vsm-test"><div class="vsm-section-head"><div><span>STEP TEST</span><h3>数据源测试</h3></div><button data-vsm="close-test">关闭</button></div>${result.steps.map(step => `<div class="vsm-test-step ${String(step.status).toLowerCase()}"><b>${esc(step.name)}</b><span>${esc(step.status)}</span><p>${esc(step.message)}</p></div>`).join('')}</aside>`;
    }

    function renderManager() {
        const shell = ensureManager();
        shell.innerHTML = `<header class="vsm-head"><div><span>VIDEO TAGGER / v0.23</span><h2>数据源管理</h2><p>配置一次，Episode 播放时自动查询和选择。</p></div><button data-vsm="close">关闭</button></header><div class="vsm-layout"><nav><button class="${state.tab === 'subscriptions' ? 'active' : ''}" data-vsm-tab="subscriptions">数据源订阅</button><button class="${state.tab === 'sources' ? 'active' : ''}" data-vsm-tab="sources">数据源列表</button><button data-vsm="templates">添加模板</button></nav><main>${state.tab === 'subscriptions' ? subscriptionCards() : sourceCards()}</main></div>`;
        bindManager(shell);
    }

    function bindManager(shell) {
        shell.querySelector('[data-vsm="close"]')?.addEventListener('click', closeManager);
        shell.querySelectorAll('[data-vsm-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.vsmTab; state.test = null; renderManager(); }));
        shell.querySelector('[data-vsm="add-subscription"]')?.addEventListener('click', addCustomSubscription);
        shell.querySelector('[data-vsm="recommended"]')?.addEventListener('click', showRecommended);
        shell.querySelector('[data-vsm="templates"]')?.addEventListener('click', showTemplates);
        shell.querySelector('[data-vsm="close-test"]')?.addEventListener('click', () => { state.test = null; renderManager(); });
        shell.querySelector('[data-vsm="close-config"]')?.addEventListener('click', () => { state.editingSourceId = null; renderManager(); });
        shell.querySelectorAll('[data-refresh-sub]').forEach(button => button.addEventListener('click', () => mutate(`/api/video-source-management/subscriptions/${button.dataset.refreshSub}/refresh`, { method: 'POST' })));
        shell.querySelectorAll('[data-disable-sub]').forEach(button => button.addEventListener('click', () => mutate(`/api/video-source-management/subscriptions/${button.dataset.disableSub}`, { method: 'DELETE' })));
        shell.querySelectorAll('[data-source-enabled]').forEach(input => input.addEventListener('change', () => updateSource(input.dataset.sourceEnabled, { enabled: input.checked })));
        shell.querySelectorAll('[data-source-move]').forEach(button => button.addEventListener('click', () => updateSource(button.dataset.sourceMove, { sortOrder: Number(button.dataset.order) })));
        shell.querySelectorAll('[data-source-test]').forEach(button => button.addEventListener('click', () => testSource(button.dataset.sourceTest)));
        shell.querySelectorAll('[data-source-config]').forEach(button => button.addEventListener('click', () => { state.editingSourceId = button.dataset.sourceConfig; state.test = null; renderManager(); }));
        shell.querySelector('[data-vsm="save-config"]')?.addEventListener('click', () => saveSourceConfig(false));
        shell.querySelector('[data-vsm="save-test"]')?.addEventListener('click', () => saveSourceConfig(true));
    }

    function showVsmDialog(title, message, actions) {
        const existing = document.getElementById('vsm-dialog');
        existing?.remove();
        const dialog = document.createElement('div');
        dialog.id = 'vsm-dialog';
        dialog.className = 'vsm-dialog-backdrop';
        dialog.innerHTML = `<div class="vsm-dialog" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(message)}</p><div class="vsm-dialog-actions">${actions.map(action => `<button data-vsm-dialog-action="${esc(action.value)}" class="${action.primary ? 'primary' : ''}">${esc(action.label)}</button>`).join('')}</div></div>`;
        document.body.appendChild(dialog);
        return new Promise(resolve => {
            dialog.querySelectorAll('[data-vsm-dialog-action]').forEach(button => button.addEventListener('click', () => {
                dialog.remove();
                resolve(button.dataset.vsmDialogAction);
            }));
        });
    }
    async function saveSourceConfig(runTest) {
        const shell = ensureManager();
        const enabled = shell.querySelector('[data-config-enabled]')?.checked;
        const sortOrder = Number(shell.querySelector('[data-config-order]')?.value || 1000);
        const id = state.editingSourceId;
        await updateSource(id, { enabled, sortOrder });
        state.editingSourceId = null;
        if (runTest) await testSource(id);
    }

    async function mutate(url, options) {
        try { state.management = await api(url, options); renderManager(); } catch (error) { alert(error.message); }
    }

    async function updateSource(id, body) {
        await mutate(`/api/video-source-management/sources/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }

    async function testSource(id) {
        const keyword = prompt('测试关键字', '败犬女主太多了！');
        if (keyword == null) return;
        try {
            state.test = { steps: [{ name: '准备测试', status: 'RUNNING', message: '正在执行分步验证' }] };
            renderManager();
            state.test = await api(`/api/video-source-management/sources/${id}/test?keyword=${encodeURIComponent(keyword)}`, { method: 'POST' });
            renderManager();
        } catch (error) { alert(error.message); }
    }

    async function addSubscription(url, name) {
        try {
            const preview = await api('/api/video-source-management/subscriptions/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
            const message = `发现 ${preview.sourceCount} 个数据源\n完全兼容 ${preview.compatibleCount}\n部分兼容 ${preview.partialCount}\n暂不兼容 ${preview.unsupportedCount}\n\n新增来源默认禁用，确认添加？`;
            if (await showVsmDialog('确认添加订阅', message, [{ value: 'cancel', label: '取消' }, { value: 'confirm', label: '确认添加', primary: true }]) !== 'confirm') return;
            state.management = await api('/api/video-source-management/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name, url, refreshIntervalMinutes: 60 }) });
            state.tab = 'sources';
            renderManager();
        } catch (error) { alert(`订阅添加失败：${error.message}`); }
    }

    function addCustomSubscription() {
        const url = prompt('Animeko 数据源订阅地址（HTTPS）');
        if (!url) return;
        addSubscription(url, '自定义数据源订阅');
    }

    function showRecommended() {
        showVsmDialog('选择推荐订阅', 'Animeko 推荐订阅会先预览兼容性，新增来源默认关闭。', [
            { value: 'bt', label: 'RSS / BT 订阅', primary: true },
            { value: 'css', label: 'Web Selector 订阅', primary: true },
            { value: 'cancel', label: '取消' }
        ]).then(choice => {
            if (choice === 'bt') addSubscription('https://sub.creamycake.org/v1/bt1.json', 'Animeko RSS/BT');
            if (choice === 'css') addSubscription('https://sub.creamycake.org/v1/css1.json', 'Animeko Web Selector');
        });
    }

    function showTemplates() {
        alert('当前模板能力：\nRSS：可导入、测试和资源发现\nWeb Selector：可导入和兼容性检查\nJellyfin：可选，仍通过部署配置启用；未配置时不会出现或参与播放');
    }

    window.v023QuickPlayEpisode = async function (episodeId, title) {
        const panel = document.getElementById('ep-quick-play-panel');
        if (!panel) return;
        clearInterval(state.quickTimer);
        state.lockedCandidateId = null;
        state.quickTitle = title || '本集';
        panel.hidden = false;
        panel.innerHTML = `<div class="eqp-loading"><b>${esc(title)}</b><span>正在启动已启用数据源…</span></div>`;
        try {
            state.quick = await api(`/api/episodes/${episodeId}/quick-play`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            renderQuick();
            state.quickTimer = setInterval(pollQuick, 500);
        } catch (error) {
            panel.innerHTML = `<div class="eqp-error">无法开始播放：${esc(error.message)} <button data-eqp-close>关闭</button></div>`;
            panel.querySelector('[data-eqp-close]').onclick = () => panel.hidden = true;
        }
    };

    async function pollQuick() {
        if (!state.quick) return;
        try {
            state.quick = await api(`/api/video-source-quick-play/${state.quick.sessionId}`);
            renderQuick();
            if (['NOT_FOUND', 'NO_SOURCES', 'NO_PLAYABLE_SOURCE'].includes(state.quick.status) || state.quick.completed >= state.quick.total) clearInterval(state.quickTimer);
        } catch (_) { clearInterval(state.quickTimer); }
    }

    function renderQuick() {
        const panel = document.getElementById('ep-quick-play-panel');
        const session = state.quick;
        if (!panel || !session) return;
        const selected = state.lockedCandidateId ? session.candidates.find(item => item.id === state.lockedCandidateId) : session.selected;
        const player = selected?.playMode === 'DIRECT'
            ? `<div class="eqp-ready"><span>DIRECT PLAYBACK READY</span><b>${esc(selected.providerName)} · ${esc(selected.itemTitle || selected.packageTitle)}</b><p>${esc(selected.quality || '未知清晰度')} · 地址仅用于当前短期播放会话。</p><div class="eqp-player-actions"><button data-eqp-open-player="${selected.id}">进入播放与打标</button><button data-eqp-materialize="${selected.id}">仅固定为 VideoAsset</button><a data-eqp-open href="${esc(selected.sourcePageUrl)}" target="_blank" rel="noopener">打开源站</a></div></div>`
            : selected?.playMode === 'EXTERNAL'
                ? `<div class="eqp-external"><span>EXTERNAL PLAYBACK</span><b>${esc(selected.providerName)} · ${esc(selected.itemTitle || selected.packageTitle)}</b><p>该来源未暴露浏览器可直放地址，可跳转源站继续播放。</p><a data-eqp-open href="${esc(selected.sourcePageUrl)}" target="_blank" rel="noopener">打开源站播放</a></div>`
                : '<div class="eqp-wait">候选仍在返回；可直放或可跳转来源会自动出现在下方。</div>';
        panel.innerHTML = `<div class="eqp-head"><div><b>播放源选择</b><span>${session.status} · 已完成 ${session.completed}/${session.total}</span></div><button data-eqp-close>关闭</button></div>${player}<div class="eqp-grid"><section><h4>播放候选</h4>${session.candidates.length ? session.candidates.map(item => `<button class="eqp-candidate ${selected?.id === item.id ? 'active' : ''}" data-candidate="${item.id}" ${item.playMode === 'UNAVAILABLE' ? 'disabled' : ''}><b>${esc(item.providerName)} · ${esc(item.itemTitle || item.packageTitle)}</b><span>${esc(item.quality || '未知清晰度')} · ${item.playMode === 'DIRECT' ? '直接播放' : item.playMode === 'EXTERNAL' ? '源站播放' : esc(item.state)}</span><small>${esc(item.message || '')}</small></button>`).join('') : '<p>候选仍在返回中…</p>'}</section><section><h4>数据源状态</h4>${session.attempts.map(item => `<div class="eqp-attempt"><b>${esc(item.providerName)}</b><span>${esc(item.status)}</span><small>${esc(item.message)}</small></div>`).join('')}</section></div>`;
        panel.querySelector('[data-eqp-close]').onclick = () => { clearInterval(state.quickTimer); panel.hidden = true; panel.innerHTML = ''; };
        panel.querySelector('[data-eqp-open-player]')?.addEventListener('click', () => {
            clearInterval(state.quickTimer);
            state.lockedCandidateId = selected.id;
            const params = new URLSearchParams({
                sessionId: session.sessionId,
                episodeId: String(session.episodeId),
                candidateId: selected.id,
                title: state.quickTitle || '本集'
            });
            const player = window.open(`/player.html?${params}`, `video-tagger-player-${session.episodeId}`, 'popup,width=1500,height=900');
            if (!player) window.v023OpenPlayerWorkbench?.({ panel, episodeId: session.episodeId, title: state.quickTitle, sessionId: session.sessionId, session, candidateId: selected.id });
        });
        panel.querySelector('[data-eqp-materialize]')?.addEventListener('click', async button => {
            try {
                const asset = await api(`/api/video-source-quick-play/${session.sessionId}/materialize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: button.currentTarget.dataset.eqpMaterialize }) });
                button.currentTarget.textContent = `已固定 · Asset ${asset.id}`;
                button.currentTarget.disabled = true;
            } catch (error) { alert(`固定失败：${error.message}`); }
        });
        panel.querySelectorAll('[data-candidate]').forEach(button => button.addEventListener('click', async () => {
            state.quick = await api(`/api/video-source-quick-play/${session.sessionId}/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: button.dataset.candidate }) });
            state.lockedCandidateId = button.dataset.candidate;
            renderQuick();
        }));
    }

    function statusText(status) { return ({ READY: '更新成功', FAILED: '更新失败', DISABLED: '已停用', PENDING: '等待首次更新' })[status] || status; }
    function compatText(value) { return ({ SUPPORTED: '可执行', PARTIAL: '部分兼容', UNSUPPORTED: '暂不兼容', UNSAFE: '已阻止' })[value] || value; }
    function compatClass(value) { return value === 'SUPPORTED' ? 'good' : value === 'PARTIAL' ? 'warn' : 'bad'; }

    document.querySelectorAll('[data-settings-cat]').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('[data-settings-cat]').forEach(item => item.classList.toggle('active', item === button));
        document.querySelectorAll('.settings-section').forEach(section => section.hidden = section.id !== `settings-section-${button.dataset.settingsCat}`);
    }));
    document.getElementById('open-video-source-management')?.addEventListener('click', () => {
        document.getElementById('settings-modal').hidden = true;
        window.v023OpenSourceManagement();
    });
})();
