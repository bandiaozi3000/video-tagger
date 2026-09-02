package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_time_mapping")
public class VideoTimeMapping {
    @TableId(type = IdType.AUTO) private Long id;
    private Long oldAssetId; private Long newAssetId; private Long parentMappingId; private String status; private Long offsetMs; private Double driftRatio; private Double confidence; private String notes; private Long createdAt; private Long confirmedAt; private Long updatedAt;
}
