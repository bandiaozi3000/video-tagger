package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.VideoAsset;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import java.util.List;

@Mapper
public interface VideoAssetMapper extends BaseMapper<VideoAsset> {
    @Select("SELECT * FROM video_asset WHERE episode_id = #{episodeId} ORDER BY CASE WHEN asset_role = 'PRIMARY' THEN 0 WHEN asset_role = 'FALLBACK' THEN 1 ELSE 2 END, priority DESC, id")
    List<VideoAsset> listByEpisode(@Param("episodeId") long episodeId);

    @Select("SELECT * FROM video_asset WHERE episode_id = #{episodeId} AND availability_state = 'AVAILABLE' ORDER BY CASE WHEN asset_role = 'PRIMARY' THEN 0 ELSE 1 END, priority DESC, id LIMIT 1")
    VideoAsset selectAvailable(@Param("episodeId") long episodeId);

    @Select("SELECT * FROM video_asset WHERE episode_id = #{episodeId} AND asset_role = 'PRIMARY' ORDER BY id LIMIT 1")
    VideoAsset selectPrimary(@Param("episodeId") long episodeId);

    @Select("SELECT * FROM video_asset WHERE episode_id = #{episodeId} AND source_item_id = #{sourceItemId} ORDER BY id LIMIT 1")
    VideoAsset selectByEpisodeSource(@Param("episodeId") long episodeId, @Param("sourceItemId") long sourceItemId);

    @Update("UPDATE video_asset SET asset_role = 'FALLBACK', updated_at = #{updatedAt} WHERE episode_id = #{episodeId} AND asset_role = 'PRIMARY' AND id <> #{assetId}")
    int demoteOtherPrimary(@Param("episodeId") long episodeId, @Param("assetId") long assetId, @Param("updatedAt") long updatedAt);
}
