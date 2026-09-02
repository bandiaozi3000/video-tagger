package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_resolution_cache")
public class VideoSourceResolutionCache {
    @TableId(type = IdType.AUTO) private Long id;
    private Long sourceItemId; private String revision; private String purpose; private String selectionKey; private String resolvedLocator; private String mimeType; private Long contentLength; private Boolean rangeSupported; private String probeState; private String probeMessage; private Boolean retryable; private Long resolvedAt; private Long expiresAt; private Long checkedAt; private Long createdAt; private Long updatedAt;
}
