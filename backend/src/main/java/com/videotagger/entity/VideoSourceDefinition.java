package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_definition")
public class VideoSourceDefinition {
    @TableId(type = IdType.AUTO) private Long id;
    private Long subscriptionId;
    private String importKey;
    private String factoryId;
    private Integer formatVersion;
    private String name;
    private String description;
    private String iconUrl;
    private String configJson;
    private Integer tier;
    private String compatibility;
    private String status;
    private Long lastSeenAt;
    private Long createdAt;
    private Long updatedAt;
}
