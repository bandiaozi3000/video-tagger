package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Anime;
import com.videotagger.service.AnimeSummary;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface AnimeMapper extends BaseMapper<Anime> {

    /** 代表性片段帧封面：番剧无显式封面时兜底（被标记最多、平分取最新）。 */
    String FALLBACK_COVER = "(SELECT c.cover_path FROM clips c JOIN episode e ON e.id = c.episode_id "
            + "WHERE e.anime_id = a.id AND c.cover_path IS NOT NULL "
            + "ORDER BY (SELECT COUNT(*) FROM clip_tag WHERE clip_id = c.id) DESC, c.created_at DESC "
            + "LIMIT 1) AS fallbackCoverPath";

    @Select("SELECT * FROM anime WHERE title = #{title} LIMIT 1")
    Anime selectByTitle(@Param("title") String title);

    /** 标题前缀匹配：供打标保存时归组到既有番剧（不含别名，别名归组属 Phase 3 LLM）。 */
    @Select("SELECT * FROM anime WHERE title LIKE CONCAT(#{title}, '%') ORDER BY id LIMIT 1")
    Anime selectByTitlePrefix(@Param("title") String title);

    /** 番剧卡片墙：含片段数与最新标记时间，按创建倒序。 */
    @Select("SELECT a.id, a.title, a.type, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, "
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + FALLBACK_COVER + " "
            + "FROM anime a "
            + "LEFT JOIN episode e ON e.anime_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "GROUP BY a.id ORDER BY a.id DESC LIMIT #{limit}")
    List<AnimeSummary> listSummaries(@Param("limit") int limit);

    /** 最近观看：打过标记即算，按最新标记时间倒序聚合番剧。 */
    @Select("SELECT a.id, a.title, a.type, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, "
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + FALLBACK_COVER + " "
            + "FROM anime a "
            + "LEFT JOIN episode e ON e.anime_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "GROUP BY a.id HAVING latestAt IS NOT NULL "
            + "ORDER BY latestAt DESC LIMIT #{limit}")
    List<AnimeSummary> listByLatest(@Param("limit") int limit);

    @Select("SELECT COUNT(*) FROM anime")
    long countAnime();

    /** 某收藏夹下的番剧列表。 */
    @Select("SELECT a.id, a.title, a.type, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, "
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + FALLBACK_COVER + " "
            + "FROM anime a "
            + "JOIN anime_collection ac ON ac.anime_id = a.id AND ac.collection_id = #{collectionId} "
            + "LEFT JOIN episode e ON e.anime_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "GROUP BY a.id ORDER BY a.id DESC LIMIT #{limit}")
    List<AnimeSummary> listByCollection(@Param("collectionId") long collectionId, @Param("limit") int limit);

    /** 番剧列表筛选：状态/类型/待确认 组合，sort=latest 按最近标记倒序。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.type, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, "
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + FALLBACK_COVER + " "
            + "FROM anime a "
            + "LEFT JOIN episode e ON e.anime_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='status != null'>a.status = #{status}</if>"
            + "<if test='type != null'>AND a.type = #{type}</if>"
            + "<if test='confirmed != null'>AND a.confirmed = #{confirmed}</if>"
            + "</where>"
            + "GROUP BY a.id "
            + "<choose>"
            + "<when test='sort != null and sort == \"latest\"'>ORDER BY latestAt DESC</when>"
            + "<otherwise>ORDER BY a.id DESC</otherwise>"
            + "</choose>"
            + " LIMIT #{limit}"
            + "</script>")
    List<AnimeSummary> listFiltered(@Param("status") String status, @Param("type") String type,
                                    @Param("confirmed") Integer confirmed, @Param("sort") String sort,
                                    @Param("limit") int limit);

    /** 番剧关键词召回：标题/别名/作品标签命中。 */
    @Select("<script>"
            + "SELECT DISTINCT a.id, a.title, a.aliases, a.type, a.status, a.rating, "
            + "a.cover_path AS coverPath, a.confirmed, a.created_at "
            + "FROM anime a "
            + "LEFT JOIN anime_tag at ON at.anime_id = a.id "
            + "LEFT JOIN tag t ON t.id = at.tag_id "
            + "WHERE a.title LIKE CONCAT('%', #{q}, '%') "
            + "   OR (a.aliases IS NOT NULL AND a.aliases LIKE CONCAT('%', #{q}, '%')) "
            + "   OR t.name LIKE CONCAT('%', #{q}, '%') "
            + "ORDER BY a.id DESC LIMIT #{limit}"
            + "</script>")
    List<com.videotagger.entity.Anime> searchByKeyword(@Param("q") String q, @Param("limit") int limit);
}
