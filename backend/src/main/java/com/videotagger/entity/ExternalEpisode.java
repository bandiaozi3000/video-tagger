package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("external_episode")
public class ExternalEpisode {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long externalWorkId;
    private String providerEpisodeId;
    private Long episodeId;
    private Integer season;
    private Integer episodeNo;
    private String title;
    private String titleCn;
    private String description;
    private String airDate;
    private Integer durationSec;
    private Long lastSeenAt;
    private String syncState;
    private Long createdAt;
    private Long updatedAt;
}
