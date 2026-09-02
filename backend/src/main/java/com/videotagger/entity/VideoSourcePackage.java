package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_package")
public class VideoSourcePackage {
    @TableId(type = IdType.AUTO) private Long id;
    private Long mediaEntryId; private String provider; private String providerPackageId; private String revision; private String status;
    private String title; private String releaseGroup; private Integer year; private String season; private String mediaFormat; private Integer episodeCount;
    private String subtitleLanguagesJson; private String audioLanguagesJson; private String quality; private String videoCodec; private String container; private String capabilitiesJson;
    private String sourcePageUrl; private String sanitizedSnapshotJson; private String matchReasonJson; private Long adoptedAt; private Long lastRefreshedAt; private Long createdAt; private Long updatedAt;
}
