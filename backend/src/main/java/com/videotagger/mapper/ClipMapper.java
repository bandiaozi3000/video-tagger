package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Clip;
import com.videotagger.service.TagSuggestion;
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
}
