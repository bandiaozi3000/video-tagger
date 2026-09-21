import React from 'react';
import { Img, OffthreadVideo, getRemotionEnvironment, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { riseIn } from '../animation';
import { assetUrl } from '../asset-url';
import { pad2 } from '../scenes/parts';
import type { RenderParams } from '../params';
import type { PocClip, PocMedia } from '../types';
import { BigNumber, BigTitle, CinemaEntrance, Facts, LowerThird, NoteQuote, Rule, useEnterCinema } from './parts';
import { clipDurationLabel, clipSourceLine } from './time';
import { needsBlurBackdrop } from './backdrop';
import { cinemaLayoutCached, heroCardCount } from './slots';
import { endingListRow, endingListRows, endingListSpeedPaused, endingPageSlice, endingPages, endingRowsPerPage, endingScrollBase, endingShow, endingStatLines, ENDING_START_PAUSE_SEC, WALL_SPEED_FACTORS } from './ending';
import { CINEMA_COLOR, CINEMA_FONT, CINEMA_LAYOUT, cinemaStatLines, readableOn, withAlpha, type CinemaPlan, type CinemaScene } from './plan';

/**
 * 银幕式模板的六个场景。
 *
 * 结构（用户 2026-09-19 定稿）：闪回段 → 定格段 → (片名卡 → 封面镜头 | 片段…) × N → 落款。
 * 除片段幕外的每一幕都由 `CinemaEntrance` 包一层"色带擦除"，颜色取上一部的主色；
 * 片段幕**不用**擦除——"片名卡缩小 → 片段长出来"本身就是它的转场。
 */

interface SceneProps {
  scene: CinemaScene;
  plan: CinemaPlan;
  assetBaseUrl: string;
}

/**
 * ⓪ 掠影段（开篇上半）：「冲入 · 掠影」——2026-09-19 用户审定。
 *
 * 设计依据（主流做法，五条机制，直指"为什么前三版像硬套模板"）：
 *   ① 速度变化：甩镜约 0.25s、模糊在中点最强；冲刺后必须减速（impractical.ai / vitelnk time-remapping）
 *   ② 纵深视差：虚拟相机在 3D 空间移动，而不是缩放平面（focusee / designkkashi parallax）
 *   ③ 运动模糊与速度成正比、静止时才锐利（compstart：180° 快门约定）
 *   ④ 尺度层级 + 打破网格：尺度差、视觉重量，而不是均匀格（collage 布局实务）
 *   ⑤ 编排：预备动作 / 跟随过冲 / 次级运动 / 错峰 / 克制（madegooddesigns / motionly）
 * 另加两条：模板感来自"设计决策没动过"（默认字体、单一尺度）；以及**统一色彩分级**——
 * 原色平铺读起来是一堆截图，压一层冷调 + 暗角 + 颗粒才像"一部片子"。
 *
 * 结构（7s 开屏里的前 ~4.2s）：
 *   掠影（4 张依次贴脸掠过，模糊随速度）→ 减速落位（尺度差 + 重叠 + 出血）
 *   → 标题升起（图层在卡片**之下**）→ **主推那张再次横扫、遮住标题一瞬** → 柔光收束。
 */
export function Scan({ scene, plan, assetBaseUrl }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const list = (scene.mediaIds ?? []).map((id) => plan.mediaIndex.get(id)).filter((item): item is PocMedia => Boolean(item));
  if (list.length === 0) return null;
  const safe = Math.round(width * CINEMA_LAYOUT.safeX);
  const fps = plan.fps;

  // 主推（开场代表秀）：勾了代表秀就全上，没勾就按片单顺序；张数由**时长**与布局上限决定（用户 2026-09-20 选 B）
  const wantedHeroes = plan.params.openingIds.length > 0
    ? plan.params.openingIds.filter((id) => list.some((item) => item.mediaId === id)).length
    : list.length;
  const heroCount = Math.min(heroCardCount(durationInFrames / fps, wantedHeroes), list.length);
  const heroes = list.slice(0, Math.max(1, heroCount));
  // 摆位：Hero 固定不动，其余由草稿里的 seed 驱动（确定性随机 + 拒绝采样避开 Hero，见 slots.ts）
  const layout = cinemaLayoutCached(heroes.length, plan.params.seed);
  const hero = heroes[0];
  const raiders = heroes.slice(1);
  const farList = list.length > heroes.length ? list.slice(heroes.length) : list;

  // 拍点（帧）
  const raidStep = Math.round(fps * 0.26);
  const raidFrames = Math.max(1, raiders.length) * raidStep + Math.round(fps * 0.46);
  const settleEnd = raidFrames + Math.round(fps * 0.85);
  const titleStart = raidFrames + Math.round(fps * 0.12);
  const sweepStart = titleStart + Math.round(fps * 0.75);
  const sweepFrames = Math.round(fps * 0.6);
  const sweepEnd = sweepStart + sweepFrames;
  const sweep = interpolate(frame, [sweepStart, sweepEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleIn = useEnterCinema(titleStart);
  const statIn = useEnterCinema(titleStart + Math.round(fps * 0.25));

  // 相机：缓慢推进 + 极轻的左右漂移（"机器是人端的"）
  const push = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [1.0, 1.045], { extrapolateRight: 'clamp' });
  const driftY = Math.sin((frame / fps) * Math.PI * 0.42) * 1.8;
  const driftX = Math.sin((frame / fps) * Math.PI * 0.31 + 1.2) * width * 0.006;
  const accent = hero ? plan.accentOf(hero) : CINEMA_COLOR.ink;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: CINEMA_COLOR.canvas }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `perspective(1500px) rotateY(${driftY.toFixed(2)}deg) scale(${push.toFixed(4)}) translateX(${driftX.toFixed(1)}px)`,
          transformOrigin: '50% 50%',
        }}
      >
        {/* 远景层：整面墙反向漂移 + 恒定模糊，只做氛围与纵深（不抢主体） */}
        <FarWall list={farList} plan={plan} assetBaseUrl={assetBaseUrl} width={width} height={height} frame={frame} fps={fps} />

        {/*
         * 标题层：**在卡片之上**（zIndex 25 > 卡片 12~20）。
         * 用户 2026-09-20 定稿：掠影期间的遮挡可以留，但**定格后标题必须干净可读**。
         * 「幽灵卡」在透视容器之外（zIndex 30），掠过时仍会盖住它一瞬 → 那个互动保留。
         */}
        {/* 标题块：2026-09-20 用户提“开头标题偏靠下” → bottom 0.11 → 0.19（约上移 8% 画面高，压暗层跟着走） */}
        <div style={{ position: 'absolute', left: safe, bottom: Math.round(height * 0.19), zIndex: 25 }}>
          {/* 角落压暗（不是玻璃/发光）：白字压在高亮封面上会糊，用它把标题区单独压出来 */}
          <div
            style={{
              position: 'absolute',
              left: -safe,
              right: -Math.round(width * 0.22),
              top: -Math.round(height * 0.06),
              bottom: -Math.round(height * 0.045),
              background: 'radial-gradient(88% 132% at 0% 88%, rgba(5,6,9,.92) 0%, rgba(5,6,9,.62) 46%, rgba(5,6,9,0) 82%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'relative',
              ...riseIn(titleIn, Math.round(height * 0.06)),
              fontFamily: CINEMA_FONT.display,
              fontWeight: 900,
              fontSize: Math.round(height * 0.104),
              lineHeight: 1,
              color: '#fff',
              textShadow: '0 2px 8px rgba(0,0,0,.85), 0 10px 38px rgba(0,0,0,.7)',
              whiteSpace: 'nowrap',
            }}
          >
            {plan.params.title || '本次片单'}
          </div>
          <div style={{ position: 'relative', ...riseIn(statIn, Math.round(height * 0.03)), marginTop: Math.round(height * 0.026), display: 'flex', alignItems: 'center', gap: Math.round(height * 0.024) }}>
            <Rule color={accent} width={width} height={height} />
            <div style={{ fontFamily: CINEMA_FONT.num, fontWeight: 600, fontSize: Math.round(height * 0.027), letterSpacing: Math.round(height * 0.004), color: 'rgba(255,255,255,.94)', textShadow: '0 2px 12px rgba(0,0,0,.85)' }}>
              {[`${plan.stats.titles} 部`, ...cinemaStatLines(plan)].join('　·　')}
            </div>
          </div>
        </div>

        {/* 掠影 + 落位的中景卡片（第 6 张起是小卡陪衬，见 `slots.ts`） */}
        {raiders.map((item, index) => (
          <RaidCard
            key={item.mediaId}
            item={item}
            plan={plan}
            assetBaseUrl={assetBaseUrl}
            width={width}
            height={height}
            frame={frame}
            fps={fps}
            index={index}
            arriveAt={index * raidStep}
            slot={layout[index + 1]}
          />
        ))}
        {/* 主推：先贴脸冲入点着画面，落最大的位置；**最后画（在最上）** —— 09-19 审定版的层叠关系，别动 */}
        {hero ? (
          <RaidCard
            item={hero}
            plan={plan}
            assetBaseUrl={assetBaseUrl}
            width={width}
            height={height}
            frame={frame}
            fps={fps}
            index={0}
            arriveAt={0}
            slot={layout[0]}
            hero
          />
        ) : null}
      </div>

      {/* 主推的第二次横扫：单独一张"幽灵卡"穿过画面，遮住标题一瞬后离场（不动已落位的卡） */}
      {hero && frame >= sweepStart - Math.round(fps * 0.1) && frame <= sweepEnd + Math.round(fps * 0.1) ? (
        <SweepCard item={hero} plan={plan} assetBaseUrl={assetBaseUrl} width={width} height={height} frame={frame} fps={fps} from={sweepStart} to={sweepEnd} />
      ) : null}

      {/* 色彩分级：统一冷调（color 混合）+ 暗角 + 上下压暗 + 柔光横扫 + 确定性颗粒 */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(196deg, rgba(14,42,54,.9), rgba(9,14,20,.95))', mixBlendMode: 'color', opacity: 0.4, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(126% 106% at 50% 44%, transparent 32%, rgba(4,7,10,.82) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,7,10,.5) 0%, transparent 24%, transparent 62%, rgba(4,7,10,.72) 100%)', pointerEvents: 'none' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(102deg, transparent ${(sweep * 120 - 14).toFixed(1)}%, rgba(206,240,255,.14) ${(sweep * 120).toFixed(1)}%, transparent ${(sweep * 120 + 14).toFixed(1)}%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: GRAIN,
          backgroundSize: '160px 160px',
          backgroundPosition: `${frame % 160}px ${(frame * 7) % 160}px`,
          opacity: 0.05,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/** 确定性颗粒：SVG feTurbulence（不需要随机数；逐帧平移背景即可“呼吸”）。 */
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/></filter><rect width="160" height="160" filter="url(#n)" opacity="0.55"/></svg>',
)}")`;

/** 远景墙：铺满画幅、恒定模糊、与近景反向漂移（纵深靠"两层不同速率"，不是靠缩放一张图）。 */
function FarWall({ list, plan, assetBaseUrl, width, height, frame, fps }: {
  list: PocMedia[];
  plan: CinemaPlan;
  assetBaseUrl: string;
  width: number;
  height: number;
  frame: number;
  fps: number;
}) {
  const rows = Math.max(2, Math.min(4, Math.round(Math.sqrt(Math.max(1, list.length) / 2.37))));
  const cols = Math.ceil(Math.max(1, list.length) / rows);
  const tileH = (height / rows) * 1.5;
  const tileW = tileH * 0.75;
  const wallW = cols * tileW;
  const wallH = rows * tileH;
  const coverScale = Math.max(width / wallW, height / wallH) * 1.18;
  const drift = Math.sin((frame / fps) * Math.PI * 0.18) * width * 0.02;
  const tiles: PocMedia[] = [];
  for (let i = 0; i < cols * rows; i++) tiles.push(list[i % list.length]);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: wallW,
        height: wallH,
        marginLeft: -wallW / 2,
        marginTop: -wallH / 2,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${tileW}px)`,
        gridTemplateRows: `repeat(${rows}, ${tileH}px)`,
        transform: `translateX(${drift.toFixed(1)}px) scale(${coverScale.toFixed(3)}) rotateY(${((-drift / width) * 6).toFixed(2)}deg)`,
        filter: 'blur(3px) brightness(.5) saturate(.85)',
        zIndex: 1,
      }}
    >
      {tiles.map((item, index) => (
        <div key={`${item.mediaId}-${index}`} style={{ position: 'relative', overflow: 'hidden' }}>
          {item.coverAssetPath ? (
            <Img src={assetUrl(item.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: withAlpha(plan.accentOf(item), 0.2) }} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * 中景卡片：掠入（贴脸、模糊随速度）→ 减速落位（弹簧过冲）。
 * 位置/旋转/缩放/模糊全部逐帧算，不用任何 CSS 过渡。
 */
function RaidCard({ item, plan, assetBaseUrl, width, height, frame, fps, index, arriveAt, slot, hero = false }: {
  item: PocMedia;
  plan: CinemaPlan;
  assetBaseUrl: string;
  width: number;
  height: number;
  frame: number;
  fps: number;
  index: number;
  arriveAt: number;
  slot: { x: number; y: number; s: number; rot: number };
  hero?: boolean;
}) {
  const baseH = height * 0.56;
  const baseW = baseH * 0.75;
  const finalX = slot.x * width - (baseW * slot.s) / 2;
  const finalY = slot.y * height - (baseH * slot.s) / 2;
  const fromLeft = index % 2 === 0;
  const raidSpan = Math.round(fps * 0.46);
  const raidP = interpolate(frame, [arriveAt, arriveAt + raidSpan], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const settled = frame >= arriveAt + raidSpan;
  const settle = useEnterCinema(arriveAt + raidSpan);
  // 掠入轨迹：交替从左上 / 右下贴脸冲过
  const raidX = fromLeft ? interpolate(raidP, [0, 1], [-0.4, 0.68]) : interpolate(raidP, [0, 1], [1.4, 0.34]);
  const raidY = interpolate(raidP, [0, 1], [fromLeft ? -0.2 : 1.2, slot.y - 0.02]);
  const x = settled ? finalX + (1 - settle) * (raidX * width - finalX) : raidX * width;
  const y = settled ? finalY + (1 - settle) * (raidY * height - finalY) : raidY * height;
  const scale = settled ? slot.s * (0.93 + settle * 0.07) : interpolate(raidP, [0, 1], [2.35, 1.15]);
  const rot = settled ? slot.rot * settle : interpolate(raidP, [0, 1], [fromLeft ? -16 : 16, slot.rot]);
  // 速度 → 模糊：静止才锐利
  const speed = settled ? Math.abs(1 - settle) : 1;
  const blur = (hero ? 20 : 16) * speed * speed;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: baseW,
        height: baseH,
        zIndex: hero ? 20 : 12 + index,
        transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
        transformOrigin: '50% 50%',
        overflow: 'hidden',
        filter: `blur(${blur.toFixed(1)}px) brightness(${(0.94 - index * 0.05).toFixed(3)})`,
        boxShadow: '0 26px 70px rgba(0,0,0,.5)',
        outline: '1px solid rgba(255,255,255,.07)',
      }}
    >
      {item.coverAssetPath ? (
        <Img src={assetUrl(item.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: withAlpha(plan.accentOf(item), 0.22) }} />
      )}
      <div style={{ position: 'absolute', left: 10, bottom: 10, fontFamily: CINEMA_FONT.num, fontSize: Math.round(baseH * 0.05), color: 'rgba(255,255,255,.92)', textShadow: '0 2px 12px rgba(0,0,0,.85)' }}>
        {item.year ?? ''}
      </div>
    </div>
  );
}

/** 幽灵卡：主推的第二次横扫——穿过画面遮住标题一瞬后离场（不影响已落位的卡片）。 */
function SweepCard({ item, plan, assetBaseUrl, width, height, frame, fps, from, to }: {
  item: PocMedia;
  plan: CinemaPlan;
  assetBaseUrl: string;
  width: number;
  height: number;
  frame: number;
  fps: number;
  from: number;
  to: number;
}) {
  const p = interpolate(frame, [from, to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const h = height * 0.78;
  const w = h * 0.75;
  const x = interpolate(p, [0, 1], [-0.7, 1.28]) * width;
  const y = interpolate(p, [0, 1], [0.28, 0.18]) * height;
  const blur = 30 * Math.sin(Math.PI * p) ** 2;
  const rot = interpolate(p, [0, 1], [-12, 10]);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        zIndex: 30,
        transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`,
        overflow: 'hidden',
        filter: `blur(${blur.toFixed(1)}px) brightness(1.02)`,
        boxShadow: '0 30px 80px rgba(0,0,0,.55)',
        opacity: 0.96,
      }}
    >
      {item.coverAssetPath ? (
        <Img src={assetUrl(item.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
    </div>
  );
}

/**
 * ② 片单卡：**上下两道栅栏互相插入**（上排从展线垂下、下排从底线上顶，水平错半格 → 城垛状互锁）。
 *
 * 为什么不是"一排竖条"：一排是**队列**，两排互相插入才是**编织**——上下的错位让相邻两部
 * 自然成对、视线在中间来回跳，而两排以不同速率横移（视差）又让整幅一直在动。
 * 中间留一条"缝"给主题/引言/统计（文字压在缝上，两排都不遮它）。
 */
export function Settle({ scene, plan, assetBaseUrl }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const params = plan.params;
  const list = plan.media;
  const hero = (params.openingIds.length > 0 ? plan.mediaIndex.get(params.openingIds[0]) : undefined)
    ?? plan.media.find((item) => item.coverAssetPath)
    ?? plan.media[0]
    ?? null;
  const accent = hero ? plan.accentOf(hero) : CINEMA_COLOR.ink;
  const safe = Math.round(width * CINEMA_LAYOUT.safeX);
  const intro = params.intro.trim();
  const showTitle = !intro && !params.subtitle.trim();
  const subIn = useEnterCinema(Math.round(fps * 0.1));
  const statIn = useEnterCinema(Math.round(fps * 0.35));

  // 栅栏几何
  // 条宽按封面比例（3:4）而不是固定 0.115w：定格段的封面要**完整**——
  // 固定 0.115w 时条是 0.487 比例，3:4 的封面会被 `object-fit: cover` 横向裁掉 35%（用户 2026-09-20 报「有几张只显示部分」）。
  const stripH = Math.round(height * 0.42);
  const stripW = Math.round(stripH * 0.75);
  const gap = Math.round(width * 0.012);
  const pitch = stripW + gap;
  const seam = Math.round(height * 0.5);
  const topY = seam - stripH;
  const bottomY = seam;
  const topPan = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, -pitch * 2.2]);
  const bottomPan = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [-pitch * 0.5, -pitch * 1.6]);
  const halfW = Math.ceil(width / pitch) + 2;

  const strip = (item: PocMedia, index: number, i: number, top: boolean) => {
    // hook 无条件调用（离屏剔除在下面），否则渲染期 hook 数量会变 → React error #310
    const drop = useEnterCinema(Math.min(Math.abs(i) * 2, Math.round(fps * 0.7)));
    const x = safe + i * pitch + (top ? topPan : bottomPan) - pitch;
    if (x + stripW < -60 || x > width + 60) return null;
    const from = top ? -1 : 1;
    const dist = Math.abs(x + stripW / 2 - width / 2) / (width / 2);
    const spot = Math.max(0, 1 - dist) ** 2;
    // 2026-09-20：整体亮度封顶（旧公式中段能到 1.46 → 最亮的封面正好贴在字旁边，"背景太亮"就是它）
    const shade = 0.42 + (0.36 + spot * 0.28) * drop;
    return (
      <div key={`${top ? 't' : 'b'}-${item.mediaId}-${i}`} style={{ position: 'absolute', left: x, top: top ? topY : bottomY, width: stripW, height: stripH, transform: `translateY(${(1 - drop) * from * -stripH * 0.85}px)`, opacity: drop }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', outline: `1px solid rgba(255,255,255,${(0.08 + spot * 0.16).toFixed(3)})` }}>
          {item.coverAssetPath ? (
            <Img src={assetUrl(item.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: `brightness(${shade.toFixed(3)}) saturate(${(0.82 + spot * 0.28).toFixed(2)})` }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: withAlpha(plan.accentOf(item), 0.2) }} />
          )}
          {/* 主色线画在"指向缝"的那一端，让互锁的节奏读得出来 */}
          <div style={{ position: 'absolute', left: 0, right: 0, [top ? 'bottom' : 'top']: 0, height: 3, background: plan.accentOf(item), opacity: 0.35 + spot * 0.65 } as React.CSSProperties} />
          <div style={{ position: 'absolute', left: 8, [top ? 'top' : 'bottom']: 8, fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.017), color: 'rgba(255,255,255,.7)' }}>
            {String(index + 1).padStart(2, '0')}
          </div>
          {/* 封面标题放在**远端**（旧代码三元写成了 `top ? 'bottom' : 'bottom'`，上排的标题全贴在缝边上 → 缝口又亮又乱） */}
          <div style={{ position: 'absolute', left: 8, right: 8, [top ? 'top' : 'bottom']: Math.round(height * 0.013), fontFamily: CINEMA_FONT.body, fontSize: Math.round(height * 0.019), lineHeight: 1.25, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,.9)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', opacity: Math.min(1, spot * 1.6) }}>
            {item.title}
          </div>
        </div>
        {/* 靠缝一端渐隐：让墙面"让位"给文字带，而不是把最亮的封面怼在字旁边 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            [top ? 'bottom' : 'top']: 0,
            height: '60%',
            background: `linear-gradient(${top ? '180deg' : '0deg'}, rgba(5,7,10,0) 0%, rgba(5,7,10,.55) 55%, rgba(5,7,10,.92) 100%)`,
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: CINEMA_COLOR.canvas }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(26,30,36,.92) 0%, rgba(11,12,15,.97) 50%, rgba(8,9,11,1) 100%)' }} />
      {/* 上排（垂下） */}
      {Array.from({ length: halfW * 2 }, (_, k) => k - halfW).map((i) => {
        const item = list[((i % list.length) + list.length) % list.length];
        return strip(item, ((i % list.length) + list.length) % list.length, i, true);
      })}
      {/* 下排（上顶 + 错半格） */}
      {Array.from({ length: halfW * 2 }, (_, k) => k - halfW).map((i) => {
        const item = list[(((i + 1000) % list.length) + list.length) % list.length];
        return strip(item, ((i % list.length) + list.length) % list.length, i, false);
      })}

      {/*
       * 中央"展带"（2026-09-20 重做）：不再是模糊的软渐变，而是**不透明核心 + 羽化边**的宽幅暗带，
       * 文字坐在带上——展签/字幕带的语言，不用玻璃与发光。
       */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: seam - Math.round(height * 0.15),
          height: Math.round(height * 0.3),
          background: 'linear-gradient(180deg, rgba(5,6,9,0) 0%, rgba(5,6,9,.72) 18%, rgba(5,6,9,.96) 36%, rgba(5,6,9,.96) 64%, rgba(5,6,9,.72) 82%, rgba(5,6,9,0) 100%)',
        }}
      />
      <div style={{ position: 'absolute', left: safe, right: safe, top: seam - Math.round(height * 0.056) }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: Math.round(width * 0.022), flexWrap: 'wrap' }}>
          <div style={{ ...riseIn(subIn, height * 0.04), fontFamily: CINEMA_FONT.display, fontWeight: 900, fontSize: Math.round(height * 0.088), lineHeight: 1, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,.9), 0 12px 44px rgba(0,0,0,.75)', whiteSpace: 'nowrap' }}>
            {showTitle || !params.subtitle.trim() ? params.title || `${list.length} 部推荐` : params.subtitle}
          </div>
          <div style={{ ...riseIn(statIn, height * 0.02), display: 'flex', alignItems: 'center', gap: Math.round(height * 0.02), paddingBottom: Math.round(height * 0.008) }}>
            <Rule color={accent} width={width} height={height} />
            <div style={{ fontFamily: CINEMA_FONT.num, fontWeight: 600, fontSize: Math.round(height * 0.026), letterSpacing: Math.round(height * 0.004), color: 'rgba(255,255,255,.94)', textShadow: '0 2px 10px rgba(0,0,0,.85)' }}>
              {[`${plan.stats.titles} 部`, ...cinemaStatLines(plan)].join('　·　')}
            </div>
          </div>
        </div>
        {intro ? (
          <div style={{ ...riseIn(subIn, height * 0.02), marginTop: Math.round(height * 0.022), maxWidth: '44ch', fontFamily: CINEMA_FONT.body, fontSize: Math.round(height * 0.028), lineHeight: 1.55, color: '#e8e6e2', textShadow: '0 3px 18px rgba(0,0,0,.95)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {intro}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * ③ 片名卡：**带图**——一张 3:4 的封面卡 + 右侧编号/标题/事实行。
 *
 * 这张卡不只是排版：它是后面片段段那个"角标"的**同一个对象**（同一套几何 A_CARD），
 * 片段开始时它会缩小到画面右下角——所以这里必须有图，缩下去才有识别度。
 */
export function TitleCard({ scene, plan, assetBaseUrl }: SceneProps) {
  const { width, height } = useVideoConfig();
  const params = plan.params;
  const media = scene.mediaId === undefined ? null : plan.mediaIndex.get(scene.mediaId) ?? null;
  if (!media) return null;
  const accent = scene.accent ?? plan.accentOf(media);
  const safe = Math.round(width * CINEMA_LAYOUT.safeX);
  const card = CARD_GEOM(width, height);
  const textLeft = card.x + card.w + Math.round(width * 0.045);
  const frame = useCurrentFrame();
  // 备注出场（2026-09-20 用户要求与片段屏一致）：标题/事实行先站好，备注再从下往上进。
  // 片名卡最短 1.0s，所以起点卡在 0.55s、走完 1.0s——再晚就会吞掉整段。
  const noteDelay = Math.round(plan.fps * 0.55);
  const noteRaw = interpolate(frame, [noteDelay, noteDelay + Math.round(plan.fps * 0.45)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const noteIn = 1 - Math.pow(1 - noteRaw, 3);

  return (
    <CinemaEntrance prevAccent={scene.prevAccent}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: CINEMA_COLOR.canvas }}>
        <div style={{ position: 'absolute', inset: 0, background: withAlpha(accent, CINEMA_LAYOUT.tintStrong) }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 100% at 26% 40%, transparent 28%, rgba(6,6,8,.8) 100%)' }} />

        {/* 封面卡 */}
        <div
          style={{
            position: 'absolute',
            left: card.x,
            top: card.y,
            width: card.w,
            height: card.h,
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,.6)',
            outline: '1px solid rgba(255,255,255,.12)',
          }}
        >
          {media.coverAssetPath ? (
            <Img src={assetUrl(media.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: withAlpha(accent, 0.25) }} />
          )}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: accent }} />
        </div>

        {/* 右侧文字 */}
        <div style={{ position: 'absolute', left: textLeft, right: safe, top: card.y + Math.round(height * 0.02) }}>
          <BigNumber text={pad2(scene.order ?? 1)} size={Math.round(height * CINEMA_LAYOUT.numRatio)} color={accent} from={0} opacity={0.95} />
          <div style={{ marginTop: Math.round(height * 0.02) }}>
            {/* maxWidth 用字号换算（CJK 下 1 字 ≈ 1em）：原来写 '10ch' 只有约 5 个汉字宽 → 「蓝兰岛漂流记」会被断成两行 */}
            <BigTitle text={media.title} size={Math.round(height * CINEMA_LAYOUT.titleRatio * 0.86)} color={CINEMA_COLOR.ink} maxWidth={String(Math.round(height * CINEMA_LAYOUT.titleRatio * 0.86 * 9))} from={Math.round(plan.fps * 0.12)} />
          </div>
          <div style={{ marginTop: Math.round(height * 0.038) }}>
            <Rule color={accent} width={width} height={height} />
          </div>
          <div style={{ marginTop: Math.round(height * 0.032) }}>
            <Facts media={media} size={Math.round(height * CINEMA_LAYOUT.metaRatio)} color={CINEMA_COLOR.muted} />
          </div>
          {/* 备注（= 用户手写的推荐语）：接「备注」开关 + 引语块样式（渲染在 parts.tsx 的 NoteQuote）
              + 与片段屏同语言的出场动画（淡入 + 上浮） */}
          {params.detailShow.note ? (
            <NoteQuote text={media.description ?? ''} accent={accent} width={width} height={height}
                       size={0.029} maxLines={3} color="#ffffff"
                       style={{
                         marginTop: Math.round(height * 0.032),
                         opacity: noteIn.toFixed(3),
                         transform: `translateY(${((1 - noteIn) * Math.round(height * 0.018)).toFixed(1)}px)`,
                       }} />
          ) : null}
        </div>

        <div style={{ position: 'absolute', right: safe, bottom: Math.round(height * 0.11), fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.019), letterSpacing: Math.round(height * 0.004), color: CINEMA_COLOR.dim }}>
          本片单 {pad2(scene.order ?? 1)} / {pad2(plan.media.length)}
          {media.clips.length > 0 ? `　·　${media.clips.length} 个片段` : ''}
        </div>
      </div>
    </CinemaEntrance>
  );
}

/** 卡片几何（片名卡与片段角标共用同一套，保证"缩小"是同一个对象）。 */
export function CARD_GEOM(width: number, height: number): { x: number; y: number; w: number; h: number } {
  const h = Math.round(height * 0.62);
  const w = Math.round(h * 0.75);
  return { x: Math.round(width * CINEMA_LAYOUT.safeX), y: Math.round(height * 0.19), w, h };
}


/** ④ 封面镜头（该部没有片段时的画面）：封面出血 + 慢推镜，右侧留白承载信息。 */
export function CoverShot({ scene, plan, assetBaseUrl }: SceneProps) {
  const { width, height } = useVideoConfig();
  const media = scene.mediaId === undefined ? null : plan.mediaIndex.get(scene.mediaId) ?? null;
  if (!media) return null;
  const accent = scene.accent ?? plan.accentOf(media);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const push = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [CINEMA_LAYOUT.kenBurnsFrom, CINEMA_LAYOUT.kenBurnsTo], { extrapolateRight: 'clamp' });
  const panelLeft = width * CINEMA_LAYOUT.coverBleedRatio;
  const textLeft = Math.round(width * 0.63);
  const quote = plan.params.detailShow.note ? media.description?.trim() || media.synopsis?.trim() || '' : '';

  return (
    <CinemaEntrance prevAccent={scene.prevAccent}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: CINEMA_COLOR.canvas }}>
        {media.coverAssetPath ? (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: panelLeft, overflow: 'hidden' }}>
            <Img src={assetUrl(media.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', transform: `scale(${push.toFixed(3)})` }} />
          </div>
        ) : null}
        <div style={{ position: 'absolute', left: panelLeft, top: 0, bottom: 0, width: 1, background: CINEMA_COLOR.line }} />
        <div style={{ position: 'absolute', left: panelLeft, right: 0, top: 0, bottom: 0, background: withAlpha(accent, CINEMA_LAYOUT.tintSoft) }} />
        <div style={{ position: 'absolute', left: textLeft, right: Math.round(width * CINEMA_LAYOUT.safeX), top: Math.round(height * 0.26) }}>
          <BigNumber text={pad2(scene.order ?? 1)} size={Math.round(height * 0.062)} color={accent} from={0} opacity={0.95} />
          <div style={{ marginTop: Math.round(height * 0.028) }}>
            <BigTitle text={media.title} size={Math.round(height * CINEMA_LAYOUT.coverTitleRatio)} color={CINEMA_COLOR.ink} maxWidth={String(Math.round(height * CINEMA_LAYOUT.coverTitleRatio * 8))} from={Math.round(plan.fps * 0.1)} />
          </div>
          <div style={{ marginTop: Math.round(height * 0.038) }}>
            <Facts media={media} size={Math.round(height * CINEMA_LAYOUT.metaRatio * 0.94)} color={CINEMA_COLOR.muted} />
          </div>
          <NoteQuote text={quote} accent={accent} width={width} height={height}
                     size={0.028} maxLines={4} style={{ marginTop: Math.round(height * 0.046) }} />
        </div>
        <div style={{ position: 'absolute', left: textLeft, bottom: Math.round(height * 0.11) }}>
          <div style={{ fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.019), letterSpacing: Math.round(height * 0.004), color: CINEMA_COLOR.dim }}>
            本片单 {pad2(scene.order ?? 1)} / {pad2(plan.media.length)}
          </div>
        </div>
      </div>
    </CinemaEntrance>
  );
}

/**
 * ⑤ 片段：**片名卡缩小 → 片段从卡片矩形长出来 → 卡片变成左下角信息卡**。
 *
 * 两处修正（用户 2026-09-19 报）：
 *   1. 去掉"呼吸"缩放——`1 + sin(...)·0.02` 每 3 秒来回放大缩小，看起来就是**一直抖**；
 *      改成一整段极慢的单向推镜（1.00 → 1.02），那才是"镜头在走"而不是"画面在抖"。
 *   2. 缩小后必须**仍然显示**：之前卡片在变形结束时被 `opacity: 0` 抹掉，右下角什么都没有。
 *      现在卡片就落在左下角成为**信息卡**（封面缩略图 + 番剧名 + 年份·集数·类型 + 推荐语），常驻。
 *
 * 信息卡的依据：lower-third 的通行做法——底部靠左、两行层级（名字主、信息次）、
 * 做得好时"观众注意不到它"（cloudmonet / anfx / olafmotion 的 lower-third 规范）。
 * 所以这里不加阴影不加发光，只用一层薄底板保证压在画面上也读得清。
 */
export function ClipShot({ scene, plan, assetBaseUrl }: SceneProps) {
  const { width, height } = useVideoConfig();
  const params = plan.params;
  const media = scene.mediaId === undefined ? null : plan.mediaIndex.get(scene.mediaId) ?? null;
  const clip: PocClip | undefined = media?.clips.find((item) => item.clipId === scene.clipId);
  if (!media || !clip) return null;
  const accent = scene.accent ?? plan.accentOf(media);
  const index = media.clips.findIndex((item) => item.clipId === clip.clipId);
  const src = assetUrl(clip.assetPath, assetBaseUrl);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // 预览里 <video> 拿到 moov + seek 完成前不画任何东西（截图就是“糊成一片、卡片正常”）。
  // 两层各自记“出帧了没”：没出帧就不显示视频层，先露出上面那层封面模糊底图。
  // 渲染（导出）链路 isPlayer=false → 恒定算就绪，不多这层非确定性。
  const isPlayer = getRemotionEnvironment().isPlayer;
  const [blurReady, setBlurReady] = React.useState(!isPlayer);
  const [sharpReady, setSharpReady] = React.useState(!isPlayer);
  const markBlurReady = React.useCallback(() => setBlurReady(true), []);
  const markSharpReady = React.useCallback(() => setSharpReady(true), []);
  // src 变了（会话重建 → 新 token）要重新等帧，否则会停在旧元素的“已就绪”上
  React.useEffect(() => {
    if (!isPlayer) return;
    setBlurReady(false);
    setSharpReady(false);
  }, [src, isPlayer]);
  const safe = Math.round(width * CINEMA_LAYOUT.safeX);

  // 展开动画：卡片矩形 → 满屏
  const morphFrames = Math.round(plan.fps * 0.7);
  const morph = interpolate(frame, [0, morphFrames], [0, 1], { extrapolateRight: 'clamp' });
  const ease = 1 - Math.pow(1 - morph, 3);
  const card = CARD_GEOM(width, height);
  const info = INFO_GEOM(width, height);
  const insetTop = (card.y * (1 - ease)).toFixed(1);
  const insetLeft = (card.x * (1 - ease)).toFixed(1);
  const insetRight = ((width - card.x - card.w) * (1 - ease)).toFixed(1);
  const insetBottom = ((height - card.y - card.h) * (1 - ease)).toFixed(1);

  // 缩略图：从片名卡的封面卡位置与尺寸，插值到左下角信息卡的缩略图
  const tx = interpolate(ease, [0, 1], [card.x, info.thumb.x]);
  const ty = interpolate(ease, [0, 1], [card.y, info.thumb.y]);
  const tw = interpolate(ease, [0, 1], [card.w, info.thumb.w]);
  const th = interpolate(ease, [0, 1], [card.h, info.thumb.h]);
  const infoText = interpolate(morph, [0.5, 0.88], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // 备注：等信息卡落定后再进（按帧计——morph 只有 0.7s，跟它同步会让整块一起堆上来）
  const noteDelay = Math.round(plan.fps * 0.85);
  const noteRaw = interpolate(frame, [noteDelay, noteDelay + Math.round(plan.fps * 0.45)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const noteIn = 1 - Math.pow(1 - noteRaw, 3);
  const noteText = (clip.note?.trim() || media.description?.trim() || '').trim();
  // 极慢的单向推镜（不是往复缩放）
  const push = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [1.0, 1.02], { extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: CINEMA_COLOR.canvas }}>
      {/* 阶段 1：先搬上片名卡末态（色底 + 右侧文字），再随变形退场 —— 保证切幕不是硬切 */}
      <div style={{ position: 'absolute', inset: 0, background: withAlpha(accent, CINEMA_LAYOUT.tintStrong), opacity: interpolate(morph, [0, 0.5], [1, 0], { extrapolateRight: 'clamp' }) }} />
      <div
        style={{
          position: 'absolute',
          left: card.x + card.w + Math.round(width * 0.045),
          right: safe,
          top: card.y + Math.round(height * 0.02),
          opacity: interpolate(morph, [0.05, 0.4], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        <div style={{ fontFamily: CINEMA_FONT.num, fontWeight: 700, fontSize: Math.round(height * CINEMA_LAYOUT.numRatio), color: accent, lineHeight: 0.9 }}>{pad2(scene.order ?? 1)}</div>
        <div style={{ marginTop: Math.round(height * 0.02), fontFamily: CINEMA_FONT.display, fontSize: Math.round(height * CINEMA_LAYOUT.titleRatio * 0.86), lineHeight: 1, color: CINEMA_COLOR.ink, maxWidth: '10ch' }}>{media.title}</div>
        <div style={{ marginTop: Math.round(height * 0.038) }}><Rule color={accent} width={width} height={height} /></div>
        <div style={{ marginTop: Math.round(height * 0.032) }}><Facts media={media} size={Math.round(height * CINEMA_LAYOUT.metaRatio)} color={CINEMA_COLOR.muted} /></div>
      </div>

      {/* 片段：从卡片矩形展开到满屏（同帧模糊铺底，原比例居中时两侧不空） */}
      <div style={{ position: 'absolute', inset: 0, clipPath: `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)` }}>
        {/* 兜底底图（仅预览）：浏览器 <video> 没解出帧前是透明的，原本就只剩背景那层模糊、看起来像“糊成一片”。
            这里先垫一层同款模糊的封面，视频出帧后再盖上去（导出/渲染链路 isPlayer=false，直接跳过这层）。 */}
        {isPlayer ? (
          <div style={{ position: 'absolute', inset: '-8%', overflow: 'hidden' }}>
            {media.coverAssetPath ? (
              <Img src={assetUrl(media.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(38px) brightness(.34) saturate(1.1)' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: withAlpha(accent, 0.22) }} />
            )}
          </div>
        ) : null}
        {/* 模糊背景视频层：只在**看得见**时才渲 —— 片段与画幅同比（都是 16:9）时，
            前景 `contain` 已经铺满，这层一个像素都看不见，却占片段帧 ~40% 耗时（实测 121 → 70 ms/帧）。
            尺寸探不到 → 保守渲染（宁多花时间也别露黑边）。
            注：它自己的 blurReady 只控制本层淡入，前景用的是独立的 sharpReady → 跳过本层不影响前景 ✓ */}
        {needsBlurBackdrop(clip, width, height) ? (
          <div style={{ position: 'absolute', inset: '-8%', overflow: 'hidden', opacity: blurReady ? 1 : 0, transition: isPlayer ? 'opacity 200ms linear' : undefined }}>
            <OffthreadVideo src={src} muted onLoadedData={markBlurReady} onSeeked={markBlurReady} onCanPlay={markBlurReady} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(38px) brightness(.34) saturate(1.1)' }} />
          </div>
        ) : null}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sharpReady ? 1 : 0, transition: isPlayer ? 'opacity 200ms linear' : undefined }}>
          <OffthreadVideo src={src} muted={!clip.hasAudio || params.clipVolume <= 0} volume={params.clipVolume / 100} onLoadedData={markSharpReady} onSeeked={markSharpReady} onCanPlay={markSharpReady} style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${push.toFixed(4)})` }} />
        </div>
      </div>

      {/* 封面缩略图：从片名卡位置缩小到左下角信息卡（变形结束后**保留**） */}
      <div
        style={{
          position: 'absolute',
          left: tx,
          top: ty,
          width: tw,
          height: th,
          overflow: 'hidden',
          zIndex: 20,
          outline: '1px solid rgba(255,255,255,.16)',
          boxShadow: `0 ${Math.round(18 * (1 - ease))}px ${Math.round(50 * (1 - ease))}px rgba(0,0,0,${(0.55 * (1 - ease)).toFixed(2)})`,
        }}
      >
        {media.coverAssetPath ? (
          <Img src={assetUrl(media.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: withAlpha(accent, 0.25) }} />
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: accent }} />
      </div>

      {/* 压暗 / 暗角 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: ease, background: 'radial-gradient(130% 100% at 50% 46%, transparent 44%, rgba(3,3,7,.72) 100%), linear-gradient(180deg, rgba(3,3,7,.6) 0%, transparent 20%, transparent 62%, rgba(3,3,7,.9) 100%)' }} />

      {/* 上带：集号 | 标签 · 片段计数 */}
      <div style={{ position: 'absolute', left: safe, top: Math.round(height * 0.11), opacity: ease, fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.021), letterSpacing: Math.round(height * 0.005), color: 'rgba(255,255,255,.85)' }}>
        {/* 只报集号（2026-09-20 用户拍板：集标题**一律不显示**）。
            库里那些标题是抓来的网页标题/多段式长题，截断也不好看；集标题在其他模板仍会显示（`episodeTitle` 照旧下发）。 */}
        {clip.episodeNo ? `EP.${pad2(clip.episodeNo)}` : '片段'}
      </div>
      <div style={{ position: 'absolute', right: safe, top: Math.round(height * 0.11), opacity: ease, textAlign: 'right', fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.019), letterSpacing: Math.round(height * 0.004), color: 'rgba(255,255,255,.8)' }}>
        {/* 跨媒体借来的片段才标来源（设计规格 §6）：不标的话观众会想“这条为什么不是这部番” */}
        {clip.sourceTitle ? `来源：${clip.sourceTitle}　·　` : ''}
        {clip.tag?.trim() ? `${clip.tag.trim()}　·　` : ''}片段 {pad2(index + 1)} / {pad2(media.clips.length)}
      </div>

      {/* 信息卡（左下）：封面缩略图右侧的三行 —— 番剧名 / 年份·集数·类型 / 推荐语 */}
      <div style={{ position: 'absolute', left: info.text.x, bottom: Math.round(height * 0.11), width: info.text.w, opacity: infoText, zIndex: 21 }}>
        <div style={{ fontFamily: CINEMA_FONT.display, fontSize: Math.round(height * 0.032), lineHeight: 1.15, color: CINEMA_COLOR.ink, textShadow: '0 3px 16px rgba(0,0,0,.9)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {media.title}
        </div>
        <div style={{ marginTop: Math.round(height * 0.01) }}>
          <Facts media={media} size={Math.round(height * 0.019)} color="rgba(255,255,255,.78)" />
        </div>
        <div style={{ marginTop: Math.round(height * 0.012), display: 'flex', alignItems: 'center', gap: Math.round(height * 0.012) }}>
          <span style={{ width: Math.round(width * 0.014), height: 2, background: accent, flex: 'none' }} />
          <span style={{ fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.017), letterSpacing: Math.round(height * 0.004), color: 'rgba(255,255,255,.72)' }}>
            {/* 出处（2026-09-20 用户要求）：上带左侧已经报了集号，这里改成「几分几秒」。
                后端只下发起点，止点用片段自己的时长推（= 起点 + 本片长度）。 */}
            {[clipSourceLine(clip), clipDurationLabel(clip.durationMs)].filter(Boolean).join('　·　')}
          </span>
        </div>
        {params.detailShow.note && noteText ? (
          /* 备注：主色引线（NoteQuote，展带同款）+ 出场动画——信息卡落定后再从下往上进。
             不发光不加玻璃，只靠引线、字号与动效把它从「一行小字」提到「这句要读」。 */
          <NoteQuote
            text={noteText}
            accent={accent}
            width={width}
            height={height}
            size={0.029}
            maxLines={2}
            color="#ffffff"
            maxWidth={Math.round(width * 0.42)}
            style={{
              marginTop: Math.round(height * 0.016),
              opacity: noteIn.toFixed(3),
              transform: `translateY(${((1 - noteIn) * Math.round(height * 0.018)).toFixed(1)}px)`,
            }}
          />
        ) : null}
      </div>

      {/* 本片段进度（信息卡之上，避免与信息卡重叠） */}
      <div style={{ position: 'absolute', left: safe, right: safe, bottom: Math.round(height * 0.085), height: 2, background: 'rgba(255,255,255,.16)', opacity: ease }}>
        <div style={{ height: '100%', width: `${(Math.min(1, frame / Math.max(1, durationInFrames - 1)) * 100).toFixed(2)}%`, background: accent }} />
      </div>
    </div>
  );
}

/** 左下角信息卡几何：封面缩略图 + 右侧文字列（文字列底边与缩略图底边对齐）。 */
function INFO_GEOM(width: number, height: number) {
  const safe = Math.round(width * CINEMA_LAYOUT.safeX);
  const thumbH = Math.round(height * 0.235);
  const thumbW = Math.round(thumbH * 0.75);
  const thumbY = height - Math.round(height * 0.11) - thumbH;
  const textX = safe + thumbW + Math.round(width * 0.018);
  return {
    thumb: { x: safe, y: thumbY, w: thumbW, h: thumbH },
    text: { x: textX, w: Math.round(width * 0.42) },
  };
}


/** ⑥ 落款：真实数字 + 曲名（有 BGM 才出现）+ 低饱和封面墙。常驻 chrome 全砍后，这是唯一的"信息位"。 */
/** 结尾右侧的滚动墙：4 列 3:4 封面纵向无缝滚动，各列速度差 ±15%（视差）。纯图不带字。 */
function ScrollWall({ media, assetBaseUrl, width, height, frame, fps, speed, opacity }: {
  media: PocMedia[];
  assetBaseUrl: string;
  width: number;
  height: number;
  frame: number;
  fps: number;
  /** `params.endingScrollSpeed`（与章节模板同源，50 = 基准 0.12 屏高/秒）。 */
  speed: number;
  opacity: number;
}) {
  if (media.length === 0) return null;
  const wallW = width * 0.36;
  const columnCount = WALL_SPEED_FACTORS.length;
  const columnW = wallW / columnCount;
  const tileH = columnW * (4 / 3);                       // 3:4 封面 → 完整不裁
  const perColumn = Math.max(3, Math.ceil((height * 1.7) / tileH));
  // 速度映射：50 → 0.12 屏高/秒（用户 2026-09-20 选的基准），钳在 0.04~0.3
  const base = Math.min(0.3, Math.max(0.04, 0.12 * ((speed > 0 ? speed : 50) / 50)));
  return (
    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: wallW, display: 'flex', overflow: 'hidden', opacity, filter: 'grayscale(.55) brightness(.5) saturate(.9)' }}>
      {Array.from({ length: columnCount }, (_, columnIndex) => {
        // 第 i 列负责 media[i], media[i+4], … 不够就循环续（4 部也能铺满 4 列）
        const sequence: PocMedia[] = [];
        for (let i = 0; i < perColumn; i++) sequence.push(media[(columnIndex + i * columnCount) % media.length]);
        const sequenceHeight = sequence.length * tileH;
        const drift = (frame / fps) * base * height * WALL_SPEED_FACTORS[columnIndex];
        const offset = -(drift % sequenceHeight);
        return (
          <div key={columnIndex} style={{ position: 'relative', width: columnW, height: '100%', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', transform: `translateY(${offset.toFixed(2)}px)` }}>
              {/* 复制一份接在尾部 → 无缝循环 */}
              {[...sequence, ...sequence].map((item, index) => (
                item.coverAssetPath
                  ? <Img key={`${item.mediaId}-${index}`} src={assetUrl(item.coverAssetPath, assetBaseUrl)} style={{ width: '100%', height: tileH, objectFit: 'cover', display: 'block' }} />
                  : <div key={`${item.mediaId}-${index}`} style={{ width: '100%', height: tileH }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CinemaEnding({ scene, plan, assetBaseUrl }: SceneProps) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const params = plan.params;
  const show = endingShow(params);
  const accent = plan.media.length > 0 ? plan.accentOf(plan.media[0]) : CINEMA_COLOR.ink;
  const safe = Math.round(width * CINEMA_LAYOUT.safeX);
  const bgm = params.bgmTracks.map((track) => track.name).filter(Boolean);
  const stats = endingStatLines(plan);
  // 入场：不用 hook（名单行数会随编辑变化，hook 写在循环里会触发 React #310）
  const enter = (atSeconds: number): React.CSSProperties => {
    const at = Math.round(fps * atSeconds);
    const progress = interpolate(frame, [at, at + Math.round(fps * 0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { opacity: progress, transform: `translateY(${((1 - progress) * Math.round(height * 0.012)).toFixed(1)}px)` };
  };
  // 收尾：末 1.2s **淡出到全黑**（用户 2026-09-20：“结尾结束得有点突兀，带个黑场转场平滑点”）。
  // 原来只把画面压到 0.55 就直接切黑→看感上是“硬停”；现在盖一层真黑幕，最后一帧落在全黑。
  const fadeFrames = Math.round(fps * 1.2);
  const outro = interpolate(frame, [Math.max(0, durationInFrames - fadeFrames), Math.max(1, durationInFrames - 1)], [1, 0.55], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blackOut = interpolate(frame, [Math.max(0, durationInFrames - fadeFrames), Math.max(1, durationInFrames - 1)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ruleProgress = interpolate(frame, [Math.round(fps * 0.7), Math.round(fps * 1.15)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // 名单配速：**只有清单滚**（用户 2026-09-20：「感谢观看统计这些固定内容别滚动，滚动的只有清单」）
  // 视窗会把出画的行裁掉，所以配速只需让整份名单走完：travel = 名单块高
  const listRows = endingListRows(plan.media);
  // 配速/翻页：两者共用「先停 ENDING_START_PAUSE_SEC 秒」的入场礼节
  const listSpeed = endingListSpeedPaused({ speed: params.endingScrollSpeed, durationSeconds: durationInFrames / fps, rows: listRows.length });
  const rowsPerPage = endingRowsPerPage({ hasTitle: params.endingTitle.trim() !== '', hasText: params.endingText.trim() !== '', hasStats: show.stats && stats.length > 0 });
  const pages = endingPages(listRows, rowsPerPage);
  const page = endingPageSlice({ durationSeconds: durationInFrames / fps, pageCount: pages.length });
  const elapsed = frame / fps - ENDING_START_PAUSE_SEC;
  const pageIndex = Math.min(pages.length - 1, Math.max(0, Math.floor(elapsed / page.slice)));
  const pageLocal = elapsed - pageIndex * page.slice;
  // 翻页：每页淡入 0.25s、淡出 0.25s（最后一页不淡出，交给结尾的压暗）
  const pageOpacity = show.paging
    ? (pageIndex === pages.length - 1
      ? interpolate(pageLocal, [0, 0.25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : interpolate(pageLocal, [0, 0.25, Math.max(0.3, page.slice - 0.25), page.slice], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
    : 1;
  const listScroll = Math.max(0, listSpeed * height * elapsed);

  return (
    <CinemaEntrance prevAccent={scene.prevAccent}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: CINEMA_COLOR.canvas }}>
        {show.wall ? <ScrollWall media={plan.media} assetBaseUrl={assetBaseUrl} width={width} height={height} frame={frame} fps={fps} speed={params.endingScrollSpeed} opacity={outro} /> : null}
        {/* 中缝：把封面推进暗处，左侧文字区永远干净 */}
        {show.wall ? <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: width * 0.36, background: `linear-gradient(90deg, ${CINEMA_COLOR.canvas} 0%, rgba(11,11,12,.35) 40%, transparent 100%)`, pointerEvents: 'none' }} /> : null}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 100% at 22% 40%, transparent 30%, rgba(6,6,8,.55) 100%)', pointerEvents: 'none', opacity: outro }} />

        {/** 左栏：**固定头（标题/文案/短线/统计）+ 名单视窗**，只有视窗里的名单在滚 */ }
        {/** 左栏：**固定头 + 名单视窗**；关掉封面墙时不再往右扩到底，而是收在 0.56w（否则名单的年份会被拉到画面最右、中间空一大片） */}
        <div style={{ position: 'absolute', left: safe, right: Math.round(width * (show.wall ? 0.4 : 0.38)), maxWidth: Math.round(width * 0.56), top: Math.round(height * 0.21), bottom: Math.round(height * 0.17), display: 'flex', flexDirection: 'column', opacity: outro }}>
          <div style={{ flex: 'none' }}>
            {params.endingTitle.trim() ? (
              <div style={{ ...enter(0.2), fontFamily: CINEMA_FONT.num, fontWeight: 700, fontSize: Math.round(height * 0.072), letterSpacing: Math.round(height * -0.0014), color: CINEMA_COLOR.ink, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {params.endingTitle.trim()}
              </div>
            ) : null}
            {params.endingText.trim() ? (
              <div style={{ ...enter(0.5), marginTop: Math.round(height * 0.022), fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.026), letterSpacing: Math.round(height * 0.005), color: CINEMA_COLOR.muted }}>
                {params.endingText.trim()}
              </div>
            ) : null}
            <div style={{ marginTop: Math.round(height * 0.04), transformOrigin: '0% 50%', transform: `scaleX(${ruleProgress.toFixed(4)})` }}>
              <Rule color={accent} width={width} height={height} />
            </div>

            {/* 统计行（默认关，`detailShow.endingStats` 打开才显示）—— 固定不动 */}
            {show.stats && stats.length > 0 ? (
              <div style={{ ...enter(1.0), marginTop: Math.round(height * 0.04), fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.024), color: CINEMA_COLOR.muted }}>
                {stats.join(' · ')}
              </div>
            ) : null}
          </div>

          {/* 分组标签：片尾职员表的「CAST / STAFF」位（用户 2026-09-20：「参考其他设计」） */}
          {show.list && listRows.length > 0 ? (
            <div style={{ flex: 'none', marginTop: Math.round(height * 0.045), fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.016), letterSpacing: Math.round(height * 0.0032), color: CINEMA_COLOR.dim }}>
              收录
            </div>
          ) : null}

          {/* 名单视窗：单列、出画裁掉；**只有这里面的名单在动**（滚动 → 平移；翻页 → 整页淡入淡出） */}
          {show.list && listRows.length > 0 ? (
            <div style={{ flex: '1 1 auto', position: 'relative', overflow: 'hidden', marginTop: Math.round(height * 0.022) }}>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'absolute', left: 0, right: 0, top: 0, opacity: pageOpacity, transform: `translateY(${(show.paging ? 0 : -listScroll).toFixed(2)}px)` }}>
                {(show.paging ? pages[pageIndex] : listRows).map((item, rowIndex) => {
                  // 翻页模式的序号要接着上一页继续（第 2 页从 16 开始），不能每页从 1 重来
                  const order = show.paging ? pageIndex * rowsPerPage + rowIndex + 1 : rowIndex + 1;
                  const row = endingListRow(item, order, show);
                  return (
                    <li key={item.mediaId}
                        style={{ display: 'flex', gap: Math.round(width * 0.009), alignItems: 'baseline', fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.021), lineHeight: 1.75, color: '#e8e6e2' }}>
                      {/* 层级靠**明度**而不是字号：序号/年份暗、名称亮（第一版三者同色同号 → 一片均匀小字） */}
                      <span style={{ flex: 'none', minWidth: Math.round(height * 0.03), textAlign: 'right', color: CINEMA_COLOR.dim }}>{row.index}</span>
                      <span style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</span>
                      {/* 年份**紧跟名称**（不再右对齐拉到 0.56w 外，中间空一大片） */}
                      {row.year ? <span style={{ flex: 'none', color: CINEMA_COLOR.dim }}>· {row.year}</span> : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </div>

        {bgm.length > 0 ? (
          <div style={{ position: 'absolute', left: safe, bottom: Math.round(height * 0.11), fontFamily: CINEMA_FONT.num, fontSize: Math.round(height * 0.019), letterSpacing: Math.round(height * 0.004), color: CINEMA_COLOR.dim, opacity: outro }}>
            BGM　{bgm.join(' / ')}
          </div>
        ) : null}

        {/* 黑场转场：盖在所有内容之上（（含封面墙与 chromium 装饰），最后一帧全黑） */}
        <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: blackOut.toFixed(3), pointerEvents: 'none' }} />
      </div>
    </CinemaEntrance>
  );
}
export type { RenderParams };
