package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 片段级标签关联（复合主键，经 Mapper 自定义 SQL 操作）。 */
@Data
@TableName("clip_tag")
public class ClipTag {
    private Long clipId;
    private Long tagId;
}
