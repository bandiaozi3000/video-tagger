package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 番剧级标签关联（复合主键，经 Mapper 自定义 SQL 操作）。 */
@Data
@TableName("media_tag")
public class MediaTag {
    private Long mediaId;
    private Long tagId;
}
