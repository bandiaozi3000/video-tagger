-- V36：导出任务分块续渲所需字段（2026-09-21）
-- 分块策略：2 分钟成片一块（24fps ≈ 2880 帧）。进度模型 = 已完成块数 + 块内百分比，
-- 所以除了 progress（总百分比）还要两块计数与一行实时状态文案。

ALTER TABLE video_export_task
    ADD COLUMN chunks_done  INT NOT NULL DEFAULT 0 AFTER progress,
    ADD COLUMN chunks_total INT NOT NULL DEFAULT 0 AFTER chunks_done,
    -- 实时状态文案：如「准备素材 3/11」「渲染第 3/16 块」「拼接收尾」
    ADD COLUMN stage_text   VARCHAR(200) NULL AFTER chunks_total;
