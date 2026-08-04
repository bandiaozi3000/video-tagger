package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/** 番剧的某一集（含季号）。电影为单集番剧时仅一行。 */
@Data
@TableName("episode")
public class Episode {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long mediaId;
    /** 季号（标题无法解析时为空） */
    private Integer season;
    /** 集号（标题无法解析时为空） */
    private Integer episodeNo;
    /** 集标题（原始页面标题，含站点后缀） */
    private String title;
    private String url;
    /** 归一化 URL 指纹（同一集唯一标识，替代原 clips.video_fp 的"集"语义） */
    private String videoFp;
    /** 集封面静态路径（自选高能画面/上传），可空；空时查询端解析到代表性片段帧 */
    private String coverPath;
    private Long createdAt;
}
