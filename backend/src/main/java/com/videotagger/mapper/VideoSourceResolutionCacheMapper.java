package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import java.util.List;

import com.videotagger.entity.VideoSourceResolutionCache;

@Mapper
public interface VideoSourceResolutionCacheMapper extends BaseMapper<VideoSourceResolutionCache> {
    @Select("SELECT * FROM video_source_resolution_cache WHERE source_item_id = #{sourceItemId} AND revision = #{revision} AND purpose = #{purpose} AND selection_key = #{selectionKey} LIMIT 1")
    VideoSourceResolutionCache selectStable(@Param("sourceItemId") long sourceItemId, @Param("revision") String revision, @Param("purpose") String purpose, @Param("selectionKey") String selectionKey);
    @Select("SELECT * FROM video_source_resolution_cache WHERE expires_at IS NOT NULL AND expires_at <= #{now}")
    List<VideoSourceResolutionCache> listExpired(@Param("now") long now);
}
