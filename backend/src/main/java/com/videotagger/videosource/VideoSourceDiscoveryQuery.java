package com.videotagger.videosource;

import java.util.List;
import java.util.Map;

public record VideoSourceDiscoveryQuery(
        long mediaEntryId,
        Map<String, String> externalIds,
        Map<String, String> episodeExternalIds,
        List<String> titles,
        List<String> episodeTitles,
        Integer year,
        String season,
        String mediaFormat,
        Integer episodeCount,
        Integer episodeSort,
        Integer episodeEp,
        int offset,
        int limit) {

    public VideoSourceDiscoveryQuery(long mediaEntryId, Map<String, String> externalIds,
                                     List<String> titles, Integer year, String season,
                                     String mediaFormat, Integer episodeCount, int offset, int limit) {
        this(mediaEntryId, externalIds, Map.of(), titles, List.of(), year, season, mediaFormat,
                episodeCount, null, null, offset, limit);
    }

    public VideoSourceDiscoveryQuery {
        externalIds = externalIds == null ? Map.of() : Map.copyOf(externalIds);
        episodeExternalIds = episodeExternalIds == null ? Map.of() : Map.copyOf(episodeExternalIds);
        titles = titles == null ? List.of() : List.copyOf(titles);
        episodeTitles = episodeTitles == null ? List.of() : List.copyOf(episodeTitles);
        offset = Math.max(0, offset);
        limit = Math.max(1, limit);
    }
}
