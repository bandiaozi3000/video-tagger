package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 媒体库对账任务行（V39）。状态与计数字段见 {@code MediaReconcileJobService}。 */
@Data
@TableName("media_reconcile_job")
public class MediaReconcileJobRow {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** dry（只报告不写） / live（真删真关联） */
    private String mode;
    /** PENDING / RUNNING / DONE / FAILED / CANCELLED / INTERRUPTED */
    private String status;
    private String phase;
    private Integer total;
    private Integer done;
    private Integer linked;
    private Integer merged;
    private Integer purged;
    private Integer skipped;
    private Integer failed;
    private Integer coverDeleted;
    private Integer entryCleaned;
    private String message;
    private String detailJson;
    private String confirmToken;
    private Long createdAt;
    private Long startedAt;
    private Long finishedAt;
    private Long updatedAt;
}
