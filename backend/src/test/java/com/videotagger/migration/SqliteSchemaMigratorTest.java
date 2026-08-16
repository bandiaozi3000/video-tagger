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
 * test classpath 提供 v02.sql / v03.sql（仅测试专用），故最新版本 = 3。
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
        // test classpath 有 v02/v03.sql → 最新 = 3
        assertEquals(3, migrator.latestVersion());
    }

    @Test
    @DisplayName("全新库（user_version=0）直接初始化为最新版本")
    void freshDatabaseInitializesToLatest() throws Exception {
        migrator.run(null);
        assertEquals(3, readUserVersion());
    }

    @Test
    @DisplayName("老库（user_version=1）按序执行 v02/v03 迁移到最新")
    void oldDatabaseMigratesStepByStep() throws Exception {
        // 模拟 v1 结构的库：media 表只有基础列，user_version=1
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)");
            st.execute("PRAGMA user_version = 1");
        }
        migrator.run(null);
        assertEquals(3, readUserVersion());
        // v02/v03 的 ALTER 应已生效
        Set<String> cols = tableColumns("media");
        assertTrue(cols.contains("test_col"), "v02 加列 test_col 应生效");
        assertTrue(cols.contains("test_col2"), "v03 加列 test_col2 应生效");
        assertTrue(cols.contains("title"), "原有列应保留");
    }

    @Test
    @DisplayName("已是最新版本不重复迁移")
    void upToDateDatabaseSkipsMigration() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)");
            st.execute("PRAGMA user_version = 3");
        }
        migrator.run(null);
        assertEquals(3, readUserVersion());
        assertTrue(tableColumns("media").isEmpty() || !tableColumns("media").contains("test_col"),
                "已最新则不该执行 v02 加列");
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

    private Set<String> tableColumns(String table) throws SQLException {
        Set<String> cols = new HashSet<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("PRAGMA table_info(" + table + ")")) {
            while (rs.next()) cols.add(rs.getString("name"));
        }
        return cols;
    }
}
