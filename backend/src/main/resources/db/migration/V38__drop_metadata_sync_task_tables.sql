-- V38：删掉「元信息同步工作区」的三种表（2026-09-21）
--
-- 背景：同步番剧功能已简化为「选条件 → 勾选 → 直接同步」（弹窗 + 3 个新端点），
-- 不再有后台任务、逐项重试与跨会话草稿，所以这三张表失去用途（用户拍板：无关代码删除）。
-- 回退：结构可从 V35 迁移重建，但表内历史任务/草稿数据无法恢复。

DROP TABLE IF EXISTS metadata_sync_task_item;
DROP TABLE IF EXISTS metadata_sync_task;
DROP TABLE IF EXISTS metadata_sync_draft;
