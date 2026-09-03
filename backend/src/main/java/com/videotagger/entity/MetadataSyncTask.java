package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
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
    /** 任务级错误摘要（null=无）。updateStrategy=IGNORED：重试/恢复时须能清回 NULL。 */
    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private String errorMessage;
    private Long createdAt;
    private Long startedAt;
    /** 完成时间戳（null=未完成）。updateStrategy=IGNORED：重试/入队须能清回 NULL。 */
    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private Long completedAt;
    /** 保留到期时间（null=不设保留期）。updateStrategy=IGNORED：重置任务时须能清回 NULL。 */
    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private Long retentionUntil;
    private Long updatedAt;
}