const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const semanticHint = document.getElementById('semantic-hint');

function fmtTime(sec) {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

async function doSearch(e) {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    statusEl.textContent = '搜索中…';
    resultsEl.innerHTML = '';
    try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await resp.json();
        semanticHint.hidden = data.semanticEnabled;
        renderResults(data.results);
        statusEl.textContent = data.results.length ? `共 ${data.results.length} 条结果` : '没有找到相关片段';
    } catch (err) {
        statusEl.textContent = '搜索失败：后端未响应，请确认服务已启动';
    }
}

function renderResults(results) {
    const maxScore = Math.max(...results.map(r => r.score), 0.0001);
    for (const r of results) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-title"></div>
            <div>
                <span class="badge-time">${fmtTime(r.timestampSec)}</span>
                <span class="card-tag"></span>
            </div>
            <div class="score-bar"><div style="width:${Math.round(r.score / maxScore * 100)}%"></div></div>`;
        card.querySelector('.card-title').textContent = r.title;
        card.querySelector('.card-tag').textContent = r.tag + (r.note ? ` · ${r.note}` : '');
        card.addEventListener('click', () => jump(r));
        resultsEl.appendChild(card);
    }
}

async function jump(r) {
    try {
        await fetch('/api/jump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: r.url, timestampSec: r.timestampSec })
        });
    } catch (err) { /* 跳转队列失败不阻塞打开页面 */ }
    window.open(r.jumpUrl, '_blank');
}

form.addEventListener('submit', doSearch);
clearBtn.addEventListener('click', () => { input.value = ''; resultsEl.innerHTML = ''; statusEl.textContent = ''; input.focus(); });
