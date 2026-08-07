package com.videotagger.mapper;

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

public interface ClipMapper extends BaseMapper<Clip> {

    @Select("SELECT * FROM clips "
            + "WHERE url = #{url} AND created_at > #{since} "
            + "AND ABS(timestamp_sec - #{ts}) < #{tolerance} "
            + "ORDER BY id DESC LIMIT 1")
    Clip findRecentNearTime(@Param("url") String url, @Param("since") long since,
                            @Param("ts") double ts, @Param("tolerance") double tolerance);

    @Select("SELECT * FROM clips "
            + "WHERE MATCH(title, tag, note) AGAINST(#{q} IN NATURAL LANGUAGE MODE) "
            + "ORDER BY MATCH(title, tag, note) AGAINST(#{q} IN NATURAL LANGUAGE MODE) DESC "
            + "LIMIT #{limit}")
    List<Clip> fullTextSearch(@Param("q") String q, @Param("limit") int limit);

    @Select("SELECT tag, COUNT(*) AS count FROM clips GROUP BY tag ORDER BY count DESC LIMIT #{limit}")
    List<TagSuggestion> countTags(@Param("limit") int limit);

    @Select("SELECT * FROM clips "
            + "WHERE url = #{url} AND ABS(timestamp_sec - #{ts}) < #{window} "
            + "ORDER BY timestamp_sec ASC")
    List<Clip> findNearby(@Param("url") String url, @Param("ts") double ts, @Param("window") double window);

    /** 按最近活跃排序的视频列表，offset 分页（传统页码，配合 countVideos 计算总页数）。 */
    @Select("SELECT video_fp AS fp, COUNT(*) AS count, MAX(created_at) AS latest, "
            + "SUBSTRING_INDEX(MAX(CONCAT(LPAD(created_at, 20, '0'), '|', title)), '|', -1) AS title "
            + "FROM clips "
            + "WHERE video_fp IS NOT NULL AND video_fp <> '' "
            + "GROUP BY video_fp "
            + "ORDER BY latest DESC, fp DESC "
            + "LIMIT #{limit} OFFSET #{offset}")
    List<VideoSummary> listVideos(@Param("limit") int limit, @Param("offset") int offset);

    @Select("SELECT * FROM clips WHERE video_fp = #{fp} ORDER BY timestamp_sec ASC")
    List<Clip> listByFingerprint(@Param("fp") String fp);

    @Select("<script>"
            + "SELECT id FROM clips "
            + "WHERE id != #{id} AND ("
            + "<foreach collection='tokens' item='t' separator=' OR '>tag LIKE CONCAT('%', #{t}, '%')</foreach>"
            + ") ORDER BY ("
            + "<foreach collection='tokens' item='t' separator='+'>IF(tag LIKE CONCAT('%', #{t}, '%'), 1, 0)</foreach>"
            + ") DESC, id DESC LIMIT #{limit}"
            + "</script>")
    List<Long> findSimilarByTag(@Param("id") Long id, @Param("tokens") List<String> tokens, @Param("limit") int limit);

    @Select("SELECT * FROM clips WHERE episode_id = #{episodeId} ORDER BY timestamp_sec ASC")
    List<Clip> listByEpisode(@Param("episodeId") long episodeId);

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

    @Select("SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(url, '/', 3), '//', -1) AS site, COUNT(*) AS count "
            + "FROM clips GROUP BY site ORDER BY count DESC LIMIT #{limit}")
    List<SiteCount> countBySite(@Param("limit") int limit);

    @Select("SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS date, COUNT(*) AS count "
            + "FROM clips WHERE created_at >= #{since} GROUP BY date ORDER BY date ASC")
    List<TrendPoint> countTrend(@Param("since") long since);

    /** 标签改名/合并时定位含该词的片段（精确按空白分词替换，避免子串误伤）。 */
    @Select("SELECT * FROM clips WHERE tag LIKE CONCAT('%', #{w}, '%')")
    List<Clip> selectByTagContains(@Param("w") String w);

    @Update("UPDATE clips SET tag = #{tag} WHERE id = #{id}")
    void updateTag(@Param("id") long id, @Param("tag") String tag);
}
