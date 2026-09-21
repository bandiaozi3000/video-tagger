-- V37：导出任务记录分块边界（2026-09-21）
-- 用途：**"只重渲某一块"的安全校验** —— 若当前草稿算出来的段边界与快照不一致，
-- 说明总帧数/段边界变了（旧块在新时间轴上对应别的内容）→ 必须整片重渲，不能局部替换。

ALTER TABLE video_export_task
    ADD COLUMN boundary_frames VARCHAR(4000) NULL AFTER chunks_total;
