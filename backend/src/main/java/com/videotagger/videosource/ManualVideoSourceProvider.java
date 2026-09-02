package com.videotagger.videosource;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ManualVideoSourceProvider implements VideoSourceProvider {
    private final Map<String, VideoSourcePackage> packages = new ConcurrentHashMap<>();
    private final Map<String, String> locators = new ConcurrentHashMap<>();

    @Override public String id() { return "manual"; }
    @Override public VideoSourceProviderCapabilities capabilities() {
        return new VideoSourceProviderCapabilities(id(), "Manual", java.util.Set.of(
                VideoSourceStatus.Capability.DISCOVER_PACKAGES,
                VideoSourceStatus.Capability.PACKAGE_DETAILS,
                VideoSourceStatus.Capability.RESOLVE_PLAYBACK,
                VideoSourceStatus.Capability.PROBE,
                VideoSourceStatus.Capability.DOWNLOAD,
                VideoSourceStatus.Capability.RANGE_DOWNLOAD,
                VideoSourceStatus.Capability.SOURCE_PAGE), 500);
    }

    public void register(VideoSourcePackage sourcePackage, Map<String, String> itemLocators) {
        if (sourcePackage == null || !id().equals(sourcePackage.providerId())) throw new IllegalArgumentException("Manual package is invalid");
        packages.put(sourcePackage.stableIdentity(), sourcePackage);
        if (itemLocators != null) itemLocators.forEach((item, locator) -> {
            RemoteResourcePolicy.validateLocator(locator, true);
            locators.put(sourcePackage.stableIdentity() + ":" + item, locator);
        });
    }

    public void clear() { packages.clear(); locators.clear(); }
    @Override public List<VideoSourcePackage> discover(VideoSourceDiscoveryQuery query) { return new ArrayList<>(packages.values()); }
    @Override public VideoSourcePackage getPackage(String providerPackageId, String revision) {
        return packages.values().stream().filter(p -> p.providerPackageId().equals(providerPackageId) && p.revision().equals(revision)).findFirst()
                .orElseThrow(() -> new VideoSourceProviderException(id(), "PACKAGE_NOT_FOUND", "Manual package not found", false));
    }
    @Override public VideoSourceResolution resolve(VideoSourceResolveRequest request) {
        String locator = locators.get(id() + ":" + request.providerPackageId() + ":" + request.revision() + ":" + request.providerItemId());
        if (locator == null) throw new VideoSourceProviderException(id(), "ITEM_NOT_FOUND", "Manual source item not found", false);
        RemoteResourcePolicy.validateLocator(locator, true);
        return new VideoSourceResolution(request.providerItemId(), request.revision(), locator, Instant.now(), null, null, null, false, locator);
    }
    @Override public VideoSourceProbeResult probe(VideoSourceProbeRequest request) {
        RemoteResourcePolicy.validateLocator(request.resolution().resolvedLocator(), true);
        return new VideoSourceProbeResult(VideoSourceStatus.ProbeState.PLAYABLE, Instant.now(), false, "MANUAL_ACCEPTED", "Manual source accepted", "PLAY", null, null, null, null, null, null, null, null, false);
    }
    @Override public VideoSourceDownloadPlan planDownload(VideoSourceDownloadRequest request) {
        VideoSourceResolution resolution = resolve(new VideoSourceResolveRequest(request.providerPackageId(), request.providerItemId(), request.revision(), VideoSourceStatus.ResolutionPurpose.DOWNLOAD, request.preferredQuality(), request.preferredSubtitleLanguage(), request.preferredAudioLanguage()));
        return new VideoSourceDownloadPlan(request.providerItemId(), request.revision(), resolution, resolution.contentLength(), ".mp4", false, request.rangeRequested(), null);
    }
}