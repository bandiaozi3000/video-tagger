package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Anime;
import com.videotagger.service.AnimeSummary;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface AnimeMapper extends BaseMapper<Anime> {

    @Select("SELECT * FROM anime WHERE title = #{title} LIMIT 1")
    Anime selectByTitle(@Param("title") String title);

    /** 标题前缀匹配：供打标保存时归组到既有番剧（不含别名，别名归组属 Phase 3 LLM）。 */
    @Select("SELECT * FROM anime WHERE title LIKE CONCAT(#{title}, '%') ORDER BY id LIMIT 1")
    Anime selectByTitlePrefix(@Param("title") String title);

    /** 番剧卡片墙：含片段数与最新标记时间，按创建倒序。 */
    @Select("SELECT a.id, a.title, a.type, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, "
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt "
            + "FROM anime a "
            + "LEFT JOIN episode e ON e.anime_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "GROUP BY a.id ORDER BY a.id DESC LIMIT #{limit}")
    List<AnimeSummary> listSummaries(@Param("limit") int limit);

    /** 最近观看：打过标记即算，按最新标记时间倒序聚合番剧。 */
    @Select("SELECT a.id, a.title, a.type, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, "
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt "
            + "FROM anime a "
            + "LEFT JOIN episode e ON e.anime_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "GROUP BY a.id HAVING latestAt IS NOT NULL "
            + "ORDER BY latestAt DESC LIMIT #{limit}")
    List<AnimeSummary> listByLatest(@Param("limit") int limit);

    @Select("SELECT COUNT(*) FROM anime")
    long countAnime();
}
