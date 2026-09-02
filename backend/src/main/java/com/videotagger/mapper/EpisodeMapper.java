package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Episode;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface EpisodeMapper extends BaseMapper<Episode> {

    @Select("SELECT * FROM episode WHERE media_entry_id = #{mediaEntryId} ORDER BY IFNULL(season, 0), IFNULL(episode_no, 0), id")
    List<Episode> listByMediaEntry(@Param("mediaEntryId") long mediaEntryId);

    @Select("SELECT * FROM episode WHERE media_entry_id = #{mediaEntryId} AND episode_no = #{episodeNo} LIMIT 1")
    Episode selectByMediaEntryAndEpisodeNo(@Param("mediaEntryId") long mediaEntryId, @Param("episodeNo") int episodeNo);

    @Select("SELECT * FROM episode WHERE video_fp = #{fp} LIMIT 1")
    Episode selectByFp(@Param("fp") String fp);

    @Select("SELECT * FROM episode WHERE media_id = #{mediaId} "
            + "ORDER BY IFNULL(season, 0), IFNULL(episode_no, 0), id")
    List<Episode> listByMedia(@Param("mediaId") long mediaId);

    @Select("SELECT COUNT(*) FROM episode WHERE media_id = #{mediaId}")
    long countByMedia(@Param("mediaId") long mediaId);

    /** 某番剧的集列表，带片段数与最新标记时间，按季/集号排序。列顺序须与 EpisodeSummary 组件顺序一致（MyBatis 按位映射）。 */
    @Select("SELECT e.id, e.media_id AS mediaId, e.season, e.episode_no AS episodeNo, "
            + "e.title, e.url, e.video_fp AS videoFp, "
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "e.cover_path AS coverPath, e.watched_at AS watchedAt "
            + "FROM episode e LEFT JOIN clips c ON c.episode_id = e.id "
            + "WHERE e.media_id = #{mediaId} GROUP BY e.id "
            + "ORDER BY IFNULL(e.season, 0), IFNULL(e.episode_no, 0), e.id")
    List<com.videotagger.service.EpisodeSummary> listSummariesByMedia(@Param("mediaId") long mediaId);

    /** 集关键词召回：集标题 / 集备注 / 集级标签命中。 */
    @Select("<script>"
            + "SELECT DISTINCT e.id, e.media_id AS mediaId, e.season, e.episode_no AS episodeNo, "
            + "e.title, e.note, e.url, e.video_fp AS videoFp, e.created_at "
            + "FROM episode e "
            + "LEFT JOIN episode_tag et ON et.episode_id = e.id "
            + "LEFT JOIN tag t ON t.id = et.tag_id "
            + "WHERE e.title LIKE CONCAT('%', #{q}, '%') "
            + "   OR (e.note IS NOT NULL AND e.note LIKE CONCAT('%', #{q}, '%')) "
            + "   OR t.name LIKE CONCAT('%', #{q}, '%') "
            + "ORDER BY e.id DESC LIMIT #{limit}"
            + "</script>")
    List<com.videotagger.entity.Episode> searchByKeyword(@Param("q") String q, @Param("limit") int limit);
}
