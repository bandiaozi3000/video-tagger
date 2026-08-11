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

    @Select("SELECT * FROM media WHERE title = #{title} AND deleted_at IS NULL LIMIT 1")
    Media selectByTitle(@Param("title") String title);

    /** 标题前缀匹配：供打标保存时归组到既有番剧（不含别名，别名归组属 Phase 3 LLM）。 */
    @Select("SELECT * FROM media WHERE title LIKE CONCAT(#{title}, '%') AND deleted_at IS NULL ORDER BY id LIMIT 1")
    Media selectByTitlePrefix(@Param("title") String title);

    /** AniList 同步去重：标题或原标题任一命中即视为已有（title/original_title 精确匹配）。 */
    @Select("SELECT * FROM media WHERE (title = #{title} OR original_title = #{title}) AND deleted_at IS NULL LIMIT 1")
    Media selectByTitleOrOriginal(@Param("title") String title);

    /** 留存了封面 URL 但尚无封面文件的媒体（异步下载中断/未下完），供「补下缺失封面」。 */
    @Select("SELECT * FROM media WHERE cover_url IS NOT NULL AND cover_url != '' "
            + "AND (cover_path IS NULL OR cover_path = '') AND deleted_at IS NULL")
    List<Media> listMissingCovers();

    /** 番剧卡片墙：含片段数与最新标记时间，按创建倒序。 */
    @Select("SELECT a.id, a.title, a.year, a.media_format AS mediaFormat, a.subcategory, a.subcategory_id AS subcategoryId, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, a.source,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "(SELECT COUNT(*) FROM media_collection mc WHERE mc.media_id = a.id) AS collectionCount, "
            + FALLBACK_COVER + " "
            + "FROM media a "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "WHERE a.deleted_at IS NULL "
            + "GROUP BY a.id ORDER BY a.id DESC LIMIT #{limit} OFFSET #{offset}")
    List<MediaSummary> listSummaries(@Param("limit") int limit, @Param("offset") int offset);

    /** 最近观看：打过标记即算，按最新标记时间倒序；支持 status/format/子分类（子树收敛）/confirmed/collectionId/year 筛选。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.year, a.media_format AS mediaFormat, a.subcategory, a.subcategory_id AS subcategoryId, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, a.source,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "(SELECT COUNT(*) FROM media_collection mc WHERE mc.media_id = a.id) AS collectionCount, "
            + FALLBACK_COVER + " "
            + "FROM media a "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + "<if test='status != null'> AND a.status = #{status}</if>"
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + "<if test='collectionId != null'> AND a.id IN (SELECT media_id FROM media_collection WHERE collection_id = #{collectionId})</if>"
            + "<if test='year != null'> AND a.year = #{year}</if>"
            + "<if test='source != null'> AND a.source = #{source}</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + "</where>"
            + "GROUP BY a.id HAVING latestAt IS NOT NULL "
            + "ORDER BY latestAt DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<MediaSummary> listByLatest(@Param("limit") int limit, @Param("offset") int offset,
                                    @Param("status") String status, @Param("format") String format,
                                    @Param("subcategoryId") Long subcategoryId,
                                    @Param("confirmed") Integer confirmed, @Param("collectionId") Long collectionId,
                                    @Param("year") Integer year, @Param("source") String source,
                                    @Param("q") String q);

    @Select("SELECT COUNT(*) FROM media WHERE deleted_at IS NULL")
    long countMedia();

    /** 带筛选的媒体总数（全部媒体/收藏夹分支）：状态/格式/子分类子树/待确认/收藏夹/年份/媒体标签 组合，与 listFiltered/listByCollection 同条件。 */
    @Select("<script>"
            + "SELECT COUNT(DISTINCT a.id) FROM media a "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + "<if test='status != null'> AND a.status = #{status}</if>"
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + "<if test='collectionId != null'> AND a.id IN (SELECT media_id FROM media_collection WHERE collection_id = #{collectionId})</if>"
            + "<if test='year != null'> AND a.year = #{year}</if>"
            + "<if test='source != null'> AND a.source = #{source}</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + "<if test='tagId != null'> AND a.id IN (SELECT media_id FROM media_tag WHERE tag_id = #{tagId})</if>"
            + "</where>"
            + "</script>")
    long countFiltered(@Param("status") String status, @Param("format") String format,
                       @Param("subcategoryId") Long subcategoryId, @Param("confirmed") Integer confirmed,
                       @Param("collectionId") Long collectionId, @Param("year") Integer year,
                       @Param("source") String source,
                       @Param("tagId") Long tagId, @Param("q") String q);

    /** 最近观看分支总数：与 listByLatest 同条件 + 仅统计打过标记的媒体。 */
    @Select("<script>"
            + "SELECT COUNT(DISTINCT a.id) FROM media a "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + "<if test='status != null'> AND a.status = #{status}</if>"
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + "<if test='collectionId != null'> AND a.id IN (SELECT media_id FROM media_collection WHERE collection_id = #{collectionId})</if>"
            + "<if test='year != null'> AND a.year = #{year}</if>"
            + "<if test='source != null'> AND a.source = #{source}</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + " AND EXISTS (SELECT 1 FROM clips c JOIN episode e ON e.id = c.episode_id WHERE e.media_id = a.id)"
            + "</where>"
            + "</script>")
    long countLatest(@Param("status") String status, @Param("format") String format,
                     @Param("subcategoryId") Long subcategoryId, @Param("confirmed") Integer confirmed,
                     @Param("collectionId") Long collectionId, @Param("year") Integer year,
                     @Param("source") String source, @Param("q") String q);

    /** 库中已有的全部首播年份（降序，供年份筛选下拉）。 */
    @Select("SELECT DISTINCT year FROM media WHERE year IS NOT NULL AND deleted_at IS NULL ORDER BY year DESC")
    List<Integer> listDistinctYears();

    /** 某收藏夹下的番剧列表；支持 status/format/子分类（子树收敛）/confirmed/year/source/q 筛选；sort=year 按首播年份排序（null 年份排最后），默认按 id 排序；order 控制升降序。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.year, a.media_format AS mediaFormat, a.subcategory, a.subcategory_id AS subcategoryId, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, a.source,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "(SELECT COUNT(*) FROM media_collection mc WHERE mc.media_id = a.id) AS collectionCount, "
            + FALLBACK_COVER + " "
            + "FROM media a "
            + "JOIN media_collection ac ON ac.media_id = a.id AND ac.collection_id = #{collectionId} "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + "<if test='status != null'> AND a.status = #{status}</if>"
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + "<if test='year != null'> AND a.year = #{year}</if>"
            + "<if test='source != null'> AND a.source = #{source}</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + "</where>"
            + "GROUP BY a.id "
            + "<choose>"
            + "<when test='sort != null and sort == \"latest\"'>ORDER BY latestAt DESC</when>"
            + "<when test='sort != null and sort == \"year\"'>ORDER BY (a.year IS NULL), a.year "
            + "<choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose></when>"
            + "<otherwise>ORDER BY a.id "
            + "<choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose></otherwise>"
            + "</choose>"
            + " LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<MediaSummary> listByCollection(@Param("collectionId") long collectionId, @Param("limit") int limit,
                                        @Param("offset") int offset,
                                        @Param("status") String status, @Param("format") String format,
                                        @Param("subcategoryId") Long subcategoryId,
                                        @Param("confirmed") Integer confirmed, @Param("year") Integer year,
                                        @Param("source") String source, @Param("q") String q,
                                        @Param("sort") String sort, @Param("order") String order);

    /** 媒体列表筛选：状态/格式/子分类/待确认/年份 组合，sort=latest 按最近标记倒序。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.year, a.media_format AS mediaFormat, a.subcategory, a.subcategory_id AS subcategoryId, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, a.source,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "(SELECT COUNT(*) FROM media_collection mc WHERE mc.media_id = a.id) AS collectionCount, "
            + FALLBACK_COVER + " "
            + "FROM media a "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + "<if test='status != null'> AND a.status = #{status}</if>"
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + "<if test='collectionId != null'> AND a.id IN (SELECT media_id FROM media_collection WHERE collection_id = #{collectionId})</if>"
            + "<if test='year != null'> AND a.year = #{year}</if>"
            + "<if test='source != null'> AND a.source = #{source}</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + "<if test='tagId != null'> AND a.id IN (SELECT media_id FROM media_tag WHERE tag_id = #{tagId})</if>"
            + "<if test='ids != null and !ids.isEmpty()'> AND a.id IN <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></if>"
            + "</where>"
            + "GROUP BY a.id "
            + "<choose>"
            + "<when test='sort != null and sort == \"latest\"'>ORDER BY latestAt DESC</when>"
            + "<when test='sort != null and sort == \"rating\"'>ORDER BY (a.rating IS NULL), a.rating "
            + "<choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose></when>"
            + "<otherwise>ORDER BY a.id "
            + "<choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose></otherwise>"
            + "</choose>"
            + " LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<MediaSummary> listFiltered(@Param("status") String status, @Param("format") String format,
                                    @Param("subcategoryId") Long subcategoryId,
                                    @Param("confirmed") Integer confirmed, @Param("collectionId") Long collectionId,
                                    @Param("sort") String sort, @Param("order") String order,
                                    @Param("year") Integer year,
                                    @Param("source") String source,
                                    @Param("tagId") Long tagId,
                                    @Param("q") String q,
                                    @Param("ids") List<Long> ids,
                                    @Param("limit") int limit, @Param("offset") int offset);

    /** 媒体关键词召回：标题/别名/备注/作品标签命中。 */
    @Select("<script>"
            + "SELECT DISTINCT a.id, a.title, a.year, a.original_title AS originalTitle, a.aliases, a.note, a.media_format AS mediaFormat, a.subcategory, "
            + "a.subcategory_id AS subcategoryId, "
            + "a.status, a.rating, a.cover_path AS coverPath, a.confirmed, a.source, a.created_at "
            + "FROM media a "
            + "LEFT JOIN media_tag at ON at.media_id = a.id "
            + "LEFT JOIN tag t ON t.id = at.tag_id "
            + "WHERE (a.title LIKE CONCAT('%', #{q}, '%') "
            + "   OR (a.aliases IS NOT NULL AND a.aliases LIKE CONCAT('%', #{q}, '%')) "
            + "   OR (a.note IS NOT NULL AND a.note LIKE CONCAT('%', #{q}, '%')) "
            + "   OR t.name LIKE CONCAT('%', #{q}, '%')) "
            + "   AND a.deleted_at IS NULL "
            + "ORDER BY a.id DESC LIMIT #{limit}"
            + "</script>")
    List<com.videotagger.entity.Media> searchByKeyword(@Param("q") String q, @Param("limit") int limit);

    /** 某格式下的媒体数（删除保护用）。 */
    @Select("SELECT COUNT(*) FROM media WHERE media_format = #{format} AND deleted_at IS NULL")
    long countByFormat(@Param("format") String format);

    /** 某子分类节点及其整棵子树下的媒体数（删除保护：任一层挂媒体即拒绝删）。 */
    @Select("SELECT COUNT(*) FROM media WHERE subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte) AND deleted_at IS NULL")
    long countBySubcategoryId(@Param("subcategoryId") Long subcategoryId);

    /** 指定节点及其全部子孙 id（子树收敛 / 子树计数，供前端按 parentId 组树时用）。 */
    @Select("WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{rootId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte")
    List<Long> subtreeIds(@Param("rootId") Long rootId);

    /** 某格式下各节点的直接媒体数（子树累计由 service 内存 DFS 完成）。 */
    @Select("SELECT a.subcategory_id AS subcategoryId, COUNT(*) AS count FROM media a "
            + "JOIN media_subcategory s ON s.id = a.subcategory_id "
            + "WHERE s.format_id = #{formatId} AND a.subcategory_id IS NOT NULL AND a.deleted_at IS NULL "
            + "GROUP BY a.subcategory_id")
    List<SubcategoryDirectCount> countDirectByFormat(@Param("formatId") long formatId);

    /** 按格式聚合统计。 */
    @Select("SELECT a.media_format AS format, COUNT(*) AS count FROM media a "
            + "WHERE a.deleted_at IS NULL "
            + "GROUP BY a.media_format ORDER BY count DESC")
    List<FormatCount> countGroupByFormat();

    /** 按子分类节点聚合统计（join 取节点当前名，改名后统计随之更新）。 */
    @Select("SELECT a.subcategory_id AS subcategoryId, s.name AS subcategory, COUNT(*) AS count FROM media a "
            + "JOIN media_subcategory s ON s.id = a.subcategory_id "
            + "WHERE a.subcategory_id IS NOT NULL AND a.deleted_at IS NULL "
            + "GROUP BY a.subcategory_id, s.name ORDER BY count DESC")
    List<SubcategoryCount> countGroupBySubcategory();

    /** 回收站：已删媒体列表（deleted_at 非空），可按标题模糊过滤，按删除时间倒序。 */
    @Select("<script>"
            + "SELECT * FROM media WHERE deleted_at IS NOT NULL "
            + "<if test='q != null and q != \"\"'> AND title LIKE CONCAT('%', #{q}, '%')</if> "
            + "ORDER BY deleted_at DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<Media> listTrash(@Param("q") String q, @Param("limit") int limit, @Param("offset") int offset);

    /** 回收站数量（可按标题过滤）。 */
    @Select("<script>"
            + "SELECT COUNT(*) FROM media WHERE deleted_at IS NOT NULL "
            + "<if test='q != null and q != \"\"'> AND title LIKE CONCAT('%', #{q}, '%')</if>"
            + "</script>")
    long countTrash(@Param("q") String q);

    /** 聚合行。 */
    record FormatCount(String format, long count) {
    }

    record SubcategoryCount(Long subcategoryId, String subcategory, long count) {
    }

    record SubcategoryDirectCount(Long subcategoryId, long count) {
    }
}
