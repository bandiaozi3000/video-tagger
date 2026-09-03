package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_episode_map")
public class VideoSourceEpisodeMap {
    @TableId(type = IdType.AUTO) private Long id;
    private Long sourceItemId;
    /** 绑定的本地集（null=未绑定/已忽略）。updateStrategy=IGNORED：ignore() 解除映射须能把 episode_id 清回 NULL。 */
    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private Long episodeId;
    private String mappingReason; private Double confidence; private String status; private Boolean manualConfirmed; private String conflictCode; private String conflictMessage; private Long createdAt; private Long updatedAt;
}
