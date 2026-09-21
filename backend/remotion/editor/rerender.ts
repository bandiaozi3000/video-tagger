/**
 * 「只重渲某一块」的安全校验（纯函数，好测）。
 *
 * 为什么必须校验：分块渲染的每块都是**按快照时间轴**渲好的。若当前草稿改了会**影响时长**的东西
 * （加/删媒体、改片段起止、改开场/资料卡/片名卡/落款时长），总帧数与**段边界全变** ✗ →
 * 旧块在新时间轴上对应的是**别的内容** ✗ → 局部替换会拼出一条错片。
 *
 * 所以：拿当前草稿算出的段边界与任务快照比对（同源同格式：渲染脚本 --probe 输出的 boundaryFrames）→
 * 一致才允许局部重渲；不一致必须整片重渲。
 */

/** 段边界帧列表（与快照同源：脚本输出的 `boundaryFrames`）。 */
export function parseBoundaryFrames(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : [];
  } catch {
    return [];
  }
}

export interface RerenderCheck {
  ok: boolean;
  reason: string;
}

export function canRerenderChunk(
  snapshot: string | null | undefined,
  current: number[],
): RerenderCheck {
  const stored = parseBoundaryFrames(snapshot);
  if (stored.length === 0) {
    return { ok: false, reason: '任务没有记录段边界（旧任务），无法校验，请整片重渲' };
  }
  if (current.length === 0) {
    return { ok: false, reason: '当前草稿算不出段边界（非银幕式形态？），无法校验，请整片重渲' };
  }
  if (stored.length !== current.length) {
    return { ok: false, reason: `段数变了（快照 ${stored.length - 1} 段 → 现在 ${current.length - 1} 段），请整片重渲` };
  }
  for (let i = 0; i < stored.length; i += 1) {
    if (stored[i] !== current[i]) {
      return { ok: false, reason: `第 ${i} 个段边界从 ${stored[i]} 帧变成 ${current[i]} 帧 —— 后面的内容整体位移了，请整片重渲` };
    }
  }
  return { ok: true, reason: '时间轴与快照一致，可只重渲这一块' };
}
