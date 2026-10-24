package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Episode;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface EpisodeMapper extends BaseMapper<Episode> {

    @Select("SELECT * FROM episode WHERE media_entry_id = #{mediaEntryId} ORDER BY IFNULL(episode_no, 0), id")
    List<Episode> listByMediaEntry(@Param("mediaEntryId") long mediaEntryId);

    @Select("SELECT * FROM episode WHERE media_entry_id = #{mediaEntryId} AND episode_no = #{episodeNo} LIMIT 1")
    Episode selectByMediaEntryAndEpisodeNo(@Param("mediaEntryId") long mediaEntryId, @Param("episodeNo") int episodeNo);

    @Select("SELECT * FROM episode WHERE video_fp = #{fp} LIMIT 1")
    Episode selectByFp(@Param("fp") String fp);

    /**
     * 同媒体内「还没被任何 URL 认领」的该集号（Bangumi 同步来的集 url/video_fp 全空）。
     * 打标签时用它兜底认领，避免同一集反复新建（见 ClipService.ensureEpisode）。
     */
    @Select("SELECT * FROM episode WHERE media_id = #{mediaId} AND episode_no = #{episodeNo} "
            + "AND (video_fp IS NULL OR video_fp = '') ORDER BY id LIMIT 1")
    Episode selectUnclaimedByMediaAndNo(@Param("mediaId") long mediaId, @Param("episodeNo") int episodeNo);

    @Select("SELECT * FROM episode WHERE media_id = #{mediaId} "
            + "ORDER BY IFNULL(episode_no, 0), id")
    List<Episode> listByMedia(@Param("mediaId") long mediaId);

    @Select("SELECT COUNT(*) FROM episode WHERE media_id = #{mediaId}")
    long countByMedia(@Param("mediaId") long mediaId);

    /** 某番剧的集列表，带片段数与最新标记时间，按集号排序。列顺序须与 EpisodeSummary 组件顺序一致（MyBatis 按位映射）。 */
    @Select("SELECT e.id, e.media_id AS mediaId, e.episode_no AS episodeNo, "
            + "e.title, e.url, e.video_fp AS videoFp, "
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "e.cover_path AS coverPath, e.watched_at AS watchedAt "
            + "FROM episode e LEFT JOIN clips c ON c.episode_id = e.id "
            + "WHERE e.media_id = #{mediaId} GROUP BY e.id "
            + "ORDER BY IFNULL(e.episode_no, 0), e.id")
    List<com.videotagger.service.EpisodeSummary> listSummariesByMedia(@Param("mediaId") long mediaId);

    /** 集关键词召回：集标题 / 集备注 / 集级标签命中。 */
    @Select("<script>"
            + "SELECT DISTINCT e.id, e.media_id AS mediaId, e.episode_no AS episodeNo, "
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
