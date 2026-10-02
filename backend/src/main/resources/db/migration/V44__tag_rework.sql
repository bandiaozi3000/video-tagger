-- v0.31 标签功能重做（设计规格 docs/superpowers/specs/2026-10-02-video-tagger-v031-tag-rework-design.md）
--
-- 1) 清空全部标签数据（用户 2026-10-02 拍板：老标签内容无价值，**未做单独备份**）
-- 2) 删掉 `clips.tag` 冗余字符串列 —— 从此 `clip_tag` 是片段标签的唯一真源
--
-- ⚠️ 执行本迁移前必须先上"不再引用 clips.tag 的代码"，并停掉旧实例（旧代码 SELECT 会报 Unknown column）。
-- ⚠️ 不可逆：4 张标签表内容 + 27 行 clips.tag 只能靠数据备份还原。

DELETE FROM clip_tag;
DELETE FROM episode_tag;
DELETE FROM media_tag;
DELETE FROM tag;

ALTER TABLE clips DROP COLUMN tag;
