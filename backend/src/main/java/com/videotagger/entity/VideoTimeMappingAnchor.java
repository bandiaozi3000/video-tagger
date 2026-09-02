package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_time_mapping_anchor")
public class VideoTimeMappingAnchor {
    @TableId(type = IdType.AUTO) private Long id;
    private Long timeMappingId; private Integer sortOrder; private Long oldTimeMs; private Long newTimeMs; private Double confidence; private Long createdAt;
}
