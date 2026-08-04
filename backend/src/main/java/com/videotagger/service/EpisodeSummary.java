package com.videotagger.service;

/** 集聚合项（供集列表）：含片段数与最新标记时间。coverPath 为集显式封面（可空）。 */
public record EpisodeSummary(Long id, Long mediaId, Integer season, Integer episodeNo,
                             String title, String url, String videoFp,
                             Long clipCount, Long latestAt, String coverPath) {
}
