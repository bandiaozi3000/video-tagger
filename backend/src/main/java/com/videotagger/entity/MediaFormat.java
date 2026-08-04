package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 媒体格式字典（可维护）。hasChildren=1 表示该格式下有 集/片段 子层（仅视频）。 */
@Data
@TableName("media_format")
public class MediaFormat {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** 格式编码：VIDEO / IMAGE / TEXT … */
    private String code;
    /** 显示名：视频 / 图片 / 文字 … */
    private String name;
    /** 是否有 集/片段 子层（0/1） */
    private Integer hasChildren;
    private Integer sort;
    private Long createdAt;
}
