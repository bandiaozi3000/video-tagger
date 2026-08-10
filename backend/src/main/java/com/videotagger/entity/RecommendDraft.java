package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 推荐草稿：单条（id 固定 1），config = 推荐向导配置 JSON（含 BGM base64）。刷新自动恢复。 */
@Data
@TableName("recommend_draft")
public class RecommendDraft {
    @TableId(type = IdType.INPUT)
    private Long id;
    private String config;
    private Long updatedAt;
}
