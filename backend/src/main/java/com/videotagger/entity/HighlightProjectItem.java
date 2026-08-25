package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("highlight_project_item")
public class HighlightProjectItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long projectId;
    private Long clipId;
    private Integer sortOrder;
    private Double inSec;
    private Double outSec;
    private String spoilerState;
    private String caption;
    private String sourceType;
    private String sourceState;
    private String sourcePath;
    private String sourceUrl;
    private String sourceMessage;
    private Integer originalVolume;
    private Long createdAt;
    private Long updatedAt;
}
