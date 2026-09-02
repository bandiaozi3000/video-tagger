package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_item")
public class VideoSourceItem {
    @TableId(type = IdType.AUTO) private Long id;
    private Long packageId; private String providerItemId; private String revision; private String itemKind; private Integer episodeNo; private Integer episodeEndNo; private String title; private Long durationMs;
    private String subtitleLanguagesJson; private String audioLanguagesJson; private String quality; private String capabilitiesJson; private String sourcePageUrl; private String sanitizedSnapshotJson; private String status;
    private Long lastSeenAt; private Long createdAt; private Long updatedAt;
}
