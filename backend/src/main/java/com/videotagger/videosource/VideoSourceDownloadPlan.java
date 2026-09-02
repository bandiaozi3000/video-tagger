package com.videotagger.videosource;

import java.time.Instant;

public record VideoSourceDownloadPlan(
        String providerItemId,
        String revision,
        VideoSourceResolution resolution,
        Long expectedBytes,
        String suggestedExtension,
        boolean resumable,
        boolean rangeDownload,
        Instant expiresAt) {
}
