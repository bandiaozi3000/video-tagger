package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("highlight_project")
public class HighlightProject {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long mediaId;
    private String name;
    private String configJson;
    private Long createdAt;
    private Long updatedAt;
}
