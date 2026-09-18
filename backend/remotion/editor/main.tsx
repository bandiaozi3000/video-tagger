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
import type { MultiMediaPocInput } from '../src/types';
import { api, type EditorConfig, type ExportTask, type MediaBrief } from './api';
import { applyLocalParams, loadConfig, saveConfig, sessionSignature } from './state';
import { BasketPane, BgmOverlay, InspectorPane, Toolbar } from './panes';
import { Timeline, type Selection } from './timeline';
import { buildScenePlan } from '../src/scene-plan';
import type { ScenePlan } from '../src/types';
import './editor.css';

type Rendered = { input: MultiMediaPocInput; plan: ScenePlan; frameCount: number };

function App() {
  const [config, setConfig] = React.useState<EditorConfig>(() => loadConfig());
  const [remoteInput, setRemoteInput] = React.useState<MultiMediaPocInput | null>(null);
  const [missing, setMissing] = React.useState<import('./api').MissingClip[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [tasksOpen, setTasksOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [frame, setFrame] = React.useState(0);
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

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((value) => (value === message ? null : value)), 2600);
  };

  // —— 会话同步（仅素材/媒体集/分组/BGM 变化触发；参数变化走本地补丁）——
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
  }, [signature, idsKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 卸载时回收会话（离开视图/关页）
  React.useEffect(() => () => {
    const token = tokenRef.current;
    if (token) void api.deleteSession(token).catch(() => undefined);
  }, []);

  const rendered: Rendered | null = React.useMemo(() => {
    if (!remoteInput || remoteInput.media.length === 0) return null;
    const input = applyLocalParams(remoteInput, config, config.ids.length);
    const plan = buildScenePlan(input);
    return { input, plan, frameCount: plan.durationInFrames };
  }, [remoteInput, config]);

  // 帧游标：Player 事件驱动（时间轴游标 + 当前段）
  React.useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (event: { detail: { frame: number } }) => { lastFrameRef.current = event.detail.frame; setFrame(event.detail.frame); };
    const onSeeked = (event: { detail: { frame: number } }) => setFrame(event.detail.frame);
    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('seeked', onSeeked);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('seeked', onSeeked);
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

  React.useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (event: { detail: { frame: number } }) => { lastFrameRef.current = event.detail.frame; };
    player.addEventListener('frameupdate', onFrame);
    return () => player.removeEventListener('frameupdate', onFrame);
  }, [rendered !== null]);

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
    if (missing.length > 0) {
      const detail = missing.slice(0, 5).map((item) => `· ${item.title || '片段'}：${item.reason}`).join('\n');
      const more = missing.length > 5 ? `\n（其余 ${missing.length - 5} 项同理）` : '';
      if (!window.confirm(`有 ${missing.length} 个片段素材不可用，导出将被后端拦截：\n${detail}${more}\n\n仍要提交吗？`)) return;
    }
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

  const mediaBriefs: MediaBrief[] = (remoteInput?.media ?? []).map((media) => ({
    id: media.mediaId,
    title: media.title,
    coverPath: media.coverAssetPath ?? null,
    year: media.year ?? null,
  }));

  const inspectorMissing = React.useMemo(() => {
    const map: Record<number, string> = {};
    for (const [clipId, reason] of Object.entries(missingByClip)) map[Number(clipId)] = reason;
    return map;
  }, [missingByClip]);

  return (
    <div className="vt-workspace">
      <Toolbar config={config} patch={patch} onExport={() => void onExport()}
               onOpenTasks={() => setTasksOpen(true)} busy={busy} />

      <div className="vt-body">
        <BasketPane config={config} patch={patch} />

        <div className="vt-stage">
          {rendered ? (
            <div
              className="vt-player-shell"
              ref={shellRef}
              style={{
                // 容器必须给**确定高度**：只给 % / flex 会让 Player 内部包装层算成 0 高，画布被顶出视口
                // （v0.27 旧预览页踩过同一个坑，这里用画幅比例 + 高度上限双约束）
                aspectRatio: `${rendered.plan.width} / ${rendered.plan.height}`,
                maxWidth: `calc(74vh * ${rendered.plan.width} / ${rendered.plan.height})`,
              }}
            >
              <Player
                ref={playerRef}
                component={RecommendComposition}
                inputProps={{ input: rendered.input }}
                durationInFrames={rendered.frameCount}
                fps={rendered.plan.fps}
                compositionWidth={rendered.plan.width}
                compositionHeight={rendered.plan.height}
                inFrame={rangeSceneValue ? rangeSceneValue.fromFrame : null}
                outFrame={rangeSceneValue ? rangeSceneValue.fromFrame + rangeSceneValue.durationInFrames - 1 : null}
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
          <div className="vt-stage-meta">
            {rendered
              ? `${rendered.plan.width}×${rendered.plan.height} · ${rendered.plan.fps}fps · ${rendered.frameCount} 帧 · ${rendered.input.media.length} 部 · 与导出同源`
              : '—'}
          </div>
        </div>

        <InspectorPane config={config} patch={patch} mediaBriefs={mediaBriefs} missingByMedia={inspectorMissing}
                       selection={selection} rendered={rendered} />
      </div>

      {rendered ? (
        <Timeline
          input={rendered.input}
          plan={rendered.plan}
          frame={frame}
          selection={selection}
          missingByClip={missingByClip}
          missingByMedia={missingByMedia}
          onSeek={seekTo}
          onSelect={(next) => {
            setSelection(next);
            // 「只看本段」开着时，选中别的段就跟着换范围（否则游标跑到范围外，行为很迷惑）
            if (rangeScene !== null && next.sceneIndex !== undefined) setRangeScene(next.sceneIndex);
          }}
          rangeOn={rangeScene !== null}
          onToggleRange={() => setRangeScene(rangeScene === null ? Math.max(0, rendered.plan.scenes.findIndex((scene) => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames)) : null)}
        />
      ) : null}

      {tasksOpen ? <TaskPanel onClose={() => setTasksOpen(false)} notify={notify} /> : null}
      {toast ? <div className="vt-toast">{toast}</div> : null}
    </div>
  );
}

/** 导出任务面板：轮询任务列表（阶段 1 只做状态/打开目录/删除）。 */
function TaskPanel({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
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
              <span className="vt-task-btns">
                {task.status === 'DONE' && task.filePath ? (
                  <>
                    <button type="button" className="btn-mini" onClick={() => void api.openTask(task.id, true)}>打开目录</button>
                    <a className="btn-mini" href={`/exports/${task.filePath.split(/[\\/]/).pop()}`} download>下载</a>
                  </>
                ) : null}
                <button type="button" className="btn-mini" onClick={() => void api.deleteTask(task.id).then(refresh)}>✕</button>
              </span>
              {task.status === 'ERROR' && task.message ? <span className="vt-task-msg">{task.message}</span> : null}
            </li>
          ))}
        </ul>
        <p className="vt-hint">产物落在 <code>data/exports/</code>；导出为串行队列，渲染期间可以继续编辑。</p>
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
