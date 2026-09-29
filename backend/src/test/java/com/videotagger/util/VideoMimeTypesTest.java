package com.videotagger.util;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** 播放 MIME：已知扩展名直取；未知扩展名嗅探 ISO BMFF（B 站伪 .flv，2026-09-29 实测）。 */
class VideoMimeTypesTest {

    private Path write(byte[] bytes, String name) throws Exception {
        Path dir = Files.createTempDirectory("vt-mime");
        Path file = dir.resolve(name);
        Files.write(file, bytes);
        return file;
    }

    @Test
    void knownExtensionWins() throws Exception {
        assertEquals("video/mp4", VideoMimeTypes.of(write(new byte[]{1, 2, 3}, "a.mp4").toFile()).toString());
        assertEquals("video/x-matroska", VideoMimeTypes.of(write(new byte[]{1}, "a.mkv").toFile()).toString());
        assertEquals("video/x-m4v", VideoMimeTypes.of(write(new byte[]{1}, "a.m4v").toFile()).toString());
    }

    @Test
    void fakeFlvWithIsoBmffHeaderIsMp4() throws Exception {
        // 本机真实 B 站文件头：00 00 00 20 'f' 't' 'y' 'p' 'i' 's' 'o' 'm'
        byte[] head = {0, 0, 0, 0x20, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'};
        assertEquals("video/mp4", VideoMimeTypes.of(write(head, "ep31.flv").toFile()).toString());
    }

    @Test
    void realFlvContainerIsRejected() throws Exception {
        byte[] head = {'F', 'L', 'V', 1, 5, 0, 0, 0, 9};
        assertNull(VideoMimeTypes.of(write(head, "real.flv").toFile()));
    }

    @Test
    void shortFileAndNullAreRejected() throws Exception {
        assertNull(VideoMimeTypes.of(write(new byte[]{0, 0, 0}, "tiny.flv").toFile()));
        assertNull(VideoMimeTypes.of(write(new byte[0], "empty.flv").toFile()));
        assertNull(VideoMimeTypes.of(null));
    }
}
