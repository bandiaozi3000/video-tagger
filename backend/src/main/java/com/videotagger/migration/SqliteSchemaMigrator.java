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
import org.springframework.core.io.support.EncodedResource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
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
 *   <li>版本为 0（全新库或首次部署迁移器）：视为当前结构，直接初始化到最新版本——
 *       首次部署时所有现存库就是当前 schema（桌面版只有一个历史结构），无需补迁移。</li>
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
        if (datasourceUrl == null || !datasourceUrl.startsWith("jdbc:sqlite:")) {
            return; // MySQL profile：Flyway 负责，不掺和
        }
        migrate();
    }

    void migrate() {
        try (Connection conn = dataSource.getConnection()) {
            int latest = latestVersion();
            int current = readUserVersion(conn);
            if (current == 0) {
                // 全新库（spring.sql.init 已建全表）或首次部署：直接标记最新
                writeUserVersion(conn, latest);
                log.info("[schema] SQLite user_version 初始化为 {}（最新）", latest);
                return;
            }
            for (int v = current + 1; v <= latest; v++) {
                runMigrationScript(conn, v);
                writeUserVersion(conn, v);
                log.info("[schema] SQLite 已迁移到 schema 版本 {}", v);
            }
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

    private void writeUserVersion(Connection conn, int version) throws SQLException {
        try (Statement st = conn.createStatement()) {
            st.execute("PRAGMA user_version = " + version);
        }
    }

    private void runMigrationScript(Connection conn, int version) throws SQLException {
        String path = MIGRATIONS_DIR + "/v" + String.format("%02d", version) + ".sql";
        ScriptUtils.executeSqlScript(conn,
                new EncodedResource(new ClassPathResource(path), StandardCharsets.UTF_8));
    }
}
