-- V4：embedding_tasks 通用化为三层实体任务（ANIME/EPISODE/CLIP）
-- 原表以 clip_id 为主键，仅支持片段；三层向量化后主键放开，改为 (entity_type, entity_id) 唯一。
ALTER TABLE embedding_tasks RENAME TO embedding_tasks_old;

CREATE TABLE IF NOT EXISTS embedding_tasks (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    entity_type VARCHAR(16) NOT NULL,
    entity_id   BIGINT NOT NULL,
    status      VARCHAR(16) NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    updated_at  BIGINT NOT NULL,
    UNIQUE KEY uk_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO embedding_tasks (entity_type, entity_id, status, retry_count, updated_at)
    SELECT 'CLIP', clip_id, status, retry_count, updated_at FROM embedding_tasks_old;

DROP TABLE IF EXISTS embedding_tasks_old;
