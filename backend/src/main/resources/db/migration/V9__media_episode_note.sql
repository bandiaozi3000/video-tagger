-- V9：媒体/集层备注（media/episode 加 note，供搜索与向量检索；与 clips.note 同口径）
-- 片段级 clips.note 已存在，本迁移补齐媒体与集两级备注。

-- 1) 媒体备注（作品观感/待办/为什么收藏等），列位置置于格式/子分类之后
ALTER TABLE media
    ADD COLUMN note VARCHAR(2000) NULL AFTER subcategory;

-- 2) 集备注（该集看点/重点等）
ALTER TABLE episode
    ADD COLUMN note VARCHAR(2000) NULL AFTER title;
