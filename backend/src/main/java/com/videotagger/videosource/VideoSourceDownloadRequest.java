package com.videotagger.videosource;

public record VideoSourceDownloadRequest(
        String providerPackageId,
        String providerItemId,
        String revision,
        String preferredQuality,
        String preferredSubtitleLanguage,
        String preferredAudioLanguage,
        Long rangeStartMs,
        Long rangeEndMs) {

    public boolean rangeRequested() {
        return rangeStartMs != null || rangeEndMs != null;
    }
}
