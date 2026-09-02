package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.VideoAssetTrack;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface VideoAssetTrackMapper extends BaseMapper<VideoAssetTrack> {
    @Select("SELECT * FROM video_asset_track WHERE video_asset_id = #{assetId} ORDER BY track_type, track_index, id")
    List<VideoAssetTrack> listByAsset(@Param("assetId") long assetId);

    @Delete("DELETE FROM video_asset_track WHERE video_asset_id = #{assetId}")
    int deleteByAsset(@Param("assetId") long assetId);
}
