package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * storagePath 解析口径：相对路径必须留在受管根内；绝对路径放行（用户手动登记的本地源）。
 * 2026-09-30 用户拍板「自己下载好文件，只登记路径」。
 */
class VideoAssetPathServiceTest {

    private final Path root = Path.of(System.getProperty("java.io.tmpdir"), "vt-asset-root").toAbsolutePath().normalize();

    @Test
    void absolutePathOutsideRootIsTrusted() {
        Path outside = root.getParent().resolve("manual-ep01.mkv").toAbsolutePath().normalize();
        assertEquals(outside, VideoAssetPathService.trustedPath(root, outside.toString()));
    }

    @Test
    void relativePathInsideRootIsResolved() {
        assertEquals(root.resolve("media-1/entry-0/episode-2/asset-3.mp4"),
                VideoAssetPathService.trustedPath(root, "media-1/entry-0/episode-2/asset-3.mp4"));
    }

    @Test
    void backslashRelativePathIsNormalized() {
        assertEquals(root.resolve("media-1/entry-0/asset-3.mp4"),
                VideoAssetPathService.trustedPath(root, "media-1\\entry-0\\asset-3.mp4"));
    }

    @Test
    void relativePathEscapingRootIsRejected() {
        assertNull(VideoAssetPathService.trustedPath(root, "../../etc/passwd"));
        assertNull(VideoAssetPathService.trustedPath(root, "a/../../b.mp4"));
    }

    @Test
    void blankNullAndRootlessAreRejected() {
        assertNull(VideoAssetPathService.trustedPath(root, null));
        assertNull(VideoAssetPathService.trustedPath(root, "   "));
        assertNull(VideoAssetPathService.trustedPath(null, "a.mp4"));
    }
}
