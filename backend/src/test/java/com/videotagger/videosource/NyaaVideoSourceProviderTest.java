package com.videotagger.videosource;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NyaaVideoSourceProviderTest {

    private HttpServer server;
    private String base;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/rss", exchange -> {
            byte[] body = ("""
                    <?xml version="1.0" encoding="UTF-8"?>
                    <rss version="2.0"><channel><title>Nyaa</title>
                    <item><title>[SubsPlease] Frieren - 05 (1080p) [Multi-Subs]</title>
                    <link>http://127.0.0.1:%d/t/1</link><guid>g1</guid>
                    <enclosure url="http://127.0.0.1:%d/f/1.torrent" type="application/x-bittorrent"/></item>
                    <item><title>【千夏字幕组】葬送的芙莉莲 第05集 [1080p]</title>
                    <link>http://127.0.0.1:%d/t/2</link><guid>g2</guid></item>
                    </channel></rss>""".formatted(server.getAddress().getPort(), server.getAddress().getPort(),
                    server.getAddress().getPort())).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/rss+xml");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    @DisplayName("Nyaa RSS 发现：条目解析出标题与 torrentUrl 快照")
    void discoverReturnsItemsWithTorrentUrl() {
        NyaaVideoSourceProvider provider = new NyaaVideoSourceProvider(
                base, base + "/rss?q={keyword}&c=1_0", 5000, 100, true);
        List<VideoSourcePackage> packages = provider.discover(
                new VideoSourceDiscoveryQuery(0L, java.util.Map.of(), List.of("葬送的芙莉莲"),
                        null, null, null, null, 0, 50));
        assertFalse(packages.isEmpty(), "应至少聚出一个发布组包");
        VideoSourcePackage pkg = packages.get(0);
        assertEquals("nyaa", pkg.providerId());
        assertNotNull(pkg.releaseGroup());
        boolean anyTorrent = pkg.items().stream().anyMatch(item ->
                item.title().contains("Frieren") || item.title().contains("芙莉莲"));
        assertTrue(anyTorrent, "条目应解析到 Frieren/芙莉莲 相关标题");
        VideoSourceItem subsplease = pkg.items().stream()
                .filter(item -> item.title().contains("SubsPlease"))
                .findFirst().orElse(null);
        assertNotNull(subsplease);
        assertEquals("http://127.0.0.1:" + server.getAddress().getPort() + "/f/1.torrent",
                subsplease.sanitizedSnapshot().get("torrentUrl"));
    }
}
