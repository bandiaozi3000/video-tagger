/**
 * 「🖼 设置封面」tab（2026-09-29）。
 *
 * 挂在导出弹窗里（与「📋 导出清单」同一个按钮的两个 tab），不另起页面：
 * 素材（`config.mediaClips`）与文字（`config.title/subtitle`）本来就在这个编辑器里。
 *
 * 预览与导出**共用同一棵 DOM + 同一份 CSS**：预览是它按比例缩放，导出是把
 * `canvasRef.current.outerHTML` + `coverCss(COVER_FONT_TOKEN)` 交给后端跑 Chrome。
 * 所以这里不要在画布上挂任何交互/状态（抓下来就是最终画面）。
 */
import React from 'react';
import { api, type ClipBrief, type EditorConfig, type MediaBrief } from '../api';
import { defaultFilter } from '../state';
import { CoverCanvas } from './CoverCanvas';
import { coverCss, COVER_FONT_TOKEN } from './cover-css';
import {
  coverWarnings, LAYOUTS, layoutById, mergeCoverConfig, pickLayout, resolveLayout, sanitizeCover,
  type CoverAnchor, type CoverConfig, type CoverFrame,
} from './cover-model';

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** 预览画布宽度：默认值只是首帧用，真实宽度由容器量出来（见下面的 ResizeObserver）。 */
const PREVIEW_FALLBACK_WIDTH = 700;

const ANCHORS: { id: CoverAnchor; label: string }[] = [
  { id: 'top-left', label: '↖' }, { id: 'top-center', label: '↑' }, { id: 'top-right', label: '↗' },
  { id: 'mid-left', label: '←' }, { id: 'center', label: '·' }, { id: 'mid-right', label: '→' },
  { id: 'bottom-left', label: '↙' }, { id: 'bottom-center', label: '↓' }, { id: 'bottom-right', label: '↘' },
];

const EFFECTS: { id: CoverConfig['effect']; label: string; hint: string }[] = [
  { id: 'plain', label: '普通压底', hint: '白字 + 渐层（缩略图最稳）' },
  { id: 'r8', label: '双层重影', hint: '白字 + 错位色字（R8，默认）' },
  { id: 'vertical', label: '竖排', hint: 'writing-mode 竖排（标题建议 ≤10 字）' },
];

interface Props {
  config: EditorConfig;
  patch: (patch: Partial<EditorConfig>) => void;
}

export function CoverTab({ config, patch }: Props) {
  const [cover, setCover] = React.useState<CoverConfig>(() => mergeCoverConfig(config.cover));
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  /**
   * 预览宽度**跟着容器走**（2026-09-29 用户反馈「显示有问题」）。
   *
   * 原先把预览写死 700px，而弹窗是三栏网格（参数 372 + 预览 700 + 素材 296）：
   * 窗口一窄（1280/1440 屏 + 96vw 上限）总宽就超过弹窗，右栏被挤出可视区 ——
   * 用户看到的正是「素材栏只剩一半、媒体名前几个字被切掉」。
   */
  const [previewWidth, setPreviewWidth] = React.useState(PREVIEW_FALLBACK_WIDTH);
  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const apply = () => setPreviewWidth(element.clientWidth || PREVIEW_FALLBACK_WIDTH);
    apply();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(element);
    window.addEventListener('resize', apply);
    return () => { observer?.disconnect(); window.removeEventListener('resize', apply); };
  }, []);
  const [medias, setMedias] = React.useState<MediaBrief[]>([]);
  const [clips, setClips] = React.useState<Record<number, ClipBrief[]>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ url: string; bytes: number } | null>(null);
  const [templates, setTemplates] = React.useState<{ id: number; name: string; config: string }[]>([]);
  const [templateName, setTemplateName] = React.useState('');
  const [toast, setToast] = React.useState<string | null>(null);

  const update = (next: Partial<CoverConfig>) => {
    // 每次改动都写回草稿（用户 2026-09-29 拍板「参数随草稿存」）→ 下次打开弹窗回填上次的选择
    const merged = sanitizeCover({ ...cover, ...next });
    setCover(merged);
    patch({ cover: merged });
    setResult(null);
  };

  // 媒体标题（分组用）
  React.useEffect(() => {
    if (config.ids.length === 0) { setMedias([]); return; }
    let cancelled = false;
    api.media({ limit: config.ids.length, offset: 0, filter: defaultFilter(), ids: config.ids })
      .then((list) => { if (!cancelled) setMedias(list); })
      .catch(() => { if (!cancelled) setMedias([]); });
    return () => { cancelled = true; };
  }, [config.ids.join(',')]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 片段列表（每个已选媒体一次请求；数量不大，够用）
  React.useEffect(() => {
    let cancelled = false;
    Promise.all(config.ids.map((id) => api.clips(id).then((list) => [id, list] as const).catch(() => [id, []] as const)))
      .then((pairs) => { if (!cancelled) setClips(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [config.ids.join(',')]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 首次：预勾「草稿已挂载的片段」（= 已选媒体的 mediaClips.order），没有则勾前几张
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current || config.ids.length === 0 || Object.keys(clips).length === 0) return;
    if (cover.frames.length > 0) { seeded.current = true; return; }
    const mounted = config.ids.flatMap((id) => config.mediaClips[String(id)]?.order ?? []);
    const all = config.ids.flatMap((id) => (clips[id] ?? []).map((clip) => clip.id));
    const pick = (mounted.length > 0 ? mounted : all).filter((id) => all.includes(id)).slice(0, 9);
    seeded.current = true;
    if (pick.length > 0) update({ frames: pick, layout: pickLayout(Math.min(pick.length, 9)) });
  }, [clips]);   // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = () => {
    api.coverTemplates().then(setTemplates).catch(() => setTemplates([]));
  };

  const title = cover.title.trim() || config.title.trim();
  const subtitle = cover.subtitle.trim() || config.subtitle.trim();
  // 画布吃的是"封面参数"，文字允许空着 → 用草稿标题兜底（但不写回参数，草稿改了仍可跟随）
  const canvasConfig = React.useMemo<CoverConfig>(
    () => ({ ...cover, title, subtitle }), [cover, title, subtitle]);

  const frames: CoverFrame[] = React.useMemo(() => {
    const byId = new Map<number, { mediaId: number; mediaTitle: string; clip: ClipBrief }>();
    config.ids.forEach((mediaId) => {
      (clips[mediaId] ?? []).forEach((clip) => byId.set(clip.id, {
        mediaId, mediaTitle: medias.find((m) => m.id === mediaId)?.title ?? `#${mediaId}`, clip,
      }));
    });
    return cover.frames
      .map((id) => {
        const hit = byId.get(id);
        if (!hit) return null;
        return {
          clipId: id,
          mediaId: hit.mediaId,
          mediaTitle: hit.mediaTitle,
          clipTitle: hit.clip.title ?? '',
          // 预览用缩略图（快）；导出时后端自动升级到 -xl（见 CoverRenderService.resolveCover）
          url: hit.clip.coverPath || `/covers/clip/${id}.jpg`,
        } satisfies CoverFrame;
      })
      .filter((frame): frame is CoverFrame => frame !== null);
  }, [cover.frames, clips, medias, config.ids]);

  const { layout, degraded } = resolveLayout(cover.layout, frames.length);
  const warnings = coverWarnings({ ...cover, title, subtitle });
  const scale = previewWidth / 1920;

  const toggleFrame = (clipId: number) => {
    const next = cover.frames.includes(clipId)
      ? cover.frames.filter((id) => id !== clipId)
      : [...cover.frames, clipId];
    update({ frames: next });
  };

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((value) => (value === message ? null : value)), 2200);
  };

  const doExport = async () => {
    const element = canvasRef.current;
    if (!element) return;
    if (frames.length === 0) { setError('先勾至少一张片段封面'); return; }
    setBusy(true);
    setError(null);
    try {
      const out = await api.coverExport({
        html: element.outerHTML,
        css: coverCss(COVER_FONT_TOKEN),
        name: config.title || title || 'cover',
      });
      setResult({ url: out.url, bytes: out.bytes });
      flash('封面已导出');
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    if (!name) { setError('给模板起个名字'); return; }
    try {
      // 模板只存参数，**不含具体片段**（每次用时重新勾）
      const { frames: _frames, ...params } = cover;
      await api.coverSaveTemplate(name, JSON.stringify(params));
      setTemplateName('');
      loadTemplates();
      flash(`已存为「${name}」`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存模板失败');
    }
  };

  const applyTemplate = (config: string) => {
    try {
      const parsed = JSON.parse(config) as Partial<CoverConfig>;
      update(parsed);
      flash('已套用模板参数（片段保持当前勾选）');
    } catch {
      setError('模板内容无法解析');
    }
  };

  const clipRows = () => config.ids.map((mediaId) => {
    const media = medias.find((m) => m.id === mediaId);
    const list = clips[mediaId] ?? [];
    if (list.length === 0) return null;
    return (
      <div className="vt-cover-media" key={mediaId}>
        <div className="vt-cover-media-title"><span>{media?.title ?? `#${mediaId}`}</span><i>{list.length}</i></div>
        <div className="vt-cover-clips">
          {list.map((clip) => {
            const on = cover.frames.includes(clip.id);
            const url = clip.coverPath || `/covers/clip/${clip.id}.jpg`;
            const order = cover.frames.indexOf(clip.id);
            return (
              <button type="button" key={clip.id} title={clip.title ?? String(clip.id)}
                      className={cls('vt-cover-clip', on && 'on')} onClick={() => toggleFrame(clip.id)}>
                <img src={url} alt="" loading="lazy"
                     onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
                <span className="vt-cover-clip-no">{order >= 0 ? order + 1 : ''}</span>
                <i className="vt-cover-clip-title">{clip.title || `片段 ${clip.id}`}</i>
              </button>
            );
          })}
        </div>
      </div>
    );
  });

  return (
    <div className="vt-cover">
      <div className="vt-cover-left">
        <div className="vt-cover-head">版式<span className="sp" />
          <button type="button" className="btn-mini" onClick={() => update({ layout: pickLayout(Math.min(cover.frames.length, 9)) })}>
            按张数自动选
          </button>
        </div>
        <div className="vt-cover-layouts">
          {LAYOUTS.map((item) => {
            const disabled = item.needs > frames.length;
            return (
              <button type="button" key={item.id} title={`${item.hint}（需 ${item.needs} 张）`}
                      className={cls('vt-cover-layout', layout.id === item.id && 'on', disabled && 'off')}
                      onClick={() => update({ layout: item.id })}>
                <b>{item.name}</b><small>{item.needs} 张</small>
              </button>
            );
          })}
        </div>
        {degraded ? (
          <div className="vt-cover-warn"><i>张数不够「{layoutById(cover.layout).name}」，已按 {layout.name} 出图</i></div>
        ) : null}

        <div className="vt-cover-head">文字</div>
        <textarea className="vt-cover-input" rows={2} value={cover.title} placeholder={config.title || '主标题'}
                  onChange={(event) => update({ title: event.target.value })} />
        <input className="vt-cover-input" value={cover.subtitle} placeholder={config.subtitle || '副标题'}
               onChange={(event) => update({ subtitle: event.target.value })} />
        <label className="vt-inline"><input type="checkbox" checked={cover.subtitleBelow}
               onChange={(event) => update({ subtitleBelow: event.target.checked })} />副标题放标题下方</label>

        <div className="vt-cover-head">位置</div>
        <div className="vt-cover-anchors">
          {ANCHORS.map((item) => (
            <button type="button" key={item.id} className={cls('vt-cover-anchor', cover.anchor === item.id && 'on')}
                    onClick={() => update({ anchor: item.id })}>{item.label}</button>
          ))}
        </div>
        <div className="vt-cover-row">
          <select className="vt-cover-input" value={cover.align}
                  onChange={(event) => update({ align: event.target.value as CoverConfig['align'] })}>
            <option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option>
          </select>
          <label className="vt-hint">偏移 X<input type="range" min={-200} max={200} value={cover.offsetX}
                 onChange={(event) => update({ offsetX: Number(event.target.value) })} /></label>
          <label className="vt-hint">Y<input type="range" min={-200} max={200} value={cover.offsetY}
                 onChange={(event) => update({ offsetY: Number(event.target.value) })} /></label>
        </div>

        <div className="vt-cover-head">文字处理</div>
        <div className="vt-cover-row">
          {EFFECTS.map((item) => (
            <button type="button" key={item.id} title={item.hint}
                    className={cls('vt-cover-fx', cover.effect === item.id && 'on')}
                    onClick={() => update({ effect: item.id })}>{item.label}</button>
          ))}
        </div>
        <div className="vt-cover-row">
          <label className="vt-hint">字号<input type="range" min={88} max={150} step={4} value={cover.titleSize}
                 onChange={(event) => update({ titleSize: Number(event.target.value) })} /></label>
          <label className="vt-hint">重影<input type="range" min={0} max={8} value={cover.ghostOffset}
                 disabled={cover.effect !== 'r8'}
                 onChange={(event) => update({ ghostOffset: Number(event.target.value) })} /></label>
          <label className="vt-hint">强调色<input type="color" value={cover.accent}
                 onChange={(event) => update({ accent: event.target.value })} /></label>
        </div>

        <div className="vt-cover-head">常用模板</div>
        <div className="vt-cover-row">
          <input className="vt-cover-input" placeholder="模板名" value={templateName}
                 onChange={(event) => setTemplateName(event.target.value)} />
          <button type="button" className="btn-mini" onClick={saveTemplate}>存为模板</button>
        </div>
        <div className="vt-cover-templates">
          {templates.length === 0 ? <span className="vt-hint">还没有常用模板</span> : null}
          {templates.map((item) => (
            <span className="vt-cover-tag" key={item.id}>
              <button type="button" className="vt-cover-tag-apply" onClick={() => applyTemplate(item.config)}>{item.name}</button>
              <button type="button" className="vt-cover-tag-del" title="删除"
                      onClick={() => api.coverDeleteTemplate(item.id).then(loadTemplates)}>✕</button>
            </span>
          ))}
        </div>
      </div>

      <div className="vt-cover-mid">
        <div className="vt-cover-viewport" ref={viewportRef}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 1920, height: 1080 }}>
            {/* ⚠️ 这块 DOM 会被 outerHTML 抓去出图：不要挂交互与状态 */}
            <CoverCanvas config={canvasConfig} frames={frames} canvasRef={canvasRef} />
          </div>
        </div>
        <div className="vt-cover-meta">
          <span>{frames.length} 张素材 · {layout.name}{degraded ? '（降级）' : ''} · {title ? `标题「${title}」` : '未填标题'}</span>
        </div>
        {warnings.map((warning) => (
          <div className={cls('vt-cover-warn', warning.level === 'warn' && 'bad')} key={warning.text}><i>{warning.text}</i></div>
        ))}
        {error ? <div className="vt-cover-warn bad"><i>{error}</i></div> : null}
        <div className="vt-cover-actions">
          <button type="button" className="btn-mini vt-cover-go" disabled={busy || frames.length === 0} onClick={doExport}>
            {busy ? '出图中…' : '导出封面'}
          </button>
          <span className="vt-hint">1920×1080 · JPEG</span>
          {result ? (
            <>
              <span className="sp" />
              <a className="vt-cover-download" href={result.url} download={`${config.title || 'cover'}.jpg`}>下载封面</a>
              <span className="vt-hint">{(result.bytes / 1024).toFixed(0)} KB</span>
            </>
          ) : null}
        </div>
        {toast ? <div className="vt-cover-toast">{toast}</div> : null}
      </div>

      <div className="vt-cover-right">
        <div className="vt-cover-head">素材（片段封面）<span className="sp" />
          <button type="button" className="btn-mini" onClick={() => update({ frames: [] })}>清空</button>
        </div>
        <div className="vt-cover-clip-list">
          {config.ids.length === 0 ? <span className="vt-hint">先在「已选」里选几部媒体，或用下面的片段库加选</span> : clipRows()}
        </div>
      </div>
    </div>
  );
}
