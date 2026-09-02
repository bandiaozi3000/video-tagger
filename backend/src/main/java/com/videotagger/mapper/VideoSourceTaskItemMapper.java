package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.VideoSourceTaskItem;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface VideoSourceTaskItemMapper extends BaseMapper<VideoSourceTaskItem> {
    @Select("SELECT COUNT(*) FROM video_source_task_item WHERE video_asset_id = #{assetId} AND status NOT IN ('COMPLETED', 'FAILED', 'CANCELED')")
    long countActiveByAsset(@Param("assetId") long assetId);
}
