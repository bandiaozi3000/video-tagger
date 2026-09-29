package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 封面工坊「常用模板」：封面参数快照（版式 + 文字/位置/处理），不含具体片段（V42）。 */
@Data
@TableName("cover_template")
public class CoverTemplateRow {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String config;
    private Long createdAt;
    private Long updatedAt;
}
