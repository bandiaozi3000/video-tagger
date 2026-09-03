-- 季上移媒体：media 增加 season（系列第几季，默认 1）；episode 移除 season（季归媒体唯一权威来源）
ALTER TABLE media ADD COLUMN season INTEGER NOT NULL DEFAULT 1;
ALTER TABLE episode DROP COLUMN season;
