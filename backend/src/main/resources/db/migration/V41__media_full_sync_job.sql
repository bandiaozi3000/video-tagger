-- V41：媒体库「全量同步」任务（2026-09-25）
--
-- 背景：同步番剧弹窗原来只能「拉取候选 → 勾选 → 同步」，上限是渲染 400 行；
--       要按年份范围把符合条件的番剧**全部**同步进来（实测 13 年约 1.4 万条，2–4 小时），
--       必须后台跑 + 进度持久化（后端一重启就看不见了）。
--
-- 与 V39 media_reconcile_job 是**兄弟表**：两者都用同一套「任务行 + 进度轮询」形态，
-- 但计数语义不同（那边是 关联/合并/删除，这边是 新增/更新/跳过/失败），所以没有合并成一张表。
--
-- 同步动作与弹窗里逐条勾选**完全同源**：同一个 SyncActionDecider + 同一个 MetadataSyncCommitService.commit，
-- 所以这里是幂等的（第二次跑会走 UPDATE/LINK 而不是再新增一遍）。

CREATE TABLE media_full_sync_job (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    -- PENDING / RUNNING / DONE / FAILED / CANCELLED / INTERRUPTED
    status        VARCHAR(16)  NOT NULL,
    phase         VARCHAR(200) NULL,
    -- 请求快照（筛选条件），便于事后知道这次拉的是什么范围
    years_json    VARCHAR(500) NOT NULL,
    seasons_json  VARCHAR(200) NULL,
    months_json   VARCHAR(200) NULL,
    region        VARCHAR(32)  NULL,
    category      VARCHAR(32)  NULL,
    total_ranges  INT          NOT NULL DEFAULT 0,
    done_ranges   INT          NOT NULL DEFAULT 0,
    -- 已处理候选条数（含被 SKIP 的）
    done_items    INT          NOT NULL DEFAULT 0,
    added         INT          NOT NULL DEFAULT 0,
    updated       INT          NOT NULL DEFAULT 0,
    skipped       INT          NOT NULL DEFAULT 0,
    failed        INT          NOT NULL DEFAULT 0,
    message       VARCHAR(2000) NULL,
    created_at    BIGINT       NOT NULL,
    started_at    BIGINT       NULL,
    finished_at   BIGINT       NULL,
    updated_at    BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
