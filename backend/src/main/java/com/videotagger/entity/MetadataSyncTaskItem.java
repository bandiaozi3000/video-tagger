package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("metadata_sync_task_item")
public class MetadataSyncTaskItem {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long taskId;
    private String provider;
    private String externalId;
    private String title;
    private String titleCn;
    private String action;
    private Long targetMediaId;
    private String status;
    private String stage;
    /** 最近错误信息（null=无）。updateStrategy=IGNORED：重试/重新入队时须能清回 NULL。 */
    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private String errorMessage;
    private Integer attempts;
    private Long lastAttemptAt;
    private String snapshotJson;
    private Long createdAt;
    private Long updatedAt;
}