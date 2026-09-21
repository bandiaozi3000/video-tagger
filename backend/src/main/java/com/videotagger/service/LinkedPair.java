package com.videotagger.service;

/**
 * 一对同系列媒体（`external_relation` 白名单关系的两端，**双向展开后**的一条）。
 *
 * 用途：导出清单的「去重」——把同系列的派生条目（OVA / 第二季 / 剧场版…）折到本体上，
 * 只保留本体（2026-09-21 用户要求）。
 */
public record LinkedPair(long fromMediaId, long toMediaId, String relationType) {
}
