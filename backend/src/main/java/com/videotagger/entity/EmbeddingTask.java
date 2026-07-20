package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("embedding_tasks")
public class EmbeddingTask {
    @TableId(type = IdType.INPUT)
    private Long clipId;
    private String status;
    private Integer retryCount;
    private Long updatedAt;
}
