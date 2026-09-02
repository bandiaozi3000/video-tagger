package com.videotagger.metadata;

public record MetadataEpisodeRecord(String externalId, Integer episodeNo, String title,
                                    String titleCn, String description, String airDate,
                                    Integer durationSec) {
}
