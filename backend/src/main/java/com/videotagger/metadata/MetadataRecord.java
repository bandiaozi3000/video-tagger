package com.videotagger.metadata;

import java.util.List;

public record MetadataRecord(
        String provider,
        String externalId,
        String canonicalTitle,
        String nativeTitle,
        String romajiTitle,
        String englishTitle,
        List<String> aliases,
        String description,
        String coverUrl,
        List<String> genres,
        String format,
        Integer year,
        String season,
        String airDate,
        String endDate,
        Integer episodeCount,
        List<MetadataEpisodeRecord> episodes,
        List<MetadataRelationRecord> relations,
        String rawJson
) {
    public String displayTitle() {
        return canonicalTitle == null || canonicalTitle.isBlank() ? nativeTitle : canonicalTitle;
    }
}
