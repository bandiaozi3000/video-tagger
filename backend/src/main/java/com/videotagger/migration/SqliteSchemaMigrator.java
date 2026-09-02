package com.videotagger.migration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SQLite schema 版本迁移（桌面版唯一数据源用，替代 MySQL 版 Flyway）。
 *
 * <p>背景：桌面版 Flyway 禁用，schema 靠 {@code spring.sql.init} 每次启动跑
 * {@code db/sqlite-schema.sql}（全表 {@code CREATE TABLE IF NOT EXISTS}，幂等）。
 * 幂等建表能覆盖「新表」，但**已有表加列/改列/数据迁移打新包无效**（IF NOT EXISTS
 * 对已存在表整体跳过），且用户 SQLite 库在各自机器数据目录，只能靠程序内迁移代码去 ALTER。
 *
 * <p>机制：用 SQLite 内建 {@code PRAGMA user_version} 存 schema 版本号。
 * <ul>
 *   <li>版本为 0 时不再盲目视为最新结构：先根据关键表/列推断遗留库的实际结构，
 *       再从对应版本继续迁移。这样可以修复早期版本没有写入 user_version 的桌面库。</li>
 *   <li>版本 &gt; 0 且小于最新：按序执行 {@code db/migration-sqlite/vNN.sql}（NN 两位对齐，
 *       纯 ALTER 语句），每执行一个即递增 user_version。</li>
 * </ul>
 * 最新版本 = max(1, 目录里最大的 vNN)（基线 v1 = sqlite-schema.sql 的当前结构）。
 * 以后每次改表结构：新建 vNN.sql（ALTER），不动 sqlite-schema.sql 已有表定义；新装用户
 * 建全表后直接初始化为最新，老用户走 vNN 迁移。
 *
 * <p>只在 SQLite 数据源下生效（MySQL profile 仅数据迁移工具用，走 Flyway，跳过）。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SqliteSchemaMigrator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SqliteSchemaMigrator.class);

    private static final int BASELINE_VERSION = 1; // sqlite-schema.sql 当前结构 = 基线 v1
    private static final String MIGRATIONS_DIR = "db/migration-sqlite";
    private static final Pattern VERSION_FILE = Pattern.compile("^v(\\d+)\\.sql$");

    private final DataSource dataSource;
    private final String datasourceUrl;

    public SqliteSchemaMigrator(DataSource dataSource,
                                @Value("${spring.datasource.url:}") String datasourceUrl) {
        this.dataSource = dataSource;
        this.datasourceUrl = datasourceUrl;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (datasourceUrl != null && !datasourceUrl.isBlank() && !datasourceUrl.startsWith("jdbc:sqlite:")) {
            return;
        }
        try (Connection connection = dataSource.getConnection()) {
            String actualUrl = connection.getMetaData().getURL();
            if (actualUrl == null || !actualUrl.startsWith("jdbc:sqlite:")) {
                return;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Unable to detect database type", e);
        }
        migrate();
    }

    void migrate() {
        try (Connection conn = dataSource.getConnection()) {
            int latest = latestVersion();
            int current = readUserVersion(conn);
            if (current == 0) {
                if (!tableExists(conn, "media")) {
                    // spring.sql.init 已完成全新库初始化；这里只需记录基线版本。
                    ensureMetadataIndexes(conn);
                    writeUserVersion(conn, latest);
                    log.info("[schema] SQLite 全新库初始化为 {}（最新）", latest);
                    return;
                }
                if (needsMetadataLibraryUpgrade(conn)) {
                    // 早期未写版本号的库通常已经完成 v02-v04，直接从 v05 继续。
                    current = 4;
                } else if (needsMetadataCleanup(conn)) {
                    // 极早期/测试中的最小遗留库没有 episode，先执行清理和新任务表迁移。
                    current = 5;
                } else {
                    current = inferVersion(conn, latest);
                }
                for (int version = current + 1; version <= latest; version++) {
                    runMigrationScript(conn, version);
                    writeUserVersion(conn, version);
                }
                ensureMetadataIndexes(conn);
                writeUserVersion(conn, latest);
                log.info("[schema] SQLite 遗留库迁移到 {}（最新）", latest);
                return;
            }
            for (int v = current + 1; v <= latest; v++) {
                runMigrationScript(conn, v);
                writeUserVersion(conn, v);
                log.info("[schema] SQLite 已迁移到 schema 版本 {}", v);
            }
            ensureMetadataIndexes(conn);
        } catch (Exception e) {
            throw new IllegalStateException("SQLite schema 迁移失败，请检查数据目录下的 video_tagger.db", e);
        }
    }

    /** 最新 schema 版本 = max(基线 v1, migration-sqlite 目录里最大的 vNN)。 */
    int latestVersion() throws Exception {
        int max = BASELINE_VERSION;
        Resource[] resources = new PathMatchingResourcePatternResolver()
                .getResources(MIGRATIONS_DIR + "/*.sql");
        for (Resource r : resources) {
            String fn = r.getFilename();
            if (fn == null) continue;
            Matcher m = VERSION_FILE.matcher(fn);
            if (m.matches()) {
                max = Math.max(max, Integer.parseInt(m.group(1)));
            }
        }
        return max;
    }

    private int readUserVersion(Connection conn) throws SQLException {
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("PRAGMA user_version")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private boolean needsMetadataLibraryUpgrade(Connection conn) throws SQLException {
        return tableExists(conn, "episode") && !hasColumn(conn, "episode", "media_entry_id");
    }

    private void ensureMetadataIndexes(Connection conn) throws SQLException {
        if (!hasColumn(conn, "episode", "media_entry_id")) return;
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE INDEX IF NOT EXISTS idx_episode_media_entry ON episode(media_entry_id)");
        }
        if (hasColumn(conn, "clips", "video_asset_id")) {
            try (Statement st = conn.createStatement()) {
                st.execute("CREATE INDEX IF NOT EXISTS idx_clips_video_asset ON clips(video_asset_id)");
            }
        }
        if (hasColumn(conn, "clips", "time_mapping_id")) {
            try (Statement st = conn.createStatement()) {
                st.execute("CREATE INDEX IF NOT EXISTS idx_clips_time_mapping ON clips(time_mapping_id)");
            }
        }
        if (hasColumn(conn, "clips", "material_state")) {
            try (Statement st = conn.createStatement()) {
                st.execute("CREATE INDEX IF NOT EXISTS idx_clips_material_state ON clips(material_state)");
            }
        }
    }

    private int inferVersion(Connection conn, int latest) throws SQLException {
        if (!tableExists(conn, "highlight_project")) return 1;
        if (!tableExists(conn, "highlight_export") || !hasColumn(conn, "highlight_export", "stage")) return 3;
        if (!hasColumn(conn, "episode", "media_entry_id")) return 4;
        if (!tableExists(conn, "metadata_sync_draft")) return 6;
        if (!hasColumn(conn, "clips", "start_ms") || !hasColumn(conn, "clips", "video_asset_id")
                || !tableExists(conn, "video_source_package")) return 7;
        if (!tableExists(conn, "video_source_subscription")) return 8;
        return latest;
    }

    private boolean hasColumn(Connection conn, String table, String column) throws SQLException {
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (rs.next()) if (column.equals(rs.getString("name"))) return true;
            return false;
        }
    }
    private boolean needsMetadataCleanup(Connection conn) throws SQLException {
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("PRAGMA table_info(media)")) {
            while (rs.next()) {
                String name = rs.getString("name");
                if ("original_title".equals(name) || "cover_url".equals(name) || "source".equals(name)) {
                    return true;
                }
            }
        }
        return tableExists(conn, "metadata_sync_candidate")
                || (tableExists(conn, "metadata_sync_task") && !tableExists(conn, "metadata_sync_draft"));
    }

    private boolean tableExists(Connection conn, String table) throws SQLException {
        try (var ps = conn.prepareStatement("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private void writeUserVersion(Connection conn, int version) throws SQLException {
        try (Statement st = conn.createStatement()) {
            st.execute("PRAGMA user_version = " + version);
        }
    }

    private void runMigrationScript(Connection conn, int version) throws SQLException {
        String path = MIGRATIONS_DIR + "/v" + String.format("%02d", version) + ".sql";
        try {
            Resource resource = new ClassPathResource(path);
            String script = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8)
                    .replaceAll("(?m)^\\s*--.*(?:\\R|$)", "");
            for (String statement : script.split(";")) {
                String sql = statement.trim();
                if (sql.isEmpty()) continue;
                try (Statement st = conn.createStatement()) {
                    st.execute(sql);
                } catch (SQLException e) {
                    if (!isDuplicateColumn(e) && !isMissingDroppedColumn(e, sql)) throw e;
                    log.info("[schema] 跳过已存在或不存在的列: {}", sql);
                }
            }
        } catch (IOException e) {
            throw new SQLException("读取迁移脚本失败: " + path, e);
        }
    }

    private static boolean isDuplicateColumn(SQLException e) {
        String message = e.getMessage();
        return message != null && message.toLowerCase(java.util.Locale.ROOT).contains("duplicate column name");
    }

    private static boolean isMissingDroppedColumn(SQLException e, String sql) {
        String message = e.getMessage();
        return sql.startsWith("ALTER TABLE media DROP COLUMN")
                && message != null
                && message.toLowerCase(java.util.Locale.ROOT).contains("no such column");
    }
}
