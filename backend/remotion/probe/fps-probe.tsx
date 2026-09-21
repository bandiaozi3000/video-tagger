/**
 * 一次性探针：**编辑器预览到底满不满帧**（用户提问：能实时看完，为何导出要几小时）。
 *
 * 三个计数器（都在页面主线程上）：
 *   · `raf`   —— requestAnimationFrame 回调次数：**真正"能画"的帧率**（主线程忙时浏览器会跳过）✓
 *   · `renders` —— 合成组件被 React 渲染的次数（Remotion 每推进一帧会重渲组件树）
 *   · `cursor` —— Player 的时间光标推进量（只说明"时钟在走"，不等于画出来了）
 *
 * 判据：cursor 走满 24 帧/秒但 raf 只有 6 → **预览在丢帧**，看着流畅是假象；
 *       raf 也接近 24 → 预览真满帧，那导出慢就只能是"物理实现差异"（满像素光栅 / 软件渲染 / 逐帧抽帧 / 编码）。
 *
 * 用法：`npm run probe:fps`（无头）/ `PROBE_HEADED=1 npm run probe:fps`（开窗口自己看）
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { CinemaComposition } from '../src/cinema';
import { buildCinemaPlan } from '../src/cinema/plan';
import type { MultiMediaPocInput } from '../src/types';

const params = new URLSearchParams(location.search);
const ASSET_BASE_URL = params.get('assets') ?? '';
const WIDTH = Number(params.get('width') ?? '1280');
const HEIGHT = Number(params.get('height') ?? '720');
const PLAY_SECONDS = Number(params.get('seconds') ?? '12');

/** 一个够真实的银幕式输入：开场 + 一张片名卡 + **一个真片段**（片段帧才是预览最贵的部分）。 */
function makeInput(): MultiMediaPocInput {
  return {
    template: 'MULTI_MEDIA_RECOMMEND',
    style: 'cinema',
    title: 'FPS 探针',
    subtitle: '',
    intro: '',
    assetBaseUrl: ASSET_BASE_URL,
    media: [
      {
        mediaId: 1,
        order: 1,
        mode: 'CLIPS_SELECTED',
        title: '少女与战车',
        year: 2012,
        coverAssetPath: 'media/poster-a.jpg',
        description: '',
        tags: [],
        clips: [
          {
            clipId: 1,
            episodeNo: 1,
            title: '探针片段',
            assetPath: 'media/clip-a.mp4',
            durationMs: 60000,
            hasAudio: true,
          },
        ],
      },
      {
        mediaId: 2,
        order: 2,
        mode: 'INFO_ONLY',
        title: '现视研 2代目',
        year: 2004,
        coverAssetPath: 'media/poster-b.jpg',
        description: '',
        tags: [],
        clips: [],
      },
    ],
    params: {
      fps: 30,
      width: WIDTH,
      height: HEIGHT,
      durations: { opening: 6, intro: 5, group: 5, detail: 10, ending: 5, title: 3 },
    },
  } as unknown as MultiMediaPocInput;
}

interface Report {
  seconds: number;
  rafTicks: number;
  rafFps: number;
  compRenders: number;
  compRendersPerSecond: number;
  cursorFrom: number;
  cursorTo: number;
  cursorFps: number;
  targetFps: number;
  /** 预览达成的帧率占目标帧率的比例。 */
  coverage: number;
  /** 长任务（>50ms 的主线程阻塞）：真在干重活就会有，用来判“无头是不是根本没画”。 */
  longTasks: number;
  longTaskMs: number;
  /** WebGL 报告的渲染器（看有没有真走 GPU）。 */
  gpuRenderer: string;
}

function App(): React.ReactElement {
  const playerRef = useRef<PlayerRef>(null);
  const input = useMemo(makeInput, []);
  const plan = useMemo(() => buildCinemaPlan(input), [input]);
  const renders = useRef(0);
  const rafTicks = useRef(0);
  const startedAt = useRef(0);
  const cursorFrom = useRef(0);
  const [live, setLive] = useState<string>('待启动');
  const longTasks = useRef(0);
  const longTaskMs = useRef(0);
  const gpuRenderer = useRef<string>('unknown');

  // 渲染计数：包一层组件，每次 React 渲染 +1（Remotion 推进一帧会重渲组件树）
  const Tracked = useMemo(() => {
    const Inner = (props: { input: MultiMediaPocInput }): React.ReactElement => {
      renders.current += 1;
      return <CinemaComposition {...props} />;
    };
    return Inner;
  }, []);

  // rAF 计数：主线程忙到画不出来时，浏览器会跳过 rAF 回调
  useEffect(() => {
    let running = true;
    const tick = (): void => {
      if (!running) return;
      rafTicks.current += 1;
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
    return () => {
      running = false;
    };
  }, []);

  // 长任务统计：主线程被阻塞 >50ms 才算。数值大 = 真在做重活
  useEffect(() => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.current += 1;
          longTaskMs.current += entry.duration;
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
      return () => observer.disconnect();
    } catch {
      return undefined;   // 浏览器不支持 longtask 就跳过
    }
  }, []);

  // GPU 渲染器：无头环境常报 SwiftShader（软件光栅）或有头报真显卡
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
      if (!gl) return;
      const anyGl = gl as unknown as { getExtension: (name: string) => unknown; getParameter: (id: unknown) => unknown };
      const ext = anyGl.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number } | null;
      gpuRenderer.current = ext ? String(anyGl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(anyGl.getParameter(gl.RENDERER));
    } catch {
      // 拿不到就算了
    }
  }, []);

  const report = (): Report => {
    const seconds = (Date.now() - startedAt.current) / 1000;
    const cursorTo = Number(playerRef.current?.getCurrentFrame() ?? 0);
    const covered = cursorTo - cursorFrom.current;
    return {
      seconds: Number(seconds.toFixed(2)),
      rafTicks: rafTicks.current,
      rafFps: Number((rafTicks.current / seconds).toFixed(1)),
      compRenders: renders.current,
      compRendersPerSecond: Number((renders.current / seconds).toFixed(1)),
      cursorFrom: cursorFrom.current,
      cursorTo,
      cursorFps: Number((covered / seconds).toFixed(1)),
      targetFps: plan.fps,
      coverage: Number((covered / seconds / plan.fps).toFixed(2)),
      longTasks: longTasks.current,
      longTaskMs: Number(longTaskMs.current.toFixed(0)),
      gpuRenderer: gpuRenderer.current,
    };
  };

  useEffect(() => {
    // 让驱动脚本能调用
    (window as unknown as Record<string, unknown>).__fpsProbe = {
      ready: false,
      start: () => {
        renders.current = 0;
        rafTicks.current = 0;
        longTasks.current = 0;
        longTaskMs.current = 0;
        cursorFrom.current = Number(playerRef.current?.getCurrentFrame() ?? 0);
        startedAt.current = Date.now();
        playerRef.current?.play();
        setLive('测量中…');
      },
      report: () => {
        const r = report();
        setLive(`raf ${r.rafFps}/s · 合成渲染 ${r.compRendersPerSecond}/s · 光标 ${r.cursorFps}/s（目标 ${r.targetFps}）`);
        return r;
      },
      seek: (frame: number) => playerRef.current?.seekTo(frame),
    };
    (window as unknown as { __fpsProbe: { ready: boolean } }).__fpsProbe.ready = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ margin: 0, background: '#07060d', color: '#e8e6f0', fontFamily: 'monospace' }}>
      <div id="readout" style={{ padding: '8px 12px', fontSize: 13 }} data-live={live}>
        {live}
      </div>
      <div style={{ width: '100%', aspectRatio: `${plan.width} / ${plan.height}` }}>
        <Player
          ref={playerRef}
          component={Tracked}
          inputProps={{ input }}
          durationInFrames={plan.durationInFrames}
          fps={plan.fps}
          compositionWidth={plan.width}
          compositionHeight={plan.height}
          controls
          loop
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <div id="meta" data-seconds={PLAY_SECONDS} data-fps={plan.fps} data-width={plan.width} data-height={plan.height} />
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
