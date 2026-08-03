package com.videotagger.service;

import java.math.BigDecimal;

/** 番剧卡片墙聚合项：一部番 + 片段数 + 最新标记时间（最近观看排序用）。 */
public record AnimeSummary(Long id, String title, String type, String status, BigDecimal rating,
                           String coverPath, Integer confirmed, Long clipCount, Long latestAt) {
}
