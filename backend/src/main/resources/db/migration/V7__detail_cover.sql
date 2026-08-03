-- 双图封面：片段详情大图（缩略图 clip/{id}.jpg 之外的悬浮/详情图，可空）
ALTER TABLE clips ADD COLUMN detail_cover_path VARCHAR(512) NULL;
