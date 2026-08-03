package com.videotagger.service;

import com.videotagger.entity.Tag;

import java.math.BigDecimal;
import java.util.List;

/** 番剧详情：基础字段 + 统计 + 作品级标签 + 所属收藏夹。fallbackCoverPath 为无封面时代表性片段帧兜底。 */
public record AnimeDetail(Long id, String title, String aliases, String type, String status,
                          BigDecimal rating, String coverPath, Integer confirmed,
                          Long createdAt, Long clipCount, Long episodeCount, List<Tag> tags,
                          List<Long> collectionIds, String fallbackCoverPath) {
}
