package com.videotagger.service;

import java.nio.file.Path;

public final class VideoAssetPathService {
    private VideoAssetPathService() {}

    public static Path assetPath(Path root, long mediaId, long entryId, long episodeId, long assetId, String extension) {
        if (root == null || mediaId < 1 || entryId < 1 || episodeId < 1 || assetId < 1) throw new IllegalArgumentException("Asset identity is invalid");
        String safeExtension = extension == null ? "bin" : extension.toLowerCase().replaceAll("[^a-z0-9]", "");
        if (safeExtension.isBlank() || safeExtension.length() > 12) safeExtension = "bin";
        return root.resolve("media-" + mediaId).resolve("entry-" + entryId).resolve("episode-" + episodeId).resolve("asset-" + assetId + "." + safeExtension);
    }

    public static Path temporaryPath(Path finalPath) { if (finalPath == null) throw new IllegalArgumentException("finalPath is required"); return finalPath.resolveSibling(finalPath.getFileName() + ".part"); }
}