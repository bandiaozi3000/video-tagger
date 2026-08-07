package com.videotagger.service;

import com.videotagger.mapper.MediaMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class CoverServiceTest {

    @TempDir
    Path tmp;

    CoverService coverService;

    @BeforeEach
    void setUp() {
        coverService = new CoverService(mock(MediaMapper.class), tmp.toString());
    }

    @Test
    void base64ForCoverPathReturnsDataUrlWithMime() throws IOException {
        Files.write(tmp.resolve("1.jpg"), "hello-cover".getBytes(StandardCharsets.UTF_8));

        String data = coverService.base64ForCoverPath("/covers/1.jpg");

        assertTrue(data.startsWith("data:image/jpeg;base64,"));
        String b64 = data.substring("data:image/jpeg;base64,".length());
        assertEquals("hello-cover", new String(Base64Utils.decode(b64), StandardCharsets.UTF_8));
    }

    @Test
    void base64ForCoverPathMimeByExtension() throws IOException {
        Files.write(tmp.resolve("2.png"), "png-bytes".getBytes(StandardCharsets.UTF_8));
        Files.write(tmp.resolve("3.webp"), "webp-bytes".getBytes(StandardCharsets.UTF_8));

        assertTrue(coverService.base64ForCoverPath("/covers/2.png").startsWith("data:image/png;base64,"));
        assertTrue(coverService.base64ForCoverPath("/covers/3.webp").startsWith("data:image/webp;base64,"));
        // jpeg 扩展名归并到 jpg mime
        Files.write(tmp.resolve("4.jpeg"), "x".getBytes(StandardCharsets.UTF_8));
        assertTrue(coverService.base64ForCoverPath("/covers/4.jpeg").startsWith("data:image/jpeg;base64,"));
    }

    @Test
    void base64ForCoverPathNullOrBlankReturnsNull() {
        assertNull(coverService.base64ForCoverPath(null));
        assertNull(coverService.base64ForCoverPath("  "));
    }

    @Test
    void base64ForCoverPathRejectsPathTraversal() throws IOException {
        Files.write(tmp.resolve("outside.txt"), "secret".getBytes(StandardCharsets.UTF_8));

        assertNull(coverService.base64ForCoverPath("/covers/../outside.txt"));
        assertNull(coverService.base64ForCoverPath("../../etc/passwd"));
        // 非 /covers/ 前缀一律拒绝
        assertNull(coverService.base64ForCoverPath("/other/1.jpg"));
    }

    @Test
    void base64ForCoverPathMissingFileReturnsNull() {
        assertNull(coverService.base64ForCoverPath("/covers/999999.jpg"));
    }

    @Test
    void base64ForCoverPathRejectsDirectory() throws IOException {
        Files.createDirectory(tmp.resolve("dir.jpg"));
        assertNull(coverService.base64ForCoverPath("/covers/dir.jpg"));
    }

    /** 轻量 base64 解码（避免引 JUnit 之外的编码工具，保持测试自包含）。 */
    private static final class Base64Utils {
        static byte[] decode(String s) {
            return java.util.Base64.getDecoder().decode(s);
        }
    }
}
