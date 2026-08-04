package com.videotagger.service;

import java.math.BigDecimal;

/** 媒体卡片墙聚合项：一个媒体 + 片段数 + 最新标记时间（最近观看排序用）。
 *  coverPath 为媒体显式封面；fallbackCoverPath 为无封面时代表性片段帧兜底。 */
public record MediaSummary(Long id, String title, String mediaFormat, String subcategory, String status,
                           BigDecimal rating, String coverPath, Integer confirmed, Long clipCount,
                           Long latestAt, String fallbackCoverPath) {
}
