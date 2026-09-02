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
 * test classpath 提供 v02-v10；最新版本 = 10。
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
        // test classpath 提供 v02-v11 → 最新 = 11
        assertEquals(11, migrator.latestVersion());
    }

    @Test
    @DisplayName("全新库（user_version=0）直接初始化为最新版本")
    void freshDatabaseInitializesToLatest() throws Exception {
        migrator.run(null);
        assertEquals(11, readUserVersion());
    }

    @Test
    @DisplayName("user_version 为 0 的遗留库也会清理废弃元数据结构")
    void legacyUnversionedDatabaseRunsCleanup() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, original_title TEXT, cover_url TEXT, source TEXT)");
            st.execute("CREATE TABLE episode (id INTEGER PRIMARY KEY AUTOINCREMENT, media_id INTEGER NOT NULL, media_entry_id INTEGER, season INTEGER, episode_no INTEGER, title TEXT NOT NULL, note TEXT, url TEXT, video_fp TEXT, cover_path TEXT, created_at INTEGER)");
            st.execute("CREATE TABLE metadata_sync_task (id INTEGER PRIMARY KEY, task_id TEXT)");
        }
        migrator.run(null);
        Set<String> cols = tableColumns("media");
        assertEquals(11, readUserVersion());
        assertTrue(!cols.contains("original_title"));
        assertTrue(!cols.contains("cover_url"));
        assertTrue(!cols.contains("source"));
        assertTrue(tableExists("metadata_sync_task"));
        assertTrue(tableExists("metadata_sync_draft"));
        assertTrue(tableExists("metadata_sync_task_item"));
    }

    @Test
    @DisplayName("无版本号的新同步库不会再次删除任务表")
    void unversionedCurrentMetadataKeepsTaskTables() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)");
            st.execute("CREATE TABLE highlight_project (id INTEGER PRIMARY KEY)");
            st.execute("CREATE TABLE highlight_export (id INTEGER PRIMARY KEY, stage TEXT)");
            st.execute("CREATE TABLE episode (id INTEGER PRIMARY KEY, media_id INTEGER NOT NULL, media_entry_id INTEGER)");
            st.execute("CREATE TABLE metadata_sync_draft (id INTEGER PRIMARY KEY, provider TEXT NOT NULL, query_json TEXT NOT NULL, candidates_json TEXT NOT NULL, review_json TEXT NOT NULL, view_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
            st.execute("CREATE TABLE metadata_sync_task (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL)");
            st.execute("CREATE TABLE clips (id INTEGER PRIMARY KEY, start_ms INTEGER, video_asset_id INTEGER, time_mapping_id INTEGER, material_state TEXT)");
            st.execute("CREATE TABLE video_source_package (id INTEGER PRIMARY KEY)");
            st.execute("CREATE TABLE video_source_subscription (id INTEGER PRIMARY KEY)");
            st.execute("INSERT INTO metadata_sync_task (task_id) VALUES ('keep-me')");
            st.execute("PRAGMA user_version = 0");
        }
        migrator.run(null);
        assertEquals(11, readUserVersion());
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT task_id FROM metadata_sync_task WHERE task_id = 'keep-me'")) {
            assertTrue(rs.next(), "新版无版本号数据库中的任务数据应保留");
        }
    }

    @Test
    @DisplayName("v1 老库逐步升级到 v10")
    void oldDatabaseMigratesStepByStep() throws Exception {
        // 模拟 v1 结构的库：media 表只有基础列，user_version=1
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)");
            st.execute("CREATE TABLE episode (id INTEGER PRIMARY KEY AUTOINCREMENT, media_id INTEGER NOT NULL, season INTEGER, episode_no INTEGER, title TEXT NOT NULL, note TEXT, url TEXT, video_fp TEXT, cover_path TEXT, created_at INTEGER)");
            st.execute("CREATE TABLE clips (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, timestamp_sec REAL NOT NULL, tag TEXT NOT NULL, note TEXT, created_at INTEGER NOT NULL, episode_id INTEGER, video_fp TEXT, video_duration REAL, cover_path TEXT, detail_cover_path TEXT)");
            st.execute("PRAGMA user_version = 1");
        }
        migrator.run(null);
        assertEquals(11, readUserVersion());
        // v02-v10 迁移应保留原有列，并创建资料库、片源、资产和数据源订阅结构
        Set<String> cols = tableColumns("media");
        assertTrue(cols.contains("title"), "原有列应保留");
        assertTrue(tableExists("highlight_project"), "高光项目表应存在");
        assertTrue(tableExists("external_work"), "外部作品表应存在");
        assertTrue(tableExists("external_episode"), "外部集表应存在");
        assertTrue(tableExists("media_entry"), "作品条目表应存在");
        assertTrue(tableColumns("episode").contains("media_entry_id"), "集条目归属列应存在");
        assertTrue(tableExists("metadata_sync_task"), "新版同步任务表应被重新创建");
        assertTrue(tableExists("metadata_sync_draft"), "同步草稿表应存在");
        assertTrue(tableExists("metadata_sync_task_item"), "同步任务项表应存在");
        assertTrue(!tableExists("metadata_sync_candidate"), "旧同步候选表应被物理删除");
        assertTrue(tableExists("video_source_package"), "片源包表应存在");
        assertTrue(tableExists("video_source_subscription"), "数据源订阅表应存在");
        assertTrue(tableExists("video_source_definition"), "数据源定义表应存在");
        assertTrue(tableExists("video_source_instance"), "数据源实例表应存在");
        assertTrue(tableExists("video_asset"), "视频资产表应存在");
        assertTrue(tableColumns("clips").contains("start_ms"), "Clip 毫秒开始时间应存在");
        assertTrue(tableColumns("episode").contains("watched_at"), "v0.24 Animeko 观看导入列应存在");
        assertTrue(tableColumns("clips").contains("channel_hints"), "v0.24 M3 素材渠道线索列应存在");
    }

    @Test
    @DisplayName("基线已建高光表的 v2 老库升级不会重复建表且能继续到 v5")
    void existingBaselineTablesDoNotBlockV03() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE highlight_project (id INTEGER PRIMARY KEY, updated_at INTEGER)");
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, created_at INTEGER)");
            st.execute("CREATE TABLE highlight_project_item (id INTEGER PRIMARY KEY, project_id INTEGER, sort_order INTEGER, clip_id INTEGER)");
            st.execute("CREATE TABLE highlight_export (id INTEGER PRIMARY KEY, project_id INTEGER, created_at INTEGER, status TEXT)");
            st.execute("CREATE TABLE episode (id INTEGER PRIMARY KEY AUTOINCREMENT, media_id INTEGER NOT NULL, season INTEGER, episode_no INTEGER, title TEXT NOT NULL, note TEXT, url TEXT, video_fp TEXT, cover_path TEXT, created_at INTEGER)");
            st.execute("PRAGMA user_version = 2");
        }
        migrator.run(null);
        assertEquals(11, readUserVersion());
        assertTrue(tableExists("highlight_project"));
    }

    @Test
    @DisplayName("v3 高光导出表升级到 v5 增加诊断字段和资料库")
    void exportDiagnosticsMigrateFromV03() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE highlight_export (id INTEGER PRIMARY KEY, project_id INTEGER, created_at INTEGER, status TEXT)");
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, created_at INTEGER)");
            st.execute("CREATE TABLE episode (id INTEGER PRIMARY KEY AUTOINCREMENT, media_id INTEGER NOT NULL, season INTEGER, episode_no INTEGER, title TEXT NOT NULL, note TEXT, url TEXT, video_fp TEXT, cover_path TEXT, created_at INTEGER)");
            st.execute("PRAGMA user_version = 3");
        }
        migrator.run(null);
        assertEquals(11, readUserVersion());
        assertTrue(tableColumns("highlight_export").contains("stage"));
        assertTrue(tableColumns("highlight_export").contains("scene_message"));
    }

    @Test
    @DisplayName("v5 资料库升级到 v10 会替换同步模型并增加视频资产结构")
    void v05DatabaseDropsRetiredMetadataStructures() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, original_title TEXT, cover_url TEXT, source TEXT, aliases TEXT, created_at INTEGER)");
            st.execute("CREATE TABLE episode (id INTEGER PRIMARY KEY AUTOINCREMENT, media_id INTEGER NOT NULL, media_entry_id INTEGER, season INTEGER, episode_no INTEGER, title TEXT NOT NULL, note TEXT, url TEXT, video_fp TEXT, cover_path TEXT, created_at INTEGER)");
            st.execute("CREATE TABLE metadata_sync_task (id INTEGER PRIMARY KEY, task_id TEXT)");
            st.execute("CREATE TABLE metadata_sync_candidate (id INTEGER PRIMARY KEY, task_id INTEGER)");
            st.execute("PRAGMA user_version = 5");
        }
        migrator.run(null);
        Set<String> cols = tableColumns("media");
        assertEquals(11, readUserVersion());
        assertTrue(!cols.contains("original_title"), "原标题列应被物理删除");
        assertTrue(!cols.contains("cover_url"), "外部封面列应被物理删除");
        assertTrue(!cols.contains("source"), "来源列应被物理删除");
        assertTrue(tableExists("metadata_sync_task"), "新版同步任务表应被重新创建");
        assertTrue(tableExists("metadata_sync_draft"), "同步草稿表应存在");
        assertTrue(tableExists("metadata_sync_task_item"), "同步任务项表应存在");
        assertTrue(!tableExists("metadata_sync_candidate"), "旧同步候选表应被物理删除");
        assertTrue(tableExists("video_source_task"), "视频源任务表应存在");
    }

    @Test
    @DisplayName("v7 Clip 时间升级到 v10 会回填毫秒字段且保持引用状态")
    void v07ClipTimesBackfillToMilliseconds() throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE clips (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, timestamp_sec REAL NOT NULL, end_sec REAL, tag TEXT NOT NULL, note TEXT, created_at INTEGER NOT NULL, episode_id INTEGER, video_fp TEXT, video_duration REAL, cover_path TEXT, detail_cover_path TEXT)");
            st.execute("CREATE TABLE episode (id INTEGER PRIMARY KEY AUTOINCREMENT, media_id INTEGER NOT NULL, media_entry_id INTEGER, season INTEGER, episode_no INTEGER, title TEXT NOT NULL, note TEXT, url TEXT, video_fp TEXT, cover_path TEXT, created_at INTEGER)");
            st.execute("INSERT INTO clips (title, url, timestamp_sec, end_sec, tag, created_at) VALUES ('片段', 'local.mp4', 12.345, 18.9, '测试', 1)");
            st.execute("PRAGMA user_version = 7");
        }
        migrator.run(null);
        assertEquals(11, readUserVersion());
        assertTrue(tableExists("video_source_package"));
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT start_ms, end_ms, material_state FROM clips WHERE id = 1")) {
            assertTrue(rs.next());
            assertEquals(12345L, rs.getLong("start_ms"));
            assertEquals(18900L, rs.getLong("end_ms"));
            assertEquals("REFERENCE_ONLY", rs.getString("material_state"));
        }
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
