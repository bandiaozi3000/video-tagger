-- V10：子分类树（任意层级细分）
-- 现状 media_subcategory 是每格式一个扁平列表，(format_id, name) 唯一；媒体按名字串引用。
-- 需求：子分类支持接着细分（分类树），媒体按 id 引用节点，筛选/搜索子树收敛。
-- 改造：加 parent_id 邻接表（0=根），唯一键改 (parent_id, name)；media 加 subcategory_id 按 id 引用（保留名字快照列）。

-- 1) 子分类表加 parent_id（0=根），唯一键改 (parent_id, name)
ALTER TABLE media_subcategory ADD COLUMN parent_id BIGINT NOT NULL DEFAULT 0 AFTER format_id;
ALTER TABLE media_subcategory DROP INDEX uk_media_subcategory;
ALTER TABLE media_subcategory ADD UNIQUE KEY uk_media_subcategory (parent_id, name);

-- 2) media 按 id 引用子分类节点（可挂任意层级）；保留 subcategory 名字快照列供展示
ALTER TABLE media ADD COLUMN subcategory_id BIGINT NULL AFTER subcategory;

-- 3) 回填：现数据名字全库唯一（无跨分支歧义），按根节点名字匹配
UPDATE media m JOIN media_subcategory s ON m.subcategory = s.name AND s.parent_id = 0
    SET m.subcategory_id = s.id;
