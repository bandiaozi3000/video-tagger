package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Episode;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface EpisodeMapper extends BaseMapper<Episode> {

    @Select("SELECT * FROM episode WHERE video_fp = #{fp} LIMIT 1")
    Episode selectByFp(@Param("fp") String fp);

    @Select("SELECT * FROM episode WHERE anime_id = #{animeId} "
            + "ORDER BY IFNULL(season, 0), IFNULL(episode_no, 0), id")
    List<Episode> listByAnime(@Param("animeId") long animeId);

    @Select("SELECT COUNT(*) FROM episode WHERE anime_id = #{animeId}")
    long countByAnime(@Param("animeId") long animeId);

    /** 某番剧的集列表，带片段数与最新标记时间，按季/集号排序。 */
    @Select("SELECT e.id, e.anime_id AS animeId, e.season, e.episode_no AS episodeNo, "
            + "e.title, e.url, e.video_fp AS videoFp, "
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt "
            + "FROM episode e LEFT JOIN clips c ON c.episode_id = e.id "
            + "WHERE e.anime_id = #{animeId} GROUP BY e.id "
            + "ORDER BY IFNULL(e.season, 0), IFNULL(e.episode_no, 0), e.id")
    List<com.videotagger.service.EpisodeSummary> listSummariesByAnime(@Param("animeId") long animeId);
}
