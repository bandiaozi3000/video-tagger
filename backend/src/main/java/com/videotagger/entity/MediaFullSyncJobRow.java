package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 「全量同步」任务行（V41）。 */
@Data
@TableName("media_full_sync_job")
public class MediaFullSyncJobRow {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** PENDING / RUNNING / DONE / FAILED / CANCELLED / INTERRUPTED */
    private String status;
    private String phase;
    private String yearsJson;
    private String seasonsJson;
    private String monthsJson;
    private String region;
    private String category;
    private Integer totalRanges;
    private Integer doneRanges;
    private Integer doneItems;
    private Integer added;
    private Integer updated;
    private Integer skipped;
    private Integer failed;
    private String message;
    private Long createdAt;
    private Long startedAt;
    private Long finishedAt;
    private Long updatedAt;
}
