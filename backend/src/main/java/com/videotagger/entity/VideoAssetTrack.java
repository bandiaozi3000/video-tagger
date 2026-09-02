package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_asset_track")
public class VideoAssetTrack {
    @TableId(type = IdType.AUTO) private Long id;
    private Long videoAssetId; private String trackType; private Integer trackIndex; private String language; private String title; private String format; private String codec; private Boolean defaultTrack; private Boolean forcedTrack; private String externalLocator; private String storagePath; private Long createdAt; private Long updatedAt;
}
