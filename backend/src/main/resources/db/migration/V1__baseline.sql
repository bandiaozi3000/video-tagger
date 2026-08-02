-- V1 基线：与初版 schema.sql 等价（CREATE TABLE IF NOT EXISTS 兼容已有数据卷）
CREATE TABLE IF NOT EXISTS clips (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    title         VARCHAR(512) NOT NULL,
    url           VARCHAR(1024) NOT NULL,
    timestamp_sec DOUBLE NOT NULL,
    tag           VARCHAR(512) NOT NULL,
    note          TEXT,
    created_at    BIGINT NOT NULL,
    FULLTEXT KEY ft_title_tag_note (title, tag, note) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS embedding_tasks (
    clip_id     BIGINT PRIMARY KEY,
    status      VARCHAR(16) NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    updated_at  BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
