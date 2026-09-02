package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("media_entry")
public class MediaEntry {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long mediaId;
    private String entryType;
    private Integer sortOrder;
    private String title;
    private String titleCn;
    private String note;
    private Long createdAt;
    private Long updatedAt;
}
