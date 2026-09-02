package com.videotagger.service;

import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
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
        this.dbPath = dbPath == null ? "" : dbPath.trim();
    }

    public boolean configured() {
        return !dbPath.isEmpty();
    }

    /** 运行状态/预览：文件可达性 + 有效播放记录数（不写库）。 */
    public Status status() {
        if (!configured()) return new Status(false, false, "未配置 Animeko 数据库路径（videotagger.animeko.db-path）", -1);
        File file = new File(dbPath);
        if (!file.isFile()) return new Status(true, false, "数据库文件不存在: " + file.getAbsolutePath(), -1);
        int count = -1;
        String message = "可达";
        try (Connection conn = open()) {
            count = countWatchRecords(conn);
        } catch (Exception e) {
            message = "读取失败: " + e.getMessage();
        }
        return new Status(true, count >= 0, message, count);
    }

    public record Status(boolean configured, boolean ok, String message, int recordCount) {}

    /** 执行导入，返回统计；不因局部无映射中断。 */
    public ImportResult importWatchHistory() {
        if (!configured()) {
            return new ImportResult(false, false, "未配置 Animeko 数据库路径", 0, 0, 0, 0, List.of());
        }
        File file = new File(dbPath);
        if (!file.isFile()) {
            return new ImportResult(true, false, "数据库文件不存在: " + file.getAbsolutePath(), 0, 0, 0, 0, List.of());
        }
        List<WatchRecord> records;
        try (Connection conn = open()) {
            records = readWatchRecords(conn);
        } catch (Exception e) {
            log.warn("[animeko] 读取播放历史失败: {}", e.getMessage());
            return new ImportResult(true, false, "读取失败: " + e.getMessage(), 0, 0, 0, 0, List.of());
        }
        int imported = 0, noMapping = 0, noEpisode = 0;
        List<String> samples = new ArrayList<>();
        Set<Long> touchedLocal = new HashSet<>(); // 本批已处理的本地集，避免同一集重复写
        for (WatchRecord r : records) {
            if (r.subjectId() == null) {
                noMapping++;
                continue;
            }
            ExternalWork work = externalWorkMapper.selectByProviderAndExternalId(
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
        log.info("[animeko] 观看导入完成: 记录 {}，标记 {}，无媒体映射 {}，无本地集 {}",
                records.size(), imported, noMapping, noEpisode);
        return new ImportResult(true, true, "导入完成", records.size(), imported, noMapping, noEpisode, samples);
    }

    public record ImportResult(boolean enabled, boolean ok, String message,
                               int total, int imported, int noMapping, int noEpisode,
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
}
