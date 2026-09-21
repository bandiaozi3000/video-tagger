package com.videotagger.metadata;

import java.util.List;

/**
 * 同步区间计划请求（设计规格 §5.1）：年（至少 1 个）、季、月都可多选。
 */
public record SyncPlanRequest(List<Integer> years, List<String> seasons, List<Integer> months) {
}
