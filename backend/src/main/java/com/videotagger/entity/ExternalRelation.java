package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("external_relation")
public class ExternalRelation {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long externalWorkId;
    private String provider;
    private String relatedExternalId;
    private String relationType;
    private String title;
    private Long createdAt;
}
