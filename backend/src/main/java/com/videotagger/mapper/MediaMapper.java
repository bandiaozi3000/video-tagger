package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Media;
import com.videotagger.service.MediaSummary;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface MediaMapper extends BaseMapper<Media> {

    /** 代表性片段帧封面：番剧无显式封面时兜底（被标记最多、平分取最新）。 */
    String FALLBACK_COVER = "(SELECT c.cover_path FROM clips c JOIN episode e ON e.id = c.episode_id "
            + "WHERE e.media_id = a.id AND c.cover_path IS NOT NULL "
            + "ORDER BY (SELECT COUNT(*) FROM clip_tag WHERE clip_id = c.id) DESC, c.created_at DESC "
            + "LIMIT 1) AS fallbackCoverPath";

    @Select("SELECT * FROM media WHERE title = #{title} LIMIT 1")
    Media selectByTitle(@Param("title") String title);

    /** 标题前缀匹配：供打标保存时归组到既有番剧（不含别名，别名归组属 Phase 3 LLM）。 */
    @Select("SELECT * FROM media WHERE title LIKE CONCAT(#{title}, '%') ORDER BY id LIMIT 1")
    Media selectByTitlePrefix(@Param("title") String title);

    /** 番剧卡片墙：含片段数与最新标记时间，按创建倒序。 */
    @Select("SELECT a.id, a.title, a.media_format AS mediaFormat, a.subcategory, a.status, a.rating, a.cover_path AS coverPath, a.confirmed,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + FALLBACK_COVER + " "
            + "FROM media a "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "GROUP BY a.id ORDER BY a.id DESC LIMIT #{limit}")
    List<MediaSummary> listSummaries(@Param("limit") int limit);

    /** 最近观看：打过标记即算，按最新标记时间倒序；支持 status/confirmed/collectionId 筛选。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.media_format AS mediaFormat, a.subcategory, a.status, a.rating, a.cover_path AS coverPath, a.confirmed,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + FALLBACK_COVER + " "
            + "FROM media a "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='status != null'>a.status = #{status}</if>"
            + "<if test='confirmed != null'>AND a.confirmed = #{confirmed}</if>"
            + "<if test='collectionId != null'>AND a.id IN (SELECT media_id FROM media_collection WHERE collection_id = #{collectionId})</if>"
            + "</where>"
            + "GROUP BY a.id HAVING latestAt IS NOT NULL "
            + "ORDER BY latestAt DESC LIMIT #{limit}"
            + "</script>")
    List<MediaSummary> listByLatest(@Param("limit") int limit, @Param("status") String status,
                                    @Param("confirmed") Integer confirmed, @Param("collectionId") Long collectionId);

    @Select("SELECT COUNT(*) FROM media")
    long countMedia();

    /** 某收藏夹下的番剧列表；支持 status/confirmed 筛选。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.media_format AS mediaFormat, a.subcategory, a.status, a.rating, a.cover_path AS coverPath, a.confirmed,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + FALLBACK_COVER + " "
            + "FROM media a "
            + "JOIN media_collection ac ON ac.media_id = a.id AND ac.collection_id = #{collectionId} "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='status != null'>a.status = #{status}</if>"
            + "<if test='confirmed != null'>AND a.confirmed = #{confirmed}</if>"
            + "</where>"
            + "GROUP BY a.id ORDER BY a.id DESC LIMIT #{limit}"
            + "</script>")
    List<MediaSummary> listByCollection(@Param("collectionId") long collectionId, @Param("limit") int limit,
                                        @Param("status") String status, @Param("confirmed") Integer confirmed);

    /** 媒体列表筛选：状态/格式/子分类/待确认 组合，sort=latest 按最近标记倒序。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.media_format AS mediaFormat, a.subcategory, a.status, a.rating, a.cover_path AS coverPath, a.confirmed,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + FALLBACK_COVER + " "
            + "FROM media a "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='status != null'>a.status = #{status}</if>"
            + "<if test='format != null'>AND a.media_format = #{format}</if>"
            + "<if test='subcategory != null'>AND a.subcategory = #{subcategory}</if>"
            + "<if test='confirmed != null'>AND a.confirmed = #{confirmed}</if>"
            + "</where>"
            + "GROUP BY a.id "
            + "<choose>"
            + "<when test='sort != null and sort == \"latest\"'>ORDER BY latestAt DESC</when>"
            + "<otherwise>ORDER BY a.id DESC</otherwise>"
            + "</choose>"
            + " LIMIT #{limit}"
            + "</script>")
    List<MediaSummary> listFiltered(@Param("status") String status, @Param("format") String format,
                                    @Param("subcategory") String subcategory,
                                    @Param("confirmed") Integer confirmed, @Param("sort") String sort,
                                    @Param("limit") int limit);

    /** 媒体关键词召回：标题/别名/备注/作品标签命中。 */
    @Select("<script>"
            + "SELECT DISTINCT a.id, a.title, a.aliases, a.note, a.media_format AS mediaFormat, a.subcategory, "
            + "a.status, a.rating, a.cover_path AS coverPath, a.confirmed, a.created_at "
            + "FROM media a "
            + "LEFT JOIN media_tag at ON at.media_id = a.id "
            + "LEFT JOIN tag t ON t.id = at.tag_id "
            + "WHERE a.title LIKE CONCAT('%', #{q}, '%') "
            + "   OR (a.aliases IS NOT NULL AND a.aliases LIKE CONCAT('%', #{q}, '%')) "
            + "   OR (a.note IS NOT NULL AND a.note LIKE CONCAT('%', #{q}, '%')) "
            + "   OR t.name LIKE CONCAT('%', #{q}, '%') "
            + "ORDER BY a.id DESC LIMIT #{limit}"
            + "</script>")
    List<com.videotagger.entity.Media> searchByKeyword(@Param("q") String q, @Param("limit") int limit);

    /** 某格式下的媒体数（删除保护用）。 */
    @Select("SELECT COUNT(*) FROM media WHERE media_format = #{format}")
    long countByFormat(@Param("format") String format);

    /** 某子分类名下的媒体数（删除保护/统计用）。 */
    @Select("SELECT COUNT(*) FROM media WHERE subcategory = #{subcategory}")
    long countBySubcategory(@Param("subcategory") String subcategory);

    /** 按格式聚合统计。 */
    @Select("SELECT a.media_format AS format, COUNT(*) AS count FROM media a "
            + "GROUP BY a.media_format ORDER BY count DESC")
    List<FormatCount> countGroupByFormat();

    /** 按子分类聚合统计。 */
    @Select("SELECT a.subcategory AS subcategory, COUNT(*) AS count FROM media a "
            + "WHERE a.subcategory IS NOT NULL GROUP BY a.subcategory ORDER BY count DESC")
    List<SubcategoryCount> countGroupBySubcategory();

    /** 聚合行。 */
    record FormatCount(String format, long count) {
    }

    record SubcategoryCount(String subcategory, long count) {
    }
}
