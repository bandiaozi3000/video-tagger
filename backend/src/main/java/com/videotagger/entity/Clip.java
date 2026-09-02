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
    private Long videoAssetId;
    private Long startMs;
    private Long endMs;
    private String sourceRevision;
    private Long timeMappingId;
    private String materialState;
    /** v0.24 M3 素材化渠道线索（JSON 数组，见 ChannelHint）：C1 本地池/C2 Animeko/C3 直链/C4 录屏；老数据为空 */
    private String channelHints;
    private Double timestampSec;
    /** 片段结束时间（秒，可空；为空时兼容旧的瞬时片段） */
    private Double endSec;
    /** 视频总时长（秒，可选，扩展打标时上报） */
    private Double videoDuration;
    private String tag;
    private String note;
    /** 片段截帧封面静态路径（扩展 canvas 截取当前帧落盘），可空 */
    private String coverPath;
    /** 片段详情大图静态路径（悬浮预览/详情页 hero，min(videoWidth,1280)），可空；无则回退缩略图 */
    private String detailCoverPath;
    private Long createdAt;
}
