(function () {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const fmt = value => {
        if (value == null || !Number.isFinite(value)) return '--:--.---';
        const total = Math.max(0, Math.round(value));
        const ms = String(total % 1000).padStart(3, '0');
        const seconds = Math.floor(total / 1000);
        return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${ms}`;
    };
    const sec = value => fmt(Number(value || 0) * 1000).slice(0, 5);

    async function api(url, options) {
        const response = await fetch(url, options);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
        return body;
    }

    window.v023OpenPlayerWorkbench = function (options) {
        const state = {
            panel: options.panel,
            episodeId: options.episodeId,
            title: options.title || '本集',
            sessionId: options.sessionId,
            session: options.session,
            candidateId: options.candidateId,
            assetByCandidate: new Map(),
            savedClips: [],
            startMs: null,
            endMs: null,
            timer: null,
            mediaId: null,
            duration: 0,
            loopClip: false,
            standalone: Boolean(options.standalone)
        };
        renderShell(state);
        loadEpisodeContext(state);
        loadCandidate(state, selectedCandidate(state), false);
        pollSession(state);
    };

    function selectedCandidate(state) {
        return state.session?.candidates?.find(item => item.id === state.candidateId) || state.session?.selected;
    }

    function renderShell(state) {
        state.panel.innerHTML = `<div class="vpw-shell vpw-immersive" tabindex="0">
            <header class="vpw-head">
                <div class="vpw-heading"><span>片段播放工作台</span><h3>${esc(state.title)}</h3><small id="vpw-source-label">正在准备播放…</small></div>
                <div class="vpw-head-actions"><button type="button" class="btn-mini" data-vpw="sources">来源</button><button type="button" class="btn-mini" data-vpw="close">关闭</button></div>
            </header>
            <div class="vpw-layout">
                <main class="vpw-stage">
                    <div class="vpw-screen" data-vpw="screen">
                        <video id="vpw-video" playsinline preload="metadata"></video>
                        <div class="vpw-video-top"><span id="vpw-mode-badge">SOURCE</span><span id="vpw-resolution"></span></div>
                        <button type="button" class="vpw-center-play" data-vpw="play" aria-label="播放或暂停">▶</button>
                        <div id="vpw-video-state" class="vpw-video-state">选择可直放候选后开始</div>
                    </div>
                    <div class="vpw-timeline-wrap">
                        <div class="vpw-timeline" id="vpw-timeline-track"><div class="vpw-timeline-range" id="vpw-timeline-range"></div><div class="vpw-timeline-marker start" id="vpw-marker-start"></div><div class="vpw-timeline-marker end" id="vpw-marker-end"></div><div id="vpw-saved-markers"></div><input id="vpw-timeline" type="range" min="0" max="1" value="0" step="0.001" aria-label="视频时间轴"></div>
                        <div class="vpw-time-row"><output id="vpw-current">00:00.000</output><span id="vpw-duration">--:--</span></div>
                    </div>
                    <div class="vpw-transport" aria-label="播放控制">
                        <button type="button" class="vpw-icon-button" data-vpw="back" title="后退 5 秒">−5</button>
                        <button type="button" class="vpw-icon-button primary" data-vpw="play" title="播放或暂停">▶</button>
                        <button type="button" class="vpw-icon-button" data-vpw="forward" title="前进 5 秒">+5</button>
                        <span class="vpw-transport-divider"></span><button type="button" class="btn-mini" data-vpw="start">设起点 <kbd>I</kbd></button><button type="button" class="btn-mini" data-vpw="point">当前点 <kbd>M</kbd></button><button type="button" class="btn-mini" data-vpw="end">设终点 <kbd>O</kbd></button>
                        <span class="vpw-transport-spacer"></span><label class="vpw-inline-select">倍速<select id="vpw-speed"><option>0.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>2</option></select></label><button type="button" class="btn-mini" data-vpw="mute">静音</button><button type="button" class="btn-mini" data-vpw="fullscreen">全屏</button>
                    </div>
                </main>
                <aside class="vpw-side vpw-inspector">
                    <section class="vpw-inspector-section vpw-clip-editor"><div class="vpw-side-title"><span>当前 Clip</span><b id="vpw-range-state">草稿</b></div><div class="vpw-range"><span>起点 <b id="vpw-start">未设置</b></span><span>终点 <b id="vpw-end">未设置</b></span><button type="button" class="btn-mini" data-vpw="clear-range">清空</button></div><div class="vpw-fields"><label>标题<input id="vpw-title" value="${esc(state.title)}"></label><label>标签<input id="vpw-tag" list="vpw-tag-suggestions" placeholder="必填，例如：高燃"><datalist id="vpw-tag-suggestions"></datalist></label><label class="wide">备注<textarea id="vpw-note" rows="3" placeholder="人物、台词、用途或剪辑说明"></textarea></label></div><div class="vpw-save-row"><span id="vpw-save-state">I / O 设置区间，M 保存当前点。</span><button type="button" class="btn-primary" data-vpw="save">保存 Clip</button></div></section>
                    <section class="vpw-inspector-section"><div class="vpw-side-title"><span>已保存 Clips</span><b id="vpw-clip-count">0</b></div><div id="vpw-saved-clips" class="vpw-saved-clips"><p class="vpw-muted">正在读取…</p></div></section>
                    <section class="vpw-inspector-section vpw-source-drawer"><div class="vpw-side-title"><span>播放来源</span><b id="vpw-query-state"></b></div><div id="vpw-candidates"></div></section>
                    <details class="vpw-diagnostics"><summary>解析诊断</summary><div id="vpw-attempts"></div></details>
                </aside>
            </div>
        </div>`;
        bind(state);
        renderSide(state);
        renderRange(state);
    }

    function bind(state) {
        const root = state.panel.querySelector('.vpw-shell');
        const video = root.querySelector('#vpw-video');
        root.querySelectorAll('[data-vpw="close"]').forEach(button => button.addEventListener('click', () => close(state)));
        root.querySelector('[data-vpw="sources"]').addEventListener('click', () => root.querySelector('.vpw-source-drawer').classList.toggle('is-open'));
        root.querySelectorAll('[data-vpw="play"]').forEach(button => button.addEventListener('click', () => togglePlay(state)));
        root.querySelector('[data-vpw="back"]').addEventListener('click', () => seek(video, -5));
        root.querySelector('[data-vpw="forward"]').addEventListener('click', () => seek(video, 5));
        root.querySelector('[data-vpw="start"]').addEventListener('click', () => setStart(state));
        root.querySelector('[data-vpw="point"]').addEventListener('click', () => setPoint(state));
        root.querySelector('[data-vpw="end"]').addEventListener('click', () => setEnd(state));
        root.querySelector('[data-vpw="clear-range"]').addEventListener('click', () => clearRange(state));
        root.querySelector('[data-vpw="save"]').addEventListener('click', () => saveClip(state));
        root.querySelector('[data-vpw="mute"]').addEventListener('click', () => { video.muted = !video.muted; root.querySelector('[data-vpw="mute"]').textContent = video.muted ? '取消静音' : '静音'; });
        root.querySelector('[data-vpw="fullscreen"]').addEventListener('click', () => root.querySelector('[data-vpw="screen"]').requestFullscreen?.());
        root.querySelector('#vpw-speed').addEventListener('change', event => { video.playbackRate = Number(event.target.value); });
        root.querySelector('#vpw-timeline').addEventListener('input', event => { if (Number.isFinite(video.duration)) video.currentTime = Number(event.target.value); });
        root.querySelector('#vpw-tag').addEventListener('input', event => suggestTags(state, event.target.value));
        root.querySelector('#vpw-note').addEventListener('keydown', event => { if (event.ctrlKey && event.key === 'Enter') saveClip(state); });
        root.addEventListener('keydown', event => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
            if (event.key.toLowerCase() === 'i') { event.preventDefault(); setStart(state); }
            if (event.key.toLowerCase() === 'o') { event.preventDefault(); setEnd(state); }
            if (event.key.toLowerCase() === 'm') { event.preventDefault(); setPoint(state); }
            if (event.key === ' ') { event.preventDefault(); togglePlay(state); }
        });
        video.addEventListener('timeupdate', () => updateCurrent(state));
        video.addEventListener('loadedmetadata', () => { state.duration = Number.isFinite(video.duration) ? video.duration * 1000 : 0; root.querySelector('#vpw-duration').textContent = sec(video.duration); updateCurrent(state); });
        video.addEventListener('play', () => updatePlayButtons(state, true));
        video.addEventListener('pause', () => updatePlayButtons(state, false));
        video.addEventListener('ended', () => { if (state.loopClip && state.startMs != null) { video.currentTime = state.startMs / 1000; video.play().catch(() => {}); } });
        video.addEventListener('error', () => setVideoState(state, classifyPlaybackError(video.error), true));
    }

    async function loadEpisodeContext(state) {
        try {
            const episode = await api(`/api/episodes/${state.episodeId}`);
            state.mediaId = episode.mediaId || null;
            state.savedClips = await api(`/api/episodes/${state.episodeId}/clips`);
            renderSavedClips(state);
            renderTimelineMarkers(state);
        } catch (error) {
            state.savedClips = [];
            renderSavedClips(state);
        }
    }

    function loadCandidate(state, candidate, userSelected) {
        if (!candidate || candidate.playMode !== 'DIRECT') return;
        state.candidateId = candidate.id;
        const video = state.panel.querySelector('#vpw-video');
        state.panel.querySelector('#vpw-source-label').textContent = `${candidate.providerName} · ${candidate.itemTitle || candidate.packageTitle} · ${candidate.quality || '未知清晰度'}`;
        state.panel.querySelector('#vpw-mode-badge').textContent = candidate.matchLevel || 'MATCHED';
        state.panel.querySelector('#vpw-resolution').textContent = candidate.quality || '';
        setVideoState(state, '正在加载媒体…');
        video.src = candidate.playbackUrl || `/api/video-source-quick-play/${state.sessionId}/candidates/${candidate.id}/stream`;
        video.playbackRate = Number(state.panel.querySelector('#vpw-speed').value);
        video.load();
        video.play().catch(() => setVideoState(state, '浏览器阻止自动播放，请点击播放按钮。'));
        if (userSelected) setSaveState(state, '已切换来源；不同版本时间码不会自动继承。');
        renderSide(state);
    }

    function togglePlay(state) {
        const video = state.panel.querySelector('#vpw-video');
        if (video.paused) video.play().catch(() => setVideoState(state, '请点击视频中央播放。'));
        else video.pause();
    }

    function updatePlayButtons(state, playing) {
        state.panel.querySelectorAll('[data-vpw="play"]').forEach(button => { button.textContent = playing ? '❚❚' : '▶'; });
        state.panel.querySelector('.vpw-center-play').classList.toggle('is-hidden', playing);
    }

    function seek(video, seconds) { if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds)); }

    function currentMs(state) { return (state.panel.querySelector('#vpw-video').currentTime || 0) * 1000; }
    function setStart(state) { state.startMs = currentMs(state); if (state.endMs != null && state.endMs <= state.startMs) state.endMs = null; renderRange(state); setSaveState(state, `起点已设为 ${fmt(state.startMs)}。`); }
    function setEnd(state) { const value = currentMs(state); if (state.startMs != null && value <= state.startMs) { setSaveState(state, '终点必须晚于起点。', true); return; } state.endMs = value; renderRange(state); setSaveState(state, `终点已设为 ${fmt(state.endMs)}。`); }
    function setPoint(state) { state.startMs = currentMs(state); state.endMs = null; renderRange(state); setSaveState(state, `当前点已设为 ${fmt(state.startMs)}，保存后可继续创建下一个 Clip。`); }
    function clearRange(state) { state.startMs = null; state.endMs = null; renderRange(state); setSaveState(state, '区间已清空。'); }

    function updateCurrent(state) {
        const video = state.panel.querySelector('#vpw-video');
        const value = currentMs(state);
        state.panel.querySelector('#vpw-current').textContent = fmt(value);
        const timeline = state.panel.querySelector('#vpw-timeline');
        if (Number.isFinite(video.duration)) { timeline.max = video.duration; timeline.value = video.currentTime; }
        renderRange(state);
    }

    function renderRange(state) {
        const root = state.panel;
        root.querySelector('#vpw-start').textContent = state.startMs == null ? '未设置' : fmt(state.startMs);
        root.querySelector('#vpw-end').textContent = state.endMs == null ? '未设置' : fmt(state.endMs);
        root.querySelector('#vpw-range-state').textContent = state.startMs == null ? '草稿' : state.endMs == null ? '点标记' : '区间';
        const duration = state.duration || 0;
        const range = root.querySelector('#vpw-timeline-range');
        const start = root.querySelector('#vpw-marker-start');
        const end = root.querySelector('#vpw-marker-end');
        if (duration > 0 && state.startMs != null) { start.style.left = `${Math.min(100, state.startMs / duration * 100)}%`; start.hidden = false; } else start.hidden = true;
        if (duration > 0 && state.endMs != null) { end.style.left = `${Math.min(100, state.endMs / duration * 100)}%`; end.hidden = false; } else end.hidden = true;
        if (duration > 0 && state.startMs != null && state.endMs != null) { range.style.left = `${state.startMs / duration * 100}%`; range.style.width = `${Math.max(0, (state.endMs - state.startMs) / duration * 100)}%`; range.hidden = false; } else range.hidden = true;
    }

    function renderTimelineMarkers(state) {
        const host = state.panel.querySelector('#vpw-saved-markers');
        const duration = state.duration;
        host.innerHTML = duration ? state.savedClips.map(clip => { const start = Number(clip.startMs ?? (clip.timestampSec || 0) * 1000); return `<i class="vpw-saved-marker" style="left:${Math.min(100, start / duration * 100)}%" title="${esc(clip.title || clip.tag || 'Clip')}"></i>`; }).join('') : '';
    }

    function renderSavedClips(state) {
        state.panel.querySelector('#vpw-clip-count').textContent = state.savedClips.length;
        state.panel.querySelector('#vpw-saved-clips').innerHTML = state.savedClips.length ? state.savedClips.map(clip => { const start = Number(clip.startMs ?? (clip.timestampSec || 0) * 1000); const end = clip.endMs ?? (clip.endSec == null ? null : Number(clip.endSec) * 1000); return `<button type="button" class="vpw-saved-clip" data-vpw-clip="${clip.id}"><span>${esc(clip.title || '未命名 Clip')}</span><small>${esc(clip.tag || '未分类')} · ${fmt(start)}${end == null ? '' : ` → ${fmt(end)}`}</small></button>`; }).join('') : '<p class="vpw-muted">还没有保存的 Clip。</p>';
        state.panel.querySelectorAll('[data-vpw-clip]').forEach(button => button.addEventListener('click', () => { const clip = state.savedClips.find(item => String(item.id) === button.dataset.vpwClip); if (!clip) return; const video = state.panel.querySelector('#vpw-video'); const start = Number(clip.startMs ?? (clip.timestampSec || 0) * 1000); video.currentTime = start / 1000; state.startMs = start; state.endMs = clip.endMs ?? (clip.endSec == null ? null : Number(clip.endSec) * 1000); state.loopClip = true; renderRange(state); setSaveState(state, '已定位到 Clip，播放结束后循环该区间。'); video.play().catch(() => {}); }));
    }

    async function saveClip(state) {
        const candidate = selectedCandidate(state);
        if (!candidate || candidate.playMode !== 'DIRECT') { setSaveState(state, '当前候选不能在应用内保存 Clip。', true); return; }
        const tag = state.panel.querySelector('#vpw-tag').value.trim();
        const title = state.panel.querySelector('#vpw-title').value.trim() || state.title;
        const note = state.panel.querySelector('#vpw-note').value.trim();
        const startMs = state.startMs == null ? currentMs(state) : state.startMs;
        const endMs = state.endMs;
        if (!tag) { setSaveState(state, '请先填写标签。', true); state.panel.querySelector('#vpw-tag').focus(); return; }
        if (endMs != null && endMs <= startMs) { setSaveState(state, '终点必须晚于起点。', true); return; }
        const button = state.panel.querySelector('[data-vpw="save"]'); button.disabled = true; setSaveState(state, '正在固定来源并保存 Clip…');
        try {
            let assetId = state.assetByCandidate.get(candidate.id);
            if (!assetId) { const asset = await api(`/api/video-source-quick-play/${state.sessionId}/materialize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: candidate.id }) }); assetId = asset.id; state.assetByCandidate.set(candidate.id, assetId); }
            const saved = await api(`/api/episodes/${state.episodeId}/video-assets/${assetId}/clips`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, startMs, endMs, tag, note }) });
            if (saved && saved.id) state.savedClips.unshift(saved);
            state.startMs = null; state.endMs = null; state.loopClip = false; state.panel.querySelector('#vpw-tag').value = ''; state.panel.querySelector('#vpw-note').value = ''; renderRange(state); renderSavedClips(state); renderTimelineMarkers(state); setSaveState(state, `Clip 已保存：${fmt(startMs)}${endMs == null ? '' : ` → ${fmt(endMs)}`}，可以继续标记。`);
            window.loadEpisodeDetail?.(state.episodeId);
            try { const channel = new BroadcastChannel('video-tagger-player'); channel.postMessage({ type: 'clip-saved', episodeId: state.episodeId }); channel.close(); } catch (_) {}
        } catch (error) { setSaveState(state, `保存失败：${error.message}`, true); } finally { button.disabled = false; }
    }

    function renderSide(state) {
        const current = selectedCandidate(state);
        state.panel.querySelector('#vpw-query-state').textContent = `${state.session.completed}/${state.session.total}`;
        state.panel.querySelector('#vpw-candidates').innerHTML = state.session.candidates.length ? state.session.candidates.map(candidate => { const active = current?.id === candidate.id ? ' active' : ''; const disabled = candidate.playMode === 'UNAVAILABLE' ? ' disabled' : ''; const action = candidate.playMode === 'EXTERNAL' ? `<a href="${esc(candidate.sourcePageUrl)}" target="_blank" rel="noopener">打开源站</a>` : ''; return `<article class="vpw-candidate${active}${disabled}"><button type="button" data-vpw-candidate="${candidate.id}" ${disabled ? 'disabled' : ''}><b>${esc(candidate.providerName)} · ${esc(candidate.itemTitle || candidate.packageTitle)}</b><span>${esc(candidate.quality || '未知清晰度')} · ${esc(candidate.matchLevel || '未标记')}</span><small>${esc(candidate.matchReason || candidate.message || '')}</small></button>${action}</article>`; }).join('') : '<p class="vpw-muted">候选仍在返回中…</p>';
        state.panel.querySelector('#vpw-attempts').innerHTML = state.session.attempts.map(attempt => `<div class="vpw-attempt"><b>${esc(attempt.providerName)}</b><span>${esc(attempt.status)}</span><small>${esc(attempt.message || '')}</small></div>`).join('');
        state.panel.querySelectorAll('[data-vpw-candidate]').forEach(button => button.addEventListener('click', async () => { const candidate = state.session.candidates.find(item => item.id === button.dataset.vpwCandidate); if (!candidate || candidate.playMode !== 'DIRECT') return; try { state.session = await api(`/api/video-source-quick-play/${state.sessionId}/select`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: candidate.id }) }); loadCandidate(state, candidate, true); } catch (error) { setSaveState(state, `切换失败：${error.message}`, true); } }));
    }

    function pollSession(state) { clearInterval(state.timer); if (state.session.completed >= state.session.total) return; state.timer = setInterval(async () => { try { state.session = await api(`/api/video-source-quick-play/${state.sessionId}`); renderSide(state); if (state.session.completed >= state.session.total) clearInterval(state.timer); } catch (_) { clearInterval(state.timer); } }, 800); }
    async function suggestTags(state, prefix) { const value = prefix.trim(); if (!value) return; try { const suffix = state.mediaId ? `&mediaId=${state.mediaId}` : ''; const tags = await api(`/api/tags?prefix=${encodeURIComponent(value)}&limit=8${suffix}`); state.panel.querySelector('#vpw-tag-suggestions').innerHTML = tags.map(tag => `<option value="${esc(tag.tag || tag)}"></option>`).join(''); } catch (_) {} }
    function setVideoState(state, message, error) { const element = state.panel.querySelector('#vpw-video-state'); element.textContent = message || ''; element.hidden = !message; element.classList.toggle('error', Boolean(error)); }
    function setSaveState(state, message, error) { const element = state.panel.querySelector('#vpw-save-state'); element.textContent = message; element.classList.toggle('error', Boolean(error)); }
    function classifyPlaybackError(error) { const code = error?.code; if (code === 1) return '播放已取消。'; if (code === 2) return '网络中断：请重试或切换来源。'; if (code === 3) return '媒体编码或容器不受浏览器支持。'; if (code === 4) return '来源格式不支持，HLS/DASH、登录态或 DRM 资源不能在此播放器中直放。'; return '媒体加载失败：请切换来源或打开源站。'; }
    function close(state) { clearInterval(state.timer); if (state.standalone) window.close(); else state.panel.innerHTML = ''; }
})();
