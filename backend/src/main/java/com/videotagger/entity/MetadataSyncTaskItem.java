package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("metadata_sync_task_item")
public class MetadataSyncTaskItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long taskId;
    private String provider;
    private String externalId;
    private String title;
    private String titleCn;
    private String action;
    private Long targetMediaId;
    private String status;
    private String stage;
    private String errorMessage;
    private Integer attempts;
    private Long lastAttemptAt;
    private String snapshotJson;
    private Long createdAt;
    private Long updatedAt;
}