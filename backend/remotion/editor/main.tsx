/**
 * 推荐工作台编辑器（v0.28 阶段 1）：常驻 Player + 即时生效 + 媒体篮子 + 扁平 Inspector。
 *
 * 装载协议（方式 A：单页挂载）：宿主 `app.js` 在进入推荐视图时调 `mount(root)`，离开时 `unmount()`。
 * 编辑器自己向后端要 RenderInput（`/api/recommend/session`），不依赖宿主传参。
 *
 * 即时生效的实现：
 * - 纯参数改动 → {@link applyLocalParams} 直接补进 `inputProps.params`（Remotion 侧 `resolveParams` 兜钳位）；
 * - 素材/媒体集/分组/BGM 变化 → 防抖后问后端换回同源 RenderInput（`missing` 用于段级提示）。
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { RecommendComposition } from '../src/RecommendComposition';
import { CinemaComposition } from '../src/cinema';
import { buildCinemaPlan } from '../src/cinema/plan';
import { canRerenderChunk } from './rerender';
import { ConfirmHost, alertDialog, confirmDialog } from './confirm';
import type { MultiMediaPocInput } from '../src/types';
import { api, type CandidateFilter, type EditorConfig, type ExportTask, type MediaBrief, type Variant } from './api';
import {
  applyLocalParams,
  buildPayload,
  defaultFilter,
  loadConfig,
  parsePayload,
  saveConfig,
  sessionSignature,
  taskProgressLabel,
} from './state';
import { BasketPane, BgmOverlay, InspectorPane, ParamPalette, TemplatePanel, Toolbar } from './panes';
import { Filmstrip, Timeline, selectionOfScene, type Selection } from './timeline';
import { DURATION_FIELD, type DurationKey } from './durations';
import { withoutClip } from './clip-refs';
import { buildScenePlan } from '../src/scene-plan';
import type { ScenePlan } from '../src/types';
import './editor.css';

type Rendered = { input: MultiMediaPocInput; plan: ScenePlan; frameCount: number };

/** 帧 → m:ss（播放控制条用）。 */
function clockText(frames: number, fps: number): string {
  const total = Math.floor(Math.max(0, frames) / Math.max(1, fps));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function App() {
  const [config, setConfig] = React.useState<EditorConfig>(() => loadConfig());
  const [remoteInput, setRemoteInput] = React.useState<MultiMediaPocInput | null>(null);
  const [missing, setMissing] = React.useState<import('./api').MissingClip[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [tasksOpen, setTasksOpen] = React.useState(false);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  /** 沉浸模式（P）：隐左右栏与工具栏，只留画布。 */
  const [immersive, setImmersive] = React.useState(false);
  /** Ctrl+K 参数搜索面板。 */
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  /** 参数搜索跳转：让右栏展开并滚到指定分组（分组标题）。 */
  const [focusGroup, setFocusGroup] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<CandidateFilter>(defaultFilter);
  const [variants, setVariants] = React.useState<Variant[]>([]);
  const draftReady = React.useRef(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [frame, setFrame] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [rate, setRate] = React.useState(1);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<Selection>({ kind: 'global' });
  const [rangeScene, setRangeScene] = React.useState<number | null>(null);
  const tokenRef = React.useRef<string | null>(null);
  const playerRef = React.useRef<PlayerRef>(null);
  const shellRef = React.useRef<HTMLDivElement>(null);
  const lastFrameRef = React.useRef(0);

  const patch = React.useCallback((changes: Partial<EditorConfig>) => {
    setConfig((current) => {
      const next = { ...current, ...changes };
      saveConfig(next);
      return next;
    });
  }, []);

  /**
   * 拖拽改时长（时间轴把手 / 胶片条时长牌共用）。
   *
   * 写入的是**类级**字段（`openingSec` …）→ `applyLocalParams` 映到 `durations` → plan 本地重排 →
   * 段块/总长/Player 立刻跟着变（不走网络）。语义：**只改这一类，总长跟着变**（用户 2026-09-20 定）。
   */
  /** 缺素材卡上的「移除」= 从草稿的 mediaClips 里拿掉该片段（与右栏「移除」同一套逻辑）。 */
  const dropClip = React.useCallback((mediaId: number, clipId: number) => {
    patch({ mediaClips: withoutClip(config.mediaClips, mediaId, clipId) });
  }, [config.mediaClips, patch]);

  const changeDuration = React.useCallback((key: DurationKey, seconds: number) => {
    patch({ [DURATION_FIELD[key]]: seconds } as Partial<EditorConfig>);
  }, [patch]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((value) => (value === message ? null : value)), 2600);
  };

  // —— 草稿（服务端会话暂存为准；1s 防抖写入）——
  React.useEffect(() => {
    let cancelled = false;
    api.draft()
      .then((draft) => {
        if (cancelled) return;
        const payload = parsePayload(draft.config);
        if (payload) {
          // 草稿里**不含 BGM**（base64 体积大，`buildPayload` 刻意剥掉），只能活在本机 localStorage。
          // 不合并就会被草稿覆盖成空 → 表现为「加了背景音乐、切个 tab 回来就没了」。
          const local = loadConfig();
          const merged: EditorConfig = {
            ...payload.config,
            bgmTracks: local.bgmTracks ?? [],
            bgImages: payload.config.bgImages?.length ? payload.config.bgImages : (local.bgImages ?? []),
          };
          setConfig(merged);
          saveConfig(merged);
          setFilter(payload.filter);
          setVariants(payload.variants);
        }
        draftReady.current = true;
      })
      .catch(() => { draftReady.current = true; });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!draftReady.current) return;
    const timer = window.setTimeout(() => {
      api.saveDraft(JSON.stringify(buildPayload(config, filter, variants)))
        .then(() => setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })))
        .catch(() => undefined);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [config, filter, variants]);


  /**
   * B：切回窗口时比一次素材指纹（节流 20s），不一样就重建会话。
   *
   * 为什么要指纹而不是直接重建：重建会话要重新读 24 部资料 + 探测片段帧率，
   * 每次 focus 都跑会闪 busy；指纹只读三张表，代价可忽略。
   */
  React.useEffect(() => {
    const check = async () => {
      if (config.ids.length === 0) return;
      if (Date.now() - lastCheckRef.current < 20000) return;
      lastCheckRef.current = Date.now();
      try {
        const { fingerprint } = await api.metaFingerprint(config.ids);
        if (lastFingerprintRef.current && fingerprint !== lastFingerprintRef.current) {
          notify('素材信息有更新，已重新读取');
          setReloadTick((value) => value + 1);
        }
      } catch {
        /* 检查失败不影响编辑 */
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // 只依赖媒体集：换批媒体时重新挂监听没有意义
  }, [config.ids.join(','), notify]);   // eslint-disable-line react-hooks/exhaustive-deps

  // —— 会话同步（仅素材/媒体集/分组/BGM 变化触发；参数变化走本地补丁）——
  // A+B：手动「重新读取素材」与自动检测都用这个 tick 触发重建（加进会话 effect 的依赖）
  const [reloadTick, setReloadTick] = React.useState(0);
  /** 上次会话里的素材指纹（B 用来判断“库里改过资料没有”）。 */
  const lastFingerprintRef = React.useRef<string | null>(null);
  const lastCheckRef = React.useRef(0);
  const signature = sessionSignature(config);
  const idsKey = config.ids.join(',');
  React.useEffect(() => {
    if (config.ids.length === 0) {
      setRemoteInput(null);
      setMissing([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const run = async () => {
        try {
          setBusy(true);
          const response = tokenRef.current
            ? await api.renderInput(tokenRef.current, config)
            : await api.createSession(config);
          if (cancelled) return;
          tokenRef.current = response.token;
          lastFingerprintRef.current = (response.input as { metaFingerprint?: string } | null)?.metaFingerprint ?? null;
          setRemoteInput(response.input);
          setMissing(response.missing || []);
        } catch (error) {
          if (!cancelled) notify(error instanceof Error ? error.message : '会话同步失败');
        } finally {
          if (!cancelled) setBusy(false);
        }
      };
      void run();
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // 依赖签名：参数改动不重建会话
  }, [signature, idsKey, reloadTick]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 卸载时回收会话（离开视图/关页）
  React.useEffect(() => () => {
    const token = tokenRef.current;
    if (token) void api.deleteSession(token).catch(() => undefined);
  }, []);

  const rendered: Rendered | null = React.useMemo(() => {
    if (!remoteInput || remoteInput.media.length === 0) return null;
    const input = applyLocalParams(remoteInput, config, config.ids.length);
    // 形态路由：cinema 走新计划与新合成（旧 chapter/clip 一行未改）。
    // 计划对象在此处按 `ScenePlan` 视图共享给时间轴/胶片条——它们只读
    // fromFrame / durationInFrames / mediaId / clipId / fps 这几个共同字段。
    const plan = input.style === 'cinema'
      ? (buildCinemaPlan(input) as unknown as ScenePlan)
      : buildScenePlan(input);
    return { input, plan, frameCount: plan.durationInFrames };
  }, [remoteInput, config]);

  /**
   * 当前草稿的段边界帧（只银幕式有）：给任务面板做「只重渲某块」的安全校验用。
   * 非银幕式/算不出来 → 空表 → 面板会拒绝局部重渲（宁可不做，也别拼错片）。
   */
  const currentBoundaries = React.useMemo(() => {
    if (!remoteInput || remoteInput.media.length === 0 || config.groupStyle !== 'cinema') return [];
    try {
      const plan = buildCinemaPlan(applyLocalParams(remoteInput, config, config.ids.length));
      return [0, ...plan.scenes.map((scene) => scene.fromFrame + scene.durationInFrames)];
    } catch {
      return [];
    }
  }, [remoteInput, config]);

  /**
   * Player 的 `inputProps` 必须是**稳定引用**（v0.29 修复）。
   *
   * 父组件每帧都会重渲染（`frameupdate` → `setFrame`），若这里写 `{{ input: rendered.input }}` 字面量，
   * Remotion 会重建 `config`，而它的播放循环 `useEffect` 依赖 `config` → 每帧重启一次（`startedTime` /
   * `framesAdvanced` 归零）→ 帧钟只跑到 ~0.65× 实时（≈20fps）；`<audio>` 走真实时间，超前后被同步机制
   * 每 ~2s 往回 seek ~0.6s（听感：同一小段反复重放）。
   */
  const playerInputProps = React.useMemo(
    () => ({ input: rendered?.input as MultiMediaPocInput }),
    [rendered?.input],
  );

  // 帧游标：Player 事件驱动（时间轴游标 + 当前段）
  React.useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (event: { detail: { frame: number } }) => { lastFrameRef.current = event.detail.frame; setFrame(event.detail.frame); };
    const onSeeked = (event: { detail: { frame: number } }) => setFrame(event.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('seeked', onSeeked);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('seeked', onSeeked);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [rendered !== null]);

  // —— 帧校正（设计规格 §6.6）：时长缩短后当前帧可能越界 → 跳到原段的新段首 ——
  React.useEffect(() => {
    if (!rendered) return;
    const player = playerRef.current;
    if (!player) return;
    if (lastFrameRef.current < rendered.frameCount) return;
    const plan = rendered.plan;
    const scene = plan.scenes.filter((item) => item.fromFrame <= lastFrameRef.current).pop();
    const target = scene ? scene.fromFrame : Math.max(0, rendered.frameCount - 1);
    player.seekTo(Math.min(target, rendered.frameCount - 1));
    lastFrameRef.current = Math.min(target, rendered.frameCount - 1);
    setFrame(lastFrameRef.current);
  }, [rendered?.frameCount, rendered?.input]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 范围预览：只循环选中段（段丢失/时长变化导致越界时自动退出）
  React.useEffect(() => {
    if (rangeScene === null) return;
    const scene = rendered?.plan.scenes[rangeScene];
    if (!scene || scene.fromFrame + scene.durationInFrames > (rendered?.frameCount ?? 0)) setRangeScene(null);
  }, [rangeScene, rendered?.frameCount, rendered?.input]);

  const rangeSceneValue = rangeScene === null ? null : rendered?.plan.scenes[rangeScene] ?? null;

  const seekTo = (target: number) => {
    playerRef.current?.seekTo(target);
    lastFrameRef.current = target;
    setFrame(target);
  };

  /** 播放/暂停（播放控制条的圆按钮）。 */
  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pause();
    else player.play();
  };

  /** 跳到上/下一段的段首。 */
  const stepScene = (delta: number) => {
    if (!rendered) return;
    const scenes = rendered.plan.scenes;
    const current = scenes.findIndex((scene) => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames);
    const at = current < 0 ? 0 : current;
    const target = Math.min(scenes.length - 1, Math.max(0, at + delta));
    if (scenes[target]) seekTo(scenes[target].fromFrame);
  };

  React.useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (event: { detail: { frame: number } }) => { lastFrameRef.current = event.detail.frame; };
    player.addEventListener('frameupdate', onFrame);
    return () => player.removeEventListener('frameupdate', onFrame);
  }, [rendered !== null]);

  /** 快捷键：`Ctrl/Cmd+K` 参数搜索、`P` 沉浸、`Esc` 退出沉浸/关面板。 */
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setImmersive(false);
        return;
      }
      if (typing) return;
      if (event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.metaKey) setImmersive((value) => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /**
   * 点画布 = 选中当前画面所属的段/媒体（参数跟着对象走）。
   *
   * 两条边界：底部 48px 是 Player 自带控制条（不抢它的点击）；BGM 浮层自己处理拖拽。
   */
  const onCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!rendered) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientY > rect.bottom - 48) return;
    if ((event.target as HTMLElement).closest('.vt-bgm-overlay')) return;
    const index = rendered.plan.scenes.findIndex((scene) => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames);
    const scene = rendered.plan.scenes[index];
    if (scene) setSelection(selectionOfScene(scene, index));
  };

  const missingByClip = React.useMemo(() => {
    const map: Record<number, string> = {};
    for (const item of missing) map[item.clipId] = `${item.title || '片段'}：${item.reason}`;
    return map;
  }, [missing]);

  const missingByMedia = React.useMemo(() => {
    const map: Record<number, string> = {};
    for (const item of missing) if (!map[item.mediaId]) map[item.mediaId] = `${item.title || '片段'}：${item.reason}`;
    return map;
  }, [missing]);

  const onExport = async () => {
    if (!(await confirmMissing())) return;
    try {
      setBusy(true);
      const response = await api.exportVideo(config);
      notify(`已提交导出任务 #${response.taskId}（队列串行执行）`);
      setTasksOpen(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : '导出失败');
    } finally {
      setBusy(false);
    }
  };

  /** 缺失素材的导出前确认（设计规格 §9：降级不阻断，但导出前要交代清楚）。 */
  const confirmMissing = async () => {
    if (missing.length === 0) return true;
    const detail = missing.slice(0, 5).map((item) => `· ${item.title || '片段'}：${item.reason}`).join('\n');
    const more = missing.length > 5 ? `\n（其余 ${missing.length - 5} 项同理）` : '';
    return confirmDialog({
      title: '素材不可用',
      msg: `有 ${missing.length} 个片段素材不可用，导出会被后端拦截：\n${detail}${more}\n\n仍要提交吗？`,
      okText: '仍要提交',
    });
  };

  /** 导出全部变体（无变体 → 当单个当前配置）；变体 = 基础配置 + 具名覆盖，逐个提交（后端签名不变）。 */
  const onExportAll = async () => {
    if (!(await confirmMissing())) return;
    const targets: Variant[] = variants.length > 0 ? variants : [{ id: 'base', name: '当前配置', overrides: {} }];
    try {
      setBusy(true);
      for (const variant of targets) {
        await api.exportVideo({ ...config, ...variant.overrides } as EditorConfig);
      }
      notify(`已提交 ${targets.length} 个导出任务（队列串行渲染）`);
      setTasksOpen(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : '导出失败');
    } finally {
      setBusy(false);
    }
  };

  const mediaBriefs: MediaBrief[] = (remoteInput?.media ?? []).map((media) => ({
    id: media.mediaId,
    title: media.title,
    coverPath: media.coverAssetPath ?? null,
    year: media.year ?? null,
  }));

  return (
    <div className={immersive ? 'vt-workspace flash' : 'vt-workspace'}>
      <Toolbar config={config} patch={patch} busy={busy} variantCount={variants.length}
               onReloadMaterials={() => setReloadTick((value) => value + 1)}
               onExport={() => void onExport()} onExportAll={() => void onExportAll()}
               onOpenTasks={() => setTasksOpen(true)} onOpenTemplates={() => setTemplatesOpen(true)}
               onOpenVariants={() => { setSelection({ kind: 'global' }); setFocusGroup('导出变体'); }}
               onOpenSearch={() => setPaletteOpen(true)}
               meta={{
                 seconds: rendered ? rendered.frameCount / rendered.plan.fps : null,
                 frames: rendered?.frameCount ?? null,
                 missingCount: missing.length,
                 savedAt,
               }} />

      <div className={immersive ? 'vt-body stage-only' : 'vt-body'}>
        <BasketPane config={config} patch={patch} filter={filter} onFilter={setFilter} onSelect={setSelection}
                    mediaBriefs={mediaBriefs}
                    highlightMediaId={selection.kind === 'media' || selection.kind === 'clip' ? selection.mediaId : undefined} />

        <section className="panel vt-col">
          <div className="vt-colhead">
            <h3>预览</h3>
            <span className="vt-colhead-meta">
              {rendered
                ? `${rendered.plan.width}×${rendered.plan.height} · ${rendered.plan.fps}fps · ${rendered.input.media.length} 部`
                : '—'}
            </span>
            <span className="sp" />
            <button type="button" className={immersive ? 'btn-mini on' : 'btn-mini'} title="沉浸模式（P）"
                    onClick={() => setImmersive((value) => !value)}>{immersive ? '退出沉浸' : '⛶ 沉浸'}</button>
          </div>

          <div className="vt-stage-body">
            {rendered ? (
              <div
                className="vt-player-shell"
                ref={shellRef}
                onClick={onCanvasClick}
                title="点画面 = 选中当前段"
                style={{
                  // 只锁画幅比例：宽度吃掉中栏（去掉 v0.29 的 42vh 硬上限 —— 它把画布卡小、还把时间轴顶到屏外）
                  aspectRatio: `${rendered.plan.width} / ${rendered.plan.height}`,
                }}
              >
                <Player
                  ref={playerRef}
                  component={rendered.input.style === 'cinema' ? CinemaComposition : RecommendComposition}
                  inputProps={playerInputProps}
                  durationInFrames={rendered.frameCount}
                  fps={rendered.plan.fps}
                  compositionWidth={rendered.plan.width}
                  compositionHeight={rendered.plan.height}
                  inFrame={rangeSceneValue ? rangeSceneValue.fromFrame : null}
                  outFrame={rangeSceneValue ? rangeSceneValue.fromFrame + rangeSceneValue.durationInFrames - 1 : null}
                  playbackRate={rate}
                  style={{ width: '100%', height: '100%' }}
                  controls
                  loop
                  doubleClickToFullscreen
                />
                <BgmOverlay config={config} patch={patch} shellRef={shellRef} />
              </div>
            ) : (
              <div className="vt-empty">
                {config.ids.length === 0 ? '从左侧勾选要推荐的媒体' : busy ? '准备素材中…' : '准备中…'}
              </div>
            )}

            <div className="vt-transport">
              <button type="button" className="vt-tbtn" title="上一段" disabled={!rendered} onClick={() => stepScene(-1)}>⏮</button>
              <button type="button" className="vt-tbtn main" disabled={!rendered}
                      title={playing ? '暂停' : '播放'} onClick={togglePlay}>{playing ? '❚❚' : '▶'}</button>
              <button type="button" className="vt-tbtn" title="下一段" disabled={!rendered} onClick={() => stepScene(1)}>⏭</button>
              <div className="vt-clock">
                <span className="vt-time">
                  {clockText(frame, rendered?.plan.fps ?? 30)}
                  <small> / {rendered ? clockText(rendered.frameCount, rendered.plan.fps) : '0:00'}</small>
                </span>
                <span className="vt-frame">帧 {frame} / {rendered?.frameCount ?? 0}</span>
              </div>
              <div className="right">
                <button type="button" className={rangeScene !== null ? 'vt-toggle on' : 'vt-toggle'}
                        disabled={!rendered}
                        title="只循环当前段（范围预览）"
                        onClick={() => setRangeScene(rangeScene === null
                          ? Math.max(0, rendered?.plan.scenes.findIndex((scene) => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames) ?? 0)
                          : null)}>
                  ⟳ 只看本段
                </button>
                <select value={rate} onChange={(event) => setRate(Number(event.target.value))} title="预览倍速（不影响导出）">
                  <option value={0.5}>0.5× 速度</option>
                  <option value={1}>1× 速度</option>
                  <option value={1.5}>1.5× 速度</option>
                  <option value={2}>2× 速度</option>
                </select>
              </div>
            </div>

            {rendered ? (
              <Filmstrip
                input={rendered.input}
                plan={rendered.plan}
                frame={frame}
                selection={selection}
                missingByClip={missingByClip}
                missingByMedia={missingByMedia}
                onSeek={seekTo}
                onSelect={(next) => {
                  setSelection(next);
                  if (rangeScene !== null && next.sceneIndex !== undefined) setRangeScene(next.sceneIndex);
                }}
                onDurationChange={changeDuration}
                onDropClip={dropClip}
              />
            ) : null}

            {rendered ? (
              <Timeline
                plan={rendered.plan}
                frame={frame}
                selection={selection}
                missingByClip={missingByClip}
                missingByMedia={missingByMedia}
                mediaCount={rendered.input.media.length}
                onSeek={seekTo}
                onSelect={(next) => {
                  setSelection(next);
                  // 「只看本段」开着时，选中别的段就跟着换范围（否则游标跑到范围外，行为很迷惑）
                  if (rangeScene !== null && next.sceneIndex !== undefined) setRangeScene(next.sceneIndex);
                }}
                onDurationChange={changeDuration}
              />
            ) : null}
          </div>
        </section>

        <InspectorPane config={config} patch={patch} mediaBriefs={mediaBriefs} missing={missing}
                       selection={selection} rendered={rendered} focusGroup={focusGroup}
                       onSelect={setSelection} onOpenSearch={() => setPaletteOpen(true)}
                       variants={variants} onVariants={setVariants} />
      </div>

      {immersive ? <div className="vt-immersive-tip">沉浸模式 · <span className="kbd">Esc</span> 或 <span className="kbd">P</span> 退出</div> : null}
      {paletteOpen ? (
        <ParamPalette
          onClose={() => setPaletteOpen(false)}
          onJump={(title) => { setSelection({ kind: 'global' }); setFocusGroup(title); setPaletteOpen(false); }}
        />
      ) : null}

      <ConfirmHost />
      {tasksOpen ? (
        <TaskPanel onClose={() => setTasksOpen(false)} notify={notify}
                   currentBoundaries={currentBoundaries} />
      ) : null}
      {templatesOpen ? (
        <TemplatePanel
          onClose={() => setTemplatesOpen(false)}
          notify={notify}
          payload={() => buildPayload(config, filter, variants)}
          onApply={(next) => {
            setConfig(next.config);
            saveConfig(next.config);
            setFilter(next.filter);
            setVariants(next.variants);
          }}
        />
      ) : null}
      {toast ? <div className="vt-toast">{toast}</div> : null}
    </div>
  );
}

/** 导出任务面板：轮询任务列表（阶段 1 只做状态/打开目录/删除）。 */
function TaskPanel({ onClose, notify, currentBoundaries }: { onClose: () => void; notify: (message: string) => void; currentBoundaries: number[] }) {
  const [tasks, setTasks] = React.useState<ExportTask[]>([]);

  const refresh = React.useCallback(() => {
    api.tasks().then(setTasks).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className="vt-overlay">
      <div className="vt-panel">
        <div className="vt-panel-head">
          <strong>导出任务</strong>
          <span>
            <button type="button" className="btn-mini" onClick={refresh}>刷新</button>
            <button type="button" className="btn-mini" onClick={onClose}>关闭</button>
          </span>
        </div>
        <ul className="vt-task-list">
          {tasks.length === 0 ? <li className="vt-hint">暂无任务</li> : null}
          {tasks.map((task) => (
            <li key={task.id}>
              <span className={`vt-task-status vt-task-${task.status.toLowerCase()}`}>{task.status}</span>
              <span className="vt-task-title">#{task.id} {task.title} · {task.mediaCount} 部 · {task.format}</span>
              {/* 进度与耗时（2026-09-20）：RUNNING 显示块进度 + 百分比 + 预计还需，其余显示总时长 */}
              <span className="vt-task-time">
                {task.stageText ? <em className="vt-task-stage">{task.stageText}</em> : null}
                {task.chunksTotal && task.chunksTotal > 0
                  ? `已完成 ${task.chunksDone ?? 0}/${task.chunksTotal} 块 · `
                  : ''}
                {taskProgressLabel(task, Date.now())}
                {task.status === 'RUNNING' ? (
                  <span className="vt-task-bar"><i style={{ width: `${Math.max(0, Math.min(100, task.progress ?? 0))}%` }} /></span>
                ) : null}
              </span>
              <span className="vt-task-btns">
                {task.status === 'RUNNING' ? (
                  <button type="button" className="btn-mini" title="当前块渲完后停（已完成块保留）"
                          onClick={() => void api.pauseTask(task.id).then(refresh)}>暂停</button>
                ) : null}
                {task.status === 'PAUSED' || task.status === 'INTERRUPTED' ? (
                  <button type="button" className="btn-mini" title="从工作目录里已有的块之后接着渲"
                          onClick={() => void api.resumeTask(task.id).then(refresh)}>继续</button>
                ) : null}
                {task.status === 'RUNNING' || task.status === 'PENDING' ? (
                  <button type="button" className="btn-mini" title="杀掉渲染子进程并标记为已取消（工作目录保留）"
                          onClick={() => void api.cancelTask(task.id).then(refresh)}>取消</button>
                ) : null}
                {task.status === 'DONE' && task.filePath ? (
                  <>
                    <button type="button" className="btn-mini" onClick={() => void api.openTask(task.id, true)}>打开目录</button>
                    <a className="btn-mini" href={`/exports/${task.filePath.split(/[\\/]/).pop()}`} download>下载</a>
                  </>
                ) : null}
                <button type="button" className="btn-mini"
                        title="删除任务记录、工作目录（含分块产物）与成品文件"
                        disabled={task.status === 'RUNNING' || task.status === 'PENDING'}
                        onClick={() => {
                          void (async () => {
                            if (task.filePath && !(await confirmDialog({
                              title: `删除任务 #${task.id}`,
                              msg: `会一并删掉：任务记录、分块工作目录、成品文件\n${task.filePath}`,
                              okText: '连同产物删除',
                            }))) return;
                            await api.deleteTask(task.id);
                            refresh();
                          })();
                        }}>删除（含产物）</button>
              </span>
              {/* 局部重渲（2026-09-21）：先校当前草稿的段边界是否与快照一致，不一致只能整片重渲 */}
              {task.chunksTotal && task.chunksTotal > 1 && task.status !== 'RUNNING' && task.status !== 'PENDING' ? (
                <span className="vt-task-chunks">
                  <em>重渲某块</em>
                  {Array.from({ length: task.chunksTotal }, (_, index) => (
                    <button key={index} type="button" className="btn-mini"
                            title={`只重渲第 ${index + 1} 块并重新拼接，完成后覆盖原成品`}
                            onClick={() => {
                              const check = canRerenderChunk(task.boundaryFrames, currentBoundaries);
                              if (!check.ok) {
                                notify(`不能只重渲：${check.reason}`);
                                return;
                              }
                              notify(`开始重渲第 ${index + 1} 块（完成后覆盖原成品）`);
                              void api.rerenderChunk(task.id, index).then(refresh);
                            }}>{index + 1}</button>
                  ))}
                </span>
              ) : null}
              {task.status === 'ERROR' && task.message ? <span className="vt-task-msg">{task.message}</span> : null}
            </li>
          ))}
        </ul>
        <p className="vt-hint">产物落在 <code>data/exports/</code>；导出为串行队列，渲染期间可以继续编辑。
          中断的任务（后端重启/取消）会保留工作目录，重启后自动标记为 <code>INTERRUPTED</code>。</p>
        <button type="button" className="btn-mini" hidden onClick={() => notify('')} />
      </div>
    </div>
  );
}

let root: Root | null = null;

/** 宿主协议：挂载编辑器（重复调用幂等）。 */
export function mount(target: HTMLElement): void {
  if (root) return;
  root = createRoot(target);
  root.render(<App />);
}

/** 宿主协议：卸载编辑器；会话回收由 App 的卸载副作用负责。 */
export function unmount(): void {
  root?.unmount();
  root = null;
}

declare global {
  interface Window {
    VTRecommendEditor?: { mount: typeof mount; unmount: typeof unmount };
  }
}

window.VTRecommendEditor = { mount, unmount };
