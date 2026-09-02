package com.videotagger.videosource;

import java.util.List;
import java.util.Map;

public record VideoSourceDiscoveryRequest(String providerId, Map<String, String> externalIds, List<String> titles, Integer year, String season, String mediaFormat, Integer episodeCount, Integer offset, Integer limit) {
    public VideoSourceDiscoveryQuery query(long mediaEntryId) { return new VideoSourceDiscoveryQuery(mediaEntryId, externalIds, titles, year, season, mediaFormat, episodeCount, offset == null ? 0 : offset, limit == null ? 50 : limit); }
}