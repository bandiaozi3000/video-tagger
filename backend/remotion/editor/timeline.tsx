/**
 * 时间轴：`ScenePlan` 的可视化（设计规格 §6.2）。
 *
 * - 段结构与时长**本地计算**（`buildScenePlan`），参数改动即时重排，不请求后端；
 * - 点击段 → `seekTo(段首帧)` + 选中该段（Inspector 随选中联动）；
 * - 游标由父级 `frameupdate` 驱动；
 * - 段级标黄：素材缺失的片段段（`missingByClip`）；
 * - 缩略图：`@remotion/player` 的 `Thumbnail` **懒加载**（进入视口才排队）+ 串行 + 已渲染即保留，
 *   上限 `THUMB_LIMIT` 段（超出回落段色 + 文字，避免多段时把主线程压满）。
 */
import React from 'react';
import { Thumbnail } from '@remotion/player';
import { RecommendComposition } from '../src/RecommendComposition';
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

export function Timeline({ input, plan, frame, selection, missingByClip, missingByMedia, onSeek, onSelect }: {
  input: MultiMediaPocInput;
  plan: ScenePlan;
  frame: number;
  selection: Selection;
  missingByClip: Record<number, string>;
  /** 媒体 id → 缺失原因（片段素材准备失败；失败片段不会进计划，所以标在**所属媒体的段**上）。 */
  missingByMedia: Record<number, string>;
  onSeek: (frame: number) => void;
  onSelect: (selection: Selection) => void;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const total = Math.max(1, plan.durationInFrames);
  const activeIndex = plan.scenes.findIndex((scene) => frame >= scene.fromFrame && frame < scene.fromFrame + scene.durationInFrames);
  const activeScene = plan.scenes[activeIndex];

  // 进入视口才排队的段（懒加载）
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
    if (readyThumbs.length >= THUMB_LIMIT) return;   // 超过上限：不再新渲，沿用段色
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

  const seekByRatio = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / Math.max(1, box.width)));
    onSeek(Math.min(plan.durationInFrames - 1, Math.round(ratio * (plan.durationInFrames - 1))));
  };

  const selectScene = (scene: Scene, index: number) => {
    onSeek(scene.fromFrame);
    if (scene.type === 'MEDIA_CLIP' && scene.mediaId !== undefined && scene.clipId !== undefined) {
      onSelect({ kind: 'clip', mediaId: scene.mediaId, clipId: scene.clipId, sceneIndex: index });
    } else if (scene.mediaId !== undefined) {
      onSelect({ kind: 'media', mediaId: scene.mediaId, sceneIndex: index });
    } else {
      onSelect({ kind: 'scene', sceneIndex: index });
    }
  };

  const totalSec = plan.durationInFrames / plan.fps;
  const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`;

  return (
    <div className="vt-timeline">
      <div className="vt-ruler">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <span key={ratio}>{clock(totalSec * ratio)}</span>)}
      </div>
      <div className="vt-timeline-track" ref={scrollerRef} onClick={seekByRatio}>
        {plan.scenes.map((scene, index) => {
          const missing = scene.type === 'MEDIA_CLIP' && scene.clipId !== undefined
            ? missingByClip[scene.clipId]
            : scene.mediaId === undefined ? undefined : missingByMedia[scene.mediaId];
          const selected = selection.sceneIndex === index;
          const isActive = index === activeIndex;
          return (
            <div
              key={`${index}-${scene.fromFrame}`}
              className={`vt-seg${selected ? ' selected' : ''}${isActive ? ' active' : ''}${missing ? ' missing' : ''}`}
              style={{ flexGrow: scene.durationInFrames, background: COLORS[scene.type] }}
              title={missing ? `${sceneLabel(plan, scene, input.media.length)}｜素材缺失：${missing}` : sceneLabel(plan, scene, input.media.length)}
              onClick={(event) => { event.stopPropagation(); selectScene(scene, index); }}
            >
              {readyThumbs.includes(index) ? (
                <Thumbnail
                  component={RecommendComposition}
                  inputProps={{ input }}
                  frameToDisplay={scene.fromFrame + Math.floor(scene.durationInFrames / 2)}
                  durationInFrames={plan.durationInFrames}
                  fps={plan.fps}
                  compositionWidth={plan.width}
                  compositionHeight={plan.height}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : null}
              <ThumbTrigger index={index} root={scrollerRef} onVisible={registerVisible} />
              <span className="vt-seg-name">{scene.type === 'MEDIA_CLIP' ? '片段' : sceneLabel(plan, scene, input.media.length).slice(0, 6)}</span>
            </div>
          );
        })}
        <span className="vt-playhead" style={{ left: `${(frame / total) * 100}%` }} />
      </div>
      <div className="vt-timeline-foot">
        <span>
          <b>{activeScene ? sceneLabel(plan, activeScene, input.media.length) : '时间轴'}</b>
          {activeScene ? ` · 第 ${activeIndex + 1} 段 · ${Math.round(activeScene.durationInFrames / plan.fps)}s` : ''}
        </span>
        <span className="vt-hint">
          {rendering !== null
            ? `缩略图渲染中…（${readyThumbs.length}/${Math.min(wantThumbs.length, THUMB_LIMIT)}）`
            : `${plan.scenes.length} 段 · 总长 ${clock(plan.durationInFrames / plan.fps)} · 点段跳转 / 点轨定位`}
        </span>
      </div>
    </div>
  );
}
/** 视口触发器：段进入时间轴可视区时回调一次。 */
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
