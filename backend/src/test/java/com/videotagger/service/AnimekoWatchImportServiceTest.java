package com.videotagger.service;

import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.Episode;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** v0.24 Animeko 观看导入单测：Mockito mock 本地 mapper + 临时 SQLite 充当 Animeko DB。 */
class AnimekoWatchImportServiceTest {

    private Path dbFile;
    private EpisodeMapper episodeMapper;
    private ExternalWorkMapper externalWorkMapper;
    private ExternalEpisodeMapper externalEpisodeMapper;
    private AnimekoWatchImportService service;

    @BeforeEach
    void setUp() throws Exception {
        dbFile = Files.createTempFile("animeko-watch", ".db");
        Files.deleteIfExists(dbFile); // 让 sqlite 重建空库
        episodeMapper = mock(EpisodeMapper.class);
        externalWorkMapper = mock(ExternalWorkMapper.class);
        externalEpisodeMapper = mock(ExternalEpisodeMapper.class);
        service = new AnimekoWatchImportService(episodeMapper, externalWorkMapper, externalEpisodeMapper,
                dbFile.toAbsolutePath().toString());
    }

    @AfterEach
    void tearDown() throws Exception {
        Files.deleteIfExists(dbFile);
    }

    private void seedPlaybackHistory(String... inserts) throws Exception {
        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + dbFile.toAbsolutePath());
             Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE playback_history_record ("
                    + "episodeId INTEGER PRIMARY KEY, positionMillis INTEGER, subjectId INTEGER, "
                    + "subjectName TEXT, episodeName TEXT, durationMillis INTEGER, "
                    + "updatedAtMillis INTEGER, deletedAtMillis INTEGER)");
            for (String row : inserts) st.execute("INSERT INTO playback_history_record " + row);
        }
    }

    @Test
    @DisplayName("未配置路径时功能关闭")
    void disabledWhenNotConfigured() {
        AnimekoWatchImportService off = new AnimekoWatchImportService(
                episodeMapper, externalWorkMapper, externalEpisodeMapper, " ");
        assertFalse(off.configured());
        AnimekoWatchImportService.ImportResult result = off.importWatchHistory();
        assertFalse(result.ok());
        assertEquals("未配置", result.message().substring(0, 3));
    }

    @Test
    @DisplayName("匹配的集标记 watchedAt，无映射/无集分开计数，已删记录不计")
    void importMarksWatchedAndCountsSkips() throws Exception {
        seedPlaybackHistory(
                "VALUES (229, 123456, 40310, 'A', 'Ep2', 1440000, 1750000000000, NULL)",
                "VALUES (999, 100, 40310, 'A', 'no-ep', 1440000, 1750000000100, NULL)",
                "VALUES (300, 50, 77777, 'B', 'no-work', 1440000, 1750000000200, NULL)",
                "VALUES (301, 40, 40310, 'A', 'deleted', 1440000, 1750000000300, 1)");

        ExternalWork work = new ExternalWork();
        work.setId(9L);
        when(externalWorkMapper.selectByProviderAndExternalId(eq("BANGUMI"), eq("40310"))).thenReturn(work);

        ExternalEpisode matched = new ExternalEpisode();
        matched.setId(1L);
        matched.setEpisodeId(100L);
        when(externalEpisodeMapper.selectByProviderEpisode(eq(9L), eq("229"))).thenReturn(matched);

        AnimekoWatchImportService.ImportResult result = service.importWatchHistory();

        assertTrue(result.ok(), result.message());
        assertEquals(3, result.total(), "已删除 1 条被 SQL 过滤，其余 3 条进入匹配");
        assertEquals(1, result.imported());
        assertEquals(1, result.noMapping());
        assertEquals(1, result.noEpisode());

        ArgumentCaptor<Episode> captor = ArgumentCaptor.forClass(Episode.class);
        verify(episodeMapper, times(1)).updateById(captor.capture());
        assertEquals(100L, captor.getValue().getId());
        assertEquals(1750000000000L, captor.getValue().getWatchedAt());
    }

    @Test
    @DisplayName("同一集多条播放记录只写一次（取最新）")
    void duplicateEpisodeWrittenOnce() throws Exception {
        seedPlaybackHistory(
                "VALUES (229, 100, 40310, 'A', 'Ep2', 1440000, 1750000000000, NULL)",
                "VALUES (228, 800, 40310, 'A', 'Ep2-old', 1440000, 1750000000999, NULL)");

        ExternalWork work = new ExternalWork();
        work.setId(9L);
        when(externalWorkMapper.selectByProviderAndExternalId("BANGUMI", "40310")).thenReturn(work);
        ExternalEpisode matched = new ExternalEpisode();
        matched.setId(1L);
        matched.setEpisodeId(100L);
        when(externalEpisodeMapper.selectByProviderEpisode(9L, "229")).thenReturn(matched);
        when(externalEpisodeMapper.selectByProviderEpisode(9L, "228")).thenReturn(matched);

        AnimekoWatchImportService.ImportResult result = service.importWatchHistory();

        assertEquals(2, result.total());
        assertEquals(1, result.imported(), "同集两条记录只应写一次");
        verify(episodeMapper, times(1)).updateById(any(Episode.class));
    }

    @Test
    @DisplayName("DB 不可达/缺表时返回失败但不抛异常")
    void unreadableDbReturnsFailure() {
        AnimekoWatchImportService bad = new AnimekoWatchImportService(
                episodeMapper, externalWorkMapper, externalEpisodeMapper, "/no/such/animeko.db");
        AnimekoWatchImportService.ImportResult result = bad.importWatchHistory();
        assertFalse(result.ok());
        assertTrue(result.message().contains("不存在"));
        verify(episodeMapper, never()).updateById(any(Episode.class));
    }
}
