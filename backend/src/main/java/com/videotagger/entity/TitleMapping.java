package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 标题映射：识别标题 → 媒体 id（打标签自动归位）。title 为主键。 */
@Data
@TableName("title_mapping")
public class TitleMapping {
    @TableId(type = IdType.INPUT)
    private String title;
    private Long mediaId;
    private Long createdAt;
}
