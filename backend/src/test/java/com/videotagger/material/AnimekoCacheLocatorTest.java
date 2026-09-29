package com.videotagger.material;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * AnimekoCacheLocator 单测：基于真实 Animeko registry 结构（metadata.episodeId 嵌套 + engine/mediaId 布局）。
 */
class AnimekoCacheLocatorTest {

    private Path dataRoot;
    private Path datastore;
    private Path downloads;

    @BeforeEach
    void setUp() throws Exception {
        dataRoot = Files.createTempDirectory("animeko-locator");
        datastore = Files.createDirectories(dataRoot.resolve("datastore"));
        downloads = Files.createDirectories(dataRoot.resolve("media-downloads").resolve("web-m3u"));
    }

    @AfterEach
    void tearDown() throws Exception {
    }

    /** 与真实 registry 同构（2026-09-02 用户显式缓存后 dump）：episodeId 在 metadata 内，文件按 engine/mediaId 命名。 */
    private void writeRealisticRegistry(String episodeId, String mediaId) throws Exception {
        Files.writeString(datastore.resolve("mediaCacheMetadataV2"), """
                [{"origin":{"type":"me.him188.ani.datasources.api.DefaultMedia","mediaId":"%s","mediaSourceId":"src-1",
                "download":{"type":"me.him188.ani.datasources.api.topic.ResourceLocation.WebVideo","uri":"https://x/1/2.html"},
                "episodeRange":{"type":"me.him188.ani.datasources.api.topic.EpisodeRange.Single","value":{"number":2.0}},
                "kind":"WEB"},
                "metadata":{"subjectId":"40310","episodeId":"%s","subjectNameCN":"少女与战车","episodeName":"战车，搭乘了！","creationTime":1},
                "engine":"web-m3u"}]
                """.formatted(mediaId, episodeId));
    }

    @Test
    @DisplayName("真实结构：episodeId 命中 + engine/mediaId 推导文件存在 → PRESENT")
    void realisticRegistryHit() throws Exception {
        String mediaId = "588fff.少女与战车-旧番主线①-第02集-02";
        writeRealisticRegistry("198749", mediaId);
        Path file = Files.createFile(downloads.resolve(mediaId + ".mp4"));

        AnimekoCacheLocator loc = new AnimekoCacheLocator(dataRoot);
        AnimekoCacheLocator.LocateResult r = loc.locate("198749");
        assertEquals("PRESENT", r.state());
        assertEquals(file.toAbsolutePath().toString(), r.filePath());
    }

    /**
     * 2026-09-29 用户实机：Animeko 把 WEB 缓存文件名改成 {@code http-v2-{sha256}}，旧候选（mediaId.ext）全落空 → 集灯灭。
     * 本条用真实三元组（零之使魔 双月骑士 / subjectId=1103 / episodeId=2957）钉死 httpDownloadId 公式；
     * 公式若变（长度前缀、顺序、编码），这里立刻红。
     */
    @Test
    @DisplayName("v2 命名 http-v2-{sha256}：真实三元组命中 → PRESENT")
    void httpV2NamingHit() throws Exception {
        String mediaId = "588fffc9-65d1-4cf3-a637-72ef82bff4c0.零之使魔 双月骑士-旧番主线①-第12集-12";
        Files.writeString(datastore.resolve("mediaCacheMetadataV2"), """
                [{"origin":{"type":"me.him188.ani.datasources.api.DefaultMedia","mediaId":"%s","mediaSourceId":"src-1",
                "download":{"type":"me.him188.ani.datasources.api.topic.ResourceLocation.WebVideo","uri":"https://dm1.xfdm.pro/watch/1981/1/12.html"},
                "episodeRange":{"type":"me.him188.ani.datasources.api.topic.EpisodeRange.Single","value":{"number":12.0}},
                "kind":"WEB"},
                "metadata":{"subjectId":"1103","episodeId":"2957","subjectNameCN":"零之使魔 双月骑士","episodeName":"诀别的婚礼","creationTime":1},
                "engine":"web-m3u"}]
                """.formatted(mediaId));
        Path file = Files.createFile(downloads.resolve(
                "http-v2-73b20a95fd2079401ccab838451d77bdb046220e4139cb44780b7bf8e0884415.mp4"));

        AnimekoCacheLocator.LocateResult r = new AnimekoCacheLocator(dataRoot).locate("2957");
        assertEquals("PRESENT", r.state());
        assertEquals(file.toAbsolutePath().toString(), r.filePath());
    }

    @Test
    @DisplayName("有条目但文件不在场 → PENDING")
    void entryButFileMissing() throws Exception {
        writeRealisticRegistry("198749", "missing-mediacode");
        AnimekoCacheLocator loc = new AnimekoCacheLocator(dataRoot);
        assertEquals("PENDING", loc.locate("198749").state());
    }

    @Test
    @DisplayName("无该集条目 → PENDING 提示可显式缓存")
    void noEntryForEpisode() throws Exception {
        writeRealisticRegistry("111111", "media-a");
        AnimekoCacheLocator loc = new AnimekoCacheLocator(dataRoot);
        AnimekoCacheLocator.LocateResult r = loc.locate("999999");
        assertEquals("PENDING", r.state());
        assertTrue(r.message().contains("显式缓存") || r.message().contains("预取"));
    }

    @Test
    @DisplayName("registry 不存在/未配置 → UNAVAILABLE（不抛错）")
    void registryMissingOrUnconfigured() {
        AnimekoCacheLocator unconfigured = new AnimekoCacheLocator(null);
        assertEquals("UNAVAILABLE", unconfigured.locate("1").state());

        AnimekoCacheLocator noRegistry = new AnimekoCacheLocator(dataRoot);   // datastore 存在但无 registry 文件
        assertEquals("UNAVAILABLE", noRegistry.locate("1").state());
    }
}
