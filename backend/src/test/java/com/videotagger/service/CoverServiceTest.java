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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class CoverServiceTest {

    @TempDir
    Path tmp;

    MediaMapper mediaMapper = mock(MediaMapper.class);
    CoverService coverService;

    @BeforeEach
    void setUp() {
        coverService = new CoverService(mediaMapper, tmp.toString());
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

    // ---------- Bangumi 封面缓存（用户 2026-09-20：「封面统一用 Bangumi」）----------

    @Test
    void ensureExternalCoverDownloadsCachesAndStaysIdempotent() throws IOException {
        byte[] body = "bangumi-cover-bytes".getBytes(StandardCharsets.UTF_8);
        java.util.concurrent.atomic.AtomicInteger hits = new java.util.concurrent.atomic.AtomicInteger();
        com.sun.net.httpserver.HttpServer server = coverServer(hits, 200, "image/jpeg", body);
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/338.jpg";

            String first = coverService.ensureExternalCover(7130L, url);
            String second = coverService.ensureExternalCover(7130L, url);

            // 文件名带来源 URL 哈希（URL 变 → 换新文件，见下一个用例）
            assertTrue(first.startsWith("/covers/ext/7130-") && first.endsWith(".jpg"), first);
            assertEquals(first, second, "第二次必须直接命中缓存");
            assertEquals(1, hits.get(), "缓存命中后不得再联网");
            // 缓存出来的封面必须能被 embed 路径读成 data URI（成片渲染靠这条）
            assertTrue(coverService.base64ForCoverPath(first).startsWith("data:image/jpeg;base64,"));
            // **不写 DB**：属于只读缓存，不能替用户改 media.cover_path
            org.mockito.Mockito.verify(mediaMapper, org.mockito.Mockito.never()).updateById(org.mockito.ArgumentMatchers.any(com.videotagger.entity.Media.class));
        } finally {
            server.stop(0);
        }
    }

    /**
     * 用户 2026-09-26 报的 bug：库里换了封面（`external_work.cover_url` 变了），视频里那张**一直没变** ——
     * 因为老实现文件名叫 `{mediaId}.{ext}`，命中就 return，来源 URL 换了也不知道。
     * 这里把两件事一起锁住：新 URL 不吃旧缓存；换 URL 后旧文件被清掉（不残留多份）。
     */
    @Test
    void ensureExternalCoverFollowsChangedSourceUrl() throws IOException {
        byte[] oldBody = "old-cover".getBytes(StandardCharsets.UTF_8);
        byte[] newBody = "brand-new-cover".getBytes(StandardCharsets.UTF_8);
        java.util.concurrent.atomic.AtomicInteger hits = new java.util.concurrent.atomic.AtomicInteger();
        // 同一个本地假 Bangumi，路径不同 = 不同 URL（命中缓存就不该再联网）
        byte[] served = oldBody;
        com.sun.net.httpserver.HttpServer server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            hits.incrementAndGet();
            byte[] body = exchange.getRequestURI().getPath().contains("new") ? newBody : oldBody;
            exchange.getResponseHeaders().add("Content-Type", "image/jpeg");
            exchange.sendResponseHeaders(200, body.length);
            try (var out = exchange.getResponseBody()) {
                out.write(body);
            }
        });
        server.start();
        try {
            int port = server.getAddress().getPort();
            String oldUrl = "http://127.0.0.1:" + port + "/old.jpg";
            String newUrl = "http://127.0.0.1:" + port + "/new.jpg";
            // 先造一个老命名的缓存（模拟线上已经存在的 `covers/ext/{id}.jpg`）
            Files.createDirectories(tmp.resolve("ext"));
            Files.write(tmp.resolve("ext/7131.jpg"), "stale-legacy".getBytes(StandardCharsets.UTF_8));

            String before = coverService.ensureExternalCover(7131L, oldUrl);
            String after = coverService.ensureExternalCover(7131L, newUrl);

            assertTrue(after.startsWith("/covers/ext/7131-"), after);
            assertNotEquals(before, after, "来源 URL 变了就必须换文件（不吃旧缓存）");
            assertEquals(newBody.length, (int) Files.size(tmp.resolve("ext/" + after.substring("/covers/ext/".length()))),
                    "新封面必须是新图，不是旧字节");
            assertEquals(2, hits.get(), "两个不同 URL 各下一张（第二次是换 URL，不是重复下载）");
            org.junit.jupiter.api.Assertions.assertFalse(Files.exists(tmp.resolve("ext/7131.jpg")), "老命名残留要被清掉");
            assertEquals(1, Files.list(tmp.resolve("ext")).filter(p -> p.getFileName().toString().startsWith("7131")).count(),
                    "同一媒体只留一份外部封面缓存");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void externalCoverKeyIsStablePerUrl() {
        String a = CoverService.externalCoverKey(7L, "http://x/1.jpg");
        assertEquals(a, CoverService.externalCoverKey(7L, "http://x/1.jpg"));
        assertNotEquals(a, CoverService.externalCoverKey(7L, "http://x/2.jpg"));
        assertTrue(a.startsWith("7-"));
    }

    @Test
    void ensureExternalCoverUsesExtensionFromContentType() throws IOException {
        com.sun.net.httpserver.HttpServer server = coverServer(new java.util.concurrent.atomic.AtomicInteger(), 200, "image/png", new byte[] {1, 2, 3});
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/x";
            String path = coverService.ensureExternalCover(42L, url);
            assertTrue(path.startsWith("/covers/ext/42-") && path.endsWith(".png"), path);
            assertTrue(coverService.base64ForCoverPath(path).startsWith("data:image/png;base64,"));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void ensureExternalCoverNullOrBlankOrFailureReturnsNull() throws IOException {
        assertNull(coverService.ensureExternalCover(1L, null));
        assertNull(coverService.ensureExternalCover(1L, "  "));
        com.sun.net.httpserver.HttpServer server = coverServer(new java.util.concurrent.atomic.AtomicInteger(), 404, "text/plain", new byte[0]);
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/missing";
            assertNull(coverService.ensureExternalCover(2L, url), "下载失败要静默退占位块，不能把渲染打断");
        } finally {
            server.stop(0);
        }
    }

    /** 本地假 Bangumi：返回固定字节，并统计被打了几次。 */
    private static com.sun.net.httpserver.HttpServer coverServer(java.util.concurrent.atomic.AtomicInteger hits, int status, String contentType, byte[] body) throws IOException {
        com.sun.net.httpserver.HttpServer server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            hits.incrementAndGet();
            if (status != 200) {
                exchange.sendResponseHeaders(status, -1);
                exchange.close();
                return;
            }
            exchange.getResponseHeaders().add("Content-Type", contentType);
            exchange.sendResponseHeaders(200, body.length);
            try (var out = exchange.getResponseBody()) {
                out.write(body);
            }
        });
        server.start();
        return server;
    }
}
