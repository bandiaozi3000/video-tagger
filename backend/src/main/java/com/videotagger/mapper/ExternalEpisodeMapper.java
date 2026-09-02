package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.ExternalEpisode;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ExternalEpisodeMapper extends BaseMapper<ExternalEpisode> {
    @Select("SELECT * FROM external_episode WHERE external_work_id = #{workId} ORDER BY season, episode_no, id")
    List<ExternalEpisode> listByWork(@Param("workId") long workId);

    @Select("SELECT * FROM external_episode WHERE external_work_id = #{workId} AND provider_episode_id = #{providerEpisodeId} LIMIT 1")
    ExternalEpisode selectByProviderEpisode(@Param("workId") long workId, @Param("providerEpisodeId") String providerEpisodeId);

    /** 本地 episode → 全部外部集桥接记录（用于反查 Bangumi episodeId，素材化 C2 定位用）。 */
    @Select("SELECT * FROM external_episode WHERE episode_id = #{episodeId}")
    List<ExternalEpisode> listByLocalEpisode(@Param("episodeId") long episodeId);
}
