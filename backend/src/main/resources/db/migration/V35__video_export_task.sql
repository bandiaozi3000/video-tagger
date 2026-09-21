-- V35：导出任务持久化（2026-09-21）
-- 背景：任务状态原本只在 `VideoExportTaskService` 的内存 Map 里，后端一重启就丢；
--       工作目录是临时目录且 finally 无条件删 → 中断后既查不到、也没法续渲。
-- 本表存任务行（含进度/状态/工作目录/子进程 pid/请求快照），下期分块续渲直接用它当入口。

CREATE TABLE video_export_task (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    title        VARCHAR(200) NOT NULL,
    media_count  INT          NOT NULL DEFAULT 0,
    -- PENDING / RUNNING / DONE / ERROR / CANCELLED / INTERRUPTED（下期加 PAUSED）
    status       VARCHAR(16)  NOT NULL,
    message      VARCHAR(2000) NULL,
    file_path    VARCHAR(500) NULL,
    format       VARCHAR(8)   NULL,
    progress     INT          NOT NULL DEFAULT 0,
    -- 工作目录（持久位置 data/exports/.work/<id>）：下期续渲的入口
    work_dir     VARCHAR(500) NULL,
    -- 渲染子进程 pid：启动接管时用来杀掉上次遗留的 node
    child_pid    BIGINT       NULL,
    -- 请求快照（**剥掉 base64**，BGM/转场音只存工作目录相对路径）：下期续渲用
    request_json MEDIUMTEXT   NULL,
    created_at   BIGINT       NOT NULL,
    started_at   BIGINT       NULL,
    finished_at  BIGINT       NULL,
    updated_at   BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
