import type { EditorConfig, MediaClips, MissingClip } from './api';

/**
 * 推荐草稿里**片段引用**的增删（纯函数，可单测）。
 *
 * 背景（用户 2026-09-20）：「媒体片段删除后，推荐还占着，提示素材缺失，但是没有入口修复。
 * 要么补要么删无法操作」—— 草稿里存的是 `mediaClips[mediaId].order = [clipId…]`，
 * 素材库里删了片段后这份引用就成了悬空指针，后端会把它报成 `missing`。
 * 「删」这一侧就是本文件两个函数（「补」= 切到该媒体，用已有的片段面板重选）。
 */

/** 该媒体在推荐里的片段配置（没有就造一个空壳，方便调用方直接改）。 */
export function clipsOf(mediaClips: EditorConfig['mediaClips'], mediaId: number): MediaClips {
  return mediaClips[String(mediaId)] ?? { order: [] };
}

/** 从某媒体的片段顺序里拿掉一个片段；**空了就把这条媒体记录一起删掉**（它同时变回「资料推荐」）。 */
export function withoutClip(mediaClips: EditorConfig['mediaClips'], mediaId: number, clipId: number): EditorConfig['mediaClips'] {
  const current = clipsOf(mediaClips, mediaId);
  const order = current.order.filter((value) => value !== clipId);
  if (order.length === current.order.length) return mediaClips;   // 本来就没有 → 原样返回，不产生新对象
  const next = { ...mediaClips };
  // 借来的片段被移除时，**来源映射也要跟着删**（否则 sources 里留悬空键）
  const sources = { ...(current.sources ?? {}) };
  delete sources[String(clipId)];
  if (order.length === 0) delete next[String(mediaId)];
  else next[String(mediaId)] = { ...current, order, sources };
  return next;
}

/**
 * 一键修好「跨媒体悬空引用」：把片段按后端建议的来源挂上（写 ），而不是删掉。
 *
 * 用户 2026-09-20 实测的形态：草稿《草莓棉花糖》里挂着属于 OVA 的片段，旧版没 sources → 被判缺失。
 */
export function attachWithSource(
  mediaClips: EditorConfig['mediaClips'],
  mediaId: number,
  clipId: number,
  sourceMediaId: number,
): EditorConfig['mediaClips'] {
  const current = clipsOf(mediaClips, mediaId);
  const order = current.order.includes(clipId) ? current.order : [...current.order, clipId];
  return {
    ...mediaClips,
    [String(mediaId)]: {
      ...current,
      order,
      sources: { ...(current.sources ?? {}), [String(clipId)]: sourceMediaId },
    },
  };
}

/** 一次清理掉全部失效片段（后端报的每一条都拿掉）。 */
export function dropAllMissing(mediaClips: EditorConfig['mediaClips'], missing: MissingClip[]): EditorConfig['mediaClips'] {
  let next = mediaClips;
  for (const item of missing) next = withoutClip(next, item.mediaId, item.clipId);
  return next;
}
