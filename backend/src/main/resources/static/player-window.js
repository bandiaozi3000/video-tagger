(async function () {
    const root = document.getElementById('player-workbench-root');
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('sessionId');
    const episodeId = Number(params.get('episodeId'));
    const candidateId = params.get('candidateId');
    const title = params.get('title') || '本集';
    if (!sessionId || !episodeId || !candidateId) {
        root.innerHTML = '<div class="player-window-loading">播放参数不完整，请返回 Episode 重新选择来源。</div>';
        return;
    }
    try {
        const response = await fetch(`/api/video-source-quick-play/${encodeURIComponent(sessionId)}`);
        const session = await response.json();
        if (!response.ok) throw new Error(session.message || `HTTP ${response.status}`);
        window.v023OpenPlayerWorkbench({ root, panel: root, episodeId, title, sessionId, session, candidateId, standalone: true });
    } catch (error) {
        root.innerHTML = `<div class="player-window-loading">无法打开播放窗口：${String(error.message || error)}</div>`;
    }
})();
