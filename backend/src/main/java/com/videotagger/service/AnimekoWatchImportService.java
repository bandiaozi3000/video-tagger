package com.videotagger.service;

import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.util.AnimekoPaths;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * v0.24 Animeko 观看导入：只读 Animeko 桌面版 SQLite 的播放历史，
 * 把"看过"的集按 Bangumi id 桥映射回本地 Episode 并记录 watchedAt。
 *
 * <p>只读侧不写 Animeko 任何数据；video-tagger 侧仅幂等标记 watched_at。
 * 建议导入时 Animeko 空闲/关闭；运行中亦可用（SQLite WAL 支持并发读）。
 */
@Service
public class AnimekoWatchImportService {

    private static final Logger log = LoggerFactory.getLogger(AnimekoWatchImportService.class);
    private static final String PROVIDER_BANGUMI = "BANGUMI";
    /** 单次导入最多处理最近 N 条播放记录。 */
    private static final int MAX_RECORDS = 500;

    private final EpisodeMapper episodeMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final ExternalEpisodeMapper externalEpisodeMapper;
    private final String dbPath;

    public AnimekoWatchImportService(EpisodeMapper episodeMapper,
                                     ExternalWorkMapper externalWorkMapper,
                                     ExternalEpisodeMapper externalEpisodeMapper,
                                     @Value("${videotagger.animeko.db-path:}") String dbPath) {
        this.episodeMapper = episodeMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.externalEpisodeMapper = externalEpisodeMapper;
        this.dbPath = AnimekoPaths.resolve(dbPath);
    }

    public boolean configured() {
        return !dbPath.isEmpty();
    }

    /** 运行状态/预览：文件可达性 + 有效播放记录数（不写库）。 */
    public Status status() {
        if (!configured()) return new Status(false, false, "未配置 Animeko 数据库路径（videotagger.animeko.db-path）", -1, -1);
        File file = new File(dbPath);
        if (!file.isFile()) return new Status(true, false, "数据库文件不存在: " + file.getAbsolutePath(), -1, -1);
        int count = -1;
        int collectionWatched = -1;
        String message = "可达";
        try (Connection conn = open()) {
            count = countWatchRecords(conn);
            collectionWatched = countCollectionWatched(conn);
        } catch (Exception e) {
            message = "读取失败: " + e.getMessage();
        }
        return new Status(true, count >= 0, message, count, collectionWatched);
    }

    public record Status(boolean configured, boolean ok, String message, int recordCount,
                         int collectionWatched) {}

    /** 执行导入：播放历史（最近观看，Animeko 会自清理）+ episode_collection 中 WATCHED（Bangumi 云同步后的持久已看）。 */
    public ImportResult importWatchHistory() {
        if (!configured()) {
            return new ImportResult(false, false, "未配置 Animeko 数据库路径", 0, 0, 0, 0, 0, List.of());
        }
        File file = new File(dbPath);
        if (!file.isFile()) {
            return new ImportResult(true, false, "数据库文件不存在: " + file.getAbsolutePath(), 0, 0, 0, 0, 0, List.of());
        }
        List<WatchRecord> history;
        List<WatchRecord> collection;
        try (Connection conn = open()) {
            history = readWatchRecords(conn);
            collection = readWatchedCollection(conn);
        } catch (Exception e) {
            log.warn("[animeko] 读取观看事实失败: {}", e.getMessage());
            return new ImportResult(true, false, "读取失败: " + e.getMessage(), 0, 0, 0, 0, 0, List.of());
        }
        int imported = 0, noMapping = 0, noEpisode = 0;
        List<String> samples = new ArrayList<>();
        Set<Long> touchedLocal = new HashSet<>(); // 跨源去重：同一本地集只写一次
        List<WatchRecord> merged = new ArrayList<>(history);
        merged.addAll(collection);
        for (WatchRecord r : merged) {
            ExternalWork work = r.subjectId() == null ? null
                    : externalWorkMapper.selectByProviderAndExternalId(
                            PROVIDER_BANGUMI, String.valueOf(r.subjectId()));
            if (work == null) {
                noMapping++;
                continue;
            }
            ExternalEpisode external = externalEpisodeMapper.selectByProviderEpisode(
                    work.getId(), String.valueOf(r.episodeId()));
            if (external == null || external.getEpisodeId() == null) {
                noEpisode++;
                continue;
            }
            long localId = external.getEpisodeId();
            if (!touchedLocal.add(localId)) continue;
            var patch = new com.videotagger.entity.Episode();
            patch.setId(localId);
            patch.setWatchedAt(r.updatedAtMillis());
            episodeMapper.updateById(patch);
            imported++;
            if (samples.size() < 5) {
                samples.add("subject " + r.subjectId() + " ep " + r.episodeId()
                        + " -> episode#" + localId + " @" + r.updatedAtMillis());
            }
        }
        log.info("[animeko] 观看导入完成: 历史 {}，收藏已看 {}，标记 {}，无媒体映射 {}，无本地集 {}",
                history.size(), collection.size(), imported, noMapping, noEpisode);
        return new ImportResult(true, true, "导入完成", history.size() + collection.size(),
                imported, noMapping, noEpisode, collection.size(), samples);
    }

    public record ImportResult(boolean enabled, boolean ok, String message,
                               int total, int imported, int noMapping, int noEpisode,
                               int collectionWatched,
                               List<String> samples) {}

    private record WatchRecord(Integer subjectId, int episodeId, long positionMillis,
                               long durationMillis, long updatedAtMillis) {}

    private Connection open() throws Exception {
        Class.forName("org.sqlite.JDBC");
        return DriverManager.getConnection("jdbc:sqlite:" + new File(dbPath).getAbsolutePath());
    }

    private int countWatchRecords(Connection conn) throws Exception {
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT COUNT(*) FROM playback_history_record WHERE deletedAtMillis IS NULL")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private List<WatchRecord> readWatchRecords(Connection conn) throws Exception {
        List<WatchRecord> out = new ArrayList<>();
        if (!tableExists(conn, "playback_history_record")) return out;
        String sql = "SELECT episodeId, subjectId, positionMillis, durationMillis, updatedAtMillis "
                + "FROM playback_history_record "
                + "WHERE deletedAtMillis IS NULL "
                + "ORDER BY updatedAtMillis DESC LIMIT " + MAX_RECORDS;
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                Integer subjectId = rs.getObject("subjectId") == null ? null : rs.getInt("subjectId");
                out.add(new WatchRecord(subjectId, rs.getInt("episodeId"),
                        rs.getLong("positionMillis"), rs.getLong("durationMillis"),
                        rs.getLong("updatedAtMillis")));
            }
        }
        return out;
    }

    private List<WatchRecord> readWatchedCollection(Connection conn) throws Exception {
        List<WatchRecord> out = new ArrayList<>();
        if (!tableExists(conn, "episode_collection")) return out; // 旧版 Animeko 无收藏表
        String sql = "SELECT episodeId, subjectId, lastFetched FROM episode_collection "
                + "WHERE selfCollectionType = 'WATCHED' ORDER BY lastFetched DESC LIMIT " + MAX_RECORDS;
        try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                Integer subjectId = rs.getObject("subjectId") == null ? null : rs.getInt("subjectId");
                out.add(new WatchRecord(subjectId, rs.getInt("episodeId"), 0L, 0L,
                        rs.getLong("lastFetched")));
            }
        }
        return out;
    }

    private int countCollectionWatched(Connection conn) throws Exception {
        if (!tableExists(conn, "episode_collection")) return 0;
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT COUNT(*) FROM episode_collection WHERE selfCollectionType = 'WATCHED'")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private boolean tableExists(Connection conn, String table) throws Exception {
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '" + table + "'")) {
            return rs.next();
        }
    }
}
