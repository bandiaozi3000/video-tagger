package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 集级标签关联（复合主键，经 Mapper 自定义 SQL 操作）。 */
@Data
@TableName("episode_tag")
public class EpisodeTag {
    private Long episodeId;
    private Long tagId;
}
