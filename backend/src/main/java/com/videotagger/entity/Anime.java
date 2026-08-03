package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;

/** 番剧（作品级实体）。电影 = type=MOVIE 的单集番剧。 */
@Data
@TableName("anime")
public class Anime {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    /** 别名（LLM 后台归组修正，可空） */
    private String aliases;
    /** 内容类型：ANIME / MOVIE */
    private String type;
    /** 追番状态：WANT / WATCHING / DONE / PAUSED / DROPPED */
    private String status;
    /** 手动评分（十分制，可空） */
    private BigDecimal rating;
    /** 本地封面路径（/covers/** 静态映射），可空 */
    private String coverPath;
    /** 自动识别为低置信时置 0，需手工确认（B 做全的待确认标记） */
    private Integer confirmed;
    private Long createdAt;
}
