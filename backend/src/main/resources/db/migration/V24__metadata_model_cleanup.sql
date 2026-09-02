-- v24：收缩 Media 外部元数据字段；外部资料已由 external_work/external_episode/external_relation 管理。
DROP TABLE IF EXISTS metadata_sync_candidate;
DROP TABLE IF EXISTS metadata_sync_task;
ALTER TABLE media DROP COLUMN original_title;
ALTER TABLE media DROP COLUMN cover_url;
ALTER TABLE media DROP COLUMN source;
