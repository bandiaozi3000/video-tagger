package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Clip;
import com.videotagger.service.TagSuggestion;
import com.videotagger.service.VideoSummary;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

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

    @Select("SELECT video_fp AS fp, COUNT(*) AS count, MAX(created_at) AS latest, "
            + "SUBSTRING_INDEX(MAX(CONCAT(LPAD(created_at, 20, '0'), '|', title)), '|', -1) AS title "
            + "FROM clips "
            + "WHERE video_fp IS NOT NULL AND video_fp <> '' "
            + "GROUP BY video_fp "
            + "HAVING latest < #{cursorLatest} OR (latest = #{cursorLatest} AND fp < #{cursorFp}) "
            + "ORDER BY latest DESC, fp DESC "
            + "LIMIT #{limit}")
    List<VideoSummary> listVideos(@Param("cursorLatest") long cursorLatest,
                                  @Param("cursorFp") String cursorFp,
                                  @Param("limit") int limit);

    @Select("SELECT * FROM clips WHERE video_fp = #{fp} ORDER BY timestamp_sec ASC")
    List<Clip> listByFingerprint(@Param("fp") String fp);
}
