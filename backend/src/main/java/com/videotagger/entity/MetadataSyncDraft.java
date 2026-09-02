package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("metadata_sync_draft")
public class MetadataSyncDraft {
    @TableId
    private Long id;
    private String provider;
    private String queryJson;
    private String candidatesJson;
    private String reviewJson;
    private String viewJson;
    private Long createdAt;
    private Long updatedAt;
}