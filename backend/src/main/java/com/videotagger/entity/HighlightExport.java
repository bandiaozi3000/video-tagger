package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("highlight_export")
public class HighlightExport {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long projectId;
    private String mode;
    private String snapshotJson;
    private String outputPath;
    private String status;
    private String message;
    private String stage;
    private String sceneMessage;
    private Long createdAt;
    private Long finishedAt;
}
