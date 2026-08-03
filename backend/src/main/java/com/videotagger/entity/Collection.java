package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 收藏夹（自定义清单，多对多挂番剧）。 */
@Data
@TableName("collection")
public class Collection {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private Long createdAt;
}
