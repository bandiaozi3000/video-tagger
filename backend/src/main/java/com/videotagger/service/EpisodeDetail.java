package com.videotagger.service;

import com.videotagger.entity.Tag;

import java.util.List;

/** 集详情：聚合字段 + 集级标签。 */
public record EpisodeDetail(Long id, Long animeId, Integer season, Integer episodeNo,
                            String title, String url, String videoFp,
                            Long clipCount, Long latestAt, List<Tag> tags) {

    public static EpisodeDetail from(EpisodeSummary s, List<Tag> tags) {
        return new EpisodeDetail(s.id(), s.animeId(), s.season(), s.episodeNo(),
                s.title(), s.url(), s.videoFp(), s.clipCount(), s.latestAt(), tags);
    }
}
