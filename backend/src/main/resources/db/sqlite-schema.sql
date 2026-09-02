-- Video Tagger SQLite 数据库 schema（桌面版唯一数据源）
-- 由 MySQL 迁移链（V1~V19）转换而来：列集合与实体字段完全对齐，语法为 SQLite。
-- 说明：
--   * 所有 id 用 INTEGER PRIMARY KEY AUTOINCREMENT（SQLite 自增主键）
--   * TEXT 代替 VARCHAR/TEXT/LONGTEXT；INTEGER 代替 INT/TINYINT；REAL 代替 DOUBLE/DECIMAL
--   * 不再有 ngram 全文索引（搜索走 LIKE 兜底，D11）；外键索引保留
--   * 由 Spring 启动时执行（spring.sql.init 或应用内脚本），幂等（IF NOT EXISTS）

-- ============ 媒体 ============
CREATE TABLE IF NOT EXISTS media (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    year            INTEGER,
    aliases         TEXT,
    note            TEXT,
    media_format    TEXT NOT NULL DEFAULT 'VIDEO',
    subcategory     TEXT,
    subcategory_id  INTEGER,
    status          TEXT NOT NULL DEFAULT 'WANT',
    rating          REAL,
    cover_path      TEXT,
    confirmed       INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER,
    deleted_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_media_format ON media(media_format);
CREATE INDEX IF NOT EXISTS idx_media_subcat ON media(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_media_deleted ON media(deleted_at);

-- ============ 集 ============
CREATE TABLE IF NOT EXISTS episode (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id        INTEGER NOT NULL,
    media_entry_id  INTEGER,
    season          INTEGER,
    episode_no      INTEGER,
    title           TEXT NOT NULL,
    title_override  INTEGER NOT NULL DEFAULT 1,
    note            TEXT,
    url             TEXT,
    video_fp        TEXT,
    cover_path      TEXT,
    created_at      INTEGER,
    watched_at      INTEGER,
    UNIQUE (video_fp)
);
CREATE INDEX IF NOT EXISTS idx_episode_media ON episode(media_id);

-- ============ 片段 ============
CREATE TABLE IF NOT EXISTS clips (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    title             TEXT NOT NULL,
    url               TEXT NOT NULL,
    timestamp_sec     REAL NOT NULL,
    end_sec           REAL,
    tag               TEXT NOT NULL,
    note              TEXT,
    created_at        INTEGER NOT NULL,
    episode_id        INTEGER,
    video_asset_id    INTEGER,
    source_revision   TEXT,
    time_mapping_id   INTEGER,
    material_state    TEXT NOT NULL DEFAULT 'REFERENCE_ONLY',
    video_fp          TEXT,
    video_duration    REAL,
    cover_path        TEXT,
    detail_cover_path TEXT,
    start_ms          INTEGER,
    end_ms            INTEGER
);
CREATE INDEX IF NOT EXISTS idx_clips_episode ON clips(episode_id);
CREATE INDEX IF NOT EXISTS idx_clips_video_fp ON clips(video_fp);
CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at);
-- These indexes are created by SqliteSchemaMigrator after legacy columns exist.

-- ============ 标签 ============
CREATE TABLE IF NOT EXISTS tag (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (name)
);

-- 三级标签关联（复合主键 = 幂等；配合 INSERT OR IGNORE 防并发冲突）
CREATE TABLE IF NOT EXISTS media_tag (
    media_id INTEGER NOT NULL,
    tag_id   INTEGER NOT NULL,
    PRIMARY KEY (media_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_media_tag_tag ON media_tag(tag_id);

CREATE TABLE IF NOT EXISTS episode_tag (
    episode_id INTEGER NOT NULL,
    tag_id     INTEGER NOT NULL,
    PRIMARY KEY (episode_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_episode_tag_tag ON episode_tag(tag_id);

CREATE TABLE IF NOT EXISTS clip_tag (
    clip_id INTEGER NOT NULL,
    tag_id  INTEGER NOT NULL,
    PRIMARY KEY (clip_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_clip_tag_tag ON clip_tag(tag_id);

-- ============ 向量任务（功能默认关，表保留结构一致） ============
CREATE TABLE IF NOT EXISTS embedding_tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id   INTEGER NOT NULL,
    status      TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL,
    UNIQUE (entity_type, entity_id)
);

-- ============ 收藏夹 ============
CREATE TABLE IF NOT EXISTS collection (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media_collection (
    media_id      INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    PRIMARY KEY (media_id, collection_id)
);
CREATE INDEX IF NOT EXISTS idx_media_collection_coll ON media_collection(collection_id);

-- ============ 媒体格式/子分类字典 ============
CREATE TABLE IF NOT EXISTS media_format (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    code         TEXT NOT NULL,
    name         TEXT NOT NULL,
    has_children INTEGER NOT NULL DEFAULT 0,
    sort         INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,
    UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS media_subcategory (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    format_id  INTEGER NOT NULL,
    parent_id  INTEGER NOT NULL DEFAULT 0,
    name       TEXT NOT NULL,
    sort       INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    UNIQUE (format_id, name)
);
CREATE INDEX IF NOT EXISTS idx_subcategory_format ON media_subcategory(format_id);

-- ============ 站点设置 / 推荐草稿模板 / 标题映射 ============
CREATE TABLE IF NOT EXISTS site_setting (
    skey TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS recommend_draft (
    id         INTEGER PRIMARY KEY,
    config     TEXT,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recommend_template (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    config     TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS title_mapping (
    title      TEXT PRIMARY KEY,
    media_id   INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

-- ============ 单媒体高光混剪项目 ============
CREATE TABLE IF NOT EXISTS highlight_project (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id    INTEGER NOT NULL,
    name        TEXT NOT NULL,
    config_json TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    UNIQUE (media_id)
);
CREATE INDEX IF NOT EXISTS idx_highlight_project_updated ON highlight_project(updated_at);

CREATE TABLE IF NOT EXISTS highlight_project_item (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL,
    clip_id         INTEGER,
    sort_order      INTEGER NOT NULL,
    in_sec          REAL,
    out_sec         REAL,
    spoiler_state   TEXT NOT NULL DEFAULT 'PENDING',
    caption         TEXT,
    source_type     TEXT NOT NULL DEFAULT 'LOCAL_LIBRARY',
    source_state    TEXT NOT NULL DEFAULT 'PENDING',
    source_path     TEXT,
    source_url      TEXT,
    source_message  TEXT,
    original_volume INTEGER NOT NULL DEFAULT 100,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_highlight_item_project_sort ON highlight_project_item(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_highlight_item_clip ON highlight_project_item(clip_id);

CREATE TABLE IF NOT EXISTS highlight_export (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL,
    mode          TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    output_path   TEXT,
    status        TEXT NOT NULL,
    message       TEXT,
    stage         TEXT,
    scene_message TEXT,
    created_at    INTEGER NOT NULL,
    finished_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_highlight_export_project_created ON highlight_export(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_highlight_export_status ON highlight_export(status);

-- ============ v0.22 番剧资料库与外部元信息缓存 ============
CREATE TABLE IF NOT EXISTS media_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL DEFAULT 'LEGACY',
    sort_order INTEGER NOT NULL DEFAULT 0,
    title TEXT,
    title_cn TEXT,
    note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (media_id, entry_type, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_media_entry_media ON media_entry(media_id);

CREATE TABLE IF NOT EXISTS external_work (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    media_id INTEGER,
    media_entry_id INTEGER,
    canonical_title TEXT,
    native_title TEXT,
    romaji_title TEXT,
    english_title TEXT,
    aliases_json TEXT,
    description TEXT,
    cover_url TEXT,
    genres_json TEXT,
    format TEXT,
    year INTEGER,
    season TEXT,
    air_date TEXT,
    end_date TEXT,
    episode_count INTEGER,
    relations_json TEXT,
    raw_json TEXT,
    payload_hash TEXT,
    sync_state TEXT NOT NULL DEFAULT 'NEVER_FETCHED',
    last_fetched_at INTEGER,
    last_success_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_external_work_media ON external_work(media_id);
CREATE INDEX IF NOT EXISTS idx_external_work_entry ON external_work(media_entry_id);
CREATE INDEX IF NOT EXISTS idx_external_work_sync ON external_work(sync_state);

CREATE TABLE IF NOT EXISTS external_episode (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_work_id INTEGER NOT NULL,
    provider_episode_id TEXT NOT NULL,
    episode_id INTEGER,
    season INTEGER,
    episode_no INTEGER,
    title TEXT,
    title_cn TEXT,
    description TEXT,
    air_date TEXT,
    duration_sec INTEGER,
    last_seen_at INTEGER,
    sync_state TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (external_work_id, provider_episode_id)
);
CREATE INDEX IF NOT EXISTS idx_external_episode_episode ON external_episode(episode_id);
CREATE INDEX IF NOT EXISTS idx_external_episode_state ON external_episode(sync_state);

CREATE TABLE IF NOT EXISTS external_relation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_work_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    related_external_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    title TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE (external_work_id, provider, related_external_id, relation_type)
);

-- v07: metadata synchronization workspace with one draft and persistent task items.
CREATE TABLE IF NOT EXISTS metadata_sync_draft (
    id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL,
    query_json TEXT NOT NULL,
    candidates_json TEXT NOT NULL,
    review_json TEXT NOT NULL,
    view_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS metadata_sync_task (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    query_json TEXT NOT NULL,
    status TEXT NOT NULL,
    stage TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    selected_total INTEGER NOT NULL DEFAULT 0,
    create_count INTEGER NOT NULL DEFAULT 0,
    update_count INTEGER NOT NULL DEFAULT 0,
    link_count INTEGER NOT NULL DEFAULT 0,
    skip_count INTEGER NOT NULL DEFAULT 0,
    processed INTEGER NOT NULL DEFAULT 0,
    succeeded INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    pending_review INTEGER NOT NULL DEFAULT 0,
    summary_json TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    retention_until INTEGER,
    updated_at INTEGER NOT NULL,
    UNIQUE (task_id)
);
CREATE INDEX IF NOT EXISTS idx_metadata_sync_task_status ON metadata_sync_task(status);
CREATE INDEX IF NOT EXISTS idx_metadata_sync_task_created ON metadata_sync_task(created_at);

CREATE TABLE IF NOT EXISTS metadata_sync_task_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT,
    title_cn TEXT,
    action TEXT NOT NULL,
    target_media_id INTEGER,
    status TEXT NOT NULL,
    stage TEXT NOT NULL,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    snapshot_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (task_id, provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_metadata_sync_item_task ON metadata_sync_task_item(task_id);
CREATE INDEX IF NOT EXISTS idx_metadata_sync_item_status ON metadata_sync_task_item(status);

CREATE TABLE IF NOT EXISTS video_source_subscription (
    id INTEGER PRIMARY KEY AUTOINCREMENT, display_name TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1, refresh_interval_minutes INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'PENDING', etag TEXT, last_modified TEXT, last_attempt_at INTEGER,
    last_success_at INTEGER, source_count INTEGER NOT NULL DEFAULT 0, error_message TEXT,
    snapshot_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_source_subscription_refresh ON video_source_subscription(enabled, last_attempt_at);
CREATE TABLE IF NOT EXISTS video_source_definition (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subscription_id INTEGER, import_key TEXT NOT NULL,
    factory_id TEXT NOT NULL, format_version INTEGER NOT NULL, name TEXT NOT NULL, description TEXT,
    icon_url TEXT, config_json TEXT NOT NULL, tier INTEGER NOT NULL DEFAULT 2,
    compatibility TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', last_seen_at INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(subscription_id, import_key)
);
CREATE INDEX IF NOT EXISTS idx_video_source_definition_subscription ON video_source_definition(subscription_id);
CREATE TABLE IF NOT EXISTS video_source_instance (
    id INTEGER PRIMARY KEY AUTOINCREMENT, definition_id INTEGER NOT NULL UNIQUE,
    provider_id TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 1000,
    health_state TEXT NOT NULL DEFAULT 'UNTESTED', health_message TEXT, last_tested_at INTEGER,
    last_success_at INTEGER, failure_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_source_instance_enabled ON video_source_instance(enabled, sort_order);

CREATE TABLE IF NOT EXISTS video_source_package (
    id INTEGER PRIMARY KEY AUTOINCREMENT, media_entry_id INTEGER NOT NULL, provider TEXT NOT NULL,
    provider_package_id TEXT NOT NULL, revision TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'CANDIDATE',
    title TEXT, release_group TEXT, year INTEGER, season TEXT, media_format TEXT, episode_count INTEGER,
    subtitle_languages_json TEXT, audio_languages_json TEXT, quality TEXT, video_codec TEXT, container TEXT,
    capabilities_json TEXT, source_page_url TEXT, sanitized_snapshot_json TEXT, match_reason_json TEXT,
    adopted_at INTEGER, last_refreshed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE (provider, provider_package_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_video_source_package_entry ON video_source_package(media_entry_id);
CREATE INDEX IF NOT EXISTS idx_video_source_package_stable ON video_source_package(provider, provider_package_id);
CREATE INDEX IF NOT EXISTS idx_video_source_package_status ON video_source_package(status);

CREATE TABLE IF NOT EXISTS video_source_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT, package_id INTEGER NOT NULL, provider_item_id TEXT NOT NULL,
    revision TEXT NOT NULL, item_kind TEXT NOT NULL DEFAULT 'UNKNOWN', episode_no INTEGER, episode_end_no INTEGER,
    title TEXT, duration_ms INTEGER, subtitle_languages_json TEXT, audio_languages_json TEXT, quality TEXT,
    capabilities_json TEXT, source_page_url TEXT, sanitized_snapshot_json TEXT, status TEXT NOT NULL DEFAULT 'PENDING',
    last_seen_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE (package_id, provider_item_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_video_source_item_package ON video_source_item(package_id);
CREATE INDEX IF NOT EXISTS idx_video_source_item_episode_no ON video_source_item(package_id, episode_no);
CREATE INDEX IF NOT EXISTS idx_video_source_item_status ON video_source_item(status);

CREATE TABLE IF NOT EXISTS video_source_episode_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source_item_id INTEGER NOT NULL, episode_id INTEGER,
    mapping_reason TEXT NOT NULL, confidence REAL, status TEXT NOT NULL DEFAULT 'PENDING',
    manual_confirmed INTEGER NOT NULL DEFAULT 0, conflict_code TEXT, conflict_message TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (source_item_id)
);
CREATE INDEX IF NOT EXISTS idx_video_source_episode_target ON video_source_episode_map(episode_id);
CREATE INDEX IF NOT EXISTS idx_video_source_episode_status ON video_source_episode_map(status);

CREATE TABLE IF NOT EXISTS video_source_resolution_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source_item_id INTEGER NOT NULL, revision TEXT NOT NULL,
    purpose TEXT NOT NULL, selection_key TEXT NOT NULL DEFAULT 'DEFAULT', resolved_locator TEXT NOT NULL,
    mime_type TEXT, content_length INTEGER, range_supported INTEGER NOT NULL DEFAULT 0,
    probe_state TEXT NOT NULL DEFAULT 'UNCHECKED', probe_message TEXT, retryable INTEGER NOT NULL DEFAULT 1,
    resolved_at INTEGER NOT NULL, expires_at INTEGER, checked_at INTEGER, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL, UNIQUE (source_item_id, revision, purpose, selection_key)
);
CREATE INDEX IF NOT EXISTS idx_video_source_resolution_expiry ON video_source_resolution_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_video_source_resolution_state ON video_source_resolution_cache(probe_state);

CREATE TABLE IF NOT EXISTS video_asset (
    id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id INTEGER NOT NULL, source_item_id INTEGER,
    asset_type TEXT NOT NULL, asset_role TEXT NOT NULL DEFAULT 'UNASSIGNED', priority INTEGER NOT NULL DEFAULT 0,
    availability_state TEXT NOT NULL DEFAULT 'UNCHECKED', source_revision TEXT, display_name TEXT,
    stable_locator TEXT, source_page_url TEXT, storage_path TEXT, mime_type TEXT, duration_ms INTEGER,
    container TEXT, video_codec TEXT, audio_codec TEXT, width INTEGER, height INTEGER, file_size INTEGER,
    fingerprint TEXT, failure_reason TEXT, last_verified_at INTEGER, created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_asset_episode ON video_asset(episode_id);
CREATE INDEX IF NOT EXISTS idx_video_asset_source_item ON video_asset(source_item_id);
CREATE INDEX IF NOT EXISTS idx_video_asset_role ON video_asset(episode_id, asset_role, priority);
CREATE INDEX IF NOT EXISTS idx_video_asset_state ON video_asset(availability_state);
CREATE INDEX IF NOT EXISTS idx_video_asset_fingerprint ON video_asset(fingerprint);

CREATE TABLE IF NOT EXISTS video_asset_track (
    id INTEGER PRIMARY KEY AUTOINCREMENT, video_asset_id INTEGER NOT NULL, track_type TEXT NOT NULL,
    track_index INTEGER NOT NULL, language TEXT, title TEXT, format TEXT, codec TEXT,
    default_track INTEGER NOT NULL DEFAULT 0, forced_track INTEGER NOT NULL DEFAULT 0,
    external_locator TEXT, storage_path TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    UNIQUE (video_asset_id, track_type, track_index)
);
CREATE INDEX IF NOT EXISTS idx_video_asset_track_asset ON video_asset_track(video_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_asset_track_language ON video_asset_track(track_type, language);

CREATE TABLE IF NOT EXISTS video_time_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT, old_asset_id INTEGER NOT NULL, new_asset_id INTEGER NOT NULL,
    parent_mapping_id INTEGER, status TEXT NOT NULL DEFAULT 'UNMAPPED', offset_ms INTEGER, drift_ratio REAL,
    confidence REAL, notes TEXT, created_at INTEGER NOT NULL, confirmed_at INTEGER, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_time_mapping_old ON video_time_mapping(old_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_time_mapping_new ON video_time_mapping(new_asset_id);
CREATE INDEX IF NOT EXISTS idx_video_time_mapping_status ON video_time_mapping(status);

CREATE TABLE IF NOT EXISTS video_time_mapping_anchor (
    id INTEGER PRIMARY KEY AUTOINCREMENT, time_mapping_id INTEGER NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
    old_time_ms INTEGER NOT NULL, new_time_ms INTEGER NOT NULL, confidence REAL, created_at INTEGER NOT NULL,
    UNIQUE (time_mapping_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_video_time_mapping_anchor_mapping ON video_time_mapping_anchor(time_mapping_id);

CREATE TABLE IF NOT EXISTS video_source_task (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, task_type TEXT NOT NULL, provider TEXT,
    status TEXT NOT NULL DEFAULT 'QUEUED', package_id INTEGER, video_asset_id INTEGER, clip_id INTEGER,
    total INTEGER NOT NULL DEFAULT 0, processed INTEGER NOT NULL DEFAULT 0, succeeded INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0, bytes_total INTEGER, bytes_processed INTEGER NOT NULL DEFAULT 0,
    plan_json TEXT, message TEXT, created_at INTEGER NOT NULL, started_at INTEGER, completed_at INTEGER,
    updated_at INTEGER NOT NULL, UNIQUE (task_id)
);
CREATE INDEX IF NOT EXISTS idx_video_source_task_status ON video_source_task(status);
CREATE INDEX IF NOT EXISTS idx_video_source_task_created ON video_source_task(created_at);

CREATE TABLE IF NOT EXISTS video_source_task_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, item_key TEXT NOT NULL,
    task_type TEXT NOT NULL, provider TEXT, status TEXT NOT NULL DEFAULT 'QUEUED', source_item_id INTEGER,
    video_asset_id INTEGER, clip_id INTEGER, bytes_total INTEGER, bytes_processed INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0, temp_path TEXT, resume_json TEXT, error_code TEXT, error_message TEXT,
    last_attempt_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (task_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_video_source_task_item_task ON video_source_task_item(task_id);
CREATE INDEX IF NOT EXISTS idx_video_source_task_item_status ON video_source_task_item(status);
CREATE INDEX IF NOT EXISTS idx_video_source_task_item_asset ON video_source_task_item(video_asset_id);


INSERT OR IGNORE INTO media_format(code, name, has_children, sort, created_at) VALUES
    ('VIDEO', '视频', 1, 1, strftime('%s','now')*1000),
    ('IMAGE', '图片', 0, 2, strftime('%s','now')*1000),
    ('TEXT',  '文字', 0, 3, strftime('%s','now')*1000);

INSERT OR IGNORE INTO media_subcategory(format_id, name, sort, created_at)
    SELECT id, '番剧',  1, strftime('%s','now')*1000 FROM media_format WHERE code='VIDEO';
INSERT OR IGNORE INTO media_subcategory(format_id, name, sort, created_at)
    SELECT id, '电影',  2, strftime('%s','now')*1000 FROM media_format WHERE code='VIDEO';
INSERT OR IGNORE INTO media_subcategory(format_id, name, sort, created_at)
    SELECT id, '电视剧', 3, strftime('%s','now')*1000 FROM media_format WHERE code='VIDEO';
INSERT OR IGNORE INTO media_subcategory(format_id, name, sort, created_at)
    SELECT id, '美剧',  4, strftime('%s','now')*1000 FROM media_format WHERE code='VIDEO';
INSERT OR IGNORE INTO media_subcategory(format_id, name, sort, created_at)
    SELECT id, '纪录片', 5, strftime('%s','now')*1000 FROM media_format WHERE code='VIDEO';
INSERT OR IGNORE INTO media_subcategory(format_id, name, sort, created_at)
    SELECT id, '插画',  1, strftime('%s','now')*1000 FROM media_format WHERE code='IMAGE';
INSERT OR IGNORE INTO media_subcategory(format_id, name, sort, created_at)
    SELECT id, '壁纸',  2, strftime('%s','now')*1000 FROM media_format WHERE code='IMAGE';
INSERT OR IGNORE INTO media_subcategory(format_id, name, sort, created_at)
    SELECT id, '摄影',  3, strftime('%s','now')*1000 FROM media_format WHERE code='IMAGE';
INSERT OR IGNORE INTO media_subcategory(format_id, name, sort, created_at)
    SELECT id, '小说',  1, strftime('%s','now')*1000 FROM media_format WHERE code='TEXT';
