package com.videotagger.metadata;

import java.util.List;

public record MetadataCandidate(
        String provider,
        String externalId,
        String title,
        String titleCn,
        String nativeTitle,
        String romajiTitle,
        String englishTitle,
        List<String> aliases,
        String description,
        List<String> genres,
        Integer year,
        String season,
        String format,
        String airDate,
        String endDate,
        Integer episodeCount,
        String coverUrl,
        Long targetMediaId,
        String matchType,
        List<LocalMatch> localMatches,
        String recommendedAction,
        String matchReason
) {
    public record LocalMatch(Long mediaId, String title, Integer year) { }
}