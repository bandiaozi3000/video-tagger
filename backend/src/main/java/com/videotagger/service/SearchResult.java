package com.videotagger.service;

/** 搜索结果：三层通用。entityType 区分 ANIME / EPISODE / CLIP，跳转目标各异。 */
public record SearchResult(
        Long id,
        String title,
        String url,
        String jumpUrl,
        Double timestampSec,
        String tag,
        String note,
        Double score,
        String entityType,
        Long animeId,
        Long episodeId,
        String videoFp
) {
    /** 片段结果（向后兼容构造器）。 */
    public SearchResult(Long id, String title, String url, String jumpUrl, Double timestampSec,
                        String tag, String note, Double score) {
        this(id, title, url, jumpUrl, timestampSec, tag, note, score, "CLIP", null, null, null);
    }
}
