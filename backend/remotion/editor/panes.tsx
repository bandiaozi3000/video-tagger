/**
 * 编辑器面板：工具栏 / 媒体篮子 / Inspector（阶段 1 为扁平参数面板；阶段 3 再按对象轴重排）。
 *
 * 交互约定：所有改动通过 `patch` 写回配置 → 本地参数即时生效（见 `state.ts`）。
 */
import React from 'react';
import { api, type ClipBrief, type EditorConfig, type MediaBrief, type MediaClips } from './api';
import { fileToBase64, fileToDataUri, parsePayload } from './state';
import { THEME_PRESETS } from '../src/theme';

type Patch = (patch: Partial<EditorConfig>) => void;

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** 对象轴/参数分组：面板内的一节（kicker + 标题 + 折叠）。 */
function Group({ title, kicker, right, children, defaultOpen = false }: {
  title: string;
  kicker?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className={cls('vt-sec', open && 'open')}>
      <button type="button" className="vt-sec-h" onClick={() => setOpen(!open)}>
        <span className="lb">{kicker ? <em>{kicker}</em> : null}{title}</span>
        <span className="cw">{right}{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div className="vt-sec-b">{children}</div> : null}
    </section>
  );
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
export function Hero({ config, patch, onExport, onExportAll, variantCount, onOpenTasks, onOpenTemplates, busy, meta }: {
  config: EditorConfig;
  patch: Patch;
  onExport: () => void;
  onExportAll: () => void;
  variantCount: number;
  onOpenTasks: () => void;
  onOpenTemplates: () => void;
  busy: boolean;
  meta: { seconds: number | null; frames: number | null; missingCount: number; savedAt: string | null };
}) {
  const empty = config.ids.length === 0;
  return (
    <header className="vt-hero">
      <div className="vt-hero-top">
        <div>
          <div className="vt-hero-title">推荐工作台</div>
          <div className="vt-hero-sub">选片、排段、调参、导出——一屏完成，改动即时可见</div>
          <div className="vt-status">
            <span className="vt-chip pk">已选 <b>{config.ids.length}</b> 部</span>
            {meta.frames !== null ? (
              <span className="vt-chip">预计时长 <b>{formatClock(meta.seconds)}</b> · <b>{meta.frames}</b> 帧</span>
            ) : null}
            <span className="vt-chip">分辨率 <b>{config.resolution}</b> · <b>{config.format}</b></span>
            {meta.missingCount > 0
              ? <span className="vt-chip warn">⚠ 素材缺失 <b>{meta.missingCount}</b> 项</span>
              : <span className="vt-chip cy">● 素材就绪</span>}
            <span className="vt-chip cy">{meta.savedAt ? `本地自动暂存 · ${meta.savedAt}` : '本地自动暂存'}</span>
          </div>
        </div>
        <div className="vt-actions">
          <button type="button" className="btn-primary" disabled={busy || empty} onClick={onExport}>
            {busy ? '提交中…' : '▶ 导出视频'}
          </button>
          <button type="button" className="btn-mini" disabled={busy || empty}
                  title="按变体逐个提交（每个变体一个任务）" onClick={onExportAll}>
            导出全部变体{variantCount > 0 ? `（${variantCount}）` : ''}
          </button>
          <button type="button" className="btn-mini" onClick={onOpenTasks}>导出任务</button>
        </div>
      </div>

      <div className="vt-settings">
        <div className="vt-set">
          <span>模板</span>
          <button type="button" className="btn-mini" onClick={onOpenTemplates}>🗂 保存 / 套用</button>
        </div>
        <div className="vt-set">
          <span>样式</span>
          <select value={config.groupStyle} onChange={(event) => patch({ groupStyle: event.target.value })} title="推荐形态">
            <option value="chapter">章节式</option>
            <option value="clip">片段放映式</option>
          </select>
        </div>
        <div className="vt-set">
          <span>画质</span>
          <select value={config.resolution} onChange={(event) => patch({ resolution: event.target.value })} title="清晰度">
            <option value="720P">720P</option>
            <option value="1080P">1080P</option>
            <option value="4K">4K</option>
          </select>
        </div>
        <div className="vt-set">
          <span>封装</span>
          <select value={config.format} onChange={(event) => patch({ format: event.target.value })} title="视频封装格式">
            <option value="MP4">MP4</option>
            <option value="WEBM">WEBM</option>
          </select>
        </div>
        <div className="vt-set">
          <span>主题</span>
          <div className="vt-presets">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={cls('vt-preset', config.preset === preset.id && 'active')}
                title={preset.note}
                onClick={() => patch({ preset: preset.id })}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
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
        <p className="vt-hint">套用后仍可手工改；要按保存的筛选重新凑批媒体，点篮子里的「↻ 按筛选重算候选」。</p>
      </div>
    </div>
  );
}

/** 媒体篮子：筛选 + 分页 + 勾选 + 已选顺序 + 片段挂载。 */
export function BasketPane({ config, patch, filter, onFilter }: {
  config: EditorConfig;
  patch: Patch;
  /** 候选筛选（提升到编辑器层：可随模板保存、套用时重算候选）。 */
  filter: import('./api').CandidateFilter;
  onFilter: (filter: import('./api').CandidateFilter) => void;
}) {
  const [list, setList] = React.useState<MediaBrief[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [collections, setCollections] = React.useState<{ id: number; name: string }[]>([]);
  const [years, setYears] = React.useState<number[]>([]);
  const [tagText, setTagText] = React.useState(filter.tagName);
  const [recomputing, setRecomputing] = React.useState(false);
  const sourceId = filter.collectionId;
  const year = filter.year;
  const tagId = filter.tagId;
  const setSourceId = (value: number | null) => onFilter({ ...filter, collectionId: value });
  const setYear = (value: string) => onFilter({ ...filter, year: value });
  const setTagId = (value: number | null) => onFilter({ ...filter, tagId: value });
  const [clipMedia, setClipMedia] = React.useState<MediaBrief | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<'candidates' | 'selected'>('candidates');
  const pageSize = 30;

  React.useEffect(() => {
    api.collections().then(setCollections).catch(() => undefined);
    api.years().then(setYears).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.media({ limit: pageSize, offset: (page - 1) * pageSize, collectionId: sourceId, tagId, year }),
      api.mediaCount({ collectionId: sourceId, tagId, year }),
    ])
      .then(([items, count]) => {
        if (cancelled) return;
        setList(items);
        setTotal(count);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [page, sourceId, tagId, year]);

  const selected = React.useMemo(() => new Set(config.ids), [config.ids]);
  const pageIds = list.map((item) => item.id);
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

  const applyTag = async () => {
    const name = tagText.trim();
    if (!name) {
      onFilter({ ...filter, tagId: null, tagName: '' });
      return;
    }
    const id = await api.resolveTagId(name).catch(() => null);
    onFilter({ ...filter, tagId: id, tagName: id === null ? '' : name });
    if (id === null) setTagText('');
  };

  /** 按筛选条件重算候选（系列化：套用模板/换一批媒体时用；之后仍可人工微调）。 */
  const recompute = async () => {
    setRecomputing(true);
    try {
      const all = await api.media({ limit: 500, offset: 0, collectionId: sourceId, tagId, year });
      const ids = all.map((item) => item.id);
      patch({ ids, openingIds: config.openingIds.filter((id) => ids.includes(id)) });
    } catch {
      // 失败保持原勾选
    } finally {
      setRecomputing(false);
    }
  };

  const openClips = (media: MediaBrief) => setClipMedia(media);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="panel vt-col">
      <div className="panel-head">
        <div>
          <span className="kicker">Library</span>
          <h3>候选库</h3>
        </div>
        <div className="vt-head-r">共 <b style={{ color: 'var(--text)' }}>{loading ? '…' : total}</b> 部</div>
      </div>

      <div className="vt-tabs">
        <button type="button" className={cls('vt-tab', tab === 'candidates' && 'on')} onClick={() => setTab('candidates')}>
          候选 <i>{total}</i>
        </button>
        <button type="button" className={cls('vt-tab', tab === 'selected' && 'on')} onClick={() => setTab('selected')}>
          已选 <i>{config.ids.length}</i>
        </button>
      </div>

      {tab === 'candidates' ? (
        <>
          <div className="vt-scroll">
            <div className="vt-filters">
              <select value={sourceId ?? ''} onChange={(event) => { setPage(1); setSourceId(event.target.value ? Number(event.target.value) : null); }}>
                <option value="">全部媒体</option>
                {collections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select value={year} onChange={(event) => { setPage(1); setYear(event.target.value); }}>
                <option value="">全部年份</option>
                {years.map((value) => <option key={value} value={value}>{value} 年</option>)}
              </select>
              <input className="vt-tag-input full" placeholder="🏷 标签过滤（回车）" value={tagText}
                     onChange={(event) => setTagText(event.target.value)}
                     onKeyDown={(event) => { if (event.key === 'Enter') void applyTag(); }} />
            </div>

            <div className="vt-tools">
              <button type="button" className="btn-mini" onClick={() => patch({ ids: [...new Set([...config.ids, ...pageIds])] })}>☑ 全选本页</button>
              <button type="button" className="btn-mini" disabled={recomputing}
                      title="按上方筛选条件重算候选（会替换当前勾选；之后仍可手工微调）"
                      onClick={() => void recompute()}>{recomputing ? '重算中…' : '↻ 按筛选重算'}</button>
              {tagId !== null ? <button type="button" className="btn-mini" onClick={() => { setTagText(''); setTagId(null); }}>✕ 清除标签</button> : null}
              <button type="button" className="btn-mini" onClick={() => patch({ ids: [], openingIds: [], mediaClips: {} })}>清空</button>
            </div>

            <div className="vt-media-grid">
        {list.map((item) => {
          const cover = item.coverPath || item.fallbackCoverPath || item.externalCoverUrl;
          const clipCount = config.mediaClips[String(item.id)]?.order.length ?? 0;
          return (
            <div key={item.id} className={cls('vt-media-card', selected.has(item.id) && 'selected')} draggable
                 onDragStart={(event) => {
                   draggedId.current = item.id;
                   event.dataTransfer.setData('text/vt-media', String(item.id));
                   event.dataTransfer.effectAllowed = 'copyMove';
                 }}>
              <div className="vt-media-cover">
                {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="vt-cover-placeholder">{(item.title || '?').slice(0, 1)}</span>}
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} title="加入推荐" />
              </div>
              <div className="vt-media-title" title={item.title}>{item.title}</div>
              <div className="vt-media-foot">
                <span className="vt-media-year">{item.year ?? '—'}</span>
                <button type="button" className={cls('btn-mini', clipCount > 0 && 'active')} onClick={() => openClips(item)}>
                  {clipCount > 0 ? `片段 ${clipCount}` : '＋ 片段'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
          </div>
          <div className="vt-basket-pager">
            <span>{loading ? '加载中…' : `第 ${page} / ${pages} 页`}</span>
            <span className="vt-pager-btns">
              <button type="button" className="btn-mini" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ 上一页</button>
              <button type="button" className="btn-mini" disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页 ›</button>
            </span>
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
export function InspectorPane({ config, patch, mediaBriefs, missingByMedia, selection, rendered, variants, onVariants }: {
  config: EditorConfig;
  patch: Patch;
  mediaBriefs: MediaBrief[];
  missingByMedia: Record<number, string>;
  selection: import('./timeline').Selection;
  rendered: { input: import('../src/types').MultiMediaPocInput } | null;
  variants: import('./api').Variant[];
  onVariants: (variants: import('./api').Variant[]) => void;
}) {
  const bgmInput = React.useRef<HTMLInputElement>(null);
  const bgInput = React.useRef<HTMLInputElement>(null);
  const selectedMedia = selection.mediaId === undefined ? null : rendered?.input.media.find((media) => media.mediaId === selection.mediaId) ?? null;
  const selectedClip = selectedMedia && selection.clipId !== undefined
    ? selectedMedia.clips.find((clip) => clip.clipId === selection.clipId) ?? null
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

  const objName = selectedClip?.title ?? selectedMedia?.title ?? (selection.kind === 'scene' ? '当前段' : '全局设置');
  const crumb = selection.kind === 'global'
    ? '全局设置'
    : selection.kind === 'clip'
      ? `第 ${selectedMedia?.order ?? '?'} 位 › 片段`
      : selection.kind === 'media'
        ? `第 ${selectedMedia?.order ?? '?'} 位 › 媒体`
        : `时间轴 · 第 ${(selection.sceneIndex ?? 0) + 1} 段`;

  return (
    <section className="panel vt-col">
      <div className="panel-head">
        <div>
          <span className="kicker">Inspector</span>
          <h3>对象轴</h3>
        </div>
        <div className="vt-head-r">改动即时生效</div>
      </div>

      <div className="vt-objbar">
        <div className="vt-crumb">{crumb}</div>
        <div className="vt-objname"><span className="dot" />{objName}</div>
      </div>

      <div className="vt-scroll flush">
      <Group kicker="Object" title={selection.kind === 'global' ? '全局参数' : selectionHeader(selection, selectedMedia, selectedClip)} defaultOpen>
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
          <p className="vt-hint">在时间轴或左侧篮子里选一部媒体/一个片段，这里就显示它的可改项；不选则改全局。</p>
        )}
      </Group>
      <Group kicker="Content" title="内容 · 主题" defaultOpen>
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

      <Group kicker="Layout" title="页面展示与交互" defaultOpen>
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

      <Group kicker="Timing" title="时长与显示" defaultOpen>
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

      <Group kicker="Opening" title="开场代表秀">
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

      <Group kicker="Variants" title={`导出变体（${variants.length}）`}>
        <VariantGroup variants={variants} onVariants={onVariants} />
      </Group>

      <Group kicker="Audio" title="背景音乐（BGM）">
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

      <Group kicker="Background" title="背景层">
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
        <Group kicker="Missing" title={`素材缺失 ${Object.keys(missingByMedia).length} 项`} defaultOpen>
          <ul className="vt-missing-list">
            {Object.entries(missingByMedia).map(([mediaId, reason]) => (
              <li key={mediaId}>#{mediaId}：{reason}</li>
            ))}
          </ul>
        </Group>
      ) : null}
      </div>
    </section>
  );
}
