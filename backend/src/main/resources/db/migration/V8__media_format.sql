-- V8：媒体格式细分（anime → media，格式/子分类字典）
-- 番剧泛化为媒体：加 media_format（视频/图片/文字）+ subcategory（子分类，取代原 type）。
-- 表改名 anime→media、anime_tag→media_tag、anime_collection→media_collection；关联列 anime_id→media_id。
-- 电影 = 视频子分类：旧 type=ANIME→'番剧'、MOVIE→'电影'。

-- 1) anime 加格式/子分类列并回填
ALTER TABLE anime
    ADD COLUMN media_format VARCHAR(16) NOT NULL DEFAULT 'VIDEO' AFTER aliases,
    ADD COLUMN subcategory  VARCHAR(32) NULL AFTER media_format;

UPDATE anime SET subcategory = IF(type = 'MOVIE', '电影', '番剧');

-- 2) 表改名
RENAME TABLE anime TO media, anime_tag TO media_tag, anime_collection TO media_collection;

-- 3) 关联列改名
ALTER TABLE episode          CHANGE anime_id media_id BIGINT NOT NULL;
ALTER TABLE media_tag        CHANGE anime_id media_id BIGINT NOT NULL;
ALTER TABLE media_collection CHANGE anime_id media_id BIGINT NOT NULL;

-- 4) 删旧 type 列（已被 subcategory 取代）
ALTER TABLE media DROP COLUMN type;

-- 5) 媒体格式字典（可维护；has_children=1 表示该格式下有 集/片段 子层，仅视频）
CREATE TABLE IF NOT EXISTS media_format (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    code         VARCHAR(16) NOT NULL,
    name         VARCHAR(32) NOT NULL,
    has_children TINYINT NOT NULL DEFAULT 0,
    sort         INT NOT NULL DEFAULT 0,
    created_at   BIGINT NOT NULL,
    UNIQUE KEY uk_media_format_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO media_format(code, name, has_children, sort, created_at) VALUES
    ('VIDEO', '视频', 1, 1, UNIX_TIMESTAMP() * 1000),
    ('IMAGE', '图片', 0, 2, UNIX_TIMESTAMP() * 1000),
    ('TEXT',  '文字', 0, 3, UNIX_TIMESTAMP() * 1000);

-- 6) 子分类字典（每格式一个列表，可维护）
CREATE TABLE IF NOT EXISTS media_subcategory (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    format_id  BIGINT NOT NULL,
    name       VARCHAR(32) NOT NULL,
    sort       INT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    UNIQUE KEY uk_media_subcategory (format_id, name),
    KEY idx_subcategory_format (format_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '番剧',  1, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'VIDEO';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '电影',  2, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'VIDEO';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '电视剧', 3, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'VIDEO';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '美剧',  4, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'VIDEO';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '纪录片', 5, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'VIDEO';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '插画',  1, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'IMAGE';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '壁纸',  2, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'IMAGE';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '摄影',  3, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'IMAGE';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '小说',  1, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'TEXT';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '轻小说', 2, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'TEXT';
INSERT INTO media_subcategory(format_id, name, sort, created_at)
SELECT id, '文章',  3, UNIX_TIMESTAMP() * 1000 FROM media_format WHERE code = 'TEXT';

-- 7) 向量任务实体类型迁移（ANIME → MEDIA）
UPDATE embedding_tasks SET entity_type = 'MEDIA' WHERE entity_type = 'ANIME';
