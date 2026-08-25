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
}
