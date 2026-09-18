/**
 * 编辑器面板：工具栏 / 媒体篮子 / Inspector（阶段 1 为扁平参数面板；阶段 3 再按对象轴重排）。
 *
 * 交互约定：所有改动通过 `patch` 写回配置 → 本地参数即时生效（见 `state.ts`）。
 */
import React from 'react';
import { api, type ClipBrief, type EditorConfig, type MediaBrief, type MediaClips } from './api';
import { fileToBase64 } from './state';

type Patch = (patch: Partial<EditorConfig>) => void;

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

function Group({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className={cls('vt-group', open && 'open')}>
      <button type="button" className="vt-group-title" onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'}</span>
        {title}
      </button>
      {open ? <div className="vt-group-body">{children}</div> : null}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="vt-field">
      <span className="vt-field-label">{label}</span>
      <span className="vt-field-control">{children}</span>
      {hint ? <span className="vt-hint">{hint}</span> : null}
    </label>
  );
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

/** 工具栏：导出格式/清晰度 + 导出 + 导出任务入口。 */
export function Toolbar({ config, patch, onExport, onOpenTasks, busy }: {
  config: EditorConfig;
  patch: Patch;
  onExport: () => void;
  onOpenTasks: () => void;
  busy: boolean;
}) {
  return (
    <div className="vt-toolbar">
      <div className="vt-toolbar-left">
        <strong>推荐工作台</strong>
        <span className="vt-toolbar-note">已选 {config.ids.length} 部 · 本地自动暂存</span>
      </div>
      <div className="vt-toolbar-right">
        <select value={config.groupStyle} onChange={(event) => patch({ groupStyle: event.target.value })} title="推荐模板">
          <option value="chapter">章节式</option>
          <option value="clip">片段放映式</option>
        </select>
        <select value={config.format} onChange={(event) => patch({ format: event.target.value })} title="视频格式">
          <option value="MP4">MP4</option>
          <option value="WEBM">WEBM</option>
        </select>
        <select value={config.resolution} onChange={(event) => patch({ resolution: event.target.value })} title="清晰度">
          <option value="720P">720P</option>
          <option value="1080P">1080P</option>
          <option value="4K">4K</option>
        </select>
        <button type="button" className="btn-mini" onClick={onOpenTasks}>🗂 导出任务</button>
        <button type="button" className="btn-primary" disabled={busy || config.ids.length === 0} onClick={onExport}>
          {busy ? '提交中…' : '导出视频'}
        </button>
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

/** 媒体篮子：筛选 + 分页 + 勾选 + 已选顺序 + 片段挂载。 */
export function BasketPane({ config, patch }: { config: EditorConfig; patch: Patch }) {
  const [list, setList] = React.useState<MediaBrief[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [collections, setCollections] = React.useState<{ id: number; name: string }[]>([]);
  const [years, setYears] = React.useState<number[]>([]);
  const [sourceId, setSourceId] = React.useState<number | null>(null);
  const [year, setYear] = React.useState('');
  const [tagText, setTagText] = React.useState('');
  const [tagId, setTagId] = React.useState<number | null>(null);
  const [clipMedia, setClipMedia] = React.useState<MediaBrief | null>(null);
  const [loading, setLoading] = React.useState(false);
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
      setTagId(null);
      return;
    }
    const id = await api.resolveTagId(name).catch(() => null);
    setTagId(id);
    if (id === null) setTagText('');
  };

  const openClips = (media: MediaBrief) => setClipMedia(media);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="vt-basket">
      <div className="vt-basket-filters">
        <select value={sourceId ?? ''} onChange={(event) => { setPage(1); setSourceId(event.target.value ? Number(event.target.value) : null); }}>
          <option value="">全部媒体</option>
          {collections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select value={year} onChange={(event) => { setPage(1); setYear(event.target.value); }}>
          <option value="">全部年份</option>
          {years.map((value) => <option key={value} value={value}>{value} 年</option>)}
        </select>
        <input className="vt-tag-input" placeholder="标签过滤（回车）" value={tagText}
               onChange={(event) => setTagText(event.target.value)}
               onKeyDown={(event) => { if (event.key === 'Enter') void applyTag(); }} />
        {tagId !== null ? <button type="button" className="btn-mini" onClick={() => { setTagText(''); setTagId(null); }}>✕ 标签</button> : null}
      </div>

      <div className="vt-basket-actions">
        <span>{loading ? '加载中…' : `共 ${total} 部 · 第 ${page}/${pages} 页`}</span>
        <span className="vt-basket-actions-btns">
          <button type="button" className="btn-mini" onClick={() => patch({ ids: [...new Set([...config.ids, ...pageIds])] })}>全选本页</button>
          <button type="button" className="btn-mini" onClick={() => patch({ ids: [], openingIds: [], mediaClips: {} })}>清空</button>
        </span>
      </div>

      <div className="vt-media-grid">
        {list.map((item) => {
          const cover = item.coverPath || item.fallbackCoverPath || item.externalCoverUrl;
          const clipCount = config.mediaClips[String(item.id)]?.order.length ?? 0;
          return (
            <div key={item.id} className={cls('vt-media-card', selected.has(item.id) && 'selected')}>
              <div className="vt-media-cover">
                {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="vt-cover-placeholder">{(item.title || '?').slice(0, 1)}</span>}
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} title="加入推荐" />
              </div>
              <div className="vt-media-title" title={item.title}>{item.title}</div>
              <div className="vt-media-foot">
                <span className="vt-media-year">{item.year ?? '—'}</span>
                <button type="button" className={cls('btn-mini', clipCount > 0 && 'active')} onClick={() => openClips(item)}>
                  {clipCount > 0 ? `片段 ${clipCount}` : '选片段'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="vt-basket-pager">
        <button type="button" className="btn-mini" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
        <button type="button" className="btn-mini" disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</button>
      </div>

      <div className="vt-selected">
        <div className="vt-selected-head">推荐顺序（{config.ids.length}）</div>
        <ol className="vt-selected-list">
          {config.ids.map((id, index) => {
            const item = list.find((value) => value.id === id);
            return (
              <li key={id}>
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
      </div>

      {clipMedia ? (
        <div className="vt-clip-panel">
          <div className="vt-clip-head">
            <strong>片段 · {clipMedia.title}</strong>
            <button type="button" className="btn-mini" onClick={() => setClipMedia(null)}>关闭</button>
          </div>
          <ClipPicker mediaId={clipMedia.id} title={clipMedia.title} config={config}
                      onClips={(next) => {
                        const mediaClips = { ...config.mediaClips };
                        if (next.order.length === 0) delete mediaClips[String(clipMedia.id)];
                        else mediaClips[String(clipMedia.id)] = next;
                        patch({ mediaClips });
                      }} />
        </div>
      ) : null}
    </div>
  );
}

/** Inspector：参数面板（阶段 2：接受选中对象；阶段 3 按对象轴重排）。 */
export function InspectorPane({ config, patch, mediaBriefs, missingByMedia, selection, rendered }: {
  config: EditorConfig;
  patch: Patch;
  mediaBriefs: MediaBrief[];
  missingByMedia: Record<number, string>;
  selection: import('./timeline').Selection;
  rendered: { input: import('../src/types').MultiMediaPocInput } | null;
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
      images.push(await fileToBase64(file));
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

  return (
    <div className="vt-inspector">
      <Group title={selectionHeader(selection, selectedMedia, selectedClip)} defaultOpen>
        {selectedMedia ? (
          <div className="vt-selected-obj">
            <Field label="片内顺序">
              <span className="vt-inline">
                #{selectedMedia.order}
                <button type="button" className="btn-mini" onClick={() => moveMedia(config, patch, selectedMedia.mediaId, -1)}>↑ 上移</button>
                <button type="button" className="btn-mini" onClick={() => moveMedia(config, patch, selectedMedia.mediaId, 1)}>↓ 下移</button>
              </span>
            </Field>
            <Field label="开场代表秀">
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
              <Field label="片段字幕条">
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
      <Group title="内容 · 主题" defaultOpen>
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

      <Group title="页面展示与交互" defaultOpen>
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

      <Group title="开场代表秀">
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

      <Group title="背景音乐（BGM）">
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

      <Group title="背景层">
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
        <Group title={`素材缺失 ${Object.keys(missingByMedia).length} 项`} defaultOpen>
          <ul className="vt-missing-list">
            {Object.entries(missingByMedia).map(([mediaId, reason]) => (
              <li key={mediaId}>#{mediaId}：{reason}</li>
            ))}
          </ul>
        </Group>
      ) : null}
    </div>
  );
}
