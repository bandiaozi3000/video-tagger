package com.videotagger.service;

/** 标签词条统计：全局视图带三级引用数；按媒体视图 refCount=该媒体内引用总数。 */
public record TagUsage(Long id, String name, Long createdAt,
                       long mediaCount, long episodeCount, long clipCount, long refCount) {

    public long total() {
        return refCount > 0 ? refCount : mediaCount + episodeCount + clipCount;
    }
}
