-- v0.24 Animeko 观看导入：episode 记录看过时间（epoch ms，来源 Animeko playback updatedAt）
ALTER TABLE episode ADD COLUMN watched_at BIGINT NULL;
