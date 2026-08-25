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
    original_title  TEXT,
    cover_url       TEXT,
    aliases         TEXT,
    note            TEXT,
    media_format    TEXT NOT NULL DEFAULT 'VIDEO',
    subcategory     TEXT,
    subcategory_id  INTEGER,
    status          TEXT NOT NULL DEFAULT 'WANT',
    rating          REAL,
    cover_path      TEXT,
    confirmed       INTEGER NOT NULL DEFAULT 0,
    source          TEXT,
    created_at      INTEGER,
    deleted_at      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_media_format ON media(media_format);
CREATE INDEX IF NOT EXISTS idx_media_subcat ON media(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_media_deleted ON media(deleted_at);

-- ============ 集 ============
CREATE TABLE IF NOT EXISTS episode (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id    INTEGER NOT NULL,
    season      INTEGER,
    episode_no  INTEGER,
    title       TEXT NOT NULL,
    note        TEXT,
    url         TEXT NOT NULL,
    video_fp    TEXT NOT NULL,
    cover_path  TEXT,
    created_at  INTEGER,
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
    video_fp          TEXT,
    video_duration    REAL,
    cover_path        TEXT,
    detail_cover_path TEXT
);
CREATE INDEX IF NOT EXISTS idx_clips_episode ON clips(episode_id);
CREATE INDEX IF NOT EXISTS idx_clips_video_fp ON clips(video_fp);
CREATE INDEX IF NOT EXISTS idx_clips_created ON clips(created_at);

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

-- ============ 种子数据：默认格式/子分类（与 MySQL V8 等价） ============
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
