package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 向量生成任务：三层通用，按 (entity_type, entity_id) 唯一。 */
@Data
@TableName("embedding_tasks")
public class EmbeddingTask {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String entityType;
    private Long entityId;
    private String status;
    private Integer retryCount;
    private Long updatedAt;
}
