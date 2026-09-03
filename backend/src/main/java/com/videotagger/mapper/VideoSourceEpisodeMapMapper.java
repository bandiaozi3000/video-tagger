package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import java.util.List;

import com.videotagger.entity.VideoSourceEpisodeMap;

@Mapper
public interface VideoSourceEpisodeMapMapper extends BaseMapper<VideoSourceEpisodeMap> {
    @Select("SELECT * FROM video_source_episode_map WHERE source_item_id = #{sourceItemId} LIMIT 1")
    VideoSourceEpisodeMap selectBySourceItem(@Param("sourceItemId") long sourceItemId);
    @Select("SELECT * FROM video_source_episode_map WHERE episode_id = #{episodeId} ORDER BY id")
    List<VideoSourceEpisodeMap> listByEpisode(@Param("episodeId") long episodeId);
    @Select("SELECT COUNT(*) FROM video_source_episode_map m JOIN video_source_item i ON i.id = m.source_item_id WHERE i.package_id = #{packageId} AND m.episode_id = #{episodeId} AND m.status = 'CONFIRMED' AND m.source_item_id <> #{sourceItemId}")
    long countConfirmedInPackage(@Param("packageId") long packageId, @Param("episodeId") long episodeId, @Param("sourceItemId") long sourceItemId);

    /** 换绑重建：删除某本地集全部片源映射。 */
    @Delete("DELETE FROM video_source_episode_map WHERE episode_id = #{episodeId}")
    int deleteByEpisode(@Param("episodeId") long episodeId);
}
