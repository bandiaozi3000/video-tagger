package com.videotagger.service;

/** 搜索结果：三层通用。entityType 区分 MEDIA / EPISODE / CLIP，跳转目标各异。
 *  mediaTitle/mediaFormat/subcategory/source 为「所属媒体」元信息（聚合/角标/来源筛选用；MEDIA 结果 mediaTitle 为空，其自身即 title）。
 *  createdAt 为实体打标/创建时间（时间范围筛选与展示用）。 */
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
        Long mediaId,
        Long episodeId,
        String videoFp,
        String coverPath,
        String detailCoverPath,
        String mediaTitle,
        String mediaFormat,
        String subcategory,
        Long subcategoryId,
        String source,
        Long createdAt
) {
    /** 片段结果（向后兼容构造器）。 */
    public SearchResult(Long id, String title, String url, String jumpUrl, Double timestampSec,
                        String tag, String note, Double score) {
        this(id, title, url, jumpUrl, timestampSec, tag, note, score, "CLIP", null, null, null, null, null,
                null, null, null, null, null, null);
    }
}
