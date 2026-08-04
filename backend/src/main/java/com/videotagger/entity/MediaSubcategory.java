package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 媒体子分类字典（格式内维护）。如视频格式下：番剧/电视剧/美剧/电影… */
@Data
@TableName("media_subcategory")
public class MediaSubcategory {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** 所属媒体格式 id */
    private Long formatId;
    private String name;
    private Integer sort;
    private Long createdAt;
}
