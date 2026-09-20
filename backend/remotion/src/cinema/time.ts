/** 片段屏的「出处」小工具（纯函数，好测）。 */

/**
 * 毫秒 → 出处写法「几分几秒」：`252700 → 04:12`，超过一小时 → `1:04:12`。
 *
 * 不用 `Math.floor(ms/1000)` 之后再补零，是因为要处理负数与 NaN（草稿里可能存着脏值）。
 */
export function mmss(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const body = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${body}` : body;
}

/**
 * 片段在**原素材**里的出处一行：`04:12 – 04:29`。
 *
 * 没标时间段（整集）→ 返回空串，调用方只用时长兜底，不留 `– 00:00` 这种残废写法。
 * 止点用片段自己的时长推（后端只下发起点），所以它等于「起点 + 本片段长度」。
 */
export function clipSourceLine(clip: { sourceStartMs?: number; durationMs: number }): string {
  if (clip.sourceStartMs == null) return '';
  const from = clip.sourceStartMs;
  const to = from + (Number.isFinite(clip.durationMs) ? clip.durationMs : 0);
  return `${mmss(from)} – ${mmss(to)}`;
}

/**
 * 片段时长（毫秒）→ 「几分几秒」，取整到秒。
 *
 * 用户 2026-09-20：「秒还有小数点，改成几分几秒，到整数」——0.4s 这种不足一拍的不显示成 `00:00`，按 1 秒算。
 */
export function clipDurationLabel(durationMs: number): string {
  const seconds = Number.isFinite(durationMs) ? Math.round(durationMs / 1000) : 0;
  return mmss(Math.max(1, seconds) * 1000);
}
