/**
 * 编辑器面板：工具栏 / 媒体篮子 / Inspector（阶段 1 为扁平参数面板；阶段 3 再按对象轴重排）。
 *
 * 交互约定：所有改动通过 `patch` 写回配置 → 本地参数即时生效（见 `state.ts`）。
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { api, type CandidateFilter, type ClipBrief, type EditorConfig, type MediaBrief, type MediaClips, type MediaFormatBrief } from './api';
import { defaultFilter, fileToBase64, fileToDataUri, loadGroupOpen, parsePayload, saveGroupOpen } from './state';
import { THEME_PRESETS } from '../src/theme';

type Patch = (patch: Partial<EditorConfig>) => void;

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/**
 * 对象轴/参数分组：受控折叠（开关状态由 `InspectorPane` 持有并持久化）。
 *
 * `forceOpen` = 参数搜索跳过来时强制展开并滚到可视区（前缀匹配，兼容「导出变体（N）」这类动态标题）。
 */
function Group({ id, title, kicker, right, children, open, onToggle, forceOpen = null }: {
  id: string;
  title: string;
  kicker?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  onToggle: (id: string) => void;
  /** 待跳转的分组名；匹配上就展开 + 滚动。 */
  forceOpen?: string | null;
}) {
  const rootRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (!forceOpen || !title.startsWith(forceOpen)) return;
    if (!open) onToggle(id);
    rootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [forceOpen, title, open, id, onToggle]);
  return (
    <section ref={rootRef} className={cls('vt-sec', open && 'open')}>
      <button type="button" className="vt-sec-h" onClick={() => onToggle(id)}>
        <span className="lb">{kicker ? <em>{kicker}</em> : null}{title}</span>
        <span className="cw">{right}{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div className="vt-sec-b">{children}</div> : null}
    </section>
  );
}

/**
 * 浮层：portal 到 body、按锚点定位、点外部/`Esc`/滚动/缩放关闭。
 *
 * 工具栏（状态/导出/主题）、左栏 `⋯`、筛选面板共用这一份实现（以前每处各写一套定位）。
 */
function Pop({ anchor, width = 300, onClose, children }: {
  anchor: React.RefObject<HTMLElement | null>;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  React.useLayoutEffect(() => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + 6, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)) });
  }, [anchor, width]);
  React.useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [anchor, onClose]);
  if (!pos) return null;
  return createPortal(
    <div ref={ref} className="vt-pop" style={{ top: pos.top, left: pos.left, width }}>{children}</div>,
    document.body,
  );
}

/** 主题预设色板（用预设自身的色值做缩略，不另维护一份色表）。 */
function presetSwatch(preset: (typeof THEME_PRESETS)[number]): string {
  const colors = preset.tokens.colors ?? {};
  return `linear-gradient(135deg, ${colors.pink ?? '#ff4d8d'}, ${colors.blue ?? colors.sky ?? '#a78bfa'}, ${colors.gold ?? '#35d6f2'})`;
}

/** 字段：标签在上、控件满宽（v0.29 起不再左右挤压）；`hl` = 与当前选中对象相关，左侧亮竖线。 */
function Field({ label, hint, hl, children }: { label: string; hint?: string; hl?: boolean; children: React.ReactNode }) {
  return (
    <div className={cls('vt-field', hl && 'hl')}>
      <span className="vt-field-label">{label}</span>
      <span className="vt-field-control">{children}</span>
      {hint ? <span className="vt-hint">{hint}</span> : null}
    </div>
  );
}

/** 秒 → m:ss（抬头卡状态胶囊用）。 */
function formatClock(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function Range({ value, onChange, min, max, step = 1, suffix }: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(event) => onChange(Number(event.target.value))} />
      <span className="vt-range-val">{value}{suffix ?? ''}</span>
    </>
  );
}

/** 抬头卡（v0.29）：状态胶囊 + 主操作（只留一个主按钮）+ 设置条。 */
/**
 * 工具条（52px，取代 v0.29 的 224px 抬头卡）。
 *
 * 只留常改的两项（形态、主题）+ 主操作；状态详情、导出设置/变体/任务全部改成按需弹层。
 * 副标题文案、状态胶囊（分辨率/素材就绪/自动暂存）都下沉到弹层或异常态（缺素材才常驻变红）。
 */
export function Toolbar({ config, patch, onExport, onExportAll, variantCount, onOpenTasks, onOpenTemplates, onOpenVariants, onOpenSearch, busy, meta }: {
  config: EditorConfig;
  patch: Patch;
  onExport: () => void;
  onExportAll: () => void;
  variantCount: number;
  onOpenTasks: () => void;
  onOpenTemplates: () => void;
  /** 跳到右栏「导出变体」组（参数搜索/弹层共用）。 */
  onOpenVariants: () => void;
  onOpenSearch: () => void;
  busy: boolean;
  meta: { seconds: number | null; frames: number | null; missingCount: number; savedAt: string | null };
}) {
  const [pop, setPop] = React.useState<'export' | 'info' | 'theme' | null>(null);
  const themeRef = React.useRef<HTMLButtonElement>(null);
  const infoRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLButtonElement>(null);
  const preset = THEME_PRESETS.find((item) => item.id === config.preset) ?? THEME_PRESETS[0];
  const empty = config.ids.length === 0;

  return (
    <header className="vt-toolbar">
      <span className="vt-tb-title">推荐工作台</span>
      <span className="vt-tb-stat">
        已选 <b>{config.ids.length}</b> 部
        {meta.frames !== null ? <> · <b>{formatClock(meta.seconds)}</b> · <b>{meta.frames}</b> 帧</> : null}
      </span>

      <span className="vt-tb-sp" />

      <div className="vt-seg" title="推荐形态">
        <button type="button" className={config.groupStyle === 'chapter' ? 'on' : ''}
                onClick={() => patch({ groupStyle: 'chapter' })}>章节式</button>
        <button type="button" className={config.groupStyle === 'clip' ? 'on' : ''}
                onClick={() => patch({ groupStyle: 'clip' })}>片段放映</button>
      </div>

      <button ref={themeRef} type="button" className="btn-mini vt-tb-btn" data-vt="theme" title="主题预设（画面立即重排）"
              onClick={() => setPop(pop === 'theme' ? null : 'theme')}>
        <i className="vt-swatch" style={{ background: presetSwatch(preset) }} />{preset.name} ▾
      </button>

      <button ref={infoRef} type="button" className={cls('btn-mini', 'vt-tb-btn', meta.missingCount > 0 && 'warn')}
              data-vt="status"
              title={meta.missingCount > 0 ? '有素材缺失' : '状态详情'}
              onClick={() => setPop(pop === 'info' ? null : 'info')}>
        {meta.missingCount > 0 ? `⚠ 缺失 ${meta.missingCount}` : 'ⓘ'}
      </button>

      <button type="button" className="btn-mini vt-tb-btn" data-vt="search" title="参数搜索（Ctrl+K）" onClick={onOpenSearch}>⌕</button>

      <span className="vt-tb-sp" />

      <button type="button" className="btn-primary" disabled={busy || empty} onClick={onExport}>
        {busy ? '提交中…' : '▶ 导出视频'}
      </button>
      <button ref={menuRef} type="button" className="btn-mini vt-tb-btn" data-vt="export-menu" disabled={empty} title="导出设置 / 变体 / 任务"
              onClick={() => setPop(pop === 'export' ? null : 'export')}>▾</button>

      {pop === 'theme' ? (
        <Pop anchor={themeRef} width={260} onClose={() => setPop(null)}>
          <h4>主题预设</h4>
          {THEME_PRESETS.map((item) => (
            <button key={item.id} type="button" className={cls('vt-pop-item', config.preset === item.id && 'on')}
                    title={item.note}
                    onClick={() => { patch({ preset: item.id }); setPop(null); }}>
              <i className="vt-swatch" style={{ background: presetSwatch(item) }} />
              <span>{item.name}</span><span className="sp" />
              {config.preset === item.id ? <small>当前</small> : null}
            </button>
          ))}
        </Pop>
      ) : null}

      {pop === 'info' ? (
        <Pop anchor={infoRef} width={286} onClose={() => setPop(null)}>
          <h4>状态</h4>
          {meta.missingCount > 0 ? (
            <div className="vt-pop-kv warn"><span className="vt-dot" />素材缺失<span className="sp" /><b>{meta.missingCount} 项</b></div>
          ) : (
            <div className="vt-pop-kv"><span className="vt-dot ok" />素材<span className="sp" /><b>全部就绪</b></div>
          )}
          <div className="vt-pop-kv"><span className="vt-dot live" />草稿<span className="sp" /><b>{meta.savedAt ? `自动暂存 ${meta.savedAt}` : '自动暂存'}</b></div>
          <div className="vt-pop-kv"><span className="vt-dot" />预估时长<span className="sp" /><b>{meta.frames !== null ? `${formatClock(meta.seconds)} · ${meta.frames} 帧` : '—'}</b></div>
          <div className="vt-pop-kv"><span className="vt-dot" />输出<span className="sp" /><b>{config.resolution} · {config.format}</b></div>
          <p className="vt-pop-note">正常状态不占地方：只有「素材缺失」会常驻在工具条上变红。</p>
        </Pop>
      ) : null}

      {pop === 'export' ? (
        <Pop anchor={menuRef} width={300} onClose={() => setPop(null)}>
          <h4>导出设置</h4>
          <div className="vt-pop-kv"><span>画质</span><span className="sp" />
            <select value={config.resolution} onChange={(event) => patch({ resolution: event.target.value })}>
              <option value="720P">720P</option><option value="1080P">1080P</option><option value="4K">4K</option>
            </select>
          </div>
          <div className="vt-pop-kv"><span>封装</span><span className="sp" />
            <select value={config.format} onChange={(event) => patch({ format: event.target.value })}>
              <option value="MP4">MP4</option><option value="WEBM">WEBM</option>
            </select>
          </div>
          <div className="vt-rule" />
          <h4>变体（{variantCount}）</h4>
          <button type="button" className="vt-pop-item" onClick={() => { setPop(null); onOpenVariants(); }}>
            <span>{variantCount > 0 ? '编辑导出变体' : '＋ 新建变体'}</span><span className="sp" /><small>右栏</small>
          </button>
          <button type="button" className="vt-pop-item" disabled={busy || empty} onClick={() => { setPop(null); onExportAll(); }}>
            <span>导出全部变体</span><span className="sp" /><small>串行队列</small>
          </button>
          <div className="vt-rule" />
          <h4>其他</h4>
          <button type="button" className="vt-pop-item" onClick={() => { setPop(null); onOpenTemplates(); }}>
            <span>模板 · 保存 / 套用</span><span className="sp" /><small>含筛选</small>
          </button>
          <button type="button" className="vt-pop-item" onClick={() => { setPop(null); onOpenTasks(); }}>
            <span>导出任务</span><span className="sp" /><small>2s 轮询</small>
          </button>
        </Pop>
      ) : null}
    </header>
  );
}

/** 参数搜索索引：只指向**稳定标题**的组（对象组随选中变，不列）。 */
const PARAM_INDEX: { label: string; group: string }[] = [
  { label: '标题文案', group: '内容 · 主题' }, { label: '左上角角标', group: '内容 · 主题' },
  { label: '副标题', group: '内容 · 主题' }, { label: '简介 / 序言页', group: '内容 · 主题' },
  { label: '序言标题', group: '内容 · 主题' }, { label: '结尾标题', group: '内容 · 主题' }, { label: '结尾文案', group: '内容 · 主题' },
  { label: '分组方式 / 排序', group: '页面展示与交互' }, { label: '每屏 N 部', group: '页面展示与交互' },
  { label: '开局封面大小', group: '页面展示与交互' }, { label: '开场加载速度', group: '页面展示与交互' },
  { label: '结尾滚动速度', group: '页面展示与交互' },
  { label: '显示时长（开场/序言/章节/资料卡/结尾）', group: '时长与显示' }, { label: '详情显示开关', group: '时长与显示' },
  { label: '开场代表秀', group: '开场代表秀' }, { label: '自定义开场封面', group: '开场代表秀' },
  { label: '导出变体', group: '导出变体' },
  { label: '添加音频 / BGM 曲目', group: '背景音乐（BGM）' }, { label: '音乐条缩放', group: '背景音乐（BGM）' },
  { label: '音乐条位置 X / Y', group: '背景音乐（BGM）' },
  { label: '背景图', group: '背景层' }, { label: '纯色背景', group: '背景层' }, { label: '背景轮换间隔', group: '背景层' },
  { label: '背景透明度 / 模糊度 / 亮度', group: '背景层' },
];

/** 参数搜索面板（`Ctrl+K`）：参数按需收起后，靠它直达。 */
export function ParamPalette({ onClose, onJump }: { onClose: () => void; onJump: (group: string) => void }) {
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { inputRef.current?.focus(); }, []);
  const q = query.trim();
  const hits = PARAM_INDEX.filter((item) => !q || item.label.includes(q) || item.group.includes(q));
  return (
    <div className="vt-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="vt-palette" onMouseDown={(event) => event.stopPropagation()}>
        <input ref={inputRef} value={query} placeholder="搜索参数（如：时长 / 亮度 / 结尾 / BGM）…"
               onChange={(event) => setQuery(event.target.value)}
               onKeyDown={(event) => { if (event.key === 'Enter' && hits[0]) onJump(hits[0].group); }} />
        <ul>
          {hits.length === 0 ? <li className="vt-hint">没有匹配的参数</li> : hits.map((item) => (
            <li key={item.label}>
              <button type="button" onClick={() => onJump(item.group)}>
                <span>{item.label}</span><span className="sp" /><small>{item.group}</small>
              </button>
            </li>
          ))}
        </ul>
        <p className="vt-hint"><span className="kbd">回车</span> 跳第一个 · <span className="kbd">Esc</span> 关闭</p>
      </div>
    </div>
  );
}

/** 选中对象标题。 */
function selectionHeader(selection: import('./timeline').Selection,
                         media: { title: string } | null,
                         clip: { title: string } | null): string {
  if (selection.kind === 'clip' && clip) return `当前片段 · ${clip.title}`;
  if (selection.kind === 'media' && media) return `当前媒体 · ${media.title}`;
  if (selection.kind === 'scene') return '当前段';
  return '全局设置';
}

/** 把某部媒体在推荐顺序里上/下移一位。 */
function moveMedia(config: EditorConfig, patch: Patch, mediaId: number, delta: number): void {
  const index = config.ids.indexOf(mediaId);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= config.ids.length) return;
  const ids = [...config.ids];
  [ids[index], ids[next]] = [ids[next], ids[index]];
  patch({ ids });
}

/**
 * 片段选择器（篮子与 Inspector 共用，避免两份实现）：候选片段 → 播放顺序 → 字幕条内容。
 * 片段列表按媒体懒加载（`/api/clips/media/{id}`）。
 */
export function ClipPicker({ mediaId, title, config, onClips }: {
  mediaId: number;
  title: string;
  config: EditorConfig;
  onClips: (clips: MediaClips) => void;
}) {
  const [clips, setClips] = React.useState<ClipBrief[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    api.clips(mediaId).then((list) => !cancelled && setClips(list)).catch(() => !cancelled && setClips([]));
    return () => { cancelled = true; };
  }, [mediaId]);

  const current: MediaClips = config.mediaClips[String(mediaId)] ?? { order: [] };
  const badge = current.badge ?? {};

  const setOrder = (order: number[]) => onClips({ order, badge: current.badge });
  const swap = (index: number, delta: number) => {
    const order = [...current.order];
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setOrder(order);
  };

  if (clips === null) return <p className="vt-hint">读取片段…</p>;
  if (clips.length === 0) return <p className="vt-hint">「{title}」没有片段</p>;

  return (
    <div className="vt-clip-picker">
      <div className="vt-clip-candidates">
        {clips.map((clip) => {
          const picked = current.order.includes(clip.id);
          return (
            <label key={clip.id} className="vt-clip-item">
              <input type="checkbox" checked={picked} onChange={() =>
                setOrder(picked ? current.order.filter((id) => id !== clip.id) : [...current.order, clip.id])} />
              <span>{clip.title || `片段 #${clip.id}`}</span>
              <span className="vt-hint">{clip.timestampSec ?? '?'}s</span>
            </label>
          );
        })}
      </div>
      {current.order.length > 0 ? (
        <div className="vt-clip-order">
          <div className="vt-hint">播放顺序（{current.order.length}）</div>
          {current.order.map((clipId, index) => (
            <div key={clipId} className="vt-clip-order-row">
              <span>{index + 1}. {clips.find((clip) => clip.id === clipId)?.title ?? `#${clipId}`}</span>
              <span>
                <button type="button" className="btn-mini" onClick={() => swap(index, -1)}>↑</button>
                <button type="button" className="btn-mini" onClick={() => swap(index, 1)}>↓</button>
              </span>
            </div>
          ))}
          <div className="vt-clip-badges">
            <span className="vt-hint">字幕条</span>
            {([['mediaTitle', '媒体名'], ['clipTitle', '片段名'], ['index', '序号'], ['note', '备注']] as const).map(([key, label]) => (
              <label key={key} className="vt-inline">
                <input type="checkbox" checked={Boolean(badge[key])} onChange={(event) =>
                  onClips({ order: current.order, badge: { ...badge, [key]: event.target.checked } })} />
                {label}
              </label>
            ))}
            <input className="vt-badge-custom" placeholder="自定义文案" value={badge.custom ?? ''}
                   onChange={(event) => onClips({ order: current.order, badge: { ...badge, custom: event.target.value } })} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** BGM 条就地编辑浮层（设计规格 §6.4）：拖拽改 x/y、角柄拖拽改缩放。
 *  浮层只活在这一层（编辑器页面），不进成片——`Root.tsx` / `render-recommend.ts` 都不引用它。
 *  坐标映射：成片里 BGM 条定位是 `left: bgmX%、bottom: bgmY%`（左上为原点，y 自下而上）。 */
export function BgmOverlay({ config, patch, shellRef }: {
  config: EditorConfig;
  patch: Patch;
  shellRef: React.RefObject<HTMLDivElement | null>;
}) {
  const drag = React.useRef<{ mode: 'move' | 'scale'; x: number; y: number; bx: number; by: number; bscale: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const start = (mode: 'move' | 'scale') => (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, x: event.clientX, y: event.clientY, bx: config.bgmX, by: config.bgmY, bscale: config.bgmScale };
    setDragging(true);
  };

  const move = (event: React.PointerEvent<HTMLSpanElement>) => {
    const state = drag.current;
    const box = shellRef.current?.getBoundingClientRect();
    if (!state || !box) return;
    if (state.mode === 'move') {
      const nextX = state.bx + ((event.clientX - state.x) / Math.max(1, box.width)) * 100;
      const nextY = state.by - ((event.clientY - state.y) / Math.max(1, box.height)) * 100;
      patch({ bgmX: Math.round(clamp(nextX, 0, 100)), bgmY: Math.round(clamp(nextY, 0, 100)) });
    } else {
      const delta = ((event.clientX - state.x) / Math.max(1, box.width)) * 200;
      patch({ bgmScale: Math.round(clamp(state.bscale + delta, 50, 200)) });
    }
  };

  const end = () => { drag.current = null; setDragging(false); };

  if (config.bgmTracks.length === 0) return null;

  return (
    <span
      className={`vt-bgm-overlay${dragging ? ' dragging' : ''}`}
      style={{ left: `${config.bgmX}%`, bottom: `${config.bgmY}%`, transform: `scale(${config.bgmScale / 100})` }}
      title="拖拽移动音乐条 · 右下角柄缩放（仅编辑时可见，不进成片）"
    >
      <span className="vt-bgm-overlay-move" onPointerDown={start('move')} onPointerMove={move}
            onPointerUp={end} onPointerCancel={end} />
      <span className="vt-bgm-overlay-scale" onPointerDown={start('scale')} onPointerMove={move}
            onPointerUp={end} onPointerCancel={end} />
    </span>
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 导出变体：具名覆盖（时长档/画幅/形态/每屏）；导出时逐个提交给现有 /video。 */
function VariantGroup({ variants, onVariants }: {
  variants: import('./api').Variant[];
  onVariants: (variants: import('./api').Variant[]) => void;
}) {
  const update = (id: string, overrides: import('./api').Variant['overrides']) =>
    onVariants(variants.map((item) => (item.id === id ? { ...item, overrides: { ...item.overrides, ...overrides } } : item)));

  return (
    <>
      <div className="vt-variants">
        {variants.map((variant) => (
          <div key={variant.id} className="vt-variant">
            <div className="vt-variant-head">
              <input value={variant.name} onChange={(event) =>
                onVariants(variants.map((item) => (item.id === variant.id ? { ...item, name: event.target.value } : item)))} />
              <button type="button" className="btn-mini"
                      onClick={() => onVariants(variants.filter((item) => item.id !== variant.id))}>✕</button>
            </div>
            <span className="vt-inline-group">
              <label className="vt-inline">清晰度
                <select value={variant.overrides.resolution ?? ''} onChange={(event) => update(variant.id, { resolution: event.target.value || undefined })}>
                  <option value="">同主配置</option>
                  <option value="720P">720P</option>
                  <option value="1080P">1080P</option>
                  <option value="4K">4K</option>
                </select>
              </label>
              <label className="vt-inline">形态
                <select value={variant.overrides.groupStyle ?? ''} onChange={(event) => update(variant.id, { groupStyle: event.target.value || undefined })}>
                  <option value="">同主配置</option>
                  <option value="chapter">章节式</option>
                  <option value="clip">片段放映式</option>
                </select>
              </label>
              <label className="vt-inline">资料卡秒数
                <input type="number" min={3} max={15} value={variant.overrides.detailSec ?? ''}
                       onChange={(event) => update(variant.id, { detailSec: event.target.value ? Number(event.target.value) : undefined })} />
              </label>
            </span>
          </div>
        ))}
      </div>
      <span className="vt-inline-group">
        <button type="button" className="btn-mini" onClick={() => onVariants([...variants, {
          id: `v${variants.length + 1}-${Math.floor(performance.now())}`,
          name: `变体 ${variants.length + 1}`,
          overrides: {},
        }])}>＋ 新增变体</button>
        <button type="button" className="btn-mini" title="完整版 + 30 秒短版" onClick={() => onVariants([
          { id: `full-${Math.floor(performance.now())}`, name: '完整版', overrides: {} },
          { id: `short-${Math.floor(performance.now())}`, name: '短版（30 秒级）', overrides: { openingSec: 2, introSec: 1, groupSec: 1, detailSec: 3, endingSec: 2 } },
        ])}>⚡ 全量 + 短版</button>
      </span>
      <p className="vt-hint">变体只覆盖写明的项，其余跟主配置；「导出全部变体」在右上角。无变体时导出按钮 = 当前配置。</p>
    </>
  );
}

/** 模板面板：保存/套用/删除（套用会带回候选筛选条件、可再重算候选）。 */
export function TemplatePanel({ onClose, notify, payload, onApply }: {
  onClose: () => void;
  notify: (message: string) => void;
  payload: () => import('./api').PresetPayload;
  onApply: (payload: import('./api').PresetPayload) => void;
}) {
  const [templates, setTemplates] = React.useState<import('./api').TemplateSummary[]>([]);
  const [name, setName] = React.useState('');

  const refresh = React.useCallback(() => {
    api.templates().then(setTemplates).catch(() => undefined);
  }, []);
  React.useEffect(refresh, [refresh]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      notify('请先填模板名');
      return;
    }
    try {
      await api.saveTemplate(trimmed, JSON.stringify(payload()));
      setName('');
      refresh();
      notify(`已保存模板「${trimmed}」`);
    } catch (error) {
      notify(error instanceof Error ? error.message : '保存失败');
    }
  };

  const apply = async (id: number) => {
    try {
      const detail = await api.templateConfig(id);
      const parsed = parsePayload(detail.config);
      if (!parsed) {
        // 旧结构（v0.28 之前的模板）：不兼容就不读；顺手给一个清理入口
        // （当前默认 profile 跑 SQLite，而 SQLite 侧迁移按冻结条款不再维护 → 旧行靠这里清）
        if (window.confirm(`模板「${detail.name}」是旧结构（v0.28 之前），不兼容。删除它吗？`)) {
          await api.deleteTemplate(id);
          refresh();
          notify('已删除旧结构模板');
        }
        return;
      }
      onApply(parsed);
      notify(`已套用模板「${detail.name}」（候选筛选一并带回）`);
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : '套用失败');
    }
  };

  return (
    <div className="vt-overlay">
      <div className="vt-panel">
        <div className="vt-panel-head">
          <strong>模板（配置 + 候选筛选 + 变体）</strong>
          <button type="button" className="btn-mini" onClick={onClose}>关闭</button>
        </div>
        <div className="vt-template-save">
          <input placeholder="模板名（如：季度回顾）" value={name} onChange={(event) => setName(event.target.value)} />
          <button type="button" className="btn-primary" onClick={() => void save()}>保存当前为模板</button>
        </div>
        <ul className="vt-task-list">
          {templates.length === 0 ? <li className="vt-hint">暂无模板</li> : null}
          {templates.map((template) => (
            <li key={template.id}>
              <span className="vt-task-title">{template.name}</span>
              <span className="vt-task-btns">
                <button type="button" className="btn-mini" onClick={() => void apply(template.id)}>套用</button>
                <button type="button" className="btn-mini"
                        onClick={() => void api.deleteTemplate(template.id).then(refresh)}>✕</button>
              </span>
            </li>
          ))}
        </ul>
        <p className="vt-hint">套用后仍可手工改；要按保存的筛选重新凑批媒体，点篮子里的「↻ 用当前筛选替换已选」。</p>
      </div>
    </div>
  );
}

/** 候选库筛选的维度定义（数组序 = chips 行与面板列表的固定序）。 */
type FilterDim = 'collectionId' | 'year' | 'format' | 'subcategoryId' | 'tagId' | 'status' | 'confirmed';

const FILTER_DIMS: { key: FilterDim; label: string }[] = [
  { key: 'collectionId', label: '收藏夹' },
  { key: 'year', label: '年份' },
  { key: 'format', label: '格式' },
  { key: 'subcategoryId', label: '子分类' },
  { key: 'tagId', label: '标签' },
  { key: 'status', label: '状态' },
  { key: 'confirmed', label: '档案' },
];

/** 状态字典唯一真值 = 后端 `MediaService.STATUSES`；中文标签沿用媒体详情页。 */
const STATUS_OPTIONS = [
  { value: 'WANT', label: '想看' },
  { value: 'WATCHING', label: '在看' },
  { value: 'DONE', label: '看完' },
  { value: 'PAUSED', label: '搁置' },
  { value: 'DROPPED', label: '弃番' },
];

interface FilterDict {
  collections: { id: number; name: string }[];
  years: number[];
  formats: MediaFormatBrief[];
  /** 展平后的子分类（`格式 › 子分类` 路径，parentId 消歧） */
  subOptions: { id: number; label: string }[];
}

function isDimActive(filter: CandidateFilter, key: FilterDim): boolean {
  if (key === 'confirmed') return filter.confirmed != null;
  if (key === 'collectionId' || key === 'subcategoryId' || key === 'tagId') return filter[key] != null;
  return String(filter[key]).trim() !== '';
}

/** 维度当前值的中文展示（chip 与面板右侧）。 */
function dimLabel(filter: CandidateFilter, key: FilterDim, dict: FilterDict): string {
  switch (key) {
    case 'collectionId': return dict.collections.find((c) => c.id === filter.collectionId)?.name ?? `收藏夹 #${filter.collectionId}`;
    case 'year': return `${filter.year} 年`;
    case 'format': return dict.formats.find((f) => f.code === filter.format)?.name ?? filter.format;
    case 'subcategoryId': return dict.subOptions.find((s) => s.id === filter.subcategoryId)?.label ?? `子分类 #${filter.subcategoryId}`;
    case 'tagId': return filter.tagName || `标签 #${filter.tagId}`;
    case 'status': return STATUS_OPTIONS.find((s) => s.value === filter.status)?.label ?? filter.status;
    case 'confirmed': return filter.confirmed === 1 ? '已确认' : '待确认';
  }
}

/** 子分类展平：`格式名 › 子分类路径`（parentId 可能是子分类，故向上拼路径）。 */
function flattenSubcategories(formats: MediaFormatBrief[]): { id: number; label: string }[] {
  const out: { id: number; label: string }[] = [];
  for (const format of formats) {
    const list = format.subcategories ?? [];
    const byId = new Map(list.map((item) => [item.id, item]));
    for (const item of list) {
      const path = [item.name];
      let parent = item.parentId != null ? byId.get(item.parentId) : undefined;
      for (let depth = 0; parent && depth < 5; depth += 1) {
        path.unshift(parent.name);
        parent = parent.parentId != null ? byId.get(parent.parentId) : undefined;
      }
      out.push({ id: item.id, label: `${format.name} › ${path.join(' › ')}` });
    }
  }
  return out;
}

/**
 * 筛选浮层：单列两段式（维度列表 → 取值列表，`‹ 返回`）。
 *
 * portal 到 body：左栏 `.vt-scroll` 是 `overflow: auto`，内联浮层会被裁剪；滚动/缩放时直接关闭（不做跟随）。
 * 取值点选立即生效（无"确定"），面板保持打开以便连加条件。
 */
function FilterPopover({ anchor, filter, onFilter, onClear, onClose, dict, hitCount, initialDim }: {
  anchor: React.RefObject<HTMLButtonElement | null>;
  filter: CandidateFilter;
  onFilter: (next: CandidateFilter) => void;
  onClear: () => void;
  onClose: () => void;
  dict: FilterDict;
  hitCount: number;
  initialDim: FilterDim | null;
}) {
  const [dim, setDim] = React.useState<FilterDim | null>(initialDim);
  const [tagText, setTagText] = React.useState('');
  const [tagHits, setTagHits] = React.useState<{ id: number; name: string }[]>([]);

  // 标签建议：250ms 防抖（不创建标签，只选既有）
  React.useEffect(() => {
    if (dim !== 'tagId') return;
    const query = tagText.trim();
    if (!query) { setTagHits([]); return; }
    const timer = window.setTimeout(() => {
      void api.tagSuggest(query).then(setTagHits).catch(() => setTagHits([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [dim, tagText]);

  const pick = (key: FilterDim, value: string | number | null) => {
    const next: CandidateFilter = { ...filter };
    switch (key) {
      case 'collectionId': next.collectionId = value as number | null; break;
      case 'year': next.year = value == null ? '' : String(value); break;
      case 'format': next.format = value == null ? '' : String(value); break;
      case 'subcategoryId': next.subcategoryId = value as number | null; break;
      case 'tagId': next.tagId = value as number | null; break;
      case 'status': next.status = value == null ? '' : String(value); break;
      case 'confirmed': next.confirmed = value as number | null; break;
    }
    onFilter(next);
  };

  const optionList = (items: { value: string | number | null; label: string }[], current: string | number | null) => (
    <div className="vt-pop-body">
      {items.map((item, index) => (
        <button key={`${String(item.value)}-${index}`} type="button"
                className={cls('vt-pop-item', item.value === current && 'on')}
                onClick={() => dim && pick(dim, item.value)}>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  const activeKeys = FILTER_DIMS.map((d) => d.key).filter((key) => isDimActive(filter, key));
  // 已设置的维度排最前（其余保持固定序），方便马上改值
  const ordered = [...FILTER_DIMS].sort((a, b) => Number(activeKeys.includes(b.key)) - Number(activeKeys.includes(a.key)));
  const dimDef = dim === null ? null : FILTER_DIMS.find((d) => d.key === dim) ?? null;

  return (
    <Pop anchor={anchor} width={308} onClose={onClose}>
      {dim === null ? (
        <>
          <div className="vt-pop-head"><span>添加筛选</span>
            <button type="button" title="关闭" onClick={onClose}>✕</button>
          </div>
          {ordered.map((d) => {
            const active = isDimActive(filter, d.key);
            return (
              <button key={d.key} type="button" className={cls('vt-pop-item', active && 'on')}
                      onClick={() => { setDim(d.key); setTagText(''); }}>
                <span>{d.label}</span>
                {active ? <small>{dimLabel(filter, d.key, dict)}</small> : null}
              </button>
            );
          })}
        </>
      ) : (
        <>
          <div className="vt-pop-head">
            <button type="button" onClick={() => { setDim(null); setTagText(''); }}>‹ 返回</button>
            <span>{dimDef?.label}</span>
          </div>
          {dim === 'tagId' ? (
            <>
              <input className="vt-pop-search" placeholder="🔍 输入标签名…" value={tagText} autoFocus
                     onChange={(event) => setTagText(event.target.value)} />
              <div className="vt-pop-body">
                <button type="button" className={cls('vt-pop-item', filter.tagId == null && 'on')}
                        onClick={() => { onFilter({ ...filter, tagId: null, tagName: '' }); setTagText(''); }}>
                  <span>不限</span>
                </button>
                {tagHits.map((tag) => (
                  <button key={tag.id} type="button" className={cls('vt-pop-item', filter.tagId === tag.id && 'on')}
                          onClick={() => { onFilter({ ...filter, tagId: tag.id, tagName: tag.name }); setTagText(''); }}>
                    <span>{tag.name}</span>
                  </button>
                ))}
                {tagText.trim() && tagHits.length === 0 ? <p className="vt-pop-note">没有这个标签（不会新建标签）</p> : null}
              </div>
            </>
          ) : dim === 'confirmed'
            ? optionList([{ value: null, label: '全部' }, { value: 1, label: '已确认' }, { value: 0, label: '待确认' }], filter.confirmed)
            : dim === 'status'
              ? optionList([{ value: null, label: '不限' }, ...STATUS_OPTIONS], filter.status || null)
              : dim === 'collectionId'
                ? optionList([{ value: null, label: '不限' }, ...dict.collections.map((c) => ({ value: c.id, label: c.name }))], filter.collectionId)
                : dim === 'year'
                  ? optionList([{ value: null, label: '不限' }, ...dict.years.map((y) => ({ value: String(y), label: `${y} 年` }))], filter.year || null)
                  : dim === 'format'
                    ? optionList([{ value: null, label: '不限' }, ...dict.formats.map((f) => ({ value: f.code, label: f.name }))], filter.format || null)
                    : optionList([{ value: null, label: '不限' }, ...dict.subOptions.map((s) => ({ value: s.id, label: s.label }))], filter.subcategoryId)}
        </>
      )}
      <div className="vt-pop-foot">
        <span>命中 <b>{hitCount}</b> 部</span>
        {activeKeys.length > 0 ? <button type="button" onClick={onClear}>清空全部</button> : null}
      </div>
    </Pop>
  );
}

/** 媒体篮子：筛选 + 分页 + 勾选 + 已选顺序 + 片段挂载。 */
export function BasketPane({ config, patch, filter, onFilter, onSelect, highlightMediaId }: {
  config: EditorConfig;
  patch: Patch;
  /** 候选筛选（提升到编辑器层：可随模板保存、套用时重算候选）。 */
  filter: CandidateFilter;
  onFilter: (filter: CandidateFilter) => void;
  /** 点卡片 = 右侧对象轴切到该媒体（参数跟着对象走）。 */
  onSelect: (selection: import('./timeline').Selection) => void;
  /** 右侧当前媒体 id（高亮对应卡片，保持两栏同步）；不传则不高亮。 */
  highlightMediaId?: number;
}) {
  const [list, setList] = React.useState<MediaBrief[]>([]);
  const [total, setTotal] = React.useState(0);
  const [collections, setCollections] = React.useState<{ id: number; name: string }[]>([]);
  const [years, setYears] = React.useState<number[]>([]);
  const [formats, setFormats] = React.useState<MediaFormatBrief[]>([]);
  const [qText, setQText] = React.useState(filter.q);
  const [popOpen, setPopOpen] = React.useState(false);
  const [popDim, setPopDim] = React.useState<FilterDim | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [expandChips, setExpandChips] = React.useState(false);
  const [outsideSelected, setOutsideSelected] = React.useState(0);
  const [recomputing, setRecomputing] = React.useState(false);
  const filterBtn = React.useRef<HTMLButtonElement>(null);
  const bulkBtn = React.useRef<HTMLButtonElement>(null);
  const [clipMedia, setClipMedia] = React.useState<MediaBrief | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<'candidates' | 'selected'>('candidates');
  const pageSize = 30;

  // filter 是对象：用序列化签名做依赖，直接依赖引用会无限重取
  const filterKey = JSON.stringify(filter);
  const idsKey = config.ids.join(',');
  const activeKeys = FILTER_DIMS.map((d) => d.key).filter((key) => isDimActive(filter, key));
  const subOptions = React.useMemo(() => flattenSubcategories(formats), [formats]);

  /**
   * 无限滚动：页码与筛选签名**绑成一个原子状态**。
   *
   * 分两个 state（page + filterKey）会遇到“筛选变了但页码还停在 3”的竞态——会把第 3 页
   * 当第一页拼上去（漏页 + 闪一下错内容）。绑在一起后，换筛选就等于换一次请求序列。
   */
  const [query, setQuery] = React.useState<{ key: string; page: number }>({ key: filterKey, page: 1 });
  React.useEffect(() => {
    setQuery((current) => (current.key === filterKey ? current : { key: filterKey, page: 1 }));
  }, [filterKey]);

  /** 所有筛选变更的唯一入口：回第 1 页（筛选后旧页码可能越界）。 */
  const applyFilter = (next: CandidateFilter) => {
    setList([]);
    setQuery({ key: JSON.stringify(next), page: 1 });
    onFilter(next);
  };
  const clearFilter = () => { setQText(''); applyFilter(defaultFilter()); };
  const removeDim = (key: FilterDim) => {
    const next: CandidateFilter = { ...filter };
    switch (key) {
      case 'collectionId': next.collectionId = null; break;
      case 'year': next.year = ''; break;
      case 'format': next.format = ''; break;
      case 'subcategoryId': next.subcategoryId = null; break;
      case 'tagId': next.tagId = null; next.tagName = ''; break;
      case 'status': next.status = ''; break;
      case 'confirmed': next.confirmed = null; break;
    }
    applyFilter(next);
  };

  React.useEffect(() => {
    api.collections().then(setCollections).catch(() => undefined);
    api.years().then(setYears).catch(() => undefined);
    api.formats().then(setFormats).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const at = query.page;
    Promise.all([
      api.media({ limit: pageSize, offset: (at - 1) * pageSize, filter }),
      api.mediaCount(filter),
    ])
      .then(([items, count]) => {
        if (cancelled) return;
        setTotal(count);
        setList((current) => (at === 1 ? items : [...current, ...items.filter((item) => !current.some((seen) => seen.id === item.id))]));
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [query]);   // eslint-disable-line react-hooks/exhaustive-deps  （filter/query.key 一一对应）

  const hasMore = list.length < total;
  /** 滚到接近底部就自动取下一页（失败/无更多时不动）。 */
  const onListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const box = event.currentTarget;
    if (loading || !hasMore) return;
    if (box.scrollHeight - box.scrollTop - box.clientHeight < 360) setQuery((current) => ({ ...current, page: current.page + 1 }));
  };

  /** 「已选中有多少不在当前筛选内」：筛选激活且有已选时查一次（只取条数，不改列表）。 */
  React.useEffect(() => {
    if (activeKeys.length === 0 || config.ids.length === 0) { setOutsideSelected(0); return; }
    let cancelled = false;
    api.media({ limit: config.ids.length, offset: 0, filter, ids: config.ids })
      .then((hits) => { if (!cancelled) setOutsideSelected(config.ids.length - hits.length); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [filterKey, idsKey, activeKeys.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** 标题搜索：300ms 防抖后写回筛选（沿用宿主收藏夹 tab 的打字习惯）。 */
  React.useEffect(() => { setQText(filter.q); }, [filter.q]);
  React.useEffect(() => {
    const next = qText.trim();
    if (next === filter.q.trim()) return;
    const timer = window.setTimeout(() => applyFilter({ ...filter, q: next }), 300);
    return () => window.clearTimeout(timer);
  }, [qText, filter.q]);   // eslint-disable-line react-hooks/exhaustive-deps

  const selected = React.useMemo(() => new Set(config.ids), [config.ids]);
  const [dropZone, setDropZone] = React.useState<'list' | 'opening' | null>(null);

  /** 拖拽载荷：被拖的媒体 id（HTML5 DnD 在编辑器内部只传 id，不需要序列化对象）。 */
  const draggedId = React.useRef<number | null>(null);

  const onDropTo = (zone: 'list' | 'opening') => (event: React.DragEvent) => {
    event.preventDefault();
    setDropZone(null);
    const id = Number(event.dataTransfer.getData('text/vt-media')) || draggedId.current;
    draggedId.current = null;
    if (!id) return;
    if (zone === 'opening') {
      patch({
        openingCustom: true,
        openingIds: config.openingIds.includes(id) ? config.openingIds : [...config.openingIds, id],
      });
      return;
    }
    if (!config.ids.includes(id)) patch({ ids: [...config.ids, id] });
  };

  const toggle = (id: number) => {
    const ids = selected.has(id) ? config.ids.filter((value) => value !== id) : [...config.ids, id];
    patch({ ids, openingIds: config.openingIds.filter((value) => ids.includes(value)) });
  };

  const move = (index: number, delta: number) => {
    const ids = [...config.ids];
    const next = index + delta;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    patch({ ids });
  };

  /**
   * 「用当前筛选替换已选」：命中 > 20 部先确认（不再无声地把手工挑的替换掉）。
   * 语义与升级前一致：命中集直接覆盖 `ids`，开场代表秀里已不在命中集的 id 一并移除。
   */
  const recompute = async () => {
    setRecomputing(true);
    try {
      const hits = await api.mediaCount(filter);
      if (hits > 20 && !window.confirm(
        `将用当前筛选命中的 ${hits} 部替换已选的 ${config.ids.length} 部（手工挑选的会被移除），继续？`,
      )) return;
      const all = await api.media({ limit: 500, offset: 0, filter });
      const ids = all.map((item) => item.id);
      patch({ ids, openingIds: config.openingIds.filter((id) => ids.includes(id)) });
      if (hits > 500) window.alert(`命中 ${hits} 部，本次只取前 500 部。`);
    } catch {
      // 失败保持原勾选
    } finally {
      setRecomputing(false);
    }
  };

  const openClips = (media: MediaBrief) => setClipMedia(media);

  const dict: FilterDict = { collections, years, formats, subOptions };
  const chipKeys = expandChips ? activeKeys : activeKeys.slice(0, 4);
  const loadedIds = list.map((item) => item.id);
  /** 右栏正在看的媒体（高亮它那张卡，两栏同步） */
  const picked = highlightMediaId ?? null;

  return (
    <section className="panel vt-col">
      <div className="vt-colhead">
        <h3>候选库</h3>
        <span className="vt-colhead-meta">
          {loading && list.length === 0 ? '…' : `${total} 部`}
          {activeKeys.length > 0 ? ` · 筛选中 ${activeKeys.length}` : ''}
        </span>
        <span className="sp" />
        <button ref={bulkBtn} type="button" className="btn-mini" title="批量操作"
                onClick={() => setBulkOpen((open) => !open)}>⋯</button>
      </div>

      {bulkOpen ? (
        <Pop anchor={bulkBtn} width={286} onClose={() => setBulkOpen(false)}>
          <h4>批量操作</h4>
          <button type="button" className="vt-pop-item"
                  onClick={() => { patch({ ids: [...new Set([...config.ids, ...loadedIds])] }); setBulkOpen(false); }}>
            <span>全选已加载</span><span className="sp" /><small>{loadedIds.length} 部</small>
          </button>
          <button type="button" className="vt-pop-item" disabled={recomputing}
                  onClick={() => { setBulkOpen(false); void recompute(); }}>
            <span>用当前筛选替换已选</span><span className="sp" /><small>命中 &gt; 20 会先确认</small>
          </button>
          <div className="vt-rule" />
          <button type="button" className="vt-pop-item danger"
                  onClick={() => { patch({ ids: [], openingIds: [], mediaClips: {} }); setBulkOpen(false); }}>
            <span>清空已选 / 开场 / 片段</span><span className="sp" /><small>不可撤销</small>
          </button>
        </Pop>
      ) : null}

      <div className="vt-tabs">
        <button type="button" className={cls('vt-tab', tab === 'candidates' && 'on')} onClick={() => setTab('candidates')}>
          候选 <i>{total}</i>
        </button>
        {config.ids.length > 0 ? (
          <button type="button" className={cls('vt-tab', tab === 'selected' && 'on')} onClick={() => setTab('selected')}>
            已选 <i>{config.ids.length}</i>
          </button>
        ) : null}
        {outsideSelected > 0 ? <span className="vt-tabs-note">{outsideSelected} 部不在当前筛选内</span> : null}
      </div>

      {tab === 'candidates' ? (
        <>
          <div className="vt-scroll" onScroll={onListScroll} data-vt="candidates">
            <div className="vt-filterbar">
              <div className="vt-search-row">
                <input className="vt-search-input" placeholder="🔍 搜索标题…" autoComplete="off" value={qText}
                       onChange={(event) => setQText(event.target.value)} />
                {qText ? (
                  <button type="button" className="vt-search-clear" title="清空搜索"
                          onClick={() => { setQText(''); applyFilter({ ...filter, q: '' }); }}>✕</button>
                ) : null}
                <button ref={filterBtn} type="button" className={cls('btn-mini', 'vt-filter-btn', activeKeys.length > 0 && 'active')}
                        title="多维度筛选候选媒体"
                        onClick={() => { setPopDim(null); setPopOpen((open) => !open); }}>
                  ＋ 筛选{activeKeys.length > 0 ? <i>{activeKeys.length}</i> : null}
                </button>
              </div>

              {activeKeys.length > 0 ? (
                <div className="vt-chip-row">
                  {chipKeys.map((key) => {
                    const label = dimLabel(filter, key, dict);
                    return (
                      <span key={key} className="vt-chip-dim">
                        <button type="button" className="vt-chip-main" title={`修改筛选：${label}`}
                                onClick={() => { setPopDim(key); setPopOpen(true); }}>
                          {FILTER_DIMS.find((d) => d.key === key)?.label} <b>{label}</b>
                        </button>
                        <button type="button" title={`移除筛选：${label}`} onClick={() => removeDim(key)}>✕</button>
                      </span>
                    );
                  })}
                  {activeKeys.length > 4 ? (
                    <button type="button" className="btn-mini" onClick={() => setExpandChips((value) => !value)}>
                      {expandChips ? '收起' : `＋${activeKeys.length - 4}`}
                    </button>
                  ) : null}
                  <button type="button" className="vt-chip-clear" onClick={clearFilter}>清除全部</button>
                </div>
              ) : null}

              {outsideSelected > 0 ? (
                <div className="vt-hit-line">已选 <b>{config.ids.length}</b> · <b>{outsideSelected}</b> 部不在当前筛选内</div>
              ) : null}
            </div>

            {popOpen ? (
              <FilterPopover anchor={filterBtn} filter={filter} onFilter={applyFilter} onClear={clearFilter}
                             onClose={() => setPopOpen(false)} dict={dict} hitCount={total} initialDim={popDim} />
            ) : null}

            <div className="vt-media-grid">
        {list.map((item) => {
          const cover = item.coverPath || item.fallbackCoverPath || item.externalCoverUrl;
          const clipCount = config.mediaClips[String(item.id)]?.order.length ?? 0;
          return (
            <div key={item.id} className={cls('vt-media-card', selected.has(item.id) && 'selected', picked === item.id && 'picked')} draggable
                 onClick={() => onSelect({ kind: 'media', mediaId: item.id, title: item.title })}
                 onDragStart={(event) => {
                   draggedId.current = item.id;
                   event.dataTransfer.setData('text/vt-media', String(item.id));
                   event.dataTransfer.effectAllowed = 'copyMove';
                 }}>
              <div className="vt-media-cover">
                {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="vt-cover-placeholder">{(item.title || '?').slice(0, 1)}</span>}
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} title="加入推荐" />
                <button type="button" className={cls('vt-clip-badge', clipCount > 0 && 'has')} title="挂载片段"
                        onClick={(event) => { event.stopPropagation(); openClips(item); }}>
                  {clipCount > 0 ? `✂ ${clipCount}` : '＋ 片段'}
                </button>
              </div>
              <div className="vt-media-title" title={item.title}>{item.title}</div>
              <div className="vt-media-foot">
                <span className="vt-media-year">{item.year ?? '—'}</span>
              </div>
            </div>
          );
        })}
      </div>
            {!loading && list.length === 0 ? (
              <div className="vt-empty-hits">
                <span>没有符合条件的媒体</span>
                {activeKeys.length > 0 ? <button type="button" className="btn-mini" onClick={clearFilter}>清除全部筛选</button> : null}
              </div>
            ) : null}
            {list.length > 0 ? (
              <div className="vt-loadmore">
                {loading ? '加载中…' : hasMore ? `已加载 ${list.length} / ${total} 部` : `已全部加载（${total} 部）`}
                {hasMore && !loading ? <button type="button" className="btn-mini" onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}>加载更多</button> : null}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="vt-scroll">
          <div
            className={cls('vt-drop-opening', dropZone === 'opening' && 'over')}
            onDragOver={(event) => { event.preventDefault(); setDropZone('opening'); }}
            onDragLeave={() => setDropZone(null)}
            onDrop={onDropTo('opening')}
          >
            🎬 拖到这里 = 加入开场代表秀（{config.openingIds.length}）
          </div>

          <div className={cls('vt-selected', dropZone === 'list' && 'over')}
               onDragOver={(event) => { event.preventDefault(); setDropZone('list'); }}
               onDragLeave={() => setDropZone(null)}
               onDrop={onDropTo('list')}>
            <div className="vt-selected-head">推荐顺序（{config.ids.length}） · 拖拽可排序</div>
            <ol className="vt-selected-list">
          {config.ids.map((id, index) => {
            const item = list.find((value) => value.id === id);
            return (
              <li key={id} draggable
                  onDragStart={(event) => {
                    draggedId.current = id;
                    event.dataTransfer.setData('text/vt-media', String(id));
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    const from = draggedId.current;
                    if (from === null || from === id) return;
                    const ids = config.ids.filter((value) => value !== from);
                    const at = ids.indexOf(id);
                    ids.splice(at < 0 ? ids.length : at, 0, from);
                    draggedId.current = from;
                    patch({ ids });
                  }}>
                <span className="idx">{index + 1}</span>
                <span className="vt-selected-title">{item?.title ?? `#${id}`}</span>
                <span className="vt-selected-btns">
                  <button type="button" className="btn-mini" onClick={() => move(index, -1)}>↑</button>
                  <button type="button" className="btn-mini" onClick={() => move(index, 1)}>↓</button>
                  <button type="button" className="btn-mini" onClick={() => toggle(id)}>✕</button>
                </span>
              </li>
            );
          })}
            </ol>
            {config.ids.length === 0 ? <p className="vt-hint">还没选片：到「候选」页勾选或拖进来。</p> : null}
          </div>
        </div>
      )}

      {clipMedia ? (
        <div className="vt-overlay">
          <div className="vt-panel">
            <div className="vt-panel-head">
              <strong>片段 · {clipMedia.title}</strong>
              <span className="btns">
                <button type="button" className="btn-mini" onClick={() => setClipMedia(null)}>关闭</button>
              </span>
            </div>
            <ClipPicker mediaId={clipMedia.id} title={clipMedia.title} config={config}
                        onClips={(next) => {
                          const mediaClips = { ...config.mediaClips };
                          if (next.order.length === 0) delete mediaClips[String(clipMedia.id)];
                          else mediaClips[String(clipMedia.id)] = next;
                          patch({ mediaClips });
                        }} />
            <p className="vt-hint">勾选后该媒体在成片里播放这些片段（按上面的顺序）；一个都不勾则回到资料卡。</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Inspector：参数面板（阶段 2：接受选中对象；阶段 3 按对象轴重排）。 */
export function InspectorPane({ config, patch, mediaBriefs, missingByMedia, selection, rendered, variants, onVariants, focusGroup, onSelect, onOpenSearch }: {
  config: EditorConfig;
  patch: Patch;
  mediaBriefs: MediaBrief[];
  missingByMedia: Record<number, string>;
  selection: import('./timeline').Selection;
  rendered: { input: import('../src/types').MultiMediaPocInput } | null;
  variants: import('./api').Variant[];
  onVariants: (variants: import('./api').Variant[]) => void;
  /** 参数搜索跳转目标分组（前缀匹配，`Group.forceOpen` 用）。 */
  focusGroup: string | null;
  /** 切换右侧对象轴（图标列）。 */
  onSelect: (selection: import('./timeline').Selection) => void;
  onOpenSearch: () => void;
}) {
  const bgmInput = React.useRef<HTMLInputElement>(null);
  const bgInput = React.useRef<HTMLInputElement>(null);
  /**
   * 分组开关：默认只开「当前对象」那组（和「素材缺失」）；用户点过的开关**记在本机**（localStorage），
   * 切对象/切 tab/刷新后保持 —— 但不进草稿与模板（那是内容，不是视图偏好）。
   */
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => ({ object: true, missing: true, ...loadGroupOpen() }));
  const groupOpen = (id: string) => openGroups[id] ?? false;
  const toggleGroup = (id: string) => setOpenGroups((current) => {
    const next = { ...current, [id]: !(current[id] ?? false) };
    saveGroupOpen(next);
    return next;
  });
  const renderedMedia = selection.mediaId === undefined ? null : rendered?.input.media.find((media) => media.mediaId === selection.mediaId) ?? null;
  /** 未加入推荐：只读展示标题（来自候选库的点击）+ 一个「加入推荐」入口，不展示成片相关字段。 */
  const outsideMedia = !renderedMedia && selection.mediaId !== undefined && selection.title
    ? { id: selection.mediaId, title: selection.title }
    : null;
  const selectedMedia = renderedMedia
    ?? (outsideMedia ? { mediaId: outsideMedia.id, order: 0, mode: 'INFO_ONLY' as const, title: outsideMedia.title, tags: [], clips: [] } : null);
  const selectedClip = renderedMedia && selection.clipId !== undefined
    ? renderedMedia.clips.find((clip) => clip.clipId === selection.clipId) ?? null
    : null;

  const addBgm = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const tracks = [...config.bgmTracks];
    for (const file of Array.from(files)) {
      tracks.push({ name: file.name, base64: await fileToBase64(file) });
    }
    patch({ bgmTracks: tracks });
  };

  const addBg = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const images = [...config.bgImages];
    for (const file of Array.from(files)) {
      // 存 data URI（不能只存 base64：成片里背景图走 assetUrl 透传规则，裸 base64 会被当相对路径）
      images.push(await fileToDataUri(file));
    }
    patch({ bgImages: images });
  };

  const clipConfig: MediaClips = selectedMedia ? (config.mediaClips[String(selectedMedia.mediaId)] ?? { order: [] }) : { order: [] };
  const updateSelectedClips = (next: MediaClips) => {
    if (!selectedMedia) return;
    const mediaClips = { ...config.mediaClips };
    if (next.order.length === 0) delete mediaClips[String(selectedMedia.mediaId)];
    else mediaClips[String(selectedMedia.mediaId)] = next;
    patch({ mediaClips });
  };

  const objName = outsideMedia
    ? `${outsideMedia.title}（未加入推荐）`
    : selectedClip?.title ?? selectedMedia?.title ?? (selection.kind === 'scene' ? '当前段' : '全局设置');
  const crumb = selection.kind === 'global'
    ? '全局设置'
    : outsideMedia
      ? `候选库 › <b>#${outsideMedia.id}</b>`
      : selection.kind === 'clip'
        ? `第 ${selectedMedia?.order ?? '?'} 位 › 片段`
        : selection.kind === 'media'
          ? `第 ${selectedMedia?.order ?? '?'} 位 › 媒体`
          : `时间轴 · 第 ${(selection.sceneIndex ?? 0) + 1} 段`;

  return (
    <section className="panel vt-col">
      <div className="vt-colhead">
        <h3>对象轴</h3>
        <span className="vt-colhead-meta">改动即时生效</span>
        <span className="sp" />
        <button type="button" className="btn-mini" title="参数搜索（Ctrl+K）"
                onClick={onOpenSearch}>⌕</button>
      </div>

      <div className="vt-insp">
        <div className="vt-rail">
          <button type="button" className={cls('vt-rail-btn', selection.kind === 'global' && 'on')}
                  title="全局参数" onClick={() => onSelect({ kind: 'global' })}>⚙</button>
          <button type="button" className={cls('vt-rail-btn', selection.kind === 'media' && 'on', !selectedMedia && 'off')}
                  title={selectedMedia ? `当前媒体：${selectedMedia.title}` : '当前媒体（先在左侧选一部）'}
                  onClick={() => selectedMedia && onSelect({ kind: 'media', mediaId: selectedMedia.mediaId, sceneIndex: selection.sceneIndex })}>▤</button>
          <button type="button" className={cls('vt-rail-btn', selection.kind === 'clip' && 'on', !selectedClip && 'off')}
                  title={selectedClip ? `当前片段：${selectedClip.title ?? '未命名'}` : '当前片段（先选一个片段）'}
                  onClick={() => selectedClip && selectedMedia && onSelect({ kind: 'clip', mediaId: selectedMedia.mediaId, clipId: selectedClip.clipId, sceneIndex: selection.sceneIndex })}>✂</button>
        </div>

        <div className="vt-insp-pane">
          <div className="vt-crumb"><span>{crumb}</span><span className="sp" /><b className="vt-objname-inline">{objName}</b></div>
          {outsideMedia ? (
            <div className="vt-outside">
              <p>这部媒体还没加入推荐，所以只有库里的信息。</p>
              <button type="button" className="btn-mini" onClick={() => patch({ ids: [...config.ids, outsideMedia.id] })}>＋ 加入推荐</button>
            </div>
          ) : null}
          <div className="vt-scroll flush">
      <Group id="object" kicker="Object" title={selection.kind === 'global' ? '全局参数' : selectionHeader(selection, selectedMedia, selectedClip)}
             open={groupOpen('object')} onToggle={toggleGroup} forceOpen={focusGroup}>
        {selectedMedia ? (
          <div className="vt-selected-obj">
            <Field label="片内顺序（选中对象）" hl>
              <span className="vt-inline">
                #{selectedMedia.order}
                <button type="button" className="btn-mini" onClick={() => moveMedia(config, patch, selectedMedia.mediaId, -1)}>↑ 上移</button>
                <button type="button" className="btn-mini" onClick={() => moveMedia(config, patch, selectedMedia.mediaId, 1)}>↓ 下移</button>
              </span>
            </Field>
            <Field label="开场代表秀" hl>
              <input type="checkbox" checked={config.openingIds.includes(selectedMedia.mediaId)} onChange={() =>
                patch({
                  openingCustom: true,
                  openingIds: config.openingIds.includes(selectedMedia.mediaId)
                    ? config.openingIds.filter((id) => id !== selectedMedia.mediaId)
                    : [...config.openingIds, selectedMedia.mediaId],
                })} />
            </Field>
            <ClipPicker mediaId={selectedMedia.mediaId} title={selectedMedia.title} config={config} onClips={updateSelectedClips} />
            {selectedClip ? (
              <Field label="片段字幕条" hl>
                <span className="vt-inline-group">
                  {([['mediaTitle', '媒体名'], ['clipTitle', '片段名'], ['index', '序号'], ['note', '备注']] as const).map(([key, label]) => (
                    <label key={key} className="vt-inline">
                      <input type="checkbox" checked={Boolean(clipConfig.badge?.[key])} onChange={(event) =>
                        updateSelectedClips({ ...clipConfig, badge: { ...clipConfig.badge, [key]: event.target.checked } })} />
                      {label}
                    </label>
                  ))}
                </span>
              </Field>
            ) : null}
          </div>
        ) : (
          <p className="vt-hint" title="点左侧卡片 / 时间轴段 / 画布，就会切到这个对象的参数。">未选中对象时这里改的是全局参数 · 点卡片或时间轴段可切换到该对象</p>
        )}
      </Group>
      <Group id="content" kicker="Content" title="内容 · 主题" open={groupOpen('content')} onToggle={toggleGroup} forceOpen={focusGroup}>
        <Field label="标题文案"><input value={config.title} placeholder="我的番剧推荐"
               onChange={(event) => patch({ title: event.target.value })} /></Field>
        <Field label="左上角角标"><input value={config.brandTitle} maxLength={20}
               onChange={(event) => patch({ brandTitle: event.target.value })} /></Field>
        <Field label="副标题"><input value={config.subtitle} maxLength={40}
               onChange={(event) => patch({ subtitle: event.target.value })} /></Field>
        <Field label="简介" hint="填写后出现序言页">
          <textarea rows={3} value={config.intro} onChange={(event) => patch({ intro: event.target.value })} />
        </Field>
        <Field label="序言标题"><input value={config.prologueTitle} maxLength={40}
               onChange={(event) => patch({ prologueTitle: event.target.value })} /></Field>
        <Field label="结尾标题"><input value={config.endingTitle} maxLength={40}
               onChange={(event) => patch({ endingTitle: event.target.value })} /></Field>
        <Field label="结尾文案"><input value={config.endingText} maxLength={40}
               onChange={(event) => patch({ endingText: event.target.value })} /></Field>
      </Group>

      <Group id="layout" kicker="Layout" title="页面展示与交互" open={groupOpen('layout')} onToggle={toggleGroup} forceOpen={focusGroup}>
        <Field label="分组方式">
          <select value={config.groupBy} onChange={(event) => patch({ groupBy: event.target.value })}>
            <option value="none">不分组</option>
            <option value="year">按年份</option>
            <option value="subcategory">按分类</option>
            <option value="collection">按收藏夹</option>
          </select>
        </Field>
        <Field label="分组排序">
          <select value={config.groupSort} onChange={(event) => patch({ groupSort: event.target.value })}>
            <option value="date-desc">新 → 旧</option>
            <option value="date-asc">旧 → 新</option>
            <option value="none">保持原序</option>
          </select>
        </Field>
        <Field label="每屏 N 部"><Range value={config.perScreen} min={1} max={10} suffix=" 部"
               onChange={(value) => patch({ perScreen: value })} /></Field>
        <Field label="开局封面大小"><Range value={Number(config.coverSize) || 50} min={0} max={100}
               onChange={(value) => patch({ coverSize: String(value) })} /></Field>
        <Field label="开场加载速度"><Range value={config.openingSpeed} min={0} max={100}
               onChange={(value) => patch({ openingSpeed: value })} /></Field>
        <Field label="结尾滚动速度"><Range value={config.endingScrollSpeed} min={0} max={100}
               onChange={(value) => patch({ endingScrollSpeed: value })} /></Field>
      </Group>

      <Group id="timing" kicker="Timing" title="时长与显示" open={groupOpen('timing')} onToggle={toggleGroup} forceOpen={focusGroup}>
        <Field label="显示时长（秒）" hint="开场 / 序言 / 章节 / 资料卡 / 结尾">
          <span className="vt-durations">
            {([['openingSec', '开场'], ['introSec', '序言'], ['groupSec', '章节'], ['detailSec', '资料'], ['endingSec', '结尾']] as const)
              .map(([key, label]) => (
                <label key={key} className="vt-duration">
                  <span>{label}</span>
                  <input type="number" min={1} max={20} value={config[key]}
                         onChange={(event) => patch({ [key]: Number(event.target.value) } as Partial<EditorConfig>)} />
                </label>
              ))}
          </span>
        </Field>
        <Field label="详情显示">
          <span className="vt-inline-group">
            <label className="vt-inline"><input type="checkbox" checked={config.detailShow.status}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, status: event.target.checked } })} />状态</label>
            <label className="vt-inline"><input type="checkbox" checked={config.detailShow.note}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, note: event.target.checked } })} />备注</label>
            <label className="vt-inline"><input type="checkbox" checked={config.detailShow.tag}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, tag: event.target.checked } })} />标签</label>
          </span>
        </Field>
      </Group>

      <Group id="opening" kicker="Opening" title="开场代表秀" open={groupOpen('opening')} onToggle={toggleGroup} forceOpen={focusGroup}>
        <Field label="自定义开场封面">
          <input type="checkbox" checked={config.openingCustom}
                 onChange={(event) => patch({ openingCustom: event.target.checked })} />
        </Field>
        <div className="vt-opening-list">
          {config.ids.map((id) => {
            const brief = mediaBriefs.find((item) => item.id === id);
            const checked = config.openingIds.includes(id);
            return (
              <label key={id} className="vt-inline">
                <input type="checkbox" checked={checked} disabled={!config.openingCustom} onChange={() =>
                  patch({ openingIds: checked ? config.openingIds.filter((value) => value !== id) : [...config.openingIds, id] })} />
                {brief?.title ?? `#${id}`}
              </label>
            );
          })}
        </div>
      </Group>

      <Group id="variants" kicker="Variants" title={`导出变体（${variants.length}）`} open={groupOpen('variants')} onToggle={toggleGroup} forceOpen={focusGroup}>
        <VariantGroup variants={variants} onVariants={onVariants} />
      </Group>

      <Group id="audio" kicker="Audio" title="背景音乐（BGM）" open={groupOpen('audio')} onToggle={toggleGroup} forceOpen={focusGroup}>
        <button type="button" className="btn-mini" onClick={() => bgmInput.current?.click()}>🎵 添加音频</button>
        <input ref={bgmInput} type="file" accept="audio/*" multiple hidden
               onChange={(event) => { void addBgm(event.target.files); event.target.value = ''; }} />
        <ul className="vt-bgm-list">
          {config.bgmTracks.map((track, index) => (
            <li key={`${track.name}-${index}`}>
              <span>{track.name}</span>
              <button type="button" className="btn-mini"
                      onClick={() => patch({ bgmTracks: config.bgmTracks.filter((_, i) => i !== index) })}>✕</button>
            </li>
          ))}
        </ul>
        <Field label="音乐条缩放"><Range value={config.bgmScale} min={50} max={200} step={5} suffix="%"
               onChange={(value) => patch({ bgmScale: value })} /></Field>
        <Field label="音乐条位置 X"><Range value={config.bgmX} min={0} max={100}
               onChange={(value) => patch({ bgmX: value })} /></Field>
        <Field label="音乐条位置 Y"><Range value={config.bgmY} min={0} max={100}
               onChange={(value) => patch({ bgmY: value })} /></Field>
      </Group>

      <Group id="background" kicker="Background" title="背景层" open={groupOpen('background')} onToggle={toggleGroup} forceOpen={focusGroup}>
        <Field label="背景图">
          <button type="button" className="btn-mini" onClick={() => bgInput.current?.click()}>🖼 添加图片</button>
          <input ref={bgInput} type="file" accept="image/*" multiple hidden
                 onChange={(event) => { void addBg(event.target.files); event.target.value = ''; }} />
        </Field>
        <ul className="vt-bgm-list">
          {config.bgImages.map((_, index) => (
            <li key={index}>
              <span>背景图 {index + 1}</span>
              <button type="button" className="btn-mini"
                      onClick={() => patch({ bgImages: config.bgImages.filter((__, i) => i !== index) })}>✕</button>
            </li>
          ))}
        </ul>
        <Field label="纯色背景">
          <input type="color" value={config.bgColor || '#08070f'} onChange={(event) => patch({ bgColor: event.target.value })} />
          <button type="button" className="btn-mini" onClick={() => patch({ bgColor: '' })}>清除</button>
        </Field>
        <Field label="轮换间隔（秒）"><Range value={config.bgRotationSec} min={1} max={60}
               onChange={(value) => patch({ bgRotationSec: value })} /></Field>
        <Field label="透明度"><Range value={config.bgOpacity} min={0} max={100}
               onChange={(value) => patch({ bgOpacity: value })} /></Field>
        <Field label="模糊度"><Range value={config.bgBlur} min={0} max={100}
               onChange={(value) => patch({ bgBlur: value })} /></Field>
        <Field label="亮度"><Range value={config.bgBrightness} min={0} max={100}
               onChange={(value) => patch({ bgBrightness: value })} /></Field>
      </Group>

      {Object.keys(missingByMedia).length > 0 ? (
        <Group id="missing" kicker="Missing" title={`素材缺失 ${Object.keys(missingByMedia).length} 项`} open={groupOpen('missing')} onToggle={toggleGroup}>
          <ul className="vt-missing-list">
            {Object.entries(missingByMedia).map(([mediaId, reason]) => (
              <li key={mediaId}>#{mediaId}：{reason}</li>
            ))}
          </ul>
        </Group>
        ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
