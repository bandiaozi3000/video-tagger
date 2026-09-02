package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_asset")
public class VideoAsset {
    @TableId(type = IdType.AUTO) private Long id;
    private Long episodeId; private Long sourceItemId; private String assetType; private String assetRole; private Integer priority; private String availabilityState; private String sourceRevision; private String displayName; private String stableLocator; private String sourcePageUrl; private String storagePath; private String mimeType; private Long durationMs; private String container; private String videoCodec; private String audioCodec; private Integer width; private Integer height; private Long fileSize; private String fingerprint; private String failureReason; private Long lastVerifiedAt; private Long createdAt; private Long updatedAt;
}
