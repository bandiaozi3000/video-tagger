package com.videotagger.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("clips")
public class Clip {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String url;
    /** 归一化 URL 的指纹（同一视频聚合用），保存时由服务端计算 */
    private String videoFp;
    /** 所属集（episode.id）。Phase 1 过渡期可空（历史数据），打标时自动创建并回填 */
    private Long episodeId;
    private Double timestampSec;
    /** 视频总时长（秒，可选，扩展打标时上报） */
    private Double videoDuration;
    private String tag;
    private String note;
    private Long createdAt;
}
