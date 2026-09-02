package com.videotagger.service;

import java.nio.file.Path;

public final class VideoAssetPathService {
    private VideoAssetPathService() {}

    public static Path assetPath(Path root, long mediaId, long entryId, long episodeId, long assetId, String extension) {
        if (root == null || episodeId < 1 || assetId < 1) throw new IllegalArgumentException("Asset identity is invalid");
        String safeExtension = extension == null ? "bin" : extension.toLowerCase().replaceAll("[^a-z0-9]", "");
        if (safeExtension.isBlank() || safeExtension.length() > 12) safeExtension = "bin";
        long m = mediaId < 1 ? 0 : mediaId;
        long e = entryId < 1 ? 0 : entryId;
        return root.resolve("media-" + m).resolve("entry-" + e).resolve("episode-" + episodeId).resolve("asset-" + assetId + "." + safeExtension);
    }

    public static Path temporaryPath(Path finalPath) { if (finalPath == null) throw new IllegalArgumentException("finalPath is required"); return finalPath.resolveSibling(finalPath.getFileName() + ".part"); }
}