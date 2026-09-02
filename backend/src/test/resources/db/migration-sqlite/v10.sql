-- v0.24: episode 增加 watched_at（Animeko 观看导入时间戳，epoch ms，可空）
ALTER TABLE episode ADD COLUMN watched_at INTEGER;
