package com.videotagger.service;

import java.util.List;

/**
 * v0.32 第二部分：统计视频的请求体。
 *
 * <p>每条线 = 前端一个**筛选快照**（形状与 JS 侧 `trendSnapshot()` 一致，字段用包装类型以便缺省为 null）。
 * 后端拿它去调 {@link StatsService#trend} 取数 —— **视频与网页共用同一套取数方法，绝不另写 SQL**。
 */
public record TrendVideoRequest(String title,
                                List<Line> lines,
                                String chartType,
                                Double secPerYear,
                                String scoreSource,
                                /** 画面风格：`light`（白底亮色，默认）/ `dark`（旧深色）。 */
                                String theme) {

    public record Line(String name, String color, Snapshot filter) {
    }

    /** 筛选快照（与媒体页 `mediaFilter` 同构）。 */
    public record Snapshot(String q, String format, Long subcategoryId, Boolean unconfirmed,
                           List<String> genres, List<Long> tagIds, List<String> status, List<Integer> year,
                           List<String> season, List<Long> collectionId, Mode mode) {
    }

    public record Mode(String genres, String tagIds, String collectionId) {
    }
}
