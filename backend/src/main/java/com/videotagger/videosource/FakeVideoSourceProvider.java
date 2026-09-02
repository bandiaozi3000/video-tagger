package com.videotagger.videosource;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class FakeVideoSourceProvider implements VideoSourceProvider {
    private final String providerId;
    private final Map<String, VideoSourcePackage> packages = new ConcurrentHashMap<>();
    private final Map<String, VideoSourceResolution> resolutions = new ConcurrentHashMap<>();
    private volatile VideoSourceStatus.ProbeState probeState = VideoSourceStatus.ProbeState.PLAYABLE;

    public FakeVideoSourceProvider(String providerId) { if (providerId == null || providerId.isBlank()) throw new IllegalArgumentException("providerId is required"); this.providerId = providerId; }
    public FakeVideoSourceProvider addPackage(VideoSourcePackage sourcePackage) { packages.put(sourcePackage.stableIdentity(), sourcePackage); return this; }
    public FakeVideoSourceProvider addResolution(String packageId, String itemId, String revision, String locator, Instant expiresAt) {
        RemoteResourcePolicy.validateLocator(locator, false);
        resolutions.put(key(packageId, itemId, revision), new VideoSourceResolution(itemId, revision, locator, Instant.now(), expiresAt, "video/mp4", null, true, locator)); return this;
    }
    public FakeVideoSourceProvider probeState(VideoSourceStatus.ProbeState state) { probeState = state; return this; }
    @Override public String id() { return providerId; }
    @Override public VideoSourceProviderCapabilities capabilities() { return new VideoSourceProviderCapabilities(providerId, "Fake " + providerId, java.util.Set.of(VideoSourceStatus.Capability.DISCOVER_PACKAGES, VideoSourceStatus.Capability.PACKAGE_DETAILS, VideoSourceStatus.Capability.RESOLVE_PLAYBACK, VideoSourceStatus.Capability.PROBE, VideoSourceStatus.Capability.DOWNLOAD, VideoSourceStatus.Capability.RANGE_DOWNLOAD), 1000); }
    @Override public List<VideoSourcePackage> discover(VideoSourceDiscoveryQuery query) { return new ArrayList<>(packages.values()); }
    @Override public VideoSourcePackage getPackage(String packageId, String revision) { return packages.values().stream().filter(p -> p.providerPackageId().equals(packageId) && p.revision().equals(revision)).findFirst().orElseThrow(() -> new VideoSourceProviderException(providerId, "PACKAGE_NOT_FOUND", "Fake package not found", false)); }
    @Override public VideoSourceResolution resolve(VideoSourceResolveRequest request) { VideoSourceResolution value = resolutions.get(key(request.providerPackageId(), request.providerItemId(), request.revision())); if (value == null) throw new VideoSourceProviderException(providerId, "RESOLUTION_NOT_FOUND", "Fake resolution not found", true); return value; }
    @Override public VideoSourceProbeResult probe(VideoSourceProbeRequest request) { return new VideoSourceProbeResult(probeState, Instant.now(), probeState == VideoSourceStatus.ProbeState.TIMEOUT, "FAKE_" + probeState.name(), probeState.name(), probeState == VideoSourceStatus.ProbeState.PLAYABLE ? "PLAY" : "SOURCE_PAGE", request.resolution().mimeType(), request.resolution().contentLength(), null, null, null, null, null, null, request.resolution().rangeSupported()); }
    @Override public VideoSourceDownloadPlan planDownload(VideoSourceDownloadRequest request) { VideoSourceResolution resolution = resolve(new VideoSourceResolveRequest(request.providerPackageId(), request.providerItemId(), request.revision(), VideoSourceStatus.ResolutionPurpose.DOWNLOAD, request.preferredQuality(), request.preferredSubtitleLanguage(), request.preferredAudioLanguage())); return new VideoSourceDownloadPlan(request.providerItemId(), request.revision(), resolution, resolution.contentLength(), ".mp4", true, request.rangeRequested(), resolution.expiresAt()); }
    private String key(String packageId, String itemId, String revision) { return packageId + "|" + itemId + "|" + revision; }
}