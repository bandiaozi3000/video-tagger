package com.videotagger.videosource;

import java.util.List;

public interface VideoSourceProvider {
    String id();

    VideoSourceProviderCapabilities capabilities();

    List<VideoSourcePackage> discover(VideoSourceDiscoveryQuery query) throws VideoSourceProviderException;

    VideoSourcePackage getPackage(String providerPackageId, String revision) throws VideoSourceProviderException;

    VideoSourceResolution resolve(VideoSourceResolveRequest request) throws VideoSourceProviderException;

    VideoSourceProbeResult probe(VideoSourceProbeRequest request) throws VideoSourceProviderException;

    VideoSourceDownloadPlan planDownload(VideoSourceDownloadRequest request) throws VideoSourceProviderException;
}
