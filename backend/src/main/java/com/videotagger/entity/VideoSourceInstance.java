package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("video_source_instance")
public class VideoSourceInstance {
    @TableId(type = IdType.AUTO) private Long id;
    private Long definitionId;
    private String providerId;
    private Integer enabled;
    private Integer sortOrder;
    private String healthState;
    private String healthMessage;
    private Long lastTestedAt;
    private Long lastSuccessAt;
    private Integer failureCount;
    private Long createdAt;
    private Long updatedAt;
}
