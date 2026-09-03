package com.videotagger.service;

import com.videotagger.entity.Episode;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.Media;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** v0.24 M2 现场打标单测：临时 SQLite 充当 Animeko DB + mock 本地 mappers。 */
class AnimekoTagServiceTest {

    private Path dbFile;
    private EpisodeMapper episodeMapper;
    private ExternalWorkMapper externalWorkMapper;
    private ExternalEpisodeMapper externalEpisodeMapper;
    private MediaMapper mediaMapper;
    private ClipMapper clipMapper;
    private TagMapper tagMapper;
    private ClipTagMapper clipTagMapper;
    private TagSyncService tagSyncService;
    private EmbeddingTaskService embeddingTaskService;
    private MaterializationService materializationService;
    private AnimekoTagService service;

    @BeforeEach
    void setUp() throws Exception {
        dbFile = Files.createTempFile("animeko-tag", ".db");
        Files.deleteIfExists(dbFile);
        episodeMapper = mock(EpisodeMapper.class);
        externalWorkMapper = mock(ExternalWorkMapper.class);
        externalEpisodeMapper = mock(ExternalEpisodeMapper.class);
        mediaMapper = mock(MediaMapper.class);
        clipMapper = mock(ClipMapper.class);
        tagMapper = mock(TagMapper.class);
        clipTagMapper = mock(ClipTagMapper.class);
        tagSyncService = mock(TagSyncService.class);
        embeddingTaskService = mock(EmbeddingTaskService.class);
        materializationService = mock(MaterializationService.class);
        service = new AnimekoTagService(episodeMapper, externalWorkMapper, externalEpisodeMapper,
                mediaMapper, clipMapper, tagMapper, clipTagMapper, tagSyncService,
                embeddingTaskService, materializationService, dbFile.toAbsolutePath().toString(), null);
    }

    @AfterEach
    void tearDown() throws Exception {
        Files.deleteIfExists(dbFile);
    }

    private void seedPlayback(String... rows) throws Exception {
        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + dbFile.toAbsolutePath());
             Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE playback_history_record ("
                    + "episodeId INTEGER PRIMARY KEY, positionMillis INTEGER, subjectId INTEGER, "
                    + "subjectName TEXT, episodeName TEXT, durationMillis INTEGER, "
                    + "updatedAtMillis INTEGER, deletedAtMillis INTEGER)");
            for (String row : rows) st.execute("INSERT INTO playback_history_record " + row);
        }
    }

    private ExternalWork bangumiWork(long id, long subjectId) {
        ExternalWork w = new ExternalWork();
        w.setId(id);
        w.setProvider("BANGUMI");
        w.setExternalId(String.valueOf(subjectId));
        return w;
    }

    private ExternalEpisode bridgeEpisode(String bangumiEp, Long localEpId) {
        ExternalEpisode e = new ExternalEpisode();
        e.setExternalWorkId(9L);
        e.setProviderEpisodeId(bangumiEp);
        e.setEpisodeId(localEpId);
        return e;
    }

    // ---------- playhead ----------

    @Test
    @DisplayName("Animeko 库不可达 → 功能关闭")
    void unavailable() {
        AnimekoTagService svc = new AnimekoTagService(episodeMapper, externalWorkMapper, externalEpisodeMapper,
                mediaMapper, clipMapper, tagMapper, clipTagMapper, tagSyncService,
                embeddingTaskService, materializationService, "Z:/no/such/animeko.db", null);
        AnimekoTagService.PlayheadView v = svc.mappedPlayhead();
        assertFalse(v.reachable());
        assertTrue(v.message().contains("不存在"));
    }

    @Test
    @DisplayName("空配置自动探测：本机真实 Animeko 库命中 → 可达")
    void blankConfigAutoDetects() {
        // 空/空白配置 = 自动探测 Windows 标准路径；测试机上有真实库时应可达
        AnimekoTagService svc = new AnimekoTagService(episodeMapper, externalWorkMapper, externalEpisodeMapper,
                mediaMapper, clipMapper, tagMapper, clipTagMapper, tagSyncService,
                embeddingTaskService, materializationService, " ", null);
        AnimekoTagService.PlayheadView v = svc.mappedPlayhead();
        // 若本机确实装了 Animeko（Roaming/Him188/Ani/data）则 reachable；否则按不可达处理也不报错
        boolean hasRealAnimeko = java.nio.file.Files.isRegularFile(java.nio.file.Path.of(
                System.getProperty("user.home"), "AppData", "Roaming", "Him188", "Ani", "data", "ani_room_database_main.db"));
        assertEquals(hasRealAnimeko, v.reachable());
    }

    @Test
    @DisplayName("有播放记录但无本地档案 → playhead 可见、mapped=false")
    void playheadUnmapped() throws Exception {
        seedPlayback("VALUES (198749, 6234000, 40310, '少女与战车', '第2集', 14400000, 1788350140151, NULL)");
        when(externalWorkMapper.selectByProviderAndExternalId("BANGUMI", "40310")).thenReturn(null);

        AnimekoTagService.PlayheadView v = service.mappedPlayhead();
        assertTrue(v.reachable());
        assertEquals(40310L, v.bangumiSubjectId());
        assertEquals(198749L, v.bangumiEpisodeId());
        assertEquals(6234000L, v.positionMs());
        assertFalse(v.mapped());
    }

    @Test
    @DisplayName("已建档 → mapped=true 且带本地集/媒体信息")
    void playheadMapped() throws Exception {
        seedPlayback("VALUES (198749, 6234000, 40310, '少女与战车', '第2集', 14400000, 1788350140151, NULL)");
        when(externalWorkMapper.selectByProviderAndExternalId("BANGUMI", "40310"))
                .thenReturn(bangumiWork(9L, 40310L));
        when(externalEpisodeMapper.selectByProviderEpisode(9L, "198749")).thenReturn(bridgeEpisode("198749", 77L));
        Episode ep = new Episode();
        ep.setId(77L);
        ep.setMediaId(5609L);
        ep.setEpisodeNo(2);
        ep.setTitle("战车，搭乘了！");
        when(episodeMapper.selectById(77L)).thenReturn(ep);
        Media m = new Media();
        m.setId(5609L);
        m.setTitle("少女与战车");
        m.setSeason(1);
        when(mediaMapper.selectById(5609L)).thenReturn(m);

        AnimekoTagService.PlayheadView v = service.mappedPlayhead();
        assertTrue(v.mapped());
        assertEquals(77L, v.localEpisodeId());
        assertEquals(5609L, v.mediaId());
        assertEquals("少女与战车", v.mediaTitle());
        assertEquals("S1-Ep2", v.episodeLabel());
    }

    // ---------- tag ----------

    @Test
    @DisplayName("打标成功：建 Clip + 标签关联 + watchedAt + 渠道求值")
    void tagCreatesClip() throws Exception {
        seedPlayback("VALUES (198749, 6234000, 40310, '少女与战车', '第2集', 14400000, 1788350140151, NULL)");
        when(externalWorkMapper.selectByProviderAndExternalId("BANGUMI", "40310"))
                .thenReturn(bangumiWork(9L, 40310L));
        when(externalEpisodeMapper.selectByProviderEpisode(9L, "198749")).thenReturn(bridgeEpisode("198749", 77L));
        Episode ep = new Episode();
        ep.setId(77L);
        ep.setMediaId(5609L);
        ep.setTitle("战车，搭乘了！");
        when(episodeMapper.selectById(77L)).thenReturn(ep);
        Media m = new Media();
        m.setId(5609L);
        m.setTitle("少女与战车");
        when(mediaMapper.selectById(5609L)).thenReturn(m);
        when(materializationService.evaluate(anyLong(), eq(true))).thenReturn(
                new MaterializationService.Evaluation(1L, "C2", "PRESENT", "TRIM_EXTERNAL_FILE",
                        null, "D:/animeko/ep.mp4", null, "命中"));
        // mock ClipMapper.insert 需回填自增 id（真实链路 MyBatis-Plus AUTO 自动回填）
        org.mockito.Mockito.doAnswer(inv -> {
            com.videotagger.entity.Clip c = inv.getArgument(0);
            c.setId(1L);
            return 1;
        }).when(clipMapper).insert(any(com.videotagger.entity.Clip.class));

        AnimekoTagService.TagResult r = service.tag(new AnimekoTagService.TagRequest("高燃 战斗", "西住流", null, 7000000L));

        assertTrue(r.ok());
        assertEquals("OK", r.code());
        assertEquals("C2", r.channel());
        ArgumentCaptor<com.videotagger.entity.Clip> captor = ArgumentCaptor.forClass(com.videotagger.entity.Clip.class);
        verify(clipMapper).insert(captor.capture());
        com.videotagger.entity.Clip clip = captor.getValue();
        assertEquals(77L, clip.getEpisodeId());
        assertEquals(6234000L, clip.getStartMs(), "默认起点取播放头位置");
        assertEquals(7000000L, clip.getEndMs());
        assertTrue(clip.getUrl().startsWith("animeko://bangumi/40310/ep/198749"), "占位引用 URL");
        assertEquals("REFERENCE_ONLY", clip.getMaterialState());
        // 已看标记
        ArgumentCaptor<Episode> epCaptor = ArgumentCaptor.forClass(Episode.class);
        verify(episodeMapper).updateById(epCaptor.capture());
        assertEquals(77L, epCaptor.getValue().getId());
        assertEquals(1788350140151L, epCaptor.getValue().getWatchedAt());
        verify(tagSyncService).syncFromClip(clip.getId());
        verify(embeddingTaskService).enqueue(EntityType.CLIP, clip.getId());
    }

    @Test
    @DisplayName("本地未建档 → NEED_ARCHIVE 不建 Clip")
    void tagNeedsArchive() throws Exception {
        seedPlayback("VALUES (198749, 6234000, 40310, '少女与战车', '第2集', 14400000, 1788350140151, NULL)");
        when(externalWorkMapper.selectByProviderAndExternalId("BANGUMI", "40310")).thenReturn(null);

        AnimekoTagService.TagResult r = service.tag(new AnimekoTagService.TagRequest("高燃", null, null, null));
        assertFalse(r.ok());
        assertEquals("NEED_ARCHIVE", r.code());
        verify(clipMapper, never()).insert(any(com.videotagger.entity.Clip.class));
    }

    @Test
    @DisplayName("无播放记录 → NO_PLAYBACK")
    void tagNoPlayback() throws Exception {
        seedPlayback(); // 空表：有表无行
        AnimekoTagService.TagResult r = service.tag(new AnimekoTagService.TagRequest("高燃", null, null, null));
        assertFalse(r.ok());
        assertEquals("NO_PLAYBACK", r.code());
    }
}
