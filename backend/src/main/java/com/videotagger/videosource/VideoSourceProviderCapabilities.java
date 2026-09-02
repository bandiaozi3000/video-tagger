package com.videotagger.videosource;

import java.util.Set;

public record VideoSourceProviderCapabilities(
        String providerId,
        String displayName,
        Set<VideoSourceStatus.Capability> capabilities,
        int maxDiscoveryPageSize) {

    public VideoSourceProviderCapabilities {
        capabilities = capabilities == null ? Set.of() : Set.copyOf(capabilities);
        maxDiscoveryPageSize = Math.max(1, maxDiscoveryPageSize);
    }

    public boolean supports(VideoSourceStatus.Capability capability) {
        return capabilities.contains(capability);
    }
}
