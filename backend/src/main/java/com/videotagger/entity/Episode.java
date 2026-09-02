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
    /** v0.22 具体作品条目；历史集可为空并继续通过 mediaId 工作。 */
    private Long mediaEntryId;
    /** 季号（标题无法解析时为空） */
    private Integer season;
    /** 集号（标题无法解析时为空） */
    private Integer episodeNo;
    /** 集标题（原始页面标题，含站点后缀） */
    private String title;
    /** 1=用户/历史标题不被外部资料覆盖，0=可使用外部展示标题 */
    private Integer titleOverride;
    /** 集备注（该集看点/重点等，供搜索），可空 */
    private String note;
    private String url;
    /** 归一化 URL 指纹（同一集唯一标识，替代原 clips.video_fp 的"集"语义） */
    private String videoFp;
    /** 集封面静态路径（自选高能画面/上传），可空；空时查询端解析到代表性片段帧 */
    private String coverPath;
    private Long createdAt;
    /** 看过时间（epoch ms；来源：Animeko 观看导入 v0.24），可空 */
    private Long watchedAt;
}
