package com.videotagger.service;

import com.videotagger.entity.Episode;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.VideoAssetMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** EpisodeReviewService：C1 本地集资产在场 / C2 Animeko 整集缓存在场 / 双缺 → UNAVAILABLE。 */
class EpisodeReviewServiceTest {

    private Path dataRoot;
    private Path assets;
    private EpisodeMapper episodeMapper = mock(EpisodeMapper.class);
    private VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
    private ExternalEpisodeMapper extEpMapper = mock(ExternalEpisodeMapper.class);
    private ExternalWorkMapper extWorkMapper = mock(ExternalWorkMapper.class);

    @AfterEach
    void tearDown() throws Exception {
        if (dataRoot != null) {
            try (var s = Files.walk(dataRoot)) { s.sorted(java.util.Comparator.reverseOrder()).forEach(p -> p.toFile().delete()); }
        }
        if (assets != null) {
            try (var s = Files.walk(assets)) { s.sorted(java.util.Comparator.reverseOrder()).forEach(p -> p.toFile().delete()); }
        }
    }

    private EpisodeReviewService service(String assetRoot, String dbPath) {
        return new EpisodeReviewService(episodeMapper, assetMapper, extEpMapper, extWorkMapper,
                assetRoot, dbPath, null);
    }

    private Episode ep(long id) {
        Episode e = new Episode();
        e.setId(id);
        return e;
    }

    @Test
    @DisplayName("C1：该集本地 asset 在场 → PRESENT 直接返回文件")
    void localAssetWins() throws Exception {
        assets = Files.createTempDirectory("ep-assets");
        Path file = Files.createFile(assets.resolve("full-ep.mp4"));
        when(episodeMapper.selectById(9L)).thenReturn(ep(9L));
        VideoAsset a = new VideoAsset();
        a.setEpisodeId(9L);
        a.setAssetType("LOCAL_ORIGINAL");
        a.setAvailabilityState("AVAILABLE");
        a.setStoragePath("full-ep.mp4");
        when(assetMapper.listByEpisode(9L)).thenReturn(List.of(a));

        EpisodeReviewService.ReviewSource r = service(assets.toString(), "Z:/no/db.db").resolve(9L);
        assertEquals("PRESENT", r.state());
        assertEquals(file.toAbsolutePath().toString(), r.filePath());
    }

    @Test
    @DisplayName("GENERATED_CLIP 产物不充当整集源：集只有产物时走 C2 Animeko 缓存")
    void generatedClipSkippedThenAnimeko() throws Exception {
        assets = Files.createTempDirectory("ep-assets-clip");
        Path product = Files.createFile(assets.resolve("clip-product.mp4"));
        when(episodeMapper.selectById(7L)).thenReturn(ep(7L));
        VideoAsset gen = new VideoAsset();
        gen.setEpisodeId(7L);
        gen.setAssetType("GENERATED_CLIP");
        gen.setAvailabilityState("AVAILABLE");
        gen.setStoragePath("clip-product.mp4");
        when(assetMapper.listByEpisode(7L)).thenReturn(List.of(gen));

        // Animeko 缓存该集整集在场
        dataRoot = Files.createTempDirectory("ep-review-genclip");
        Path datastore = Files.createDirectories(dataRoot.resolve("datastore"));
        Path downloads = Files.createDirectories(dataRoot.resolve("media-downloads").resolve("web-m3u"));
        String mediaId = "bbb.集B-02";
        Files.writeString(datastore.resolve("mediaCacheMetadataV2"),
                "[{\"origin\":{\"mediaId\":\"" + mediaId + "\"},\"metadata\":{\"episodeId\":\"666\",\"subjectId\":\"1\"},\"engine\":\"web-m3u\"}]");
        Path epFile = Files.createFile(downloads.resolve(mediaId + ".mp4"));
        ExternalEpisode bridge = new ExternalEpisode();
        bridge.setExternalWorkId(2L);
        bridge.setProviderEpisodeId("666");
        when(extEpMapper.listByLocalEpisode(7L)).thenReturn(List.of(bridge));
        ExternalWork work = new ExternalWork();
        work.setProvider("BANGUMI");
        when(extWorkMapper.selectById(2L)).thenReturn(work);
        Path fakeDb = dataRoot.resolve("ani_room_database_main.db");
        Files.writeString(fakeDb, "x");

        EpisodeReviewService.ReviewSource r = service(assets.toString(), fakeDb.toString()).resolve(7L);
        assertEquals("PRESENT", r.state());
        assertEquals(epFile.toAbsolutePath().toString(), r.filePath());
        assert product.toAbsolutePath().toString() != r.filePath() : "不得返回片段产物";
    }

    @Test
    @DisplayName("C2：无本地资产但有 Animeko 缓存 registry 条目 → 桥 + locate 命中")
    void animekoCacheHit() throws Exception {
        dataRoot = Files.createTempDirectory("ep-review-animeko");
        Path datastore = Files.createDirectories(dataRoot.resolve("datastore"));
        Path downloads = Files.createDirectories(dataRoot.resolve("media-downloads").resolve("web-m3u"));
        String mediaId = "aaa.集A-01";
        Files.writeString(datastore.resolve("mediaCacheMetadataV2"),
                "[{\"origin\":{\"mediaId\":\"" + mediaId + "\"},\"metadata\":{\"episodeId\":\"777\",\"subjectId\":\"1\"},\"engine\":\"web-m3u\"}]");
        Path file = Files.createFile(downloads.resolve(mediaId + ".mp4"));
        when(episodeMapper.selectById(7L)).thenReturn(ep(7L));
        when(assetMapper.listByEpisode(7L)).thenReturn(List.of());
        ExternalEpisode bridge = new ExternalEpisode();
        bridge.setExternalWorkId(2L);
        bridge.setProviderEpisodeId("777");
        when(extEpMapper.listByLocalEpisode(7L)).thenReturn(List.of(bridge));
        ExternalWork work = new ExternalWork();
        work.setProvider("BANGUMI");
        when(extWorkMapper.selectById(2L)).thenReturn(work);

        // dbPath 指向 dataRoot 下的假 db（父目录= dataRoot）
        Path fakeDb = dataRoot.resolve("ani_room_database_main.db");
        Files.writeString(fakeDb, "x");
        EpisodeReviewService.ReviewSource r = service("C:/no/assets", fakeDb.toString()).resolve(7L);
        assertEquals("PRESENT", r.state());
        assertEquals(file.toAbsolutePath().toString(), r.filePath());
    }

    @Test
    @DisplayName("双缺 → UNAVAILABLE 不抛错")
    void bothMissing() throws Exception {
        when(episodeMapper.selectById(1L)).thenReturn(ep(1L));
        when(assetMapper.listByEpisode(1L)).thenReturn(List.of());
        when(extEpMapper.listByLocalEpisode(1L)).thenReturn(List.of());
        EpisodeReviewService.ReviewSource r = service("C:/no/assets", "").resolve(1L);
        assertEquals("UNAVAILABLE", r.state());
        assertNull(r.filePath());
    }
}
