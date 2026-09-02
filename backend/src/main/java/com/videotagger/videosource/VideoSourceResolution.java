package com.videotagger.videosource;

import java.time.Instant;

public record VideoSourceResolution(
        String providerItemId,
        String revision,
        String resolvedLocator,
        Instant resolvedAt,
        Instant expiresAt,
        String mimeType,
        Long contentLength,
        boolean rangeSupported,
        String sourcePageUrl) {

    public boolean expiredAt(Instant instant) {
        return expiresAt != null && !expiresAt.isAfter(instant);
    }
}
