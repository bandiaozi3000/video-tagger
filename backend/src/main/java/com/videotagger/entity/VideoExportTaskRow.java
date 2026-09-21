package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 导出任务行（表 `video_export_task`，Flyway V35）。
 *
 * 2026-09-21：任务状态从内存搬到库 —— 后端重启不再丢任务；`workDir`/`childPid`/`requestJson`
 * 三个字段本期只写不读，是给下期「分块续渲」预留的入口（见设计规格 §4）。
 */
@Data
@TableName("video_export_task")
public class VideoExportTaskRow {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private Integer mediaCount;
    /** PENDING / RUNNING / DONE / ERROR / CANCELLED / INTERRUPTED。 */
    private String status;
    private String message;
    private String filePath;
    private String format;
    private Integer progress;
    /** 已完成 / 总块数（分块续渲；0/0 = 还没进分块阶段）。 */
    private Integer chunksDone;
    private Integer chunksTotal;
    /** 实时状态文案（准备素材 3/11 / 渲染第 3/16 块 / 拼接收尾）。 */
    private String stageText;
    /** 段边界帧 JSON（如 `[0,165,300,…]`）：局部重渲前的安全校验基准。 */
    private String boundaryFrames;
    private String workDir;
    private Long childPid;
    private String requestJson;
    private Long createdAt;
    private Long startedAt;
    private Long finishedAt;
    private Long updatedAt;
}
