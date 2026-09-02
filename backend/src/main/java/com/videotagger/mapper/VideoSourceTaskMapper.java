package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.VideoSourceTask;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface VideoSourceTaskMapper extends BaseMapper<VideoSourceTask> {
    @Select("SELECT * FROM video_source_task WHERE status IN ('QUEUED', 'RESOLVING', 'RUNNING', 'PAUSED', 'VERIFYING') ORDER BY created_at, id")
    List<VideoSourceTask> listRecoverable();

    @Select("SELECT * FROM video_source_task WHERE task_id = #{taskId} LIMIT 1")
    VideoSourceTask selectByTaskId(@Param("taskId") String taskId);
    @Select("SELECT COUNT(*) FROM video_source_task WHERE video_asset_id = #{assetId} AND status NOT IN ('COMPLETED', 'FAILED', 'CANCELED')")
    long countActiveByAsset(@Param("assetId") long assetId);
}
