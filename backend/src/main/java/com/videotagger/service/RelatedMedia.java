package com.videotagger.service;

/**
 * 与某部媒体「同系列」的本地条目（跨媒体借片段的候选来源）。
 *
 * 只包含**视频类关系**且**本地存在、有片段**的条目 —— 由 {@link RelatedMediaService} 过滤。
 */
public record RelatedMedia(Long mediaId, String title, Integer year, String relationType, long clipCount) {
}
