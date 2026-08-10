package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 推荐模板：可复用配置快照（不含 BGM），命名 + 列表/载入/删除。 */
@Data
@TableName("recommend_template")
public class RecommendTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String config;
    private Long createdAt;
}
