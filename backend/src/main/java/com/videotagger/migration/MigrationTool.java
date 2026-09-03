package com.videotagger.migration;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * 一次性数据迁移工具：MySQL → SQLite。
 *
 * 用法：
 *   java -cp <backend.jar> com.videotagger.migration.MigrationTool \
 *     --mysql-url=jdbc:mysql://localhost:3306/video_tagger?... \
 *     --mysql-user=root --mysql-pass=root123456 \
 *     --sqlite=path/to/video_tagger.db \
 *     [--schema=classpath 路径，默认 db/sqlite-schema.sql] \
 *     [--covers-src=现有本地封面目录 data/covers] \
 *     [--covers-dst=目标封面目录（默认 sqlite 同目录下 covers/）]
 *
 * 行为：
 *   1. 目标 SQLite 库已存在则先删除（全新迁移）
 *   2. 执行 sqlite-schema.sql 建 18 张表 + 种子数据
 *   3. 按外键依赖序从 MySQL 读表 → 写入 SQLite（保留原始 id，保证关联不破）
 *   4. 行数校验：每表 MySQL 行数 == SQLite 行数，不一致则报错退出
 *   5. 封面文件：cover_path 存本地相对路径（/covers/xxx.jpg，非 MinIO），整个 covers 目录拷贝到目标数据目录
 *
 * 说明：不依赖 Spring 上下文，纯 JDBC 双连接。迁移幂等（目标库全新重建）。
 */
public class MigrationTool {

    public static void main(String[] args) throws Exception {
        String mysqlUrl = arg(args, "--mysql-url");
        String mysqlUser = arg(args, "--mysql-user");
        String mysqlPass = arg(args, "--mysql-pass");
        String sqlitePath = arg(args, "--sqlite");
        String schemaPath = arg(args, "--schema"); // 可空：文件路径；默认从 classpath 读 db/sqlite-schema.sql
        String coversSrc = arg(args, "--covers-src"); // 可空：现有本地封面目录（data/covers）
        String coversDst = arg(args, "--covers-dst"); // 可空：目标封面目录，默认 sqlite 同目录 covers/

        if (mysqlUrl == null || sqlitePath == null) {
            System.err.println("用法: --mysql-url --mysql-user --mysql-pass --sqlite [--schema] [--covers-src] [--covers-dst]");
            System.exit(2);
        }

        // 目标库：先删旧建新（全新迁移，幂等）
        Path sqliteFile = Path.of(sqlitePath);
        Files.deleteIfExists(sqliteFile);
        if (sqliteFile.getParent() != null) Files.createDirectories(sqliteFile.getParent());

        Class.forName("com.mysql.cj.jdbc.Driver");
        Class.forName("org.sqlite.JDBC");

        try (Connection mysql = DriverManager.getConnection(mysqlUrl, mysqlUser, mysqlPass);
             Connection sqlite = DriverManager.getConnection("jdbc:sqlite:" + sqlitePath)) {
            sqlite.setAutoCommit(false);
            // 1. 建表。SQLite JDBC 的 Statement.execute 只执行第一条语句，须逐条执行；
            //    且 schema 里注释行会与 CREATE 语句粘在同一段（split(";") 无法区分），
            //    改为逐行处理：跳过纯注释行，非注释内容按分号累积分句执行。
            String schemaSql = schemaPath != null && !schemaPath.isBlank()
                    ? new String(Files.readAllBytes(Path.of(schemaPath)), StandardCharsets.UTF_8)
                    : new String(MigrationTool.class.getResourceAsStream("/db/sqlite-schema.sql").readAllBytes(), StandardCharsets.UTF_8);
            Statement schemaSt = sqlite.createStatement();
            int idx = 0;
            StringBuilder buf = new StringBuilder();
            for (String line : schemaSql.split("\n")) {
                String l = line.trim();
                if (l.startsWith("--")) continue;         // 整行注释：跳过
                buf.append(line).append('\n');
                if (l.endsWith(";")) {                     // 语句结束（分号收尾）
                    String s = buf.toString().trim();
                    buf.setLength(0);
                    if (s.isEmpty()) continue;
                    idx++;
                    try {
                        schemaSt.execute(s);
                    } catch (Exception e) {
                        System.err.println("[migrate] schema 第 " + idx + " 条语句失败: " + s.substring(0, Math.min(80, s.length())));
                        throw e;
                    }
                }
            }
            System.out.println("[migrate] schema 建表完成（" + idx + " 条语句）");

            long t0 = System.currentTimeMillis();

            // 2. 按依赖序迁移（保留原 id）
            migrateTable(mysql, sqlite, "media",
                    "SELECT id, title, year, season, aliases, note, media_format, subcategory, subcategory_id, status, rating, cover_path, confirmed, created_at, deleted_at FROM media");
            migrateTable(mysql, sqlite, "media_entry",
                    "SELECT id, media_id, entry_type, sort_order, title, title_cn, note, created_at, updated_at FROM media_entry");
            migrateTable(mysql, sqlite, "external_work",
                    "SELECT id, provider, external_id, media_id, media_entry_id, canonical_title, native_title, romaji_title, english_title, aliases_json, description, cover_url, genres_json, format, year, season, air_date, end_date, episode_count, relations_json, raw_json, payload_hash, sync_state, last_fetched_at, last_success_at, last_error, created_at, updated_at FROM external_work");
            migrateTable(mysql, sqlite, "external_episode",
                    "SELECT id, external_work_id, provider_episode_id, episode_id, season, episode_no, title, title_cn, description, air_date, duration_sec, last_seen_at, sync_state, created_at, updated_at FROM external_episode");
            migrateTable(mysql, sqlite, "external_relation",
                    "SELECT id, external_work_id, provider, related_external_id, relation_type, title, created_at FROM external_relation");
            migrateTable(mysql, sqlite, "metadata_sync_draft",
                    "SELECT id, provider, query_json, candidates_json, review_json, view_json, created_at, updated_at FROM metadata_sync_draft");
            migrateTable(mysql, sqlite, "metadata_sync_task",
                    "SELECT id, task_id, provider, scope_type, query_json, status, stage, total, selected_total, create_count, update_count, link_count, skip_count, processed, succeeded, failed, pending_review, summary_json, error_message, created_at, started_at, completed_at, retention_until, updated_at FROM metadata_sync_task");
            migrateTable(mysql, sqlite, "metadata_sync_task_item",
                    "SELECT id, task_id, provider, external_id, title, title_cn, action, target_media_id, status, stage, error_message, attempts, last_attempt_at, snapshot_json, created_at, updated_at FROM metadata_sync_task_item");
            migrateTable(mysql, sqlite, "episode",
                    "SELECT id, media_id, media_entry_id, episode_no, title, title_override, note, url, video_fp, cover_path, created_at FROM episode");
            migrateTable(mysql, sqlite, "clips",
                    "SELECT id, title, url, timestamp_sec, end_sec, tag, note, created_at, episode_id, video_asset_id, source_revision, time_mapping_id, material_state, video_fp, video_duration, cover_path, detail_cover_path, start_ms, end_ms FROM clips");
            migrateTable(mysql, sqlite, "video_source_package",
                    "SELECT id, media_entry_id, provider, provider_package_id, revision, status, title, release_group, year, season, media_format, episode_count, subtitle_languages_json, audio_languages_json, quality, video_codec, container, capabilities_json, source_page_url, sanitized_snapshot_json, match_reason_json, adopted_at, last_refreshed_at, created_at, updated_at FROM video_source_package");
            migrateTable(mysql, sqlite, "video_source_item",
                    "SELECT id, package_id, provider_item_id, revision, item_kind, episode_no, episode_end_no, title, duration_ms, subtitle_languages_json, audio_languages_json, quality, capabilities_json, source_page_url, sanitized_snapshot_json, status, last_seen_at, created_at, updated_at FROM video_source_item");
            migrateTable(mysql, sqlite, "video_source_episode_map",
                    "SELECT id, source_item_id, episode_id, mapping_reason, confidence, status, manual_confirmed, conflict_code, conflict_message, created_at, updated_at FROM video_source_episode_map");
            migrateTable(mysql, sqlite, "video_source_resolution_cache",
                    "SELECT id, source_item_id, revision, purpose, selection_key, resolved_locator, mime_type, content_length, range_supported, probe_state, probe_message, retryable, resolved_at, expires_at, checked_at, created_at, updated_at FROM video_source_resolution_cache");
            migrateTable(mysql, sqlite, "video_source_subscription",
                    "SELECT id, display_name, url, enabled, refresh_interval_minutes, status, etag, last_modified, last_attempt_at, last_success_at, source_count, error_message, snapshot_json, created_at, updated_at FROM video_source_subscription");
            migrateTable(mysql, sqlite, "video_source_definition",
                    "SELECT id, subscription_id, import_key, factory_id, format_version, name, description, icon_url, config_json, tier, compatibility, status, last_seen_at, created_at, updated_at FROM video_source_definition");
            migrateTable(mysql, sqlite, "video_source_instance",
                    "SELECT id, definition_id, provider_id, enabled, sort_order, health_state, health_message, last_tested_at, last_success_at, failure_count, created_at, updated_at FROM video_source_instance");
            migrateTable(mysql, sqlite, "video_asset",
                    "SELECT id, episode_id, source_item_id, asset_type, asset_role, priority, availability_state, source_revision, display_name, stable_locator, source_page_url, storage_path, mime_type, duration_ms, container, video_codec, audio_codec, width, height, file_size, fingerprint, failure_reason, last_verified_at, created_at, updated_at FROM video_asset");
            migrateTable(mysql, sqlite, "video_asset_track",
                    "SELECT id, video_asset_id, track_type, track_index, language, title, format, codec, default_track, forced_track, external_locator, storage_path, created_at, updated_at FROM video_asset_track");
            migrateTable(mysql, sqlite, "video_time_mapping",
                    "SELECT id, old_asset_id, new_asset_id, parent_mapping_id, status, offset_ms, drift_ratio, confidence, notes, created_at, confirmed_at, updated_at FROM video_time_mapping");
            migrateTable(mysql, sqlite, "video_time_mapping_anchor",
                    "SELECT id, time_mapping_id, sort_order, old_time_ms, new_time_ms, confidence, created_at FROM video_time_mapping_anchor");
            migrateTable(mysql, sqlite, "video_source_task",
                    "SELECT id, task_id, task_type, provider, status, package_id, video_asset_id, clip_id, total, processed, succeeded, failed, bytes_total, bytes_processed, plan_json, message, created_at, started_at, completed_at, updated_at FROM video_source_task");
            migrateTable(mysql, sqlite, "video_source_task_item",
                    "SELECT id, task_id, item_key, task_type, provider, status, source_item_id, video_asset_id, clip_id, bytes_total, bytes_processed, attempts, temp_path, resume_json, error_code, error_message, last_attempt_at, created_at, updated_at FROM video_source_task_item");
            migrateTable(mysql, sqlite, "tag",
                    "SELECT id, name, created_at FROM tag");
            migrateTable(mysql, sqlite, "media_tag",
                    "SELECT media_id, tag_id FROM media_tag");
            migrateTable(mysql, sqlite, "episode_tag",
                    "SELECT episode_id, tag_id FROM episode_tag");
            migrateTable(mysql, sqlite, "clip_tag",
                    "SELECT clip_id, tag_id FROM clip_tag");
            migrateTable(mysql, sqlite, "embedding_tasks",
                    "SELECT id, entity_type, entity_id, status, retry_count, updated_at FROM embedding_tasks");
            migrateTable(mysql, sqlite, "collection",
                    "SELECT id, name, created_at FROM collection");
            migrateTable(mysql, sqlite, "media_collection",
                    "SELECT media_id, collection_id FROM media_collection");
            migrateTable(mysql, sqlite, "media_format",
                    "SELECT id, code, name, has_children, sort, created_at FROM media_format");
            migrateTable(mysql, sqlite, "media_subcategory",
                    "SELECT id, format_id, parent_id, name, sort, created_at FROM media_subcategory");
            migrateTable(mysql, sqlite, "site_setting",
                    "SELECT skey, value FROM site_setting");
            migrateTable(mysql, sqlite, "recommend_draft",
                    "SELECT id, config, updated_at FROM recommend_draft");
            migrateTable(mysql, sqlite, "recommend_template",
                    "SELECT id, name, config, created_at FROM recommend_template");
            migrateTable(mysql, sqlite, "title_mapping",
                    "SELECT title, media_id, created_at FROM title_mapping");

            sqlite.commit();
            System.out.printf("[migrate] 数据迁移完成，耗时 %.1fs%n", (System.currentTimeMillis() - t0) / 1000.0);

            // 3. 封面文件拷贝（cover_path 存本地相对路径 /covers/xxx.jpg，整个目录拷到目标数据目录）
            if (coversSrc != null && !coversSrc.isBlank()) {
                Path src = Path.of(coversSrc);
                if (!Files.isDirectory(src)) {
                    System.err.println("[migrate] 警告: covers-src 不是目录，跳过封面拷贝: " + coversSrc);
                } else {
                    Path dst = coversDst != null && !coversDst.isBlank()
                            ? Path.of(coversDst)
                            : sqliteFile.getParent().resolve("covers");
                    Files.createDirectories(dst);
                    long copied = 0;
                    try (var files = Files.list(src)) {
                        for (Path f : files.toList()) {
                            if (Files.isRegularFile(f)) {
                                Files.copy(f, dst.resolve(f.getFileName()), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                                copied++;
                            }
                        }
                    }
                    System.out.printf("[migrate] 封面拷贝完成：%d 个文件 → %s%n", copied, dst);
                }
            }
        }
    }

    /** 通用迁移：读 MySQL 全表列 → 按列名写 SQLite（动态列，保留 id）。 */
    static void migrateTable(Connection mysql, Connection sqlite, String table, String selectSql) throws Exception {
        // 动态读列数
        String mysqlCount = "SELECT COUNT(*) FROM " + table;
        long srcCount;
        try (Statement st = mysql.createStatement(); ResultSet rs = st.executeQuery(mysqlCount)) {
            rs.next(); srcCount = rs.getLong(1);
        }

        String insertSql;
        try (Statement st = mysql.createStatement(); ResultSet rs = st.executeQuery(selectSql + " LIMIT 0")) {
            int cols = rs.getMetaData().getColumnCount();
            String[] colNames = new String[cols];
            for (int i = 0; i < cols; i++) colNames[i] = rs.getMetaData().getColumnLabel(i + 1);
            String colList = String.join(", ", colNames);
            String marks = String.join(", ", java.util.Collections.nCopies(cols, "?"));
            insertSql = "INSERT OR IGNORE INTO " + table + " (" + colList + ") VALUES (" + marks + ")";
        }

        long written = 0;
        try (Statement st = mysql.createStatement();
             ResultSet rs = st.executeQuery(selectSql);
             PreparedStatement ps = sqlite.prepareStatement(insertSql)) {
            while (rs.next()) {
                for (int i = 0; i < rs.getMetaData().getColumnCount(); i++) {
                    Object v = rs.getObject(i + 1);
                    ps.setObject(i + 1, v);
                }
                ps.addBatch();
                if (++written % 1000 == 0) {
                    ps.executeBatch();
                    sqlite.commit();
                }
            }
            ps.executeBatch();
            sqlite.commit();
        }

        // 行数校验
        long dstCount;
        try (Statement st = sqlite.createStatement(); ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM " + table)) {
            rs.next(); dstCount = rs.getLong(1);
        }
        String status = srcCount == dstCount ? "OK" : "MISMATCH!";
        System.out.printf("[migrate] %-18s 源 %-8d 目标 %-8d %s%n", table, srcCount, dstCount, status);
        if (srcCount != dstCount) {
            throw new IllegalStateException("表 " + table + " 迁移行数不一致: 源 " + srcCount + " 目标 " + dstCount);
        }
    }

    static String arg(String[] args, String key) {
        for (String a : args) {
            if (a.startsWith(key + "=")) return a.substring(key.length() + 1);
        }
        return null;
    }
}
