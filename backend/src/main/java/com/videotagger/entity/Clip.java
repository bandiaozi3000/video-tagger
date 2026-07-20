package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("clips")
public class Clip {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String url;
    private Double timestampSec;
    private String tag;
    private String note;
    private Long createdAt;
}
