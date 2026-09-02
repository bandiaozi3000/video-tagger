-- v0.24 M2+ 素材化：clips 增加 source_start_ms（物化前原视频起点；materialize 归零后保留打标位置）
ALTER TABLE clips ADD COLUMN source_start_ms INTEGER;
