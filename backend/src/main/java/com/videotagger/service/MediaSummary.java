package com.videotagger.service;

import java.math.BigDecimal;

/** 媒体卡片墙聚合项：一个媒体 + 片段数 + 最新标记时间（最近观看排序用）。
 *  coverPath 为媒体显式封面；fallbackCoverPath 为无封面时代表性片段帧兜底；
 *  collectionCount 为该媒体被加入的收藏夹数量（前端 ♡ 已收藏变色判定，>0 即已收藏）。
 *
 *  ⚠️ 构造器按位映射：record 参数顺序必须与 MediaMapper 各 SELECT 列顺序一致，
 *  中间加字段要同步调整，否则 MyBatis 按位错配（字符串塞进 Long 等）。 */
public record MediaSummary(Long id, String title, Integer year, String mediaFormat, String subcategory,
                           Long subcategoryId, String status, BigDecimal rating, String coverPath, Integer confirmed,
                           String source, Long clipCount, Long latestAt, Long collectionCount,
                           String fallbackCoverPath, String externalCoverUrl) {
}
