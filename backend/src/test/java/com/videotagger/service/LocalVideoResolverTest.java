package com.videotagger.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LocalVideoResolverTest {
    @TempDir
    Path temp;

    @Test
    void resolvesUniqueWhitelistedExtension() throws Exception {
        Files.writeString(temp.resolve("abc123.mp4"), "video");
        ClipExportProperties p = new ClipExportProperties();
        p.setVideoDir(temp.toString());
        p.setAllowedExtensions(List.of("mp4", "mkv"));
        assertEquals(temp.resolve("abc123.mp4").toAbsolutePath().normalize(),
                new LocalVideoResolver(p).resolve("abc123"));
    }

    @Test
    void rejectsUnsafeFingerprint() {
        ClipExportProperties p = new ClipExportProperties();
        p.setVideoDir(temp.toString());
        assertThrows(IllegalArgumentException.class, () -> new LocalVideoResolver(p).resolve("../secret"));
    }

    @Test
    void rejectsMultipleMatches() throws Exception {
        Files.writeString(temp.resolve("abc123.mp4"), "video");
        Files.writeString(temp.resolve("abc123.mkv"), "video");
        ClipExportProperties p = new ClipExportProperties();
        p.setVideoDir(temp.toString());
        p.setAllowedExtensions(List.of("mp4", "mkv"));
        assertThrows(IllegalArgumentException.class, () -> new LocalVideoResolver(p).resolve("abc123"));
    }

    /** 上传的资源视频可能是不在白名单里的容器（m2ts/ts…）：兜底按 `{指纹}.*` 找，不报假故障。 */
    @Test
    void resolvesExtensionOutsideWhitelist() throws Exception {
        Files.writeString(temp.resolve("abc123.m2ts"), "video");
        ClipExportProperties p = new ClipExportProperties();
        p.setVideoDir(temp.toString());
        p.setAllowedExtensions(List.of("mp4"));
        assertEquals(temp.resolve("abc123.m2ts").toAbsolutePath().normalize(),
                new LocalVideoResolver(p).resolve("abc123"));
    }
}
