package com.videotagger.service;

import java.util.List;

/** 统计面板数据：全部由聚合查询得出，不加表。 */
public record StatsResponse(
        long totalClips,
        long totalVideos,
        long totalTags,
        List<TagSuggestion> topTags,
        List<SiteCount> bySite,
        List<TrendPoint> trend7,
        List<TrendPoint> trend30,
        List<MediaFormatStat> byMediaFormat,
        List<SubcategoryStat> bySubcategory
) {
    public record SiteCount(String site, long count) {
    }

    public record TrendPoint(String date, long count) {
    }

    /** 按媒体格式分布（format=编码，name=显示名）。 */
    public record MediaFormatStat(String format, String name, long count) {
    }

    /** 按子分类分布（label=从根到该节点的路径，重名分支可区分）。 */
    public record SubcategoryStat(Long id, String label, long count) {
    }
}
