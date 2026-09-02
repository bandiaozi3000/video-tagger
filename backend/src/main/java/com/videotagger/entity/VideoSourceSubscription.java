package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_subscription")
public class VideoSourceSubscription {
    @TableId(type = IdType.AUTO) private Long id;
    private String displayName;
    private String url;
    private Integer enabled;
    private Integer refreshIntervalMinutes;
    private String status;
    private String etag;
    private String lastModified;
    private Long lastAttemptAt;
    private Long lastSuccessAt;
    private Integer sourceCount;
    private String errorMessage;
    private String snapshotJson;
    private Long createdAt;
    private Long updatedAt;
}
