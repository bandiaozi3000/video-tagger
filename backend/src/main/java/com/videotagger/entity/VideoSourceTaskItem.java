package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_task_item")
public class VideoSourceTaskItem {
    @TableId(type = IdType.AUTO) private Long id;
    private Long taskId; private String itemKey; private String taskType; private String provider; private String status; private Long sourceItemId; private Long videoAssetId; private Long clipId; private Long bytesTotal; private Long bytesProcessed; private Integer attempts; private String tempPath; private String resumeJson; private String errorCode; private String errorMessage; private Long lastAttemptAt; private Long createdAt; private Long updatedAt;
}
