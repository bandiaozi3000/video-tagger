package com.videotagger.metadata;

/**
 * 取某一段区间的候选（设计规格 §5.2）：一次只查一段，让前端能显示逐段进度。
 *
 * @param region   地区筛选（可空 = 不限）。Bangumi 没有 region 字段，走官方公共标签
 *                 `filter.meta_tags`（且关系），取值见 {@code BangumiMetadataProvider.REGIONS}。
 * @param category 分类筛选（可空 = 不限）。同 `region` 走 `meta_tags`，白名单见
 *                 {@code BangumiMetadataProvider.CATEGORIES}；与 region **且**叠加。
 */
public record SyncRangeFetchRequest(String from, String to, String region, String category) {
}
