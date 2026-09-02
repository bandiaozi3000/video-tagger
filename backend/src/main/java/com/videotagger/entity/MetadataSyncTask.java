package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("metadata_sync_task")
public class MetadataSyncTask {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String taskId;
    private String provider;
    private String scopeType;
    private String queryJson;
    private String status;
    private String stage;
    private Integer total;
    private Integer selectedTotal;
    private Integer createCount;
    private Integer updateCount;
    private Integer linkCount;
    private Integer skipCount;
    private Integer processed;
    private Integer succeeded;
    private Integer failed;
    private Integer pendingReview;
    private String summaryJson;
    private String errorMessage;
    private Long createdAt;
    private Long startedAt;
    private Long completedAt;
    private Long retentionUntil;
    private Long updatedAt;
}