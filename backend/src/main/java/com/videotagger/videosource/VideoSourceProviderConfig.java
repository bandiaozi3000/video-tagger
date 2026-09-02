package com.videotagger.videosource;

import java.net.URI;
import java.util.Map;

public record VideoSourceProviderConfig(
        String id,
        boolean enabled,
        String baseUrl,
        int priority,
        int timeoutMs,
        int concurrency,
        long cacheSeconds,
        boolean allowPlayback,
        boolean allowDownload,
        String defaultQuality,
        String defaultSubtitleLanguage,
        String defaultAudioLanguage) {
    public VideoSourceProviderConfig {
        if (id == null || id.isBlank() || !id.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,63}")) {
            throw new IllegalArgumentException("Provider id is invalid");
        }
        if (timeoutMs < 100 || timeoutMs > 120_000) throw new IllegalArgumentException("Provider timeout is invalid");
        if (concurrency < 1 || concurrency > 16) throw new IllegalArgumentException("Provider concurrency is invalid");
        if (cacheSeconds < 0 || cacheSeconds > 86_400 * 30L) throw new IllegalArgumentException("Provider cache period is invalid");
        if (baseUrl != null && !baseUrl.isBlank()) URI.create(baseUrl);
    }

    public static VideoSourceProviderConfig manual() {
        return new VideoSourceProviderConfig("manual", true, null, 0, 10_000, 1, 0, true, true, null, null, null);
    }

    public Map<String, Object> safeView() {
        return Map.of("id", id, "enabled", enabled, "baseUrl", baseUrl == null ? "" : baseUrl,
                "priority", priority, "timeoutMs", timeoutMs, "concurrency", concurrency,
                "cacheSeconds", cacheSeconds, "allowPlayback", allowPlayback, "allowDownload", allowDownload);
    }
}