-- V14：媒体回收站（软删除标记，NULL=正常；回收站查询 deleted_at 非空）
ALTER TABLE media ADD COLUMN deleted_at BIGINT NULL AFTER created_at;
