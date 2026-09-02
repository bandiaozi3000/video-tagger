package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.material.ChannelHint;
import com.videotagger.material.MaterializationChannel;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** v0.24 M3 素材化管线求值单测：C1 本地资产/指纹、C2 Animeko 文件、C3 直链、C4 兜底。 */
class MaterializationServiceTest {

    private Path dataRoot;         // 模拟 video-tagger data
    private Path assetRoot;        // video-assets
    private Path animekoRoot;      // 模拟 Animeko data/
    private Path animekoDataStore;
    private ClipMapper clipMapper;
    private VideoAssetMapper assetMapper;
    private ExternalEpisodeMapper externalEpisodeMapper;
    private ExternalWorkMapper externalWorkMapper;
    private MaterializationService service;

    @BeforeEach
    void setUp() throws Exception {
        dataRoot = Files.createTempDirectory("vt-material");
        assetRoot = Files.createDirectories(dataRoot.resolve("video-assets"));
        animekoRoot = Files.createTempDirectory("animeko-data");
        animekoDataStore = Files.createDirectories(animekoRoot.resolve("datastore"));
        clipMapper = mock(ClipMapper.class);
        assetMapper = mock(VideoAssetMapper.class);
        externalEpisodeMapper = mock(ExternalEpisodeMapper.class);
        externalWorkMapper = mock(ExternalWorkMapper.class);
        service = new MaterializationService(clipMapper, assetMapper, externalEpisodeMapper,
                externalWorkMapper, assetRoot.toString(), animekoRoot.resolve("ani.db").toString());
    }

    @AfterEach
    void tearDown() throws Exception {
    }

    private Clip clip(long id) {
        Clip c = new Clip();
        c.setId(id);
        return c;
    }

    private VideoAsset asset(long id, String type, String state, String relPath, String fp, Long episodeId) {
        VideoAsset a = new VideoAsset();
        a.setId(id);
        a.setAssetType(type);
        a.setAvailabilityState(state);
        a.setStoragePath(relPath);
        a.setFingerprint(fp);
        a.setEpisodeId(episodeId);
        return a;
    }

    // ---------- C1 ----------

    @Test
    @DisplayName("C1：clip 已绑本地资产且文件在场 → PRESENT/TRIM_LOCAL_ASSET")
    void c1BoundLocalAssetPresent() throws Exception {
        Path file = Files.createFile(assetRoot.resolve("ep1.mp4"));
        Clip c = clip(1);
        c.setVideoAssetId(10L);
        when(clipMapper.selectById(1L)).thenReturn(c);
        when(assetMapper.selectById(10L)).thenReturn(
                asset(10L, "LOCAL_ORIGINAL", "AVAILABLE", "ep1.mp4", null, null));

        MaterializationService.Evaluation ev = service.evaluate(1L);
        assertEquals("C1", ev.channel());
        assertEquals("PRESENT", ev.state());
        assertEquals("TRIM_LOCAL_ASSET", ev.strategy());
        assertEquals(file.toString(), ev.filePath());
    }

    @Test
    @DisplayName("C1：无绑定资产但 videoFp 命中池内资产 → PRESENT")
    void c1FingerprintHit() throws Exception {
        Path file = Files.createFile(assetRoot.resolve("pool.mp4"));
        Clip c = clip(2);
        c.setVideoFp("fp-abc");
        when(clipMapper.selectById(2L)).thenReturn(c);
        when(assetMapper.selectByFingerprint("fp-abc")).thenReturn(
                asset(11L, "DOWNLOADED", "AVAILABLE", "pool.mp4", "fp-abc", 5L));

        MaterializationService.Evaluation ev = service.evaluate(2L);
        assertEquals("C1", ev.channel());
        assertEquals(file.toString(), ev.filePath());
    }

    @Test
    @DisplayName("C1：Animeko 打标 clip 无绑定资产，按 episodeId 命中可用本地资产")
    void c1ByEpisodeWhenNoBinding() throws Exception {
        Path file = Files.createFile(assetRoot.resolve("by-ep.mp4"));
        Clip c = clip(21);
        c.setEpisodeId(66L);
        c.setUrl("animeko://bangumi/40310/ep/198749");
        when(clipMapper.selectById(21L)).thenReturn(c);
        when(assetMapper.selectByFingerprint(any())).thenReturn(null);
        when(assetMapper.selectAvailable(66L)).thenReturn(
                asset(21L, "LOCAL_ORIGINAL", "AVAILABLE", "by-ep.mp4", null, 66L));

        MaterializationService.Evaluation ev = service.evaluate(21L);
        assertEquals("C1", ev.channel());
        assertEquals("PRESENT", ev.state());
        assertEquals(file.toString(), ev.filePath());
    }

    // ---------- C2 ----------

    @Test
    @DisplayName("C2：本地集经 BANGUMI 桥反查到 Bangumi episodeId，Animeko 文件在场 → PRESENT/TRIM_EXTERNAL_FILE")
    void c2AnimekoFilePresent() throws Exception {
        // Animeko registry 命中（假 JSON：episodeId 字段 + 绝对路径候选）
        Path cached = Files.createTempFile(animekoRoot, "ep-198749", ".mp4");
        Files.writeString(animekoDataStore.resolve("mediaCacheMetadataV2"),
                "[{\"episodeId\":\"198749\",\"subjectId\":\"40310\",\"filePath\":\"" + cached.toString().replace("\\", "\\\\") + "\"}]");

        Clip c = clip(3);
        c.setEpisodeId(77L);
        when(clipMapper.selectById(3L)).thenReturn(c);
        ExternalEpisode bridge = new ExternalEpisode();
        bridge.setExternalWorkId(9L);
        bridge.setProviderEpisodeId("198749");
        when(externalEpisodeMapper.listByLocalEpisode(77L)).thenReturn(java.util.List.of(bridge));
        ExternalWork work = new ExternalWork();
        work.setId(9L);
        work.setProvider("BANGUMI");
        when(externalWorkMapper.selectById(9L)).thenReturn(work);

        MaterializationService.Evaluation ev = service.evaluate(3L);
        assertEquals("C2", ev.channel());
        assertEquals("PRESENT", ev.state());
        assertEquals("TRIM_EXTERNAL_FILE", ev.strategy());
        assertEquals(cached.toString(), ev.filePath());
    }

    @Test
    @DisplayName("C2：registry 为空/无该集 → PENDING（提示可显式缓存）")
    void c2PendingWhenNoCache() throws Exception {
        Files.writeString(animekoDataStore.resolve("mediaCacheMetadataV2"), "[]");
        Clip c = clip(4);
        c.setEpisodeId(78L);
        when(clipMapper.selectById(4L)).thenReturn(c);
        ExternalEpisode bridge = new ExternalEpisode();
        bridge.setExternalWorkId(9L);
        bridge.setProviderEpisodeId("999001");
        when(externalEpisodeMapper.listByLocalEpisode(78L)).thenReturn(java.util.List.of(bridge));
        ExternalWork work = new ExternalWork();
        work.setId(9L);
        work.setProvider("BANGUMI");
        when(externalWorkMapper.selectById(9L)).thenReturn(work);

        MaterializationService.Evaluation ev = service.evaluate(4L);
        assertEquals("C2", ev.channel());
        assertEquals("PENDING", ev.state());
        assertEquals("SOURCE_REQUIRED", ev.strategy());
    }

    @Test
    @DisplayName("C2 未配置 Animeko → UNAVAILABLE（不抛错）")
    void c2Unconfigured() {
        MaterializationService svc = new MaterializationService(clipMapper, assetMapper,
                externalEpisodeMapper, externalWorkMapper, assetRoot.toString(), "   ");
        Clip c = clip(5);
        c.setEpisodeId(79L);
        when(clipMapper.selectById(5L)).thenReturn(c);
        ExternalEpisode bridge = new ExternalEpisode();
        bridge.setExternalWorkId(9L);
        bridge.setProviderEpisodeId("5");
        when(externalEpisodeMapper.listByLocalEpisode(79L)).thenReturn(java.util.List.of(bridge));
        ExternalWork work = new ExternalWork();
        work.setId(9L);
        work.setProvider("BANGUMI");
        when(externalWorkMapper.selectById(9L)).thenReturn(work);

        MaterializationService.Evaluation ev = svc.evaluate(5L);
        assertEquals("C2", ev.channel());
        assertEquals("UNAVAILABLE", ev.state());
    }

    // ---------- C3 / C4 ----------

    @Test
    @DisplayName("C3：仅网页 URL 引用 → PENDING/受控下载（不视为可用素材）")
    void c3WebUrlPending() {
        Clip c = clip(6);
        c.setUrl("https://example.com/watch/40310?ep=198749");
        when(clipMapper.selectById(6L)).thenReturn(c);

        MaterializationService.Evaluation ev = service.evaluate(6L);
        assertEquals("C3", ev.channel());
        assertEquals("PENDING", ev.state());
        assertEquals("https://example.com/watch/40310?ep=198749", ev.url());
    }

    @Test
    @DisplayName("C4：无任何线索（本地非 URL）→ C4 录屏兜底提示")
    void c4Fallback() {
        Clip c = clip(7);
        c.setUrl("local://something.mp4");
        when(clipMapper.selectById(7L)).thenReturn(c);

        MaterializationService.Evaluation ev = service.evaluate(7L);
        assertEquals("C4", ev.channel());
        assertEquals("PENDING", ev.state());
    }

    // ---------- codec ----------

    @Test
    @DisplayName("channel_hints codec：upsert 幂等 + firstActionable 按 C1>C2 优先级")
    void channelHintCodec() {
        ChannelHint c1 = new ChannelHint("C1", "PRESENT", "local-file", null, null, "fp-x", 1L,
                null, "/tmp/a.mp4", 1L);
        ChannelHint c2 = new ChannelHint("C2", "PRESENT", "animeko-cache", "198749", "40310", null,
                null, null, "/tmp/b.mp4", 2L);
        String json = ChannelHint.Codec.encode(java.util.List.of(c1, c2));
        assertNotNull(json);
        assertTrue(json.contains("\"channel\":\"C1\""));

        // upsert 同 channel+kind 覆盖
        var updated = ChannelHint.Codec.upsert(ChannelHint.Codec.decode(json), new ChannelHint(
                "C1", "PENDING", "local-file", null, null, "fp-x", 1L, null, null, 3L));
        assertEquals(2, updated.size());
        assertEquals("PENDING", updated.get(0).state());

        // 优先级：C2 present 但 C1 pending → firstActionable 返回 C1? 不：present 优先于 pending，
        // C2 present 应先于 C1 pending？firstActionable 逻辑：先扫全部 present（按渠道排序），再扫 pending。
        var onlyC1Pending = java.util.List.of(new ChannelHint("C1", "PENDING", "local-file", null,
                null, "fp-x", 1L, null, null, 1L));
        ChannelHint pendingPick = ChannelHint.Codec.firstActionable(onlyC1Pending);
        assertNotNull(pendingPick, "只有 pending 时返回该渠道作为可预取引导");
        assertEquals("PENDING", pendingPick.state());
        var mixed = java.util.List.of(
                new ChannelHint("C1", "PENDING", "local-file", null, null, "fp-x", null, null, null, 1L),
                new ChannelHint("C2", "PRESENT", "animeko-cache", "198749", "40310", null, null, null, "/tmp/b.mp4", 2L));
        ChannelHint chosen = ChannelHint.Codec.firstActionable(mixed);
        assertNotNull(chosen);
        assertEquals("C2", chosen.channel(), "present 优先于 pending");
    }

    @Test
    @DisplayName("渠道枚举解析与优先级")
    void channelEnum() {
        assertEquals(MaterializationChannel.C1, MaterializationChannel.parse("C1"));
        assertEquals(MaterializationChannel.C4, MaterializationChannel.parse("c4"));
        assertNull(MaterializationChannel.parse("C9"));
        assertEquals(1, MaterializationChannel.inPriorityOrder().get(0).priority());
        assertEquals("Animeko 缓存", MaterializationChannel.C2.label());
    }
}
