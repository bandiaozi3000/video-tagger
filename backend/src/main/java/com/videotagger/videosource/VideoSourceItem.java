package com.videotagger.videosource;

import java.util.List;
import java.util.Map;
import java.util.Set;

public record VideoSourceItem(
        String providerId,
        String providerPackageId,
        String providerItemId,
        String revision,
        VideoSourceStatus.ItemKind kind,
        Integer episodeNumber,
        Integer episodeEndNumber,
        String title,
        Long durationMs,
        List<String> subtitleLanguages,
        List<String> audioLanguages,
        String quality,
        Set<VideoSourceStatus.Capability> capabilities,
        String sourcePageUrl,
        Map<String, Object> sanitizedSnapshot) {

    public VideoSourceItem {
        kind = kind == null ? VideoSourceStatus.ItemKind.UNKNOWN : kind;
        subtitleLanguages = subtitleLanguages == null ? List.of() : List.copyOf(subtitleLanguages);
        audioLanguages = audioLanguages == null ? List.of() : List.copyOf(audioLanguages);
        capabilities = capabilities == null ? Set.of() : Set.copyOf(capabilities);
        sanitizedSnapshot = sanitizedSnapshot == null ? Map.of() : Map.copyOf(sanitizedSnapshot);
    }

    public String stableIdentity() {
        return providerId + ":" + providerItemId + ":" + revision;
    }
}
