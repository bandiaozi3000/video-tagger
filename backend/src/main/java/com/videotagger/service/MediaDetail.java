package com.videotagger.service;

import com.videotagger.entity.Tag;

import java.math.BigDecimal;
import java.util.List;

/** 媒体详情：基础字段 + 统计 + 作品级标签 + 所属收藏夹。fallbackCoverPath 为无封面时代表性片段帧兜底。 */
public record MediaDetail(Long id, String title, Integer year, String originalTitle, String aliases, String mediaFormat,
                          String subcategory, Long subcategoryId, String note, String status, BigDecimal rating,
                          String coverPath, Integer confirmed, String source, Long createdAt, Long clipCount,
                          Long episodeCount,
                          List<Tag> tags, List<Long> collectionIds, String fallbackCoverPath, String externalCoverUrl) {
    public MediaDetail(Long id, String title, Integer year, String originalTitle, String aliases, String mediaFormat,
                       String subcategory, Long subcategoryId, String note, String status, BigDecimal rating,
                       String coverPath, Integer confirmed, String source, Long createdAt, Long clipCount,
                       Long episodeCount, List<Tag> tags, List<Long> collectionIds, String fallbackCoverPath) {
        this(id, title, year, originalTitle, aliases, mediaFormat, subcategory, subcategoryId, note, status,
                rating, coverPath, confirmed, source, createdAt, clipCount, episodeCount, tags, collectionIds,
                fallbackCoverPath, null);
    }
}
