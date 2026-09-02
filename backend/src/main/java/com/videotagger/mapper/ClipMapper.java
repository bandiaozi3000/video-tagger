package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Clip;
import com.videotagger.service.StatsResponse.SiteCount;
import com.videotagger.service.StatsResponse.TrendPoint;
import com.videotagger.service.TagSuggestion;
import com.videotagger.service.VideoSummary;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface ClipMapper extends BaseMapper<Clip> {

    @Select("SELECT * FROM clips WHERE video_asset_id = #{videoAssetId} ORDER BY start_ms, id")
    List<Clip> listByVideoAsset(@Param("videoAssetId") long videoAssetId);

    @Update("UPDATE clips SET video_asset_id = #{videoAssetId}, source_revision = #{sourceRevision}, start_ms = #{startMs}, end_ms = #{endMs}, material_state = #{materialState} WHERE id = #{id}")
    void bindVideoAsset(@Param("id") long id, @Param("videoAssetId") Long videoAssetId, @Param("sourceRevision") String sourceRevision, @Param("startMs") Long startMs, @Param("endMs") Long endMs, @Param("materialState") String materialState);

    @Select("SELECT * FROM clips "
            + "WHERE url = #{url} AND created_at > #{since} "
            + "AND ABS(timestamp_sec - #{ts}) < #{tolerance} "
            + "ORDER BY id DESC LIMIT 1")
    Clip findRecentNearTime(@Param("url") String url, @Param("since") long since,
                            @Param("ts") double ts, @Param("tolerance") double tolerance);

    /** 全文检索（SQLite 版：LIKE 兜底）。原 MySQL ngram FULLTEXT 召回更准，SQLite FTS5 中文分词后置优化（D11），此处保证能用。 */
    @Select("SELECT * FROM clips "
            + "WHERE (title LIKE CONCAT('%', #{q}, '%') OR tag LIKE CONCAT('%', #{q}, '%') "
            + "   OR note LIKE CONCAT('%', #{q}, '%')) "
            + "ORDER BY CASE WHEN title LIKE CONCAT('%', #{q}, '%') THEN 2 "
            + "WHEN tag LIKE CONCAT('%', #{q}, '%') THEN 1 ELSE 0 END DESC, id DESC "
            + "LIMIT #{limit}")
    List<Clip> fullTextSearch(@Param("q") String q, @Param("limit") int limit);

    @Select("SELECT tag, COUNT(*) AS count FROM clips GROUP BY tag ORDER BY count DESC LIMIT #{limit}")
    List<TagSuggestion> countTags(@Param("limit") int limit);

    @Select("SELECT * FROM clips "
            + "WHERE url = #{url} AND ABS(timestamp_sec - #{ts}) < #{window} "
            + "ORDER BY timestamp_sec ASC")
    List<Clip> findNearby(@Param("url") String url, @Param("ts") double ts, @Param("window") double window);

    /** 按最近活跃排序的视频列表，offset 分页（传统页码，配合 countVideos 计算总页数）。
     *  SQLite 版：SUBSTRING_INDEX/LPAD/CONCAT 无等价，改关联子查询取每 fp 的最近标题。 */
    @Select("SELECT g.video_fp AS fp, g.count AS count, g.latest AS latest, "
            + "(SELECT c.title FROM clips c WHERE c.video_fp = g.video_fp ORDER BY c.created_at DESC, c.id DESC LIMIT 1) AS title "
            + "FROM (SELECT video_fp, COUNT(*) AS count, MAX(created_at) AS latest "
            + "      FROM clips WHERE video_fp IS NOT NULL AND video_fp <> '' "
            + "      GROUP BY video_fp) g "
            + "ORDER BY g.latest DESC, g.video_fp DESC "
            + "LIMIT #{limit} OFFSET #{offset}")
    List<VideoSummary> listVideos(@Param("limit") int limit, @Param("offset") int offset);

    @Select("SELECT * FROM clips WHERE video_fp = #{fp} ORDER BY timestamp_sec ASC")
    List<Clip> listByFingerprint(@Param("fp") String fp);

    @Select("<script>"
            + "SELECT id FROM clips "
            + "WHERE id != #{id} AND ("
            + "<foreach collection='tokens' item='t' separator=' OR '>tag LIKE CONCAT('%', #{t}, '%')</foreach>"
            + ") ORDER BY ("
            + "<foreach collection='tokens' item='t' separator='+'>CASE WHEN tag LIKE CONCAT('%', #{t}, '%') THEN 1 ELSE 0 END</foreach>"
            + ") DESC, id DESC LIMIT #{limit}"
            + "</script>")
    List<Long> findSimilarByTag(@Param("id") Long id, @Param("tokens") List<String> tokens, @Param("limit") int limit);

    @Select("SELECT * FROM clips WHERE episode_id = #{episodeId} ORDER BY timestamp_sec ASC")
    List<Clip> listByEpisode(@Param("episodeId") long episodeId);

    @Select("SELECT c.* FROM clips c JOIN episode e ON e.id = c.episode_id "
            + "WHERE e.media_id = #{mediaId} ORDER BY e.season ASC, e.episode_no ASC, c.timestamp_sec ASC")
    List<Clip> listByMedia(@Param("mediaId") long mediaId);

    /** 代表性片段封面：被 clip_tag 标记最多、平分取最新；供集封面智能默认。 */
    @Select("SELECT cover_path FROM clips "
            + "WHERE episode_id = #{episodeId} AND cover_path IS NOT NULL "
            + "ORDER BY (SELECT COUNT(*) FROM clip_tag WHERE clip_id = clips.id) DESC, created_at DESC "
            + "LIMIT 1")
    String selectRepresentativeCoverByEpisode(@Param("episodeId") long episodeId);

    /** 代表性片段封面：某番剧下被标记最多、平分取最新；供番剧封面兜底。 */
    @Select("SELECT c.cover_path FROM clips c JOIN episode e ON e.id = c.episode_id "
            + "WHERE e.media_id = #{mediaId} AND c.cover_path IS NOT NULL "
            + "ORDER BY (SELECT COUNT(*) FROM clip_tag WHERE clip_id = c.id) DESC, c.created_at DESC "
            + "LIMIT 1")
    String selectRepresentativeCoverByMedia(@Param("mediaId") long mediaId);

    @Delete("DELETE FROM clips WHERE episode_id = #{episodeId}")
    void deleteByEpisode(@Param("episodeId") long episodeId);

    @Select("SELECT COUNT(*) FROM clips c JOIN episode e ON e.id = c.episode_id "
            + "WHERE e.media_id = #{mediaId}")
    long countByMedia(@Param("mediaId") long mediaId);

    @Select("SELECT COUNT(*) FROM clips")
    long countClips();

    @Select("SELECT COUNT(DISTINCT video_fp) FROM clips WHERE video_fp IS NOT NULL AND video_fp <> ''")
    long countVideos();

    @Select("SELECT COUNT(DISTINCT tag) FROM clips")
    long countDistinctTags();

    @Select("SELECT CASE "
            + "  WHEN url LIKE 'https://%' THEN substr(url, 9, instr(CONCAT(substr(url, 9), '/'), '/') - 1) "
            + "  WHEN url LIKE 'http://%' THEN substr(url, 8, instr(CONCAT(substr(url, 8), '/'), '/') - 1) "
            + "  ELSE '' END AS site, COUNT(*) AS count "
            + "FROM clips GROUP BY site ORDER BY count DESC LIMIT #{limit}")
    List<SiteCount> countBySite(@Param("limit") int limit);

    @Select("SELECT date(created_at / 1000, 'unixepoch') AS date, COUNT(*) AS count "
            + "FROM clips WHERE created_at >= #{since} GROUP BY date ORDER BY date ASC")
    List<TrendPoint> countTrend(@Param("since") long since);

    /** 标签改名/合并时定位含该词的片段（精确按空白分词替换，避免子串误伤）。 */
    @Select("SELECT * FROM clips WHERE tag LIKE CONCAT('%', #{w}, '%')")
    List<Clip> selectByTagContains(@Param("w") String w);

    @Update("UPDATE clips SET tag = #{tag} WHERE id = #{id}")
    void updateTag(@Param("id") long id, @Param("tag") String tag);
}
