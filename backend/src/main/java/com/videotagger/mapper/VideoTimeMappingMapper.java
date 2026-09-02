package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.VideoTimeMapping;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface VideoTimeMappingMapper extends BaseMapper<VideoTimeMapping> {
    @Select("SELECT COUNT(*) FROM video_time_mapping WHERE old_asset_id = #{assetId} OR new_asset_id = #{assetId}")
    long countByAsset(@Param("assetId") long assetId);
}
