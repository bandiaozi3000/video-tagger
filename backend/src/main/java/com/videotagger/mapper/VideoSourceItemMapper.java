package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import java.util.List;

import com.videotagger.entity.VideoSourceItem;

@Mapper
public interface VideoSourceItemMapper extends BaseMapper<VideoSourceItem> {
    @Select("SELECT * FROM video_source_item WHERE package_id = #{packageId} ORDER BY episode_no, episode_end_no, id")
    List<VideoSourceItem> listByPackage(@Param("packageId") long packageId);
    @Select("SELECT * FROM video_source_item WHERE package_id = #{packageId} AND episode_no = #{episodeNo} ORDER BY id")
    List<VideoSourceItem> listByEpisodeNo(@Param("packageId") long packageId, @Param("episodeNo") int episodeNo);
}
