package com.videotagger.videosource;

public record VideoSourceResolveRequest(
        String providerPackageId,
        String providerItemId,
        String revision,
        VideoSourceStatus.ResolutionPurpose purpose,
        String preferredQuality,
        String preferredSubtitleLanguage,
        String preferredAudioLanguage) {
}
