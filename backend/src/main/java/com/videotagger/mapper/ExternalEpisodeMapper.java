package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.ExternalEpisode;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

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

    /** 换绑重建：解除全部外部集对指定本地集的绑定（避免删除本地集后悬空引用）。 */
    @Update({"<script>UPDATE external_episode SET episode_id = NULL, sync_state = 'MISSING', updated_at = #{updatedAt} "
            + "WHERE episode_id IN <foreach collection='episodeIds' item='id' open='(' separator=',' close=')'>#{id}</foreach></script>"})
    int unbindByEpisodeIds(@Param("episodeIds") List<Long> episodeIds, @Param("updatedAt") long updatedAt);

    /** 删除某外部条目的全部集索引记录（同步产物）。 */
    @Delete("DELETE FROM external_episode WHERE external_work_id = #{workId}")
    int deleteByWorkId(@Param("workId") long workId);
}
