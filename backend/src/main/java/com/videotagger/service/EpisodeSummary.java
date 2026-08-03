package com.videotagger.service;

/** 集聚合项（供集列表）：含片段数与最新标记时间。 */
public record EpisodeSummary(Long id, Long animeId, Integer season, Integer episodeNo,
                             String title, String url, String videoFp,
                             Long clipCount, Long latestAt) {
}
