package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_task")
public class VideoSourceTask {
    @TableId(type = IdType.AUTO) private Long id;
    private String taskId; private String taskType; private String provider; private String status; private Long packageId; private Long videoAssetId; private Long clipId; private Integer total; private Integer processed; private Integer succeeded; private Integer failed; private Long bytesTotal; private Long bytesProcessed; private String planJson; private String message; private Long createdAt; private Long startedAt; private Long completedAt; private Long updatedAt;
}
