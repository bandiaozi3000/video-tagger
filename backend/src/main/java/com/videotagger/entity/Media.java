package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;

/** 媒体（作品级实体，原「番剧」泛化）。格式=视频时可有集/片段子层；图片/文字单层。 */
@Data
@TableName("media")
public class Media {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    /** 别名（LLM 后台归组修正，可空） */
    private String aliases;
    /** 媒体格式：VIDEO / IMAGE / TEXT（media_format 字典） */
    private String mediaFormat;
    /** 子分类（media_subcategory 字典，格式内可选），可空=未分类 */
    private String subcategory;
    /** 状态：WANT / WATCHING / DONE / PAUSED / DROPPED（全格式共用） */
    private String status;
    /** 手动评分（十分制，可空） */
    private BigDecimal rating;
    /** 本地封面路径（/covers/** 静态映射），可空 */
    private String coverPath;
    /** 自动识别为低置信时置 0，需手工确认（B 做全的待确认标记） */
    private Integer confirmed;
    private Long createdAt;
}
