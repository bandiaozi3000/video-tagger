package com.videotagger.videosource;

import java.time.Instant;

public record VideoSourceProbeResult(
        VideoSourceStatus.ProbeState state,
        Instant checkedAt,
        boolean retryable,
        String reasonCode,
        String message,
        String recommendedAction,
        String mimeType,
        Long contentLength,
        Long durationMs,
        Integer width,
        Integer height,
        String container,
        String videoCodec,
        String audioCodec,
        boolean rangeSupported) {
}
