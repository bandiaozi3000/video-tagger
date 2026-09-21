package com.videotagger.metadata;

import java.util.List;

/**
 * 一段区间的候选结果。
 *
 * @param total      本次取到的候选条数（未截断时即真实条数）
 * @param truncated  是否撞到 Bangumi 的 1000 条上限（撞了要让用户改选月份）
 * @param candidates 带本地匹配判定的候选（`matchType` / `targetMediaId` / `matchReason`）
 */
public record SyncRangeFetchResult(int total, boolean truncated, List<MetadataCandidate> candidates) {
}
