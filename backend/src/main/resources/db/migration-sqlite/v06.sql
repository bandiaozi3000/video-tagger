-- v06：移除已废弃的同步任务/候选持久化结构和 Media 外部冗余列。
DROP TABLE IF EXISTS metadata_sync_candidate;
DROP TABLE IF EXISTS metadata_sync_task;
ALTER TABLE media DROP COLUMN original_title;
ALTER TABLE media DROP COLUMN cover_url;
ALTER TABLE media DROP COLUMN source;
