package com.videotagger.migration;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SqliteSchemaMigrator 单测（内存 SQLite，不启 Spring 上下文）。
 * test classpath 提供 v02.sql；v03 与生产高光迁移保持一致，故最新版本 = 4。
 */
class SqliteSchemaMigratorTest {

    private Connection conn;
    private SqliteSchemaMigrator migrator;

    @BeforeEach
    void setUp() throws SQLException {
        conn = DriverManager.getConnection("jdbc:sqlite::memory:");
        DataSource ds = new SingleConnectionDataSource(conn, true);
        migrator = new SqliteSchemaMigrator(ds, "jdbc:sqlite::memory:");
    }

    @AfterEach
    void tearDown() throws SQLException {
        if (conn != null) conn.close();
    }

    @Test
    @DisplayName("最新版本 = max(基线1, migration-sqlite 目录里最大 vNN)")
    void latestVersionTracksScripts() throws Exception {
        // test classpath 提供 v02/v03/v04 → 最新 = 4
        assertEquals(4, migrator.latestVersion());
    }

    @Test
    @DisplayName("全新库（user_version=0）直接初始化为最新版本")
    void freshDatabaseInitializesToLatest() throws Exception {
        migrator.run(null);
        assertEquals(4, readUserVersion());
    }

    @Test
    @DisplayName("老库（user_version=1）按序执行 v02/v03/v04 迁移到最新")
    void oldDatabaseMigratesStepByStep() throws Exception {
        // 模拟 v1 结构的库：media 表只有基础列，user_version=1
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)");
            st.execute("PRAGMA user_version = 1");
        }
        migrator.run(null);
        assertEquals(4, readUserVersion());
        // v02 的 ALTER 与真实 v03 高光表迁移应均已生效
        Set<String> cols = tableColumns("media");
        assertTrue(cols.contains("test_col"), "v02 加列 test_col 应生效");
        assertTrue(cols.contains("title"), "原有列应保留");
        assertTrue(tableExists("highlight_project"), "v03 应创建高光项目表");
        assertTrue(tableExists("highlight_project_item"), "v03 应创建高光项目段表");
        assertTrue(tableExists("highlight_export"), "v03 应创建高光导出表");
        assertTrue(tableColumns("highlight_export").contains("stage"), "v04 应增加导出阶段字段");
    }

    @Test
    @DisplayName("基线已建高光表的 v2 老库升级到 v3 不会重复建表失败")
    void existingBaselineTablesDoNotBlockV03() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE highlight_project (id INTEGER PRIMARY KEY, updated_at INTEGER)");
            st.execute("CREATE TABLE highlight_project_item (id INTEGER PRIMARY KEY, project_id INTEGER, sort_order INTEGER, clip_id INTEGER)");
            st.execute("CREATE TABLE highlight_export (id INTEGER PRIMARY KEY, project_id INTEGER, created_at INTEGER, status TEXT)");
            st.execute("PRAGMA user_version = 2");
        }
        migrator.run(null);
        assertEquals(4, readUserVersion());
        assertTrue(tableExists("highlight_project"));
    }

    @Test
    @DisplayName("v3 高光导出表升级到 v4 增加诊断字段")
    void exportDiagnosticsMigrateFromV03() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE highlight_export (id INTEGER PRIMARY KEY, project_id INTEGER, created_at INTEGER, status TEXT)");
            st.execute("PRAGMA user_version = 3");
        }
        migrator.run(null);
        assertEquals(4, readUserVersion());
        assertTrue(tableColumns("highlight_export").contains("stage"));
        assertTrue(tableColumns("highlight_export").contains("scene_message"));
    }

    @Test
    @DisplayName("已是最新版本不重复迁移")
    void upToDateDatabaseSkipsMigration() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)");
            st.execute("PRAGMA user_version = 4");
        }
        migrator.run(null);
        assertEquals(4, readUserVersion());
        assertTrue(tableColumns("media").isEmpty() || !tableColumns("media").contains("test_col"),
                "已最新则不该执行 v02 加列");
        assertTrue(!tableExists("highlight_project"), "已最新则不该执行 v03 建表");
    }

    @Test
    @DisplayName("MySQL 数据源跳过迁移")
    void mysqlDatasourceSkipped() throws Exception {
        // 仅验证 url 判断：mysql 前缀不触发（run 里 return，不抛异常即通过）
        SqliteSchemaMigrator mysqlMigrator =
                new SqliteSchemaMigrator(new SingleConnectionDataSource(conn, true),
                        "jdbc:mysql://localhost:3306/video_tagger");
        mysqlMigrator.run(null); // 不抛异常 = 跳过成功
        assertEquals(0, readUserVersion(), "mysql 场景不动 sqlite 版本");
    }

    private int readUserVersion() throws SQLException {
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("PRAGMA user_version")) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private boolean tableExists(String table) throws SQLException {
        try (var ps = conn.prepareStatement("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")) {
            ps.setString(1, table);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private Set<String> tableColumns(String table) throws SQLException {
        Set<String> cols = new HashSet<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (rs.next()) cols.add(rs.getString("name"));
        }
        return cols;
    }
}
