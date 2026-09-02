package com.videotagger.videosource;

public record VideoSourceProbeRequest(
        String providerPackageId,
        String providerItemId,
        String revision,
        VideoSourceResolution resolution) {
}
