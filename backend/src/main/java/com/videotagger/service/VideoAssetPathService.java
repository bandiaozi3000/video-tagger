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

    /**
     * storagePath → 受信绝对路径（所有读出 storagePath 的地方都应走这里，别再各自 root.resolve）。
     *
     * <p>相对路径必须留在受管根内（越界 = 不可信 → null）；**绝对路径直接放行**，用于
     * 「用户自己下载好文件、只登记路径」的本地源（2026-09-30 用户拍板）。
     *
     * <p>ponytail: 绝对路径不设白名单根 —— 本机单用户应用，写入端只有本机 UI，
     * 与既有 {@code /api/shell/open-folder} 同信任模型；要收紧就在这一处加根白名单。
     */
    public static Path trustedPath(Path root, String storagePath) {
        if (root == null || storagePath == null || storagePath.isBlank()) return null;
        try {
            Path raw = Path.of(storagePath.replace('\\', '/'));
            if (raw.isAbsolute()) return raw.normalize();
            Path resolved = root.resolve(raw).normalize();
            return resolved.startsWith(root) ? resolved : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}