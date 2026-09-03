package com.videotagger.service;

import com.videotagger.entity.Tag;

import java.util.List;

/** 集详情：聚合字段 + 集级标签。coverPath 为解析后的有效封面（显式为空时落到代表性片段帧）。watchedAt 为 v0.24 Animeko 观看回灌时间。 */
public record EpisodeDetail(Long id, Long mediaId, Integer episodeNo,
                            String title, String note, String url, String videoFp,
                            Long clipCount, Long latestAt, List<Tag> tags, String coverPath,
                            Long watchedAt) {

    public static EpisodeDetail from(EpisodeSummary s, List<Tag> tags, String coverPath) {
        return new EpisodeDetail(s.id(), s.mediaId(), s.episodeNo(),
                s.title(), null, s.url(), s.videoFp(), s.clipCount(), s.latestAt(), tags, coverPath,
                s.watchedAt());
    }
}
