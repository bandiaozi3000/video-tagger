-- 帧封面：片段截帧封面 + 集自选封面（可空，纯展示，不进向量化）
ALTER TABLE episode ADD COLUMN cover_path VARCHAR(512) NULL;
ALTER TABLE clips ADD COLUMN cover_path VARCHAR(512) NULL;
