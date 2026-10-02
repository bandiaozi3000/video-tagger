/**
 * 编辑器面板：工具栏 / 媒体篮子 / Inspector（阶段 1 为扁平参数面板；阶段 3 再按对象轴重排）。
 *
 * 交互约定：所有改动通过 `patch` 写回配置 → 本地参数即时生效（见 `state.ts`）。
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { api, type CandidateFilter, type ClipBrief, type EditorConfig, type MediaBrief, type MediaClips, type MediaExportRow, type MediaFormatBrief, type MediaMark } from './api';
import { confirmDialog } from './confirm';
import { CoverTab } from './cover/CoverTab';
import { buildListText, DEFAULT_TOGGLES, prepareRows, type ExportToggles } from './export-list';

/** ExportToggles 里的布尔开关（sortBy 是枚举，不走 checkbox 助手）。 */
type BooleanToggleKey = { [K in keyof ExportToggles]: ExportToggles[K] extends boolean ? K : never }[keyof ExportToggles];
import { attachWithSource, dropAllMissing, withoutClip } from './clip-refs';
import { endingPlayback, endingRowsPerPage, LIST_MAX } from '../src/cinema/ending';
import {
  estimateIntroHeight, fitIntroSize, INTRO_LAYOUT, parseRichText, plainLength, RichInline, TONE_LABEL, TONES, toggleLinePrefix, wrapInline,
  type MarkupKind,
} from '../src/rich-text';
import { RECOMMEND_TIERS, cycleTier, tierLook, toggleTier } from '../src/tier';
import { resolveParams, resolveTheme, titleCardShow } from '../src/params';
import { defaultFilter, fileToBase64, fileToDataUri, loadGroupOpen, parsePayload, rollSeed, saveGroupOpen } from './state';
import { THEME_PRESETS } from '../src/theme';

type Patch = (patch: Partial<EditorConfig>) => void;

/**
 * 每部媒体的推荐标注（等级 + 理由）读写。**等级名单写死在 `src/tier.tsx`，不做配置**。
 * 稀疏存：没有等级也没理由 → 就把这条键删掉，老草稿里不存在这个字段也能跑。
 */
function markOf(config: EditorConfig, mediaId: number): MediaMark {
  return config.mediaMarks?.[String(mediaId)] ?? {};
}

function patchMark(config: EditorConfig, patch: Patch, mediaId: number, next: Partial<MediaMark>): void {
  const key = String(mediaId);
  const merged: MediaMark = { ...markOf(config, mediaId), ...next };
  const marks = { ...config.mediaMarks };
  if (merged.tier === undefined && !merged.reason?.trim()) delete marks[key];
  else marks[key] = merged;
  patch({ mediaMarks: marks });
}

/** 等级名次 → 展示名/胶囊色（与渲染侧**同一份** `tierLook`，不另写一套）。 */
function tierLookOf(tier: number | undefined) {
  return tierLook(tier, [...RECOMMEND_TIERS]);
}

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/**
 * 双击卡片进「媒体详情」（2026-09-29 用户要求）。
 *
 * 为什么要搭桥：编辑器是 ESM 模块，宿主 `app.js` 是**普通脚本**（`openMediaDetail` 就在 window 上），
 * 而且两者**同页挂载**（不是 iframe，见 `index.html` 的注释）—— 所以直接取宿主全局是最短路径。
 * 宿主那侧 `openMediaDetail` 会 `pushView('media-detail')` 入栈，所以详情页的「← 返回媒体」按一下就回到工作台。
 * 没有宿主时（编辑器单独跑 / 单测）静默忽略。
 */
function openHostMediaDetail(mediaId: number): void {
  const host = (window as unknown as { openMediaDetail?: (id: number) => void }).openMediaDetail;
  host?.(mediaId);
}

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
/** BGM 播放范围的三段（与 `src/bgm.ts` 的 `BgmRangeSegment` 对齐）。 */
const BGM_SEGMENTS = [["opening", "开场"], ["cards", "片名卡"], ["ending", "结尾"]] as const;

/** 勾/取消一个段：全不勾 → `none`（显式“不播”，不默默回“全程”）。 */
export function toggleBgmSegment(current: string, key: string, on: boolean): string {
  const picked = current === 'all' ? [] : current.split(',').filter(Boolean);
  const next = on ? [...picked, key] : picked.filter((value) => value !== key);
  const ordered = ['opening', 'cards', 'ending'].filter((value) => next.includes(value));
  return ordered.length === 0 ? 'none' : ordered.join(',');
}

export function Toolbar({ config, patch, onExport, onExportAll, variantCount, onOpenTasks, onOpenTemplates, onOpenVariants, onOpenSearch, onReloadMaterials, busy, meta }: {
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
  /** A：手动重新读取素材信息（重建会话）。 */
  onReloadMaterials: () => void;
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
        <button type="button" className={config.groupStyle === 'cinema' ? 'on' : ''}
                title="银幕式：片名卡 → 画面/片段 → 硬切（每部一色）"
                onClick={() => patch({ groupStyle: 'cinema' })}>银幕式</button>
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
          <button type="button" className="btn-mini" style={{ marginTop: 8 }}
                  title="库里改了标题/年份/标签/封面后，点这里重新读取（导出本来就是最新的，只有预览需要它）"
                  onClick={() => { onReloadMaterials(); setPop(null); }}>↻ 重新读取素材</button>
          <p className="vt-pop-note">{meta.missingCount > 0
            ? '在右侧面板的「素材缺失」里逐条处理（去补 / 移除 / 一键清理）—— 之前那里只是一行字、没法操作。'
            : '正常状态不占地方：只有「素材缺失」会常驻在工具条上变红。'}</p>
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

/** 三种语义色的按钮提示（给用户讲清"什么时候用哪个"，而不是让他猜颜色）。 */
const TONE_TITLE: Record<(typeof TONES)[number], string> = {
  accent: '重点：用 == == 包住（金色，放片名/数字/结论）',
  warn: '提醒：用 !! !! 包住（红色，放叠甲/避雷/注意）',
  info: '信息：用 ++ ++ 包住（青色，放来源/补充说明）',
};

/** 参数搜索索引：只指向**稳定标题**的组（对象组随选中变，不列）。 */
const PARAM_INDEX: { label: string; group: string }[] = [
  { label: '标题文案', group: '内容 · 主题' }, { label: '左上角角标', group: '内容 · 主题' },
  { label: '副标题', group: '内容 · 主题' }, { label: '简介 / 序言页', group: '内容 · 主题' },
  { label: '序言标题', group: '内容 · 主题' }, { label: '结尾标题', group: '内容 · 主题' }, { label: '结尾文案', group: '内容 · 主题' },
  { label: '分组方式 / 排序', group: '页面展示与交互' }, { label: '每屏 N 部', group: '页面展示与交互' },
  { label: '开局封面大小', group: '页面展示与交互' }, { label: '开场加载速度', group: '页面展示与交互' },
  { label: '结尾滚动速度', group: '页面展示与交互' },
  { label: '显示时长（开场/序言/章节/资料卡/结尾）', group: '时长与显示' }, { label: '详情显示开关', group: '时长与显示' },
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
  /** 来源页签：本部 / 同系列（跨媒体借片段，设计规格 §7）。 */
  const [sourceTab, setSourceTab] = React.useState<number | 'own'>('own');
  const [related, setRelated] = React.useState<import('./api').RelatedMedia[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    api.clips(mediaId).then((list) => !cancelled && setClips(list)).catch(() => !cancelled && setClips([]));
    api.relatedMedia(mediaId).then((list) => !cancelled && setRelated(list)).catch(() => !cancelled && setRelated([]));
    return () => { cancelled = true; };
  }, [mediaId]);

  /** 同系列条目各自的片段（切到那个页签才取，避免一次拉一堆）。 */
  const [relatedClips, setRelatedClips] = React.useState<Record<number, ClipBrief[]>>({});
  React.useEffect(() => {
    if (sourceTab === 'own') return;
    let cancelled = false;
    if (relatedClips[sourceTab]) return;
    api.clips(sourceTab).then((list) => !cancelled && setRelatedClips((current) => ({ ...current, [sourceTab]: list })))
      .catch(() => !cancelled && setRelatedClips((current) => ({ ...current, [sourceTab]: [] })));
    return () => { cancelled = true; };
  }, [sourceTab, relatedClips]);

  const current: MediaClips = config.mediaClips[String(mediaId)] ?? { order: [] };
  const badge = current.badge ?? {};
  const sources: Record<string, number> = current.sources ?? {};

  /** 写顺序时**带上 sources**（不然一改顺序就把借来的片段当成本体）。 */
  const setOrder = (order: number[], nextSources: Record<string, number> = sources) =>
    onClips({ order, badge: current.badge, sources: nextSources });

  /** 加/减一个片段（借来的要同时记下来源 mediaId）。 */
  const toggleClip = (clipId: number, sourceMediaId: number | null) => {
    const picked = current.order.includes(clipId);
    const order = picked ? current.order.filter((id) => id !== clipId) : [...current.order, clipId];
    const nextSources = { ...sources };
    if (picked || sourceMediaId === null) delete nextSources[String(clipId)];
    else nextSources[String(clipId)] = sourceMediaId;
    setOrder(order, nextSources);
  };

  /** 片段标题：借来的片段不在本部的 clips 里，要从来源列表里找。 */
  const titleOfClip = (clipId: number): string => {
    const own = clips?.find((clip) => clip.id === clipId);
    if (own) return own.title || `片段 #${clipId}`;
    for (const list of Object.values(relatedClips)) {
      const hit = list.find((clip) => clip.id === clipId);
      if (hit) return hit.title || `片段 #${clipId}`;
    }
    return `#${clipId}`;
  };

  /** 来源短名（角标用）：同系列标题去掉书名号里的空格后缀，直接取 title。 */
  const sourceNameOf = (clipId: number): string | null => {
    const sourceMediaId = sources[String(clipId)];
    if (sourceMediaId === undefined) return null;
    if (sourceMediaId === mediaId) return null;
    return related?.find((item) => item.mediaId === sourceMediaId)?.title ?? `#${sourceMediaId}`;
  };

  const swap = (index: number, delta: number) => {
    const order = [...current.order];
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setOrder(order);
  };

  if (clips === null) return <p className="vt-hint">读取片段…</p>;

  /** 当前页签要列的片段。 */
  const listed = sourceTab === 'own' ? clips : relatedClips[sourceTab];

  return (
    <div className="vt-clip-picker">
      {/* 来源切换：本部 / 同系列（本地有片段的视频类关联条目） */}
      {related !== null && related.length > 0 ? (
        <div className="vt-clip-sources">
          <span className="vt-hint">来源</span>
          <button type="button" className={cls('btn-mini', sourceTab === 'own' && 'on')}
                  onClick={() => setSourceTab('own')}>本部 {clips.length}</button>
          {Array.from(new Set(related.map((item) => item.relationType))).map((type) => (
            <span key={type} className="vt-clip-source-group">
              <span className="vt-hint">{type}</span>
              {related.filter((item) => item.relationType === type).map((item) => (
                <button key={item.mediaId} type="button" className={cls('btn-mini', sourceTab === item.mediaId && 'on')}
                        title={`${item.title}${item.year ? ` (${item.year})` : ''} · ${item.clipCount} 个片段`}
                        onClick={() => setSourceTab(item.mediaId)}>
                  {item.title} {item.clipCount}
                </button>
              ))}
            </span>
          ))}
        </div>
      ) : null}
      {listed === null || listed === undefined ? (
        <p className="vt-hint">读取片段…</p>
      ) : listed.length === 0 ? (
        <p className="vt-hint">{sourceTab === 'own' ? `「${title}」没有片段` : '这个条目没有片段'}</p>
      ) : (
        <div className="vt-clip-candidates">
          {listed.map((clip) => {
            const picked = current.order.includes(clip.id);
            return (
              <label key={clip.id} className="vt-clip-item">
                <input type="checkbox" checked={picked}
                       onChange={() => toggleClip(clip.id, sourceTab === 'own' ? null : sourceTab)} />
                <span>{clip.title || `片段 #${clip.id}`}</span>
                {sourceTab === 'own' ? null : <span className="vt-clip-from">来源</span>}
                <span className="vt-hint">{clip.timestampSec ?? '?'}s</span>
              </label>
            );
          })}
        </div>
      )}
      {current.order.length > 0 ? (
        <div className="vt-clip-order">
          <div className="vt-hint">播放顺序（{current.order.length}）</div>
          {current.order.map((clipId, index) => {
            const sourceName = sourceNameOf(clipId);
            return (
              <div key={clipId} className="vt-clip-order-row">
                <span>
                  {index + 1}. {titleOfClip(clipId)}
                  {sourceName ? <em className="vt-clip-from-tag">来源：{sourceName}</em> : null}
                </span>
                <span>
                  <button type="button" className="btn-mini" onClick={() => swap(index, -1)}>↑</button>
                  <button type="button" className="btn-mini" onClick={() => swap(index, 1)}>↓</button>
                </span>
              </div>
            );
          })}
          <div className="vt-clip-badges">
            <span className="vt-hint">字幕条</span>
            {([['mediaTitle', '媒体名'], ['clipTitle', '片段名'], ['index', '序号'], ['note', '备注']] as const).map(([key, label]) => (
              <label key={key} className="vt-inline">
                <input type="checkbox" checked={Boolean(badge[key])} onChange={(event) =>
                  onClips({ order: current.order, badge: { ...badge, [key]: event.target.checked }, sources })} />
                {label}
              </label>
            ))}
            <input className="vt-badge-custom" placeholder="自定义文案" value={badge.custom ?? ''}
                   onChange={(event) => onClips({ order: current.order, badge: { ...badge, custom: event.target.value }, sources })} />
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
                  <option value="cinema">银幕式</option>
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
        if (await confirmDialog({
          title: '旧结构模板',
          msg: `模板「${detail.name}」是旧结构（v0.28 之前），不兼容。删除它吗？`,
          okText: '删除',
        })) {
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
type FilterDim = 'collectionId' | 'year' | 'format' | 'subcategoryId' | 'tagIds' | 'status' | 'confirmed';

const FILTER_DIMS: { key: FilterDim; label: string }[] = [
  { key: 'collectionId', label: '收藏夹' },
  { key: 'year', label: '年份' },
  { key: 'format', label: '格式' },
  { key: 'subcategoryId', label: '子分类' },
  { key: 'tagIds', label: '标签' },
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

/**
 * 按年份把已加载的候选切成**连续年份段**。
 *
 * 无限滚动下同一年会跨页：靠"与上一段同年就并入"来避免同一个年份出现两次表头
 * （所以分组时必须让后端 `sort=year`，否则年份交错、分段无意义）。
 */
function yearRuns(items: MediaBrief[]): { year: number | null; items: MediaBrief[] }[] {
  const runs: { year: number | null; items: MediaBrief[] }[] = [];
  for (const item of items) {
    const year = item.year ?? null;
    const last = runs[runs.length - 1];
    if (last && last.year === year) last.items.push(item);
    else runs.push({ year, items: [item] });
  }
  return runs;
}

interface FilterDict {
  collections: { id: number; name: string }[];
  years: number[];
  formats: MediaFormatBrief[];
  /** 展平后的子分类（`格式 › 子分类` 路径，parentId 消歧） */
  subOptions: { id: number; label: string }[];
}

function isDimActive(filter: CandidateFilter, key: FilterDim): boolean {
  if (key === 'confirmed') return filter.confirmed != null;
  if (key === 'tagIds') return filter.tagIds.length > 0;
  if (key === 'collectionId' || key === 'subcategoryId') return filter[key] != null;
  return String(filter[key]).trim() !== '';
}

/** 维度当前值的中文展示（chip 与面板右侧）。 */
function dimLabel(filter: CandidateFilter, key: FilterDim, dict: FilterDict): string {
  switch (key) {
    case 'collectionId': return dict.collections.find((c) => c.id === filter.collectionId)?.name ?? `收藏夹 #${filter.collectionId}`;
    case 'year': return `${filter.year} 年`;
    case 'format': return dict.formats.find((f) => f.code === filter.format)?.name ?? filter.format;
    case 'subcategoryId': return dict.subOptions.find((s) => s.id === filter.subcategoryId)?.label ?? `子分类 #${filter.subcategoryId}`;
    case 'tagIds': return filter.tagNames.length
        ? filter.tagNames.join(filter.tagMode === 'OR' ? ' 或 ' : ' 且 ')
        : `标签 #${filter.tagIds.join('/')}`;
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
    if (dim !== 'tagIds') return;
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
      case 'tagIds': {
        const id = value as number;
        const idx = next.tagIds.indexOf(id);
        if (idx >= 0) {
          next.tagIds = next.tagIds.filter((t) => t !== id);
          next.tagNames = next.tagNames.filter((_, i) => i !== idx);
        } else {
          const hit = tagHits.find((t) => t.id === id);
          next.tagIds = [...next.tagIds, id];
          next.tagNames = [...next.tagNames, hit?.name ?? `标签 #${id}`];
        }
        break;
      }
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
          {dim === 'tagIds' ? (
            <>
              <input className="vt-pop-search" placeholder="🔍 输入标签名…" value={tagText} autoFocus
                     onChange={(event) => setTagText(event.target.value)} />
              <div className="vt-pop-mode">
                {([['AND', '全部匹配'], ['OR', '任一匹配']] as const).map(([mode, label]) => (
                  <button key={mode} type="button" className={cls('btn-mini', filter.tagMode === mode && 'on')}
                          onClick={() => onFilter({ ...filter, tagMode: mode })}>{label}</button>
                ))}
              </div>
              <div className="vt-pop-body">
                <button type="button" className={cls('vt-pop-item', filter.tagIds.length === 0 && 'on')}
                        onClick={() => { onFilter({ ...filter, tagIds: [], tagNames: [] }); setTagText(''); }}>
                  <span>不限</span>
                </button>
                {tagHits.map((tag) => (
                  <button key={tag.id} type="button" className={cls('vt-pop-item', filter.tagIds.includes(tag.id) && 'on')}
                          onClick={() => pick('tagIds', tag.id)}>
                    <span>{filter.tagIds.includes(tag.id) ? '☑' : '☐'} {tag.name}</span>
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
/**
 * 编辑器里的「结尾时间账」提示（用户 2026-09-20：「防止播放不全」）。
 *
 * 复用 Remotion 侧同一套纯函数（`endingPlayback`），所以预览与成片的判断不会两套口径。
 * 只算「名单」：固定头（标题/文案/统计）是常驻的，不参与计时。
 */
function endingHint(config: EditorConfig): string | null {
  const rows = Math.min(config.ids.length, LIST_MAX);
  if (rows === 0 || config.detailShow.endingList === false) return null;
  const paging = config.detailShow.endingPaging === true;
  const plan = endingPlayback({
    durationSeconds: config.endingSec,
    rows,
    paging,
    rowsPerPage: endingRowsPerPage({
      hasTitle: config.endingTitle.trim() !== '',
      hasText: config.endingText.trim() !== '',
      hasStats: config.detailShow.endingStats === true,
    }),
    speed: config.endingScrollSpeed,
  });
  const mode = paging
    ? `${plan.pages} 页 · 每页 ${plan.pageSeconds.toFixed(1)}s`
    : `滚动 ${plan.scrollSpeed.toFixed(2)} 屏/秒`;
  return `结尾名单：${rows} 部 → ${mode}${plan.warning ? '　⚠ 偏紧，建议把「结尾时长」调大' : ''}`;
}

/** 候选卡与开场秀芯片共用的拖拽源（HTML5 dnd 在 dragover 里读不到 dataTransfer，所以用 ref 记）。 */
function movedOpening(order: number[], index: number, delta: number): number[] {
  const next = index + delta;
  if (next < 0 || next >= order.length) return order;
  const ids = [...order];
  [ids[index], ids[next]] = [ids[next], ids[index]];
  return ids;
}

/**
 * 「📋 导出清单」对话框（2026-09-20 用户）：候选/已选 → 可勾选元素 + 按年份分组 → 预览/复制/下载。
 *
 * 文本生成在 `export-list.ts`（纯函数 + 单测）；这里只管取数、勾选与导出动作。
 */
/**
 * 「导出」弹窗（2026-09-29 用户拍板）：**一个按钮两个 tab** —— 导出清单 / 设置封面。
 *
 * 为什么合并：两者都吃同一份草稿上下文（已选媒体、标题、片段），分成两个入口反而要多跳一次。
 * 清单 tab 的内容与行为一字未改（原来它自己占一个弹窗，现在只降级成 tab 里的内容）。
 */
function ExportDialog({ config, filter, onClose, patch }: {
  config: EditorConfig;
  filter: CandidateFilter;
  onClose: () => void;
  patch: Patch;
}) {
  const [tab, setTab] = React.useState<'list' | 'cover'>('list');
  return (
    <div className="vt-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={cls('vt-panel', 'vt-export-panel', tab === 'cover' && 'vt-cover-panel')}
           onMouseDown={(event) => event.stopPropagation()}>
        <div className="vt-export-tabs">
          <button type="button" className={cls('vt-tab', tab === 'list' && 'on')} onClick={() => setTab('list')}>📋 导出清单</button>
          <button type="button" className={cls('vt-tab', tab === 'cover' && 'on')} onClick={() => setTab('cover')}>🖼 设置封面</button>
          <span className="sp" />
          <button type="button" className="btn-mini" onClick={onClose}>关闭</button>
        </div>
        {tab === 'list'
          ? <ExportListTab config={config} filter={filter} onClose={onClose} />
          : <CoverTab config={config} patch={patch} />}
      </div>
    </div>
  );
}

function ExportListTab({ config, filter, onClose }: {
  config: EditorConfig;
  filter: CandidateFilter;
  onClose: () => void;
}) {
  const [scope, setScope] = React.useState<'candidate' | 'selected'>('candidate');
  const [toggles, setToggles] = React.useState<ExportToggles>(DEFAULT_TOGGLES);
  const [rows, setRows] = React.useState<MediaExportRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request = scope === 'candidate'
      ? api.listExport(filter)
      : api.listExport({ ...defaultFilter(), q: '' }, config.ids);
    request
      .then((list) => {
        if (cancelled) return;
        // 已选：按**推荐顺序**排（后端按年份/ID 排，不是用户排的那一版）
        setRows(scope === 'selected'
          ? config.ids.map((id) => list.find((row) => row.id === id)).filter((row): row is MediaExportRow => Boolean(row))
          : list);
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : '取数失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scope, config.ids.join(','), JSON.stringify(filter)]);   // eslint-disable-line react-hooks/exhaustive-deps

  const text = React.useMemo(
    () => buildListText(rows, toggles, scope === 'candidate' ? `${config.title || '候选清单'}（候选）` : config.title || '推荐清单'),
    [rows, toggles, scope, config.title],
  );
  // 去重提示：显示实际保留几部（去重只影响清单文本/预览，**不动已选媒体与视频**）
  const shown = React.useMemo(() => prepareRows(rows, toggles).length, [rows, toggles]);
  const deduped = toggles.dedupe && shown < rows.length;

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((value) => (value === message ? null : value)), 2000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash(`已复制 ${rows.length} 部`);
    } catch {
      // 剪贴板 API 在非 https / 无权限时会抛：退回选中 textarea 让用户 Ctrl+C
      textareaRef.current?.select();
      flash('自动复制被拒：已全选，按 Ctrl+C');
    }
  };

  const download = () => {
    const name = (config.title || '推荐清单').replace(/[\\/:*?"<>|]/g, '_');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    flash('已下载 .txt');
  };

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  // 只用于**布尔**开关（sortBy 是枚举，单独写 select）
  const element = (key: BooleanToggleKey, label: string, disabled = false) => (
    <label className={cls('vt-inline', disabled && 'off')}>
      <input type="checkbox" checked={toggles[key]} disabled={disabled}
             onChange={(event) => setToggles({ ...toggles, [key]: event.target.checked })} />{label}
    </label>
  );

  return (
    <>
      <div className="vt-export-row">
          <span className="vt-export-label">清单</span>
          <label className="vt-inline"><input type="radio" checked={scope === 'candidate'} onChange={() => setScope('candidate')} />候选（当前筛选）</label>
          <label className="vt-inline"><input type="radio" checked={scope === 'selected'} onChange={() => setScope('selected')} />已选（推荐顺序）</label>
          <span className="sp" />
          <span className="vt-hint">{loading ? '读取中…' : `${rows.length} 部`}</span>
        </div>
        <div className="vt-export-row">
          <span className="vt-export-label">元素</span>
          {element('index', '序号')}
          {element('title', '标题')}
          {element('year', '年份', toggles.groupByYear)}
          {element('episode', '集数')}
          {element('tags', '标签')}
          {element('subcategory', '分类')}
          {element('source', '来源')}
          {element('clips', '片段数')}
        </div>
        <div className="vt-export-row">
          <span className="vt-export-label">版式</span>
          {element('header', '标题行')}
          {element('groupByYear', '按年份分组')}
          {element('dedupe', '去重（只留本体）')}
          <label className="vt-inline">
            排序
            <select value={toggles.sortBy}
                    onChange={(event) => setToggles({ ...toggles, sortBy: event.target.value as ExportToggles['sortBy'] })}>
              <option value="year-desc">年份 ↓（新→旧）</option>
              <option value="year-asc">年份 ↑（旧→新）</option>
              <option value="none">不排序</option>
            </select>
          </label>
          {toggles.groupByYear && toggles.sortBy !== 'none' ? <span className="vt-hint">（分组时排序作用于组顺序）</span> : null}
          {deduped ? <span className="vt-hint">去重后 {shown} 部（原 {rows.length} 部）</span> : null}
        </div>
        {error ? <p className="vt-export-error">取数失败：{error}</p> : null}
        <textarea ref={textareaRef} className="vt-export-text" readOnly value={text} spellCheck={false} />
        <div className="vt-export-actions">
          <span className="vt-hint">{toast ?? '可直接粘贴给别人'}</span>
          <span className="sp" />
          <button type="button" className="btn-mini" disabled={rows.length === 0} onClick={() => void copy()}>复制文本</button>
          <button type="button" className="btn-mini" disabled={rows.length === 0} onClick={download}>下载 .txt</button>
          <button type="button" className="btn-mini" onClick={onClose}>关闭</button>
        </div>
    </>
  );
}

export function BasketPane({ config, patch, filter, onFilter, onSelect, highlightMediaId, mediaBriefs, notify }: {
  config: EditorConfig;
  patch: Patch;
  /** 宿主 toast（候选项翻页撞上重复条目时报警 + 给一个重载按钮，不再静默少几部）。 */
  notify: (message: string, action?: { label: string; run: () => void }) => void;
  /** 候选筛选（提升到编辑器层：可随模板保存、套用时重算候选）。 */
  filter: CandidateFilter;
  onFilter: (filter: CandidateFilter) => void;
  /** 点卡片 = 右侧对象轴切到该媒体（参数跟着对象走）。 */
  onSelect: (selection: import('./timeline').Selection) => void;
  /** 右侧当前媒体 id（高亮对应卡片，保持两栏同步）；不传则不高亮。 */
  highlightMediaId?: number;
  /** 已选媒体的标题索引：开场代表秀的芯片要显示“哪几部”，而它们可能不在当前候选页里。 */
  mediaBriefs: MediaBrief[];
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
  const [exportOpen, setExportOpen] = React.useState(false);
  const [expandChips, setExpandChips] = React.useState(false);
  const [outsideSelected, setOutsideSelected] = React.useState(0);
  const [recomputing, setRecomputing] = React.useState(false);
  const filterBtn = React.useRef<HTMLButtonElement>(null);
  const bulkBtn = React.useRef<HTMLButtonElement>(null);
  const [clipMedia, setClipMedia] = React.useState<MediaBrief | null>(null);
  const [loading, setLoading] = React.useState(false);
  /** 列表镜像：翻页 effect 只依赖 `query`，读 `list` 会拿到过期闭包，所以用 ref 取"当前已加载"。 */
  const listRef = React.useRef<MediaBrief[]>([]);
  listRef.current = list;
  const [tab, setTab] = React.useState<'candidates' | 'selected'>('candidates');
  /** 候选按首播年份分组（用户 2026-09-26 要求）。默认关 —— 不开时保持原来的 id 倒序。 */
  const [groupByYear, setGroupByYear] = React.useState(false);
  /** 候选排序（用户 2026-09-26）：默认 id 倒序；年份可在**不分组**时单独排。 */
  const [sortOrder, setSortOrder] = React.useState<'default' | 'year-desc' | 'year-asc'>('default');
  /** 只看已勾选（用户 2026-09-26）：候选收窄到 config.ids，其它筛选维度照常 AND。 */
  const [onlySelected, setOnlySelected] = React.useState(false);
  const pageSize = 30;
  /** 只看已选时按 ids 取数：**一次取满**（已选是手挑的小集合，分页只会剩个永远点不完的按钮）。 */
  const onlyIds = onlySelected ? config.ids : null;

  // filter 是对象：用序列化签名做依赖，直接依赖引用会无限重取。
  // 分组 / 只看已选 / 排序也并进签名：切一下 = 换一次请求序列（回第 1 页 + 换排序），
  // 复用已有的「页码与签名绑成原子状态」机制，不另写一套重置逻辑。只看已选时把 ids 也算进去 ——
  // 否则取消勾选的卡片不会当场消失。
  const filterKey = JSON.stringify({
    ...filter, __groupByYear: groupByYear, __onlySelected: onlySelected, __sort: sortOrder,
    __ids: onlySelected ? config.ids.join(',') : '',
  });
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
      case 'tagIds': next.tagIds = []; next.tagNames = []; break;
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
    /**
     * 取一页并拼上；`retried` = 本 offset 已重取过一次。
     *
     * 为什么非要校验：拼列表只能靠"页"对齐（offset = (at-1)*pageSize）。一旦某一页返回的
     * 行与前面重了/少了（后端排序并列抖动、集合在会话中被改写、或某页请求失败而页码照样前进），
     * 旧写法是**静默按 id 去重丢掉**，于是列表永远少几部、年份段错位，只有整页重载才能恢复
     * （用户 2026-09-26 报「候选某年只显示 5 部，与收藏夹数量不符，强刷就好」）。
     * 现在同一 offset 重取一次；再撞上就明确报出来，别让人以为库里就这么多。
     */
    const load = async (retried: boolean): Promise<void> => {
      // 排序唯一出口：分组必须按年份排（否则年份交错、分段无意义）；不分组时由排序选项决定。
      const sort = groupByYear || sortOrder !== 'default' ? 'year' : undefined;
      const order = sortOrder === 'year-asc' ? 'asc' : 'desc';
      // 已选被清空（还在「只看已选」里）：直接空列表。留意后端 `Math.max(limit,1)` 会把 limit=0 抬成 1，
      // 靠 limit 取空是取不到的。
      if (onlyIds && onlyIds.length === 0) { setList([]); setTotal(0); return; }
      const [items, count] = await Promise.all([
        api.media({
          limit: onlyIds ? onlyIds.length : pageSize,
          offset: onlyIds ? 0 : (at - 1) * pageSize,
          // 没选排序时干脆不带 order：后端缺省就是 id 倒序（也免得多一个无意义的 query 参数）
          filter, sort, order: sort ? order : undefined, ids: onlyIds ?? undefined,
        }),
        onlyIds ? Promise.resolve(0) : api.mediaCount(filter),
      ]);
      if (cancelled) return;
      // 只看已选：命中数 = 实际条数（被后端筛掉的已删媒体不会让「加载更多」永远点不完）
      setTotal(onlyIds ? items.length : count);
      // 末页天然不足 30 条：只有"拿满页却有重复"才算异常。
      // 重复分两种，都要当场看出来：① 与已加载的撞（后端翻页重叠/集合被改写）② 页内自己撞；
      // 两者都不该被静默吞掉，也都不该把同一张卡插两遍。
      const known = new Set(listRef.current.map((seen) => seen.id));
      const fresh = items.filter((item) => (known.has(item.id) ? false : (known.add(item.id), true)));
      const duplicated = at > 1 && fresh.length < items.length;
      if (duplicated && !retried) {
        await load(true);
        return;
      }
      if (duplicated) {
        notify('候选加载出现重复条目，已重试仍未对齐', {
          label: '重载候选库',
          // 清空后回第 1 页：整条请求序列重来（当前 seq 不变，所以不用碰 filterKey）
          run: () => { setList([]); setQuery((current) => ({ ...current, page: 1 })); },
        });
      }
      setList((current) => (at === 1 ? items : [...current, ...fresh]));
    };
    load(false)
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [query]);   // eslint-disable-line react-hooks/exhaustive-deps  （filter/query.key 一一对应）

  const hasMore = list.length < total;

  /** 单张候选卡（分组与非分组共用）。内部不用 hook，所以可以是普通函数。 */
  const renderCard = (item: MediaBrief) => {
    // 媒体封面统一取值链（用户 2026-09-20 定稿）：Bangumi 外链 → 显式封面 → 片段帧兜底
    const cover = item.coverPath || item.externalCoverUrl || item.fallbackCoverPath;
    const clipCount = config.mediaClips[String(item.id)]?.order.length ?? 0;
    return (
      <div key={item.id} className={cls('vt-media-card', selected.has(item.id) && 'selected', picked === item.id && 'picked')} draggable
           title="双击进入媒体详情"
           onClick={() => onSelect({ kind: 'media', mediaId: item.id, title: item.title })}
           onDoubleClick={(event) => {
             // 双击卡上的勾选框/按钮不该跳走（它们自己有单击动作）
             if ((event.target as HTMLElement).closest('input,button')) return;
             openHostMediaDetail(item.id);
           }}
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
          {/* 开场秀：拖卡也可以（旧交互保留），但拖拽不发现 → 再给一个按钮（用户 2026-09-20） */}
          <button type="button"
                  className={cls('vt-open-badge', config.openingIds.includes(item.id) && 'has')}
                  disabled={config.openingIds.includes(item.id)}
                  title={config.openingIds.includes(item.id)
                    ? '已在开场秀（第一个 = 开场主推，可在左侧名单里排序/移出）'
                    : '加入开场秀（追加到名单末尾）'}
                  onClick={(event) => { event.stopPropagation(); patch({ openingIds: [...config.openingIds, item.id] }); }}>
            {config.openingIds.includes(item.id) ? '🎬 开场秀 ✓' : '🎬 开场秀'}
          </button>
          {/* 推荐等级：点一下**循环**下一档：未标 → 强推 → 推荐 → 值得一看 → 一般 → 未标（可取消，用户 2026-09-26 报「只能勾选不能取消」）；细节仍可在右侧「当前媒体」改 */}
          <button type="button"
                  className={cls('vt-tier-badge', tierLookOf(markOf(config, item.id).tier).decorated && 'has')}
                  style={{ background: tierLookOf(markOf(config, item.id).tier).badgeBackground, color: tierLookOf(markOf(config, item.id).tier).badgeText,
                           opacity: tierLookOf(markOf(config, item.id).tier).decorated ? 1 : 0.55 }}
                  title={`推荐等级：${markOf(config, item.id).tier === undefined ? '未标' : tierLookOf(markOf(config, item.id).tier).name}（点击循环：未标 → 强推 → 推荐 → 值得一看 → 一般 → 未标）`}
                  onClick={(event) => {
                    event.stopPropagation();
                    const current = markOf(config, item.id).tier;
                    // 循环里**包含 undefined**（取消），所以最后一档再点一下就回到未标
                    patchMark(config, patch, item.id, { tier: cycleTier(current) });
                  }}>
            {markOf(config, item.id).tier === undefined ? '未标' : tierLookOf(markOf(config, item.id).tier).name}
          </button>
        </div>
        <div className="vt-media-title" title={item.title}>{item.title}</div>
        <div className="vt-media-foot">
          <span className="vt-media-year">{item.year ?? '—'}</span>
        </div>
      </div>
    );
  };
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

  /**
   * 拖拽结束兜底（2026-09-27）：`dragover` 把 `.over`（虚线高亮）点亮后，
   * 只要**松手位置不在那两个容器上**（拖到别的面板 / 窗口外 / 拖拽被取消），
   * `dragleave` 就不会来 → 虚线框残留不走。收尾交给全局 `dragend` / `drop`。
   */
  React.useEffect(() => {
    const clear = () => setDropZone(null);
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  /** 拖拽载荷：被拖的媒体 id（HTML5 DnD 在编辑器内部只传 id，不需要序列化对象）。 */
  const draggedId = React.useRef<number | null>(null);

  /**
   * 标题查询（用户 2026-09-20：「推荐顺序后续不显示名称了，都是 #id」）。
   *
   * 根因：旧代码只查 `list`（**候选页/当前筛选**的结果）；已选媒体只要不在当前筛选或当前页里
   * （左栏那行“N 部不在当前筛选内”就是这个情况）就退成 `#id`。
   * `mediaBriefs` 来自会话输入，覆盖**全部已选媒体** → 先查它。
   */
  const titleOf = (id: number): string =>
    mediaBriefs.find((value) => value.id === id)?.title
    ?? list.find((value) => value.id === id)?.title
    ?? `#${id}`;

  const onDropTo = (zone: 'list' | 'opening') => (event: React.DragEvent) => {
    event.preventDefault();
    setDropZone(null);
    const id = Number(event.dataTransfer.getData('text/vt-media')) || draggedId.current;
    draggedId.current = null;
    if (!id) return;
    if (zone === 'opening') {
      // 拖入的可能是**还没加入推荐**的候选 → 一并加入，否则 plan 会把它过滤掉（静默无效）
      // 有内容 = 用这个顺序；一个都不放 = 按推荐顺序（用户 2026-09-20）
      patch({
        ids: config.ids.includes(id) ? config.ids : [...config.ids, id],
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
      if (hits > 20 && !(await confirmDialog({
        title: '替换已选',
        msg: `将用当前筛选命中的 ${hits} 部替换已选的 ${config.ids.length} 部（手工挑选的会被移除），继续？`,
        okText: '替换',
      }))) return;
      const all = hits === 0 ? [] : await api.media({ limit: hits, offset: 0, filter });
      const ids = all.map((item) => item.id);
      patch({ ids, openingIds: config.openingIds.filter((id) => ids.includes(id)) });
      // 取**全部**命中（2026-09-25 用户报「候选 557、已选只有 200」）：原来写死 `limit: 500`，
      // 而后端又把 limit 钳到 200 → 实际只填进 200 部；且下面那句提示还谎报「只取前 500 部」。
      // 两端上限都已去掉，这里按实际命中数取满。
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
          {/* 未加载完时把"已加载"一并写出来：只印 total 会被误读成"这一年只有这么多" */}
          {loading && list.length === 0 ? '…' : hasMore ? `已加载 ${list.length} / ${total} 部` : `${total} 部`}
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
        <span className="sp" />
        <button type="button" className="btn-mini" title="导出清单 / 设置封面"
                onClick={() => setExportOpen(true)}>📋 导出</button>
      </div>

      {exportOpen ? <ExportDialog config={config} filter={filter} patch={patch} onClose={() => setExportOpen(false)} /> : null}

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
                <button type="button" className={cls('btn-mini', 'vt-group-btn', groupByYear && 'active')}
                        title={groupByYear ? '取消按年份分组' : '按首播年份分组（组内顺序跟排序选项）'}
                        onClick={() => setGroupByYear((value) => !value)}>📅 按年份</button>
                <select className="vt-sort-sel" value={sortOrder} title="候选排序"
                        onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}>
                  <option value="default">默认排序</option>
                  <option value="year-desc">年份 ↓ 新→旧</option>
                  <option value="year-asc">年份 ↑ 旧→新</option>
                </select>
                <button type="button" className={cls('btn-mini', 'vt-group-btn', onlySelected && 'active')}
                        disabled={config.ids.length === 0}
                        title={onlySelected
                          ? '显示全部候选'
                          : `只看已勾选的 ${config.ids.length} 部（其它筛选条件照常生效）`}
                        onClick={() => setOnlySelected((value) => !value)}>✓ 已勾选</button>
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
        {groupByYear
          /*
           * 年份段与卡片**平铺成同一层**（不再包 Fragment）：
           * 包一层 Fragment 时，从「分组 31 段」切回「平铺 196 张」会留下幽灵节点
           * （实测：state 里 list=196，grid 里却是 206 张卡 + 6 个旧年份段，DOM 永远对不上 state，
           * 排序切换后读到的还是旧那张表）—— 平铺后每个子节点都是显式 key 的兄弟节点，
           * 年份段用 `y<年份>` 前缀避开媒体 id（本库真有 1887/2002/2018/2061 这类 id）。
           */
          ? yearRuns(list).flatMap((run, runIndex, all) => [
              /* key 带 runIndex：列表**还没换成年份序**的瞬态里，同一年会拆出多个连续段（id 序下年份是散开的），
                 只拿年份当 key 就是重复 key → React 又会把上一个瞬态的年份段残留下来（实测 45 个段）。 */
              <div className="vt-year-head" key={`y${run.year ?? 'none'}#${runIndex}`}>
                <span className="vt-year-num">{run.year ?? '未知年份'}</span>
                {/* 最后一段可能在无限滚动中还没取完 → 标"已加载"，避免当成该年总数 */}
                <span className="vt-year-count">
                  {hasMore && runIndex === all.length - 1 ? `已加载 ${run.items.length} 部` : `${run.items.length} 部`}
                </span>
              </div>,
              ...run.items.map(renderCard),
            ])
          : list.map(renderCard)}
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
            🎬 拖到这里 = 加入开场秀（{config.openingIds.length}）
            {/* 🎲 重排：只重摇**摆位**种子（Hero 不动）—— 用户 2026-09-20 选 A：“真随机但 Hero 不变不被遮挡” */}
            <button type="button" className="vt-roll-btn" title="重摇中景摆位（Hero 不变；预览与成片用同一个种子）"
                    onClick={() => patch({ seed: rollSeed() })}>🎲 换个摆位</button>
            {/*
             * 2026-09-20（用户）：开场秀就是**一份可排序的名单**，第一个 = 主推 Hero。
             * 旧版只给一个数字、排序藏在右侧面板里，看不出选的是哪几部、也看不出谁在打头阵。
             */}
            {config.openingIds.length > 0 ? (
              <ol className="vt-opening-order">
                {config.openingIds.map((id, index) => {
                  const title = titleOf(id);
                  return (
                    <li
                      key={id}
                      draggable
                      className={cls(index === 0 && 'hero')}
                      title={index === 0 ? '第 1 个 = 开场主推（最大那张）· 可拖拽排序' : '可拖拽排序'}
                      onDragStart={(event) => {
                        draggedId.current = id;
                        event.dataTransfer.setData('text/vt-media', String(id));
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        const from = draggedId.current;
                        if (from === null || from === id || !config.openingIds.includes(from)) return;
                        const order = config.openingIds.filter((value) => value !== from);
                        const at = order.indexOf(id);
                        order.splice(at < 0 ? order.length : at, 0, from);
                        draggedId.current = from;
                        patch({ openingIds: order });
                      }}
                    >
                      <span className="idx">{index + 1}</span>
                      <span className="vt-opening-title">{title}</span>
                      <span className="vt-selected-btns">
                        <button type="button" className="btn-mini" title="上移"
                                onClick={() => patch({ openingIds: movedOpening(config.openingIds, index, -1) })}>↑</button>
                        <button type="button" className="btn-mini" title="下移"
                                onClick={() => patch({ openingIds: movedOpening(config.openingIds, index, 1) })}>↓</button>
                        <button type="button" className="btn-mini" title="移出开场秀"
                                onClick={() => patch({ openingIds: config.openingIds.filter((value) => value !== id) })}>✕</button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <span className="vt-opening-none">
                一个都没放 → **按推荐顺序**自动取（当前 {config.ids.length} 部）
              </span>
            )}
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
                  title="双击进入媒体详情"
                  onDoubleClick={(event) => {
                    if ((event.target as HTMLElement).closest('input,button')) return;
                    openHostMediaDetail(id);
                  }}
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
                <span className="vt-selected-title">{titleOf(id)}</span>
                <span className="vt-selected-btns">
                  <button type="button" className="btn-mini" title="加入开场秀（第一个 = 开场主推）"
                          disabled={config.openingIds.includes(id)}
                          onClick={() => patch({ openingIds: [...config.openingIds, id] })}>🎬</button>
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
export function InspectorPane({ config, patch, mediaBriefs, missing, selection, rendered, variants, onVariants, focusGroup, onSelect, onOpenSearch }: {
  config: EditorConfig;
  patch: Patch;
  mediaBriefs: MediaBrief[];
  /**
   * 素材缺失清单（会话里后端判定的）。
   *
   * 2026-09-20 用户：「媒体片段删除后，推荐还占着，提示素材缺失，但是没有入口修复。要么补要么删无法操作」
   * → 原来这里只收到一个「每媒体一条」的 reason map（丢信息、显 `#id`），现在直接拿完整清单，每条都给「补/删」两个入口。
   */
  missing: import('./api').MissingClip[];
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
  const stingInput = React.useRef<HTMLInputElement>(null);
  const bgInput = React.useRef<HTMLInputElement>(null);
  /** 简介的富文本插入（工具栏按钮）：需要拿到 textarea 的选区才能"包住选中的字"。 */
  const introInput = React.useRef<HTMLTextAreaElement>(null);
  const restoreCaret = (start: number, end: number) => {
    // 受控 textarea 的值要等 React 重渲后才新 → 下一帧回填选区（无选区时选中占位文字，直接打字就替换）
    window.requestAnimationFrame(() => {
      const el = introInput.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    });
  };
  const insertMarkup = (kind: MarkupKind) => {
    const box = introInput.current;
    const start = box ? box.selectionStart : config.intro.length;
    const end = box ? box.selectionEnd : config.intro.length;
    const next = wrapInline(config.intro, start, end, kind);
    patch({ intro: next.value });
    restoreCaret(next.start, next.end);
  };
  /** 块级标记（`## ` / `- `）加在**当前行行首**，再点一次摘掉。 */
  const toggleMarkupLine = (prefix: string) => {
    const box = introInput.current;
    const caret = box ? box.selectionStart : config.intro.length;
    const next = toggleLinePrefix(config.intro, caret, prefix);
    patch({ intro: next.value });
    restoreCaret(next.start, next.start);
  };
  /**
   * 序言屏预算：与渲染侧**同一份常量/同一个估行器**（`src/rich-text.tsx`）——
   * 否则"约 N 行"会骗人。行数超限 = 渲染侧会收字号；连下限都放不下 = 会被裁。
   */
  const introBudget = React.useMemo(() => {
    if (rendered === null) return null;
    const theme = resolveTheme(rendered.input);
    // 画幅从 params 解析（编辑器手里的 rendered 只有 input，没有 plan）
    const frame = resolveParams(rendered.input.params, rendered.input);
    const blocks = parseRichText(config.intro);
    const base = Math.round(frame.height * theme.layout.bodyRatio * 1.15);
    const maxWidth = Math.round(frame.width * INTRO_LAYOUT.maxWidthRatio);
    const budget = Math.round(frame.height * INTRO_LAYOUT.maxHeightRatio);
    const fitted = fitIntroSize(blocks, base, maxWidth, budget);
    return {
      chars: plainLength(config.intro),
      blocks: blocks.length,
      scale: base === 0 ? 100 : Math.round((fitted / base) * 100),
      lines: base === 0 ? 0 : estimateIntroHeight(blocks, fitted, maxWidth) / (fitted * INTRO_LAYOUT.lineHeight),
      maxLines: fitted === 0 ? 0 : budget / (fitted * INTRO_LAYOUT.lineHeight),
      clipped: estimateIntroHeight(blocks, fitted, maxWidth) > budget + 1,
      readable: config.introSec * 5,
    };
  }, [config.intro, config.introSec, rendered]);
  /**
   * 分组开关：默认只开「当前对象」那组（和「素材缺失」）；用户点过的开关**记在本机**（localStorage），
   * 切对象/切 tab/刷新后保持 —— 但不进草稿与模板（那是内容，不是视图偏好）。
   */
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => ({ object: true, missing: true, ...loadGroupOpen() }));
  // 素材缺失是**错误态**：一旦出现就自动展开（localStorage 里可能记着它是折叠的）
  const missingAutoOpened = React.useRef(false);
  React.useEffect(() => {
    if (missing.length === 0) { missingAutoOpened.current = false; return; }
    if (missingAutoOpened.current) return;
    missingAutoOpened.current = true;
    setOpenGroups((current) => ({ ...current, missing: true }));
  }, [missing.length]);
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

  const addSting = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    patch({ stingTracks: [{ name: file.name, base64: await fileToBase64(file) }] });
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
      {/* 素材缺失**置顶**：它是错误态，不该埋在面板最下面（用户："太不明显了"） */}
      {missing.length > 0 ? (
        <Group id="missing" kicker="Missing" title={`素材缺失 ${missing.length} 项`} open={groupOpen('missing')} onToggle={toggleGroup}>
          {/* 每一条都带「去补片段 / 移除这一条」；底部给一个「清理全部失效」 */}
          <ul className="vt-missing-list">
            {missing.map((item) => {
              const title = mediaBriefs.find((value) => value.id === item.mediaId)?.title ?? `#${item.mediaId}`;
              // 会话输入里这部媒体的**现存片段数**：0 就说明「去补」无门（素材库里已经一个不剩）
              const available = rendered?.input.media.find((value) => value.mediaId === item.mediaId)?.clips.length ?? 0;
              return (
                <li key={`${item.mediaId}-${item.clipId}`}>
                  <span className="vt-missing-text">
                    <b>{title}</b>　{item.title || `片段 #${item.clipId}`}
                    <small>
                      {item.suggestedSourceTitle
                        ? `这个片段属于同系列《${item.suggestedSourceTitle}》—— 一键改成「借片段」即可`
                        : `${item.reason}${available === 0 ? '　·　库里已无片段，只能移除' : ''}`}
                    </small>
                  </span>
                  <span className="vt-selected-btns">
                    {item.suggestedSourceMediaId ? (
                      <button type="button" className="btn-mini" style={{ color: '#ffd166', borderColor: 'rgba(255,209,102,.5)' }}
                              title={`把片段 ${item.clipId} 改挂到《${item.suggestedSourceTitle}》（只写 sources，不删片段）`}
                              onClick={() => patch({ mediaClips: attachWithSource(config.mediaClips, item.mediaId, item.clipId, item.suggestedSourceMediaId!) })}>
                        ↩ 挂到同系列
                      </button>
                    ) : (
                      <button type="button" className="btn-mini" disabled={available === 0}
                              title={available === 0 ? '这部媒体在素材库里已经没有任何片段了' : '切到这部媒体，在「对象轴 → 片段」里换一个片段'}
                              onClick={() => onSelect({ kind: 'media', mediaId: item.mediaId, title })}>去补</button>
                    )}
                    <button type="button" className="btn-mini" title="从推荐里拿掉这个片段（只改草稿，不动素材库）"
                            onClick={() => patch({ mediaClips: withoutClip(config.mediaClips, item.mediaId, item.clipId) })}>移除</button>
                  </span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn-mini" onClick={() => patch({ mediaClips: dropAllMissing(config.mediaClips, missing) })}>
            清理全部失效（{missing.length}）
          </button>
        </Group>
        ) : null}

      <Group id="object" kicker="Object" title={selection.kind === 'global' ? '全局参数' : selectionHeader(selection, selectedMedia, selectedClip)}
             open={groupOpen('object')} onToggle={toggleGroup} forceOpen={focusGroup}>
        {selectedMedia ? (
          <div className="vt-selected-obj">
            <Field label="推荐等级" hl hint="再点一次同一档 = 取消（未标等级）；不标的垫在组最后、也不进结尾回顾">
              <span className="vt-inline-group">
                {RECOMMEND_TIERS.map((name, rank) => {
                  const on = markOf(config, selectedMedia.mediaId).tier === rank;
                  return (
                    <button key={name} type="button" className={cls('btn-mini', on && 'active')}
                            title={on ? '再点一次取消这一档' : undefined}
                            style={on ? { background: tierLookOf(rank).badgeBackground, color: tierLookOf(rank).badgeText, borderColor: 'transparent' } : undefined}
                            onClick={() => patchMark(config, patch, selectedMedia.mediaId,
                                                    { tier: toggleTier(markOf(config, selectedMedia.mediaId).tier, rank) })}>{name}</button>
                  );
                })}
              </span>
            </Field>
            <Field label="推荐理由" hint="一句话（≤30 字）；网格卡最多两行，超出自动省略号">
              <input value={markOf(config, selectedMedia.mediaId).reason ?? ''} maxLength={30}
                     placeholder="例：年度最佳，情绪压满"
                     onChange={(event) => patchMark(config, patch, selectedMedia.mediaId, { reason: event.target.value })} />
            </Field>
            <Field label="片内顺序（选中对象）" hl>
              <span className="vt-inline">
                #{selectedMedia.order}
                <button type="button" className="btn-mini" onClick={() => moveMedia(config, patch, selectedMedia.mediaId, -1)}>↑ 上移</button>
                <button type="button" className="btn-mini" onClick={() => moveMedia(config, patch, selectedMedia.mediaId, 1)}>↓ 下移</button>
              </span>
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
        <Field label="简介" hint={`填写后出现序言页${rendered?.input.style === 'cinema' ? '（银幕式只有一行位，只显示第一块）' : ''}。行首：## 小标题 / - 条目；行内：**加粗**、==重点==、!!提醒!!、++信息++`}>
          <div className="vt-rich-edit">
            <div className="vt-rich-bar">
              <button type="button" className="btn-mini" title="行首加 `## `（小标题）／再点取消" onClick={() => toggleMarkupLine('## ')}>小标题</button>
              <button type="button" className="btn-mini" title="行首加 `- `（条目）／再点取消" onClick={() => toggleMarkupLine('- ')}>条目</button>
              <button type="button" className="btn-mini" title="用 ** ** 包住选中的字（没选中就插占位文字）" onClick={() => insertMarkup('bold')}>加粗</button>
              {TONES.map((tone) => (
                <button key={tone} type="button" className="btn-mini" title={TONE_TITLE[tone]}
                        onClick={() => insertMarkup(tone)}>{TONE_LABEL[tone]}</button>
              ))}
            </div>
            <textarea ref={introInput} rows={3} value={config.intro}
                      onChange={(event) => patch({ intro: event.target.value })} />
            {introBudget ? (
              <div className={cls('vt-rich-budget', introBudget.clipped && 'bad')}>
                <span>{introBudget.chars} 字 · {introBudget.blocks} 块 · 约 {Math.round(introBudget.lines)} 行 / 上限 {Math.floor(introBudget.maxLines)} 行</span>
                <span>* 字号 {introBudget.scale}%{introBudget.scale < 100 ? '（内容偏多，成片会自动缩小）' : ''}</span>
                {introBudget.clipped ? <span>内容过长，成片会被裁切 —— 删减到约 {Math.round(introBudget.readable)} 字内</span> : null}
                {!introBudget.clipped && introBudget.chars > introBudget.readable
                  ? <span className="note">序言 {config.introSec} 秒 ≈ 易读 {introBudget.readable} 字，现在偏多（观众可能来不及读）</span>
                  : null}
              </div>
            ) : null}
          </div>
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
        <Field label="按推荐等级再分组">
          <label className="vt-inline">
            <input type="checkbox" checked={config.tierGroup}
                   onChange={(event) => patch({ tierGroup: event.target.checked })} />
            同一分组内按 强推 → 推荐 → 值得一看 → 一般 依次成群（未标等级的垫最后）
          </label>
          <span className="vt-hint">前一级选了「不分组」也生效（等于全片按等级分组）；这一年里一个等级都没标时不切，结构保持原样；关掉就退回旧结构（结尾也只回顾第 1 档）</span>
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
        <Field label="显示时长（秒）" hint="开场 / 序言 / 章节 / 资料卡 / 片名卡 / 结尾（上不封顶，可自由发挥；下限保留是为了别出空段）">
          <span className="vt-durations">
            {/* 2026-09-26 用户：「显示时长无限制可自由发挥」→ 去掉 HTML `max`（旧上限：20/10/10/15/10/5 秒） */}
            {([['openingSec', '开场', 2], ['introSec', '序言', 1], ['groupSec', '章节', 1], ['detailSec', '资料', 3], ['titleSec', '片名卡', 1], ['endingSec', '结尾', 1]] as const)
              .map(([key, label, min]) => (
                <label key={key} className="vt-duration">
                  <span>{label}</span>
                  <input type="number" min={min} value={config[key]}
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
        {/* 片名卡（银幕式）：备注 / 推荐理由 两个**独立**开关（2026-09-29 用户：「推荐片名卡备注自定义勾选是否显示」）。
            「备注」没勾过时**跟随上面的「详情显示·备注」**（老草稿行为不变），一旦点过就变成显式值；
            「推荐理由」默认关 —— 以前填过的理由不该突然出现在成片里。
            勾选状态与渲染侧同源于 `titleCardShow`（`src/params.ts`），别在两边各写一遍。 */}
        <Field label="片名卡" hint="银幕式">
          <span className="vt-inline-group">
            <label className="vt-inline"><input type="checkbox" checked={titleCardShow(config.detailShow).note}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, titleNote: event.target.checked } })} />备注</label>
            <label className="vt-inline"><input type="checkbox" checked={titleCardShow(config.detailShow).reason}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, titleReason: event.target.checked } })} />推荐理由（自定义）</label>
          </span>
        </Field>
        {/* 结尾（落款）左侧：2026-09-20 用户「显示序号 名称 年份即可，或者做成可配置」→ 默认名单+序号+年份，统计可选 */}
        <Field label="结尾名单" hint="落款幕左侧">
          <span className="vt-inline-group">
            <label className="vt-inline"><input type="checkbox" checked={config.detailShow.endingWall !== false}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, endingWall: event.target.checked } })} />封面墙</label>
            <label className="vt-inline"><input type="checkbox" checked={config.detailShow.endingList !== false}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, endingList: event.target.checked } })} />名单</label>
            <label className="vt-inline"><input type="checkbox" checked={config.detailShow.endingIndex !== false}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, endingIndex: event.target.checked } })} />序号</label>
            <label className="vt-inline"><input type="checkbox" checked={config.detailShow.endingYear !== false}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, endingYear: event.target.checked } })} />年份</label>
            <label className="vt-inline"><input type="checkbox" checked={config.detailShow.endingPaging === true}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, endingPaging: event.target.checked } })} />翻页</label>
            <label className="vt-inline"><input type="checkbox" checked={config.detailShow.endingStats === true}
              onChange={(event) => patch({ detailShow: { ...config.detailShow, endingStats: event.target.checked } })} />统计行</label>
            {/* 时间账：名单/翻页会不会来不及播完（用户 2026-09-20：「防止播放不全」） */}
            {endingHint(config) ? <span className="vt-ending-hint">{endingHint(config)}</span> : null}
          </span>
        </Field>
      </Group>

      <Group id="variants" kicker="Variants" title={`导出变体（${variants.length}）`} open={groupOpen('variants')} onToggle={toggleGroup} forceOpen={focusGroup}>
        <VariantGroup variants={variants} onVariants={onVariants} />
      </Group>

      <Group id="audio" kicker="Audio" title="背景音乐（BGM）" open={groupOpen('audio')} onToggle={toggleGroup} forceOpen={focusGroup}>
        <button type="button" className="btn-mini" onClick={() => bgmInput.current?.click()}>🎵 添加音频</button>
        <input ref={bgmInput} type="file" accept="audio/*" multiple hidden
               onChange={(event) => { void addBgm(event.target.files); event.target.value = ''; }} />
        <Field label="转场音乐">
          <button type="button" className="btn-mini" onClick={() => stingInput.current?.click()}>🎵 选过渡音乐</button>
          <input ref={stingInput} type="file" accept="audio/*" hidden
                 onChange={(event) => { void addSting(event.target.files); event.target.value = ''; }} />
          {config.stingTracks.length > 0 ? (
            <button type="button" className="btn-mini" onClick={() => patch({ stingTracks: [] })}>移除</button>
          ) : null}
        </Field>
        {config.stingTracks.length > 0 ? (
          <Field label="转场音音量"><Range value={config.stingVolume} min={0} max={100} step={5} suffix="%"
                 onChange={(value) => patch({ stingVolume: value })} /></Field>
        ) : null}
        <ul className="vt-bgm-list">
          {config.bgmTracks.map((track, index) => (
            <li key={`${track.name}-${index}`}>
              <span>{track.name}</span>
              <button type="button" className="btn-mini"
                      onClick={() => patch({ bgmTracks: config.bgmTracks.filter((_, i) => i !== index) })}>✕</button>
            </li>
          ))}
        </ul>
        {/* 片段原声：一个旋钮覆盖「静音」(0) 与「调小」(1~99)（用户 2026-09-20） */}
        <Field label="片段原声音量"><Range value={config.clipVolume} min={0} max={100} step={5} suffix="%"
               onChange={(value) => patch({ clipVolume: value })} />
          <button type="button" className="btn-mini" onClick={() => patch({ clipVolume: config.clipVolume === 0 ? 100 : 0 })}>
            {config.clipVolume === 0 ? '恢复原声' : '全静音'}
          </button>
        </Field>
        {/* BGM 播放范围（用户 2026-09-20：先要「只在开头和结尾」，再要「片名卡也顺带播」）
            → 多选集合：`all` / `none` / `opening,cards,ending` 的任意子集 */}
        <Field label="BGM 播放范围">
          <div className="vt-inline-group">
            <label className="vt-inline">
              <input type="checkbox" checked={config.bgmRange === 'all'}
                     onChange={(event) => patch({ bgmRange: event.target.checked ? 'all' : 'opening,cards,ending' })} />
              全程
            </label>
            {config.bgmRange === 'all' ? null : (
              <>
                {BGM_SEGMENTS.map(([key, label]) => (
                  <label key={key} className="vt-inline">
                    <input type="checkbox" checked={config.bgmRange.split(',').includes(key)}
                           onChange={(event) => patch({ bgmRange: toggleBgmSegment(config.bgmRange, key, event.target.checked) })} />
                    {label}
                  </label>
                ))}
                {config.bgmRange === 'none' ? <span className="vt-hint">一段都没勾 → 全片不放 BGM</span> : null}
              </>
            )}
          </div>
        </Field>
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


          </div>
        </div>
      </div>
    </section>
  );
}
