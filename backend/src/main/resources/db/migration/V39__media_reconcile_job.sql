-- V39：媒体库对账任务（2026-09-25）
-- 背景：对账要打上千次 Bangumi 搜索 + 物理删几千条 media，不能挂在 HTTP 请求里；
--       任务状态必须持久化，否则后端一重启就「看不见了」（用户要求：后台跑、可看进度）。
-- 参照 V35 video_export_task 的做法。

CREATE TABLE media_reconcile_job (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    -- dry（只报告不写） / live（真删真关联）
    mode          VARCHAR(8)   NOT NULL,
    -- PENDING / RUNNING / DONE / FAILED / CANCELLED / INTERRUPTED
    status        VARCHAR(16)  NOT NULL,
    phase         VARCHAR(32)  NULL,
    total         INT          NOT NULL DEFAULT 0,
    done          INT          NOT NULL DEFAULT 0,
    linked        INT          NOT NULL DEFAULT 0,
    merged        INT          NOT NULL DEFAULT 0,
    purged        INT          NOT NULL DEFAULT 0,
    skipped       INT          NOT NULL DEFAULT 0,
    failed        INT          NOT NULL DEFAULT 0,
    cover_deleted INT          NOT NULL DEFAULT 0,
    entry_cleaned INT          NOT NULL DEFAULT 0,
    message       VARCHAR(2000) NULL,
    -- 明细：AUTO（含覆盖字段）、人工两层、失败/拒绝项。PURGE 只计数不存明细
    detail_json   MEDIUMTEXT   NULL,
    -- live 的确认词校验记录，留痕用
    confirm_token VARCHAR(64)  NULL,
    created_at    BIGINT       NOT NULL,
    started_at    BIGINT       NULL,
    finished_at   BIGINT       NULL,
    updated_at    BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_status_created (status, created_at),
    KEY idx_mode_status (mode, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
