package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_episode_map")
public class VideoSourceEpisodeMap {
    @TableId(type = IdType.AUTO) private Long id;
    private Long sourceItemId; private Long episodeId; private String mappingReason; private Double confidence; private String status; private Boolean manualConfirmed; private String conflictCode; private String conflictMessage; private Long createdAt; private Long updatedAt;
}
