import React from 'react';

/**
 * 推荐等级的**视觉阶梯**（2026-09-26 用户拍板：等级取代 ★重点，卡片按等级出"抽卡感"）。
 *
 * 口径：**视觉只由名次决定，不让用户配颜色** —— index 0 = 最强，最后一名 = 默认卡片（不加装饰）。
 * 光效只给"大卡"，网格里的小卡只描边（缩小后光效看不见，还白烧渲染时间）。
 *
 * ⚠️ 这一个模块是"名次 → 视觉"的**唯一真源**：chapter 资料卡 / 网格小卡 / 结尾回顾都用它，
 * 换配色只改这里（否则三处会各说各话）。
 */

export interface TierLook {
  /** 名次（0 = 最强）。 */
  rank: number;
  /** 该档的名字（来自全局设置；越界时给兜底文案）。 */
  name: string;
  /** 描边/光晕主色。 */
  accent: string;
  /** 等级胶囊底色（已含渐变）。 */
  badgeBackground: string;
  /** 等级胶囊文字色。 */
  badgeText: string;
  /** 是否彩虹档（旋转渐变 + 呼吸光）。 */
  rainbow: boolean;
  /** 推荐理由左侧那道竖线的底色（彩虹档用竖向彩虹）。 */
  barBackground: string;
  /** 是否出装饰（最后一名 = 默认卡片：不描边、不出胶囊）。 */
  decorated: boolean;
}

const RAINBOW_BADGE = 'linear-gradient(90deg,#ff6b6b,#ffd166,#4ade80,#4fc3f7,#a78bfa)';
const RAINBOW_BAR = 'linear-gradient(180deg,#ff6b6b,#ffd166,#4ade80,#4fc3f7,#a78bfa)';
export const RAINBOW_RING = 'conic-gradient(from 0deg,#ff6b6b,#ffd166,#4ade80,#4fc3f7,#a78bfa,#ff6b6b)';

/**
 * 推荐等级名单：**写死，不做配置**（2026-09-26 用户拍板「按你的直接定死吧，也不需要配置」）。
 * 四档刚好对应四套视觉，顺序即强度（index 0 最强）；最后一个 = 默认卡片。
 */
export const RECOMMEND_TIERS = ['强推', '推荐', '值得一看', '一般'] as const;

/**
 * 媒体 → 档位名次（0 = 最强）；**未标注 / 越界脏数据 → `null`**（归入「未分级」）。
 *
 * 二级分组（`scene-plan.groupMedia`）与结尾全局回顾都读它，别再各处自己 `media.tier === 0` 硬写。
 */
export function tierRankOf(media: { tier?: number }, names: readonly string[] = RECOMMEND_TIERS): number | null {
  const tier = media.tier;
  if (typeof tier !== 'number' || !Number.isFinite(tier)) return null;
  const rank = Math.round(tier);
  return rank >= 0 && rank < names.length ? rank : null;
}

/** 名次 → 视觉。`total` = 档位总数（用最后一名判"默认档"）。 */
export function tierLook(rank: number | undefined, names: string[], fallbackName = '未定档'): TierLook {
  const total = Math.max(1, names.length);
  const at = rank === undefined ? total - 1 : Math.max(0, Math.min(total - 1, Math.round(rank)));
  const name = names[at]?.trim() || (rank === undefined ? fallbackName : `第 ${at + 1} 档`);
  if (at === total - 1) {
    return { rank: at, name, accent: '#8fa2c0', badgeBackground: 'rgba(163,174,196,.18)', badgeText: '#c8d3e6', rainbow: false, decorated: false, barBackground: '#4fc3f7' };
  }
  if (at === 0) {
    return { rank: at, name, accent: '#ffd166', badgeBackground: RAINBOW_BADGE, badgeText: '#241a00', rainbow: true, decorated: true, barBackground: RAINBOW_BAR };
  }
  if (at === 1) {
    return { rank: at, name, accent: '#ffd166', badgeBackground: 'linear-gradient(90deg,#ffe3a1,#ffd166)', badgeText: '#241a00', rainbow: false, decorated: true, barBackground: '#ffd166' };
  }
  return { rank: at, name, accent: '#4fc3f7', badgeBackground: 'linear-gradient(90deg,rgba(79,195,247,.32),rgba(79,195,247,.18))', badgeText: '#dff4ff', rainbow: false, decorated: true, barBackground: '#4fc3f7' };
}

/**
 * 网格小卡的等级外框（描边 + 光晕）。为什么要单独一份：小卡是 `overflow: hidden` 的卡片容器，
 * 外发光只能用 `boxShadow`（`overflow` 不裁阴影），而**贴边的彩虹环**要画在卡片内部（见 `TierCardRing`）。
 * 彩虹档用**多层异色阴影**凑出"彩虹光晕"（单层 boxShadow 只能一个颜色），不额外包一层 DOM（包了会被裁）。
 */
export function tierCardFrame(look: TierLook, breathe: number): { border: string; boxShadow: string } {
  if (!look.decorated) return { border: '1px solid rgba(255,255,255,.10)', boxShadow: '0 18px 44px rgba(0,0,0,.55)' };
  const glow = Math.round(20 + breathe * 22);
  if (look.rainbow) {
    return {
      border: `1px solid ${look.accent}cc`,
      boxShadow: [
        '0 18px 44px rgba(0,0,0,.55)',
        `0 0 ${glow}px rgba(255,107,107,${(0.32 + breathe * 0.22).toFixed(2)})`,
        `0 0 ${Math.round(glow * 1.7)}px rgba(79,195,247,${(0.24 + breathe * 0.18).toFixed(2)})`,
        `0 0 ${Math.round(glow * 2.4)}px rgba(167,139,250,${(0.18 + breathe * 0.14).toFixed(2)})`,
      ].join(', '),
    };
  }
  return {
    border: `1px solid ${look.accent}99`,
    boxShadow: `0 18px 44px rgba(0,0,0,.55), 0 0 0 1px ${look.accent}44, 0 0 ${Math.round(14 + breathe * 10)}px ${look.accent}55`,
  };
}

/**
 * 网格小卡的**彩虹内环**：`inset: 0` + mask 挖空，不受卡片 `overflow: hidden` 影响。
 * 非彩虹档返回 null（它们只需要 `tierCardFrame` 的单色描边）。
 */
export function TierCardRing({ look, radius }: { look: TierLook; radius: number }) {
  if (!look.decorated || !look.rainbow) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        padding: 4,
        // 小卡**不旋转**：一圈只有几厘米，旋转到某些角度会只剩单色（实测看着像“紫边”而不是彩虹），
        // 固定角度才能让五色均匀铺满一圈；“活着”的感觉交给呼吸光晕。
        background: 'conic-gradient(from 0deg,#ff6b6b,#ffd166,#4ade80,#4fc3f7,#a78bfa,#ff6b6b)',
        WebkitMaskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
        WebkitMaskClip: 'content-box, border-box',
        WebkitMaskComposite: 'xor',
        maskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
        maskClip: 'content-box, border-box',
        maskComposite: 'exclude',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  );
}

/**
 * 等级胶囊：彩虹档 = 彩虹底 + 深色字；其余 = 该档色底 + 亮字。
 * `size` = 字号（胶囊自身按它推内外边距）。
 */
export function TierBadge({ look, fontFamily, size, pulse = 0 }: {
  look: TierLook;
  fontFamily: string;
  size: number;
  /** 0-1：彩虹档的呼吸（由帧驱动；非彩虹档忽略）。 */
  pulse?: number;
}) {
  if (!look.decorated) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.4),
        padding: `${Math.round(size * 0.26)}px ${Math.round(size * 0.95)}px`,
        borderRadius: 999,
        background: look.badgeBackground,
        color: look.badgeText,
        fontFamily,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: 1,
        boxShadow: look.rainbow
          ? `0 0 ${Math.round(size * (1.1 + pulse * 0.9))}px rgba(255,209,102,${(0.55 + pulse * 0.35).toFixed(2)}), 0 6px 18px rgba(0,0,0,.45)`
          : `0 6px 18px rgba(0,0,0,.4)`,
      }}
    >
      {look.rainbow ? '✦' : '·'} {look.name}
    </span>
  );
}

/** 推荐理由文字的样式：彩虹档走**彩虹渐变字**（用户 2026-09-26 点名要）；其余用该档色。 */
export function reasonTextStyle(look: TierLook): React.CSSProperties {
  if (look.rainbow) {
    return { backgroundImage: RAINBOW_BADGE, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' };
  }
  return look.decorated ? { color: look.accent, textShadow: `0 0 12px ${look.accent}88` } : {};
}

/**
 * 大卡封面外的等级光环：**绝对定位的兄弟节点**（不包住封面，免得改掉封面的布局/尺寸）。
 *
 * 彩虹档用 conic 渐变 + `mask` 挖空中心只留一圈（旋转 + 呼吸光）；其余档是同一条代码路径的
 * 单色斜向渐变环 + 更小的光晕。为什么不用 `border`：3px 的渐变边框做不出来，
 * 而“包一层 padding 外框”会把封面挤小（首版就是这么把封面挤成一片色团的）。
 */
export function TierHalo({ look, frame, fps, radius }: {
  look: TierLook;
  frame: number;
  fps: number;
  radius: number;
}) {
  if (!look.decorated) return null;
  const pulse = look.rainbow ? (Math.sin((frame / Math.max(1, fps)) * Math.PI * 2) + 1) / 2 : 0;
  const spin = look.rainbow ? (frame / Math.max(1, fps)) * 45 : 0;
  const band = look.rainbow ? 5 : 2;
  return (
    <>
      {/* 外发光：彩虹档铺一层模糊旋转的彩环（boxShadow 只能单色，做不出“彩虹光晕”） */}
      {look.rainbow ? (
        <div
          style={{
            position: 'absolute',
            inset: -14,
            borderRadius: radius + 16,
            background: `conic-gradient(from ${spin.toFixed(2)}deg,#ff6b6b,#ffd166,#4ade80,#4fc3f7,#a78bfa,#ff6b6b)`,
            filter: `blur(${16 + pulse * 8}px)`,
            opacity: 0.5 + pulse * 0.25,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* 细环：用 mask 挖空中心 → 只剩一圈；**旋转的是渐变角度**（`from Ndeg`），
          而不是旋转元素本身 —— 首版用 `transform: rotate` 把方形环转成了菱形，包围不住封面。 */}
      <div
        style={{
          position: 'absolute',
          inset: -(band + 2),
          borderRadius: radius + band + 2,
          padding: band + 2,
          background: look.rainbow
            ? `conic-gradient(from ${spin.toFixed(2)}deg,#ff6b6b,#ffd166,#4ade80,#4fc3f7,#a78bfa,#ff6b6b)`
            : `linear-gradient(140deg,${look.accent},${look.accent}44)`,
          boxShadow: `0 0 ${Math.round(look.rainbow ? 30 + pulse * 20 : 16)}px ${look.accent}${look.rainbow ? 'cc' : '55'}`,
          WebkitMaskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
          WebkitMaskClip: 'content-box, border-box',
          WebkitMaskComposite: 'xor',
          maskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
          maskClip: 'content-box, border-box',
          maskComposite: 'exclude',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

/**
 * 候选卡胶囊的点击循环：**未标 → 第 1 档 → … → 最后一档 → 未标**。
 *
 * 以前写成 `(current + 1) % names.length`，**永远回不到"未标"** —— 用户 2026-09-26 报
 * 「推荐等级只能勾选，不能取消」。取消这一态必须留在循环里。
 */
export function cycleTier(current: number | undefined, names: readonly string[] = RECOMMEND_TIERS): number | undefined {
  if (current === undefined) return 0;
  const next = Math.round(current) + 1;
  return next >= names.length ? undefined : next;
}

/** 右侧面板里点某一档：点的就是当前这档 → **取消**（undefined）；否则设成这档。 */
export function toggleTier(current: number | undefined, rank: number): number | undefined {
  return current === rank ? undefined : rank;
}
