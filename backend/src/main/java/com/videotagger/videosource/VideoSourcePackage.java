package com.videotagger.videosource;

import java.util.List;
import java.util.Map;
import java.util.Set;

public record VideoSourcePackage(
        String providerId,
        String providerPackageId,
        String revision,
        String title,
        String releaseGroup,
        Integer year,
        String season,
        String mediaFormat,
        Integer episodeCount,
        List<String> subtitleLanguages,
        List<String> audioLanguages,
        String quality,
        String videoCodec,
        String container,
        Set<VideoSourceStatus.Capability> capabilities,
        String sourcePageUrl,
        Map<String, Object> sanitizedSnapshot,
        List<VideoSourceItem> items) {

    public VideoSourcePackage {
        subtitleLanguages = subtitleLanguages == null ? List.of() : List.copyOf(subtitleLanguages);
        audioLanguages = audioLanguages == null ? List.of() : List.copyOf(audioLanguages);
        capabilities = capabilities == null ? Set.of() : Set.copyOf(capabilities);
        sanitizedSnapshot = sanitizedSnapshot == null ? Map.of() : Map.copyOf(sanitizedSnapshot);
        items = items == null ? List.of() : List.copyOf(items);
    }

    public String stableIdentity() {
        return providerId + ":" + providerPackageId + ":" + revision;
    }
}
