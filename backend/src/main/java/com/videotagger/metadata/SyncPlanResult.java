package com.videotagger.metadata;

import java.util.List;

/** 区间计划响应。 */
public record SyncPlanResult(List<SyncRange> ranges) {
}
