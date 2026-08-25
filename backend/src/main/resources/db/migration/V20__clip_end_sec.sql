-- V20：片段结束时间（秒），为空时兼容旧的瞬时片段
ALTER TABLE clips ADD COLUMN end_sec DOUBLE NULL;
