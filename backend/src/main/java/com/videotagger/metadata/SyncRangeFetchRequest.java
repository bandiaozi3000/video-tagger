package com.videotagger.metadata;

/** 取某一段区间的候选（设计规格 §5.2）：一次只查一段，让前端能显示逐段进度。 */
public record SyncRangeFetchRequest(String from, String to) {
}
