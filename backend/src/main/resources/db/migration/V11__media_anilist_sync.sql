-- V11：番剧同步（AniList）——首播年份 + 原标题
-- 需求：媒体支持按年份批量导入（名称/年份/封面）；media 记录作品首播年份与 AniList 原生标题。
-- year 为空 = 未知首播年；original_title 用于去重匹配 + 展示「原名」。

ALTER TABLE media ADD COLUMN year INT NULL AFTER title;
ALTER TABLE media ADD COLUMN original_title VARCHAR(512) NULL AFTER year;
