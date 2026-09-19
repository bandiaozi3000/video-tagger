/**
 * 时间轴与胶片条：`ScenePlan` 的两个视角（2026-09-19 拆分）。
 *
 * - **时间轴**（`Timeline`）：纯时序 —— 段色块 + 游标 + 当前段，默认收成 **32px 一条**，
 *   点右侧箭头/`T` 展开；点段 = 跳转 + 选中，点轨 = 按时长比例定位。不渲缩略图。
 * - **胶片条**（`Filmstrip`）：视觉浏览 —— 每段一张卡（懒加载缩略图 + 段名 + 时长），
 *   点卡跳段，当前段自动滚进视野。缩略图上限 `THUMB_LIMIT` 段，串行渲染给主线程留空隙。
 *
 * 拆分的理由：两处各渲一份缩略图会把主线程压满（每个 `Thumbnail` 都是一个独立 Player），
 * 而"看清全片结构（视觉）"和"对时间段（时序）"本来就是两种操作。
 */
import React from 'react';
import { Thumbnail } from '@remotion/player';
import { RecommendComposition } from '../src/RecommendComposition';
import { CinemaComposition } from '../src/cinema';
import { sceneLabel } from '../src/scene-plan';
import type { MultiMediaPocInput, Scene, ScenePlan } from '../src/types';

/** 缩略图渲染上限（段数）——超过就只用段色 + 文字。 */
const THUMB_LIMIT = 12;
/** 串行队列的两张之间间隔（ms）：给主线程留出响应拖动/点击的空隙。 */
const THUMB_GAP_MS = 150;

export interface Selection {
  kind: 'global' | 'media' | 'clip' | 'scene';
  mediaId?: number;
  clipId?: number;
  sceneIndex?: number;
  /** 候选库里点中的媒体标题；该媒体还没加入推荐时，右栏靠它显示名字。 */
  title?: string;
}

const COLORS: Record<Scene['type'], string> = {
  COLLECTION_OPENING: 'rgba(79,195,247,.55)',
  COLLECTION_INTRO: 'rgba(111,139,255,.55)',
  GROUP_INTRO: 'rgba(167,139,250,.55)',
  MEDIA_INFO: 'rgba(200,206,230,.28)',
  MEDIA_GRID: 'rgba(200,206,230,.28)',
  MEDIA_CLIP: 'rgba(255,143,184,.5)',
  COLLECTION_ENDING: 'rgba(255,209,102,.5)',
};

/** 银幕式幕名 → 时间轴/胶片条上的短标签。 */
const CINEMA_LABELS: Record<string, string> = {
  SCAN: '速览',
  FLASH: '闪回',
  SETTLE: '定格',
  HOOK: '钩子',
  SLATE: '片单卡',
  TITLE: '片名卡',
  COVER: '封面镜头',
  CLIP: '片段',
  ENDING: '落款',
};

/** 银幕式幕色（与旧模板同一套色板，只是换了归类）。 */
const CINEMA_COLORS: Record<string, string> = {
  SCAN: 'rgba(79,195,247,.55)',
  FLASH: 'rgba(79,195,247,.55)',
  SETTLE: 'rgba(111,139,255,.55)',
  HOOK: 'rgba(79,195,247,.55)',
  SLATE: 'rgba(111,139,255,.55)',
  TITLE: 'rgba(255,209,102,.5)',
  COVER: 'rgba(200,206,230,.28)',
  CLIP: 'rgba(255,143,184,.5)',
  ENDING: 'rgba(255,209,102,.5)',
};

/** 幕色：银幕式幕型 → 自己的表；旧幕型 → 旧表。 */
export function colorOfScene(scene: { type: string }): string {
  return CINEMA_COLORS[scene.type] ?? COLORS[scene.type as Scene['type']] ?? 'rgba(200,206,230,.28)';
}

/** 段 → 选中对象（时间轴、胶片条、画布点击共用同一套映射）。 */
export function selectionOfScene(scene: Scene, index: number): Selection {
  if (scene.type === 'MEDIA_CLIP' && scene.mediaId !== undefined && scene.clipId !== undefined) {
    return { kind: 'clip', mediaId: scene.mediaId, clipId: scene.clipId, sceneIndex: index };
  }
  if (scene.mediaId !== undefined) return { kind: 'media', mediaId: scene.mediaId, sceneIndex: index };
  return { kind: 'scene', sceneIndex: index };
}

/** 段名（片段段统一显示"片段"，其余用 `sceneLabel`）。 */
function labelOf(plan: ScenePlan, scene: Scene, mediaCount: number): string {
  if (plan.style === 'cinema') {
    const name = CINEMA_LABELS[(scene as { type: string }).type] ?? '—';
    const media = scene.mediaId === undefined ? undefined : plan.mediaIndex.get(scene.mediaId);
    return media ? `${media.title} · ${name}` : name;
  }
  return scene.type === 'MEDIA_CLIP' ? '片段' : sceneLabel(plan, scene, mediaCount);
}

/** 段级素材缺失原因：片段段看 clipId，媒体段看 mediaId（银幕式与前两者同字段）。 */
function missingOf(scene: Scene, missingByClip: Record<number, string>, missingByMedia: Record<number, string>): string | undefined {
  if (scene.clipId !== undefined) return missingByClip[scene.clipId];
  return scene.mediaId === undefined ? undefined : missingByMedia[scene.mediaId];
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`;

/* ============================ 时间轴（32px 条） ============================ */

export function Timeline({ plan, frame, selection, missingByClip, missingByMedia, mediaCount, onSeek, onSelect }: {
  plan: ScenePlan;
  frame: number;
  selection: Selection;
  missingByClip: Record<number, string>;
  missingByMedia: Record<number, string>;
  mediaCount: number;
  onSeek: (frame: number) => void;
  onSelect: (selection: Selection) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const total = Math.max(1, plan.durationInFrames);
  const activeIndex = plan.scenes.findIndex((scene) => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames);
  const activeScene = plan.scenes[activeIndex];
  const totalSec = plan.durationInFrames / plan.fps;

  const seekByRatio = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / Math.max(1, box.width)));
    onSeek(Math.min(plan.durationInFrames - 1, Math.round(ratio * (plan.durationInFrames - 1))));
  };

  const pick = (scene: Scene, index: number) => {
    onSeek(scene.fromFrame);
    onSelect(selectionOfScene(scene, index));
  };

  return (
    <div className={open ? 'vt-tl open' : 'vt-tl'}>
      <div className="vt-tl-head">
        <button type="button" className="vt-tl-toggle" title="展开时间轴（T）" onClick={() => setOpen((value) => !value)}>
          {open ? '▾' : '▸'} 时间轴
        </button>
        <div className="vt-tl-segs" onClick={seekByRatio}>
          {plan.scenes.map((scene, index) => {
            const missing = missingOf(scene, missingByClip, missingByMedia);
            return (
              <span
                key={`${index}-${scene.fromFrame}`}
                className={`vt-tl-seg${selection.sceneIndex === index ? ' selected' : ''}${index === activeIndex ? ' active' : ''}${missing ? ' missing' : ''}`}
                style={{ flexGrow: scene.durationInFrames, background: colorOfScene(scene) }}
                title={missing ? `${labelOf(plan, scene, mediaCount)}｜素材缺失：${missing}` : labelOf(plan, scene, mediaCount)}
                onClick={(event) => { event.stopPropagation(); pick(scene, index); }}
              />
            );
          })}
          <span className="vt-tl-playhead" style={{ left: `${(frame / total) * 100}%` }} />
        </div>
        <span className="vt-tl-cur">
          {activeScene ? <><b>{labelOf(plan, activeScene, mediaCount)}</b> · 第 {activeIndex + 1}/{plan.scenes.length} 段</> : '—'}
        </span>
        <span className="vt-tl-time">{clock(frame / plan.fps)} / {clock(totalSec)}</span>
      </div>
      {open ? (
        <div className="vt-tl-body" onClick={seekByRatio}>
          <div className="vt-tl-ruler">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <span key={ratio}>{clock(totalSec * ratio)}</span>)}
          </div>
          <div className="vt-tl-track">
            {plan.scenes.map((scene, index) => {
              const missing = missingOf(scene, missingByClip, missingByMedia);
              return (
                <div
                  key={`${index}-${scene.fromFrame}`}
                  className={`vt-tl-cell${selection.sceneIndex === index ? ' selected' : ''}${index === activeIndex ? ' active' : ''}${missing ? ' missing' : ''}`}
                  style={{ flexGrow: scene.durationInFrames, background: colorOfScene(scene) }}
                  title={missing ? `素材缺失：${missing}` : labelOf(plan, scene, mediaCount)}
                  onClick={(event) => { event.stopPropagation(); pick(scene, index); }}
                >
                  <span className="vt-tl-cell-name">{labelOf(plan, scene, mediaCount)}</span>
                  <span className="vt-tl-cell-dur">{Math.round(scene.durationInFrames / plan.fps)}s</span>
                </div>
              );
            })}
          </div>
          <div className="vt-tl-foot">
            <span className="vt-hint">点段跳转并选中 · 点空白按时长定位 · 段级操作在右栏</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ============================ 胶片条（缩略图） ============================ */

/** 视口触发器：卡片进入胶片条可视区时回调一次。 */
function ThumbTrigger({ index, root, onVisible }: {
  index: number;
  root: React.RefObject<HTMLDivElement | null>;
  onVisible: (index: number) => void;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisible(index);
          observer.disconnect();
        }
      },
      { root: root.current, threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [index, onVisible, root]);
  return <span ref={ref} className="vt-thumb-trigger" />;
}

export function Filmstrip({ input, plan, frame, selection, missingByClip, missingByMedia, onSeek, onSelect }: {
  input: MultiMediaPocInput;
  plan: ScenePlan;
  frame: number;
  selection: Selection;
  missingByClip: Record<number, string>;
  missingByMedia: Record<number, string>;
  onSeek: (frame: number) => void;
  onSelect: (selection: Selection) => void;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const activeIndex = plan.scenes.findIndex((scene) => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames);
  const mediaCount = input.media.length;

  const [wantThumbs, setWantThumbs] = React.useState<number[]>([]);
  const [readyThumbs, setReadyThumbs] = React.useState<number[]>([]);
  const registerVisible = React.useCallback((index: number) => {
    setWantThumbs((current) => (current.includes(index) ? current : [...current, index]));
  }, []);

  // 串行渲染队列：一次只挂一个 Thumbnail，渲完再挂下一个
  const [rendering, setRendering] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (rendering !== null) return;
    const next = wantThumbs.filter((index) => !readyThumbs.includes(index))[0];
    if (next === undefined) return;
    if (readyThumbs.length >= THUMB_LIMIT) return;
    setRendering(next);
  }, [wantThumbs, readyThumbs, rendering]);

  React.useEffect(() => {
    if (rendering === null) return;
    const timer = window.setTimeout(() => {
      setReadyThumbs((current) => (current.includes(rendering) ? current : [...current, rendering]));
      setRendering(null);
    }, THUMB_GAP_MS);
    return () => window.clearTimeout(timer);
  }, [rendering]);

  // 当前段自动滚进视野（只按 activeIndex 变，不跟每一帧）
  React.useEffect(() => {
    const box = scrollerRef.current;
    const card = box?.children[activeIndex] as HTMLElement | undefined;
    if (!box || !card) return;
    const target = card.offsetLeft - box.clientWidth / 2 + card.clientWidth / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeIndex]);

  const pick = (scene: Scene, index: number) => {
    onSeek(scene.fromFrame);
    onSelect(selectionOfScene(scene, index));
  };

  return (
    <div className="vt-film" ref={scrollerRef}>
      {plan.scenes.map((scene, index) => {
        const missing = missingOf(scene, missingByClip, missingByMedia);
        const ready = readyThumbs.includes(index);
        return (
          <button
            key={`${index}-${scene.fromFrame}`}
            type="button"
            className={`vt-film-card${selection.sceneIndex === index ? ' selected' : ''}${index === activeIndex ? ' active' : ''}${missing ? ' missing' : ''}`}
            title={missing ? `素材缺失：${missing}` : `${labelOf(plan, scene, mediaCount)} · ${Math.round(scene.durationInFrames / plan.fps)}s`}
            onClick={() => pick(scene, index)}
          >
            <span className="vt-film-thumb" style={{ background: colorOfScene(scene) }}>
              {ready ? (
                <Thumbnail
                  component={input.style === 'cinema' ? CinemaComposition : RecommendComposition}
                  inputProps={{ input }}
                  frameToDisplay={scene.fromFrame + Math.floor(scene.durationInFrames / 2)}
                  durationInFrames={plan.durationInFrames}
                  fps={plan.fps}
                  compositionWidth={plan.width}
                  compositionHeight={plan.height}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <span className="vt-film-fallback">{labelOf(plan, scene, mediaCount).slice(0, 2)}</span>
              )}
              <ThumbTrigger index={index} root={scrollerRef} onVisible={registerVisible} />
              {missing ? <i className="vt-film-warn" title={`素材缺失：${missing}`}>⚠</i> : null}
            </span>
            <span className="vt-film-meta">
              <b>{labelOf(plan, scene, mediaCount)}</b>
              <small>#{index + 1} · {Math.round(scene.durationInFrames / plan.fps)}s</small>
            </span>
          </button>
        );
      })}
      <span className="vt-film-state">
        {rendering !== null ? `缩略图渲染中…（${readyThumbs.length}/${Math.min(wantThumbs.length, THUMB_LIMIT)}）` : `${plan.scenes.length} 段`}
      </span>
    </div>
  );
}
