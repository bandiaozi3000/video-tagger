package com.videotagger.videosource;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class VideoSourceProviderRegistry {
    private final Map<String, VideoSourceProvider> providers = new LinkedHashMap<>();

    public VideoSourceProviderRegistry(List<VideoSourceProvider> discovered) {
        for (VideoSourceProvider provider : discovered) register(provider);
    }

    public synchronized void register(VideoSourceProvider provider) {
        if (provider == null || provider.id() == null || provider.id().isBlank()) throw new IllegalArgumentException("Provider is invalid");
        if (providers.putIfAbsent(provider.id(), provider) != null) throw new IllegalStateException("Duplicate Provider: " + provider.id());
    }

    public VideoSourceProvider require(String id) {
        VideoSourceProvider provider = providers.get(id);
        if (provider == null) throw new VideoSourceProviderException(id, "PROVIDER_NOT_FOUND", "Provider not found", false);
        return provider;
    }

    public Collection<VideoSourceProvider> all() { return List.copyOf(providers.values()); }

    public List<VideoSourceProviderCapabilities> capabilities() {
        return providers.values().stream().map(VideoSourceProvider::capabilities).toList();
    }
}