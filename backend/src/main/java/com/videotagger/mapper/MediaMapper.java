package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Media;
import com.videotagger.service.MediaExportRow;
import com.videotagger.service.MediaSummary;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface MediaMapper extends BaseMapper<Media> {

    /** 代表性片段帧封面：番剧无显式封面时兜底（被标记最多、平分取最新）。 */
    String FALLBACK_COVER = "(SELECT c.cover_path FROM clips c JOIN episode e ON e.id = c.episode_id "
            + "WHERE e.media_id = a.id AND c.cover_path IS NOT NULL "
            + "ORDER BY (SELECT COUNT(*) FROM clip_tag WHERE clip_id = c.id) DESC, c.created_at DESC "
            + "LIMIT 1) AS fallbackCoverPath";

    /* ── 单值维度（v0.32 起全部多选）：同维度内**恒为「任一匹配」**，不提供且/或开关 ──
       `media.year`／`media.status` 是单值列，`external_work` 实测每部媒体只有 1 条条目
       （抽 200 部 200 条），所以这些维度选 2 个值再取「且」恒为空集 —— 不给开关是刻意的，
       别当成漏改去补。缺省 = 不筛（null / 空列表）。 */
    String STATUS_FILTER = "<if test='status != null and !status.isEmpty()'> AND a.status IN "
            + "<foreach collection='status' item='st' open='(' separator=',' close=')'>#{st}</foreach></if>";
    String YEAR_FILTER = "<if test='year != null and !year.isEmpty()'> AND a.year IN "
            + "<foreach collection='year' item='yr' open='(' separator=',' close=')'>#{yr}</foreach></if>";
    /** 季度筛选（`external_work.season`：SPRING / SUMMER / FALL / WINTER）。 */
    String SEASON_FILTER = "<if test='season != null and !season.isEmpty()'> AND a.id IN "
            + "(SELECT ews.media_id FROM external_work ews WHERE ews.season IN "
            + "<foreach collection='season' item='se' open='(' separator=',' close=')'>#{se}</foreach>)</if>";

    /* ── 多值维度（v0.32）：AND = 逐值各自成立（形状照抄 TAG_FILTER）；缺省 OR。 ── */
    String COLLECTION_IDS = "<foreach collection='collectionId' item='cid' open='(' separator=',' close=')'>#{cid}</foreach>";
    String COLLECTION_FILTER = "<if test='collectionId != null and !collectionId.isEmpty()'><choose>"
            + "<when test=\"collectionMode == 'AND'\"><foreach collection='collectionId' item='cid'>"
            + " AND a.id IN (SELECT media_id FROM media_collection WHERE collection_id = #{cid})</foreach></when>"
            + "<otherwise> AND a.id IN (SELECT media_id FROM media_collection WHERE collection_id IN "
            + COLLECTION_IDS + ")</otherwise></choose></if>";

    /**
     * 题材筛选（Bangumi tag，**多选**）：与外部作品的标签数组比对。
     *
     * <p>OR（缺省，= 历史语义）：`JSON_OVERLAPS` 任一命中即真，需 MySQL 8.0.17+；
     * AND：逐词 `JSON_CONTAINS`，每个词都命中才算。
     * 不用 `CAST(#{g} AS JSON)`：裸词（`奇幻`）不是合法 JSON，必须走 `JSON_QUOTE`（→ `"奇幻"`）。
     * SQLite 侧不维护（桌面轨道已冻结，见 `docs/rules.md` §13）。
     */
    String GENRE_FILTER = "<if test='genres != null and !genres.isEmpty()'><choose>"
            + "<when test=\"genreMode == 'AND'\"><foreach collection='genres' item='g'>"
            + " AND EXISTS (SELECT 1 FROM external_work eg WHERE eg.media_id = a.id AND eg.genres_json IS NOT NULL"
            + " AND JSON_CONTAINS(eg.genres_json, JSON_QUOTE(#{g})))</foreach></when>"
            + "<otherwise> AND EXISTS (SELECT 1 FROM external_work ew WHERE ew.media_id = a.id"
            + " AND ew.genres_json IS NOT NULL AND JSON_OVERLAPS(ew.genres_json, JSON_ARRAY("
            + "<foreach collection='genres' item='g' separator=','>#{g}</foreach>)))"
            + "</otherwise></choose></if>";

    /* ── 标签筛选（v0.31 标签重做）──────────────────────────────
       媒体视角 = **查询期三级并集**：媒体自己 ∪ 其下集 ∪ 其下片段，任一层命中即算。
       三级不再落库同步（旧 TagSyncService 已删），所以并集只发生在这些 SQL 里。
       谓词必须同时加进 5 条查询 + listExportRows，否则「切到最近观看就静默忽略条件」。
       tagMode：默认 AND（每个标签各自三级命中）；OR = 任一标签命中即可。
       实体视角（详情页标签池）只读本级关联表，不走这里。 */
    String TAG_IDS = "<foreach collection='tagIds' item='tid' open='(' separator=',' close=')'>#{tid}</foreach>";
    String TAG_UNION_ANY = "(SELECT media_id FROM media_tag WHERE tag_id IN " + TAG_IDS
            + " UNION SELECT e.media_id FROM episode_tag et JOIN episode e ON e.id = et.episode_id WHERE et.tag_id IN " + TAG_IDS
            + " UNION SELECT e.media_id FROM clip_tag ct JOIN clips c ON c.id = ct.clip_id "
            + "JOIN episode e ON e.id = c.episode_id WHERE ct.tag_id IN " + TAG_IDS + ")";
    String TAG_UNION_ONE = "(SELECT media_id FROM media_tag WHERE tag_id = #{tid}"
            + " UNION SELECT e.media_id FROM episode_tag et JOIN episode e ON e.id = et.episode_id WHERE et.tag_id = #{tid}"
            + " UNION SELECT e.media_id FROM clip_tag ct JOIN clips c ON c.id = ct.clip_id "
            + "JOIN episode e ON e.id = c.episode_id WHERE ct.tag_id = #{tid})";
    String TAG_FILTER = "<if test='tagIds != null and tagIds.size() > 0'>"
            + "<choose><when test=\"tagMode == 'OR'\"> AND a.id IN " + TAG_UNION_ANY + "</when>"
            + "<otherwise><foreach collection='tagIds' item='tid'> AND a.id IN " + TAG_UNION_ONE + "</foreach></otherwise>"
            + "</choose></if>";

    /** 卡片标签（v0.31）：三级并集的标签名、逗号分隔（媒体视角：任一层命中都算）。卡片只显示前两个。 */
    String TAG_NAMES_COL = ", (SELECT GROUP_CONCAT(DISTINCT t2.name ORDER BY t2.name SEPARATOR ',') FROM tag t2 JOIN ("
            + " SELECT mt.tag_id AS tid FROM media_tag mt WHERE mt.media_id = a.id"
            + " UNION SELECT et.tag_id FROM episode_tag et JOIN episode e9 ON e9.id = et.episode_id WHERE e9.media_id = a.id"
            + " UNION SELECT ct.tag_id FROM clip_tag ct JOIN clips c9 ON c9.id = ct.clip_id "
            + "JOIN episode e8 ON e8.id = c9.episode_id WHERE e8.media_id = a.id"
            + ") r9 ON r9.tid = t2.id) AS tags ";

    /**
     * 分组键（批次主规格「第四部分：媒体页分组」）：
     * - `season`：季度（唯一真值 `external_work.season`）
     * - `genresJson`：题材**原样 JSON 串**（前端 `JSON.parse`，Java 不解析）
     * - `collectionIds`：所属收藏夹 id 逗号串（前端 split）
     *
     * ⚠️ 与上面 `source` / `cover` 同法的 correlated 子查询；
     * **必须排在 `TAG_NAMES_COL` 之后**，且顺序与 `MediaSummary` 末尾三个字段逐字对应 ——
     * 那是 record，MyBatis 按**位置**装配（列顺序错了会把字符串塞进 Long）。
     */
    String GROUP_KEYS_COL = ", (SELECT ew2.season FROM external_work ew2 WHERE ew2.media_id = a.id ORDER BY ew2.id LIMIT 1) AS season"
            + ", (SELECT ew3.genres_json FROM external_work ew3 WHERE ew3.media_id = a.id ORDER BY ew3.id LIMIT 1) AS genresJson"
            + ", (SELECT GROUP_CONCAT(mc2.collection_id ORDER BY mc2.collection_id SEPARATOR ',') FROM media_collection mc2 WHERE mc2.media_id = a.id) AS collectionIds ";

    @Select("SELECT * FROM media WHERE title = #{title} AND deleted_at IS NULL LIMIT 1")
    Media selectByTitle(@Param("title") String title);

    /** 标题前缀匹配：供打标保存时归组到既有番剧（不含别名，别名归组属 Phase 3 LLM）。 */
    @Select("SELECT * FROM media WHERE title LIKE CONCAT(#{title}, '%') AND deleted_at IS NULL ORDER BY id LIMIT 1")
    Media selectByTitlePrefix(@Param("title") String title);

    /** 兼容旧方法名：标题或本地别名命中即可。 */
    @Select("SELECT * FROM media WHERE (title = #{title} OR (aliases IS NOT NULL AND aliases LIKE CONCAT('%', #{title}, '%'))) AND deleted_at IS NULL LIMIT 1")
    Media selectByTitleOrOriginal(@Param("title") String title);

    @Select(value = "SELECT * FROM media WHERE (title = #{title} OR (aliases IS NOT NULL AND aliases LIKE '%' || #{title} || '%')) AND deleted_at IS NULL ORDER BY id", databaseId = "sqlite")
    @Select(value = "SELECT * FROM media WHERE (title = #{title} OR (aliases IS NOT NULL AND aliases LIKE CONCAT('%', #{title}, '%'))) AND deleted_at IS NULL ORDER BY id", databaseId = "mysql")
    List<Media> listByTitleOrAlias(@Param("title") String title);

    @Select("SELECT ew.provider FROM external_work ew WHERE ew.media_id = #{mediaId} ORDER BY ew.id LIMIT 1")
    String selectProviderByMedia(@Param("mediaId") long mediaId);

    @Select("SELECT ew.cover_url FROM external_work ew WHERE ew.media_id = #{mediaId} ORDER BY ew.id LIMIT 1")
    String selectExternalCoverByMedia(@Param("mediaId") long mediaId);

    /** 番剧卡片墙：含片段数与最新标记时间，按创建倒序。 */
    @Select("SELECT a.id, a.title, a.year, a.media_format AS mediaFormat, a.subcategory, a.subcategory_id AS subcategoryId, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, (SELECT ew.provider FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS source,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "(SELECT COUNT(*) FROM media_collection mc WHERE mc.media_id = a.id) AS collectionCount, "
            + FALLBACK_COVER + ", (SELECT ew.cover_url FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS externalCoverUrl " + TAG_NAMES_COL + GROUP_KEYS_COL
            + "FROM media a "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "WHERE a.deleted_at IS NULL "
            + "GROUP BY a.id ORDER BY a.id DESC LIMIT #{limit} OFFSET #{offset}")
    List<MediaSummary> listSummaries(@Param("limit") int limit, @Param("offset") int offset);

    /** 最近观看：打过标记即算，按最新标记时间倒序；支持 status/format/子分类（子树收敛）/confirmed/collectionId/year 筛选。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.year, a.media_format AS mediaFormat, a.subcategory, a.subcategory_id AS subcategoryId, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, (SELECT ew.provider FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS source,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "(SELECT COUNT(*) FROM media_collection mc WHERE mc.media_id = a.id) AS collectionCount, "
            + FALLBACK_COVER + ", (SELECT ew.cover_url FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS externalCoverUrl " + TAG_NAMES_COL + GROUP_KEYS_COL
            + "FROM media a "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + STATUS_FILTER
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + COLLECTION_FILTER
            + YEAR_FILTER
            + "<if test='source != null'> AND a.id IN (SELECT ew.media_id FROM external_work ew WHERE ew.provider = #{source})</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + TAG_FILTER
            + GENRE_FILTER
            + SEASON_FILTER
            + "</where>"
            + "GROUP BY a.id HAVING latestAt IS NOT NULL "
            + "ORDER BY latestAt DESC, a.id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<MediaSummary> listByLatest(@Param("limit") int limit, @Param("offset") int offset,
                                    @Param("status") List<String> status, @Param("format") String format,
                                    @Param("subcategoryId") Long subcategoryId,
                                    @Param("confirmed") Integer confirmed, @Param("collectionId") List<Long> collectionId,
                                    @Param("year") List<Integer> year, @Param("source") String source,
                                    @Param("q") String q,
                                    @Param("tagIds") List<Long> tagIds, @Param("tagMode") String tagMode,
                                    @Param("genreMode") String genreMode, @Param("collectionMode") String collectionMode,
                                       @Param("genres") List<String> genres, @Param("season") List<String> season);

    @Select("SELECT COUNT(*) FROM media WHERE deleted_at IS NULL")
    long countMedia();

    /** 带筛选的媒体总数（全部媒体/收藏夹分支）：状态/格式/子分类子树/待确认/收藏夹/年份/媒体标签 组合，与 listFiltered/listByCollection 同条件。 */
    @Select("<script>"
            + "SELECT COUNT(DISTINCT a.id) FROM media a "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + STATUS_FILTER
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + COLLECTION_FILTER
            + YEAR_FILTER
            + "<if test='source != null'> AND a.id IN (SELECT ew.media_id FROM external_work ew WHERE ew.provider = #{source})</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + TAG_FILTER
            + GENRE_FILTER
            + SEASON_FILTER
            + "</where>"
            + "</script>")
    long countFiltered(@Param("status") List<String> status, @Param("format") String format,
                       @Param("subcategoryId") Long subcategoryId, @Param("confirmed") Integer confirmed,
                       @Param("collectionId") List<Long> collectionId, @Param("year") List<Integer> year,
                       @Param("source") String source,
                       @Param("tagIds") List<Long> tagIds, @Param("tagMode") String tagMode,
                       @Param("genreMode") String genreMode, @Param("collectionMode") String collectionMode,
                       @Param("q") String q,
                       @Param("genres") List<String> genres, @Param("season") List<String> season);

    /** 最近观看分支总数：与 listByLatest 同条件 + 仅统计打过标记的媒体。 */
    @Select("<script>"
            + "SELECT COUNT(DISTINCT a.id) FROM media a "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + STATUS_FILTER
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + COLLECTION_FILTER
            + YEAR_FILTER
            + "<if test='source != null'> AND a.id IN (SELECT ew.media_id FROM external_work ew WHERE ew.provider = #{source})</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + TAG_FILTER
            + GENRE_FILTER
            + SEASON_FILTER
            + " AND EXISTS (SELECT 1 FROM clips c JOIN episode e ON e.id = c.episode_id WHERE e.media_id = a.id)"
            + "</where>"
            + "</script>")
    long countLatest(@Param("status") List<String> status, @Param("format") String format,
                     @Param("subcategoryId") Long subcategoryId, @Param("confirmed") Integer confirmed,
                     @Param("collectionId") List<Long> collectionId, @Param("year") List<Integer> year,
                     @Param("source") String source, @Param("q") String q,
                     @Param("tagIds") List<Long> tagIds, @Param("tagMode") String tagMode,
                     @Param("genreMode") String genreMode, @Param("collectionMode") String collectionMode,
                     @Param("genres") List<String> genres, @Param("season") List<String> season);

    /** 库中已有的全部首播年份（降序，供年份筛选下拉）。 */
    @Select("SELECT DISTINCT year FROM media WHERE year IS NOT NULL AND deleted_at IS NULL ORDER BY year DESC")
    List<Integer> listDistinctYears();

    /** 某收藏夹下的番剧列表；支持 status/format/子分类（子树收敛）/confirmed/year/source/q 筛选；sort=year 按首播年份排序（null 年份排最后），默认按 id 排序；order 控制升降序。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.year, a.media_format AS mediaFormat, a.subcategory, a.subcategory_id AS subcategoryId, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, (SELECT ew.provider FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS source,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "(SELECT COUNT(*) FROM media_collection mc WHERE mc.media_id = a.id) AS collectionCount, "
            + FALLBACK_COVER + ", (SELECT ew.cover_url FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS externalCoverUrl " + TAG_NAMES_COL + GROUP_KEYS_COL
            + "FROM media a "
            + "JOIN media_collection ac ON ac.media_id = a.id AND ac.collection_id = #{collectionId} "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + STATUS_FILTER
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + YEAR_FILTER
            + "<if test='source != null'> AND a.id IN (SELECT ew.media_id FROM external_work ew WHERE ew.provider = #{source})</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + GENRE_FILTER
            + SEASON_FILTER
            + "</where>"
            + "GROUP BY a.id "
            + "<choose>"
            + "<when test='sort != null and sort == \"latest\"'>ORDER BY latestAt DESC, a.id DESC</when>"
            + "<when test='sort != null and sort == \"year\"'>ORDER BY (a.year IS NULL), a.year "
            + "<choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose>"
            + ", a.id <choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose></when>"
            + "<otherwise>ORDER BY a.id "
            + "<choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose></otherwise>"
            + "</choose>"
            + " LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<MediaSummary> listByCollection(@Param("collectionId") long collectionId, @Param("limit") int limit,
                                        @Param("offset") int offset,
                                        @Param("status") List<String> status, @Param("format") String format,
                                        @Param("subcategoryId") Long subcategoryId,
                                        @Param("confirmed") Integer confirmed, @Param("year") List<Integer> year,
                                        @Param("source") String source, @Param("q") String q,
                                        @Param("sort") String sort, @Param("order") String order,
                                        @Param("genreMode") String genreMode, @Param("collectionMode") String collectionMode,
                                       @Param("genres") List<String> genres, @Param("season") List<String> season);

    /**
     * 清单导出：候选（当前筛选，同一套条件）/ 已选（ids）→ 含集数与标签的轻量投影。
     *
     * 集数取 Bangumi 的 episode_count，探测不到时回落到本地 episode 行数；标签是 media ∪ episode ∪ clip
     * 三级标签名的逗号串（与媒体详情页看到的标签同一套来源）。
     *
     * **无行数上限**（2026-09-25 删掉原来的 `LIMIT 500`）：那个上限把「异世界」收藏夹的 557 部**静默截成 500**
     * （按年份降序 → 丢的是 2015 年及以前全部 57 部），而实测开销根本不需要它（557 部 0.83s / 全库 5249 部 2.46s）。
     * 别再加回来 —— 要限制就该让调用方显式传，且截断必须对用户可见。
     * ⚠️ 列顺序必须与 MediaExportRow 的字段顺序一致。
     */
    @Select("<script>"
            + "SELECT a.id, a.title, a.year, a.subcategory, a.media_format AS mediaFormat, "
            + "(SELECT ew.provider FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS source, "
            + "COALESCE((SELECT ew2.episode_count FROM external_work ew2 WHERE ew2.media_id = a.id AND ew2.episode_count IS NOT NULL ORDER BY ew2.id LIMIT 1), "
            + "  (SELECT COUNT(*) FROM episode e WHERE e.media_id = a.id)) AS episodeCount, "
            + "  (SELECT COUNT(*) FROM clips c JOIN episode e ON e.id = c.episode_id WHERE e.media_id = a.id) AS clipCount, "
            + "  (SELECT GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ',') FROM tag t JOIN ("
            + "    SELECT tag_id AS tid FROM media_tag WHERE media_id = a.id "
            + "    UNION ALL SELECT et.tag_id FROM episode_tag et JOIN episode e2 ON e2.id = et.episode_id WHERE e2.media_id = a.id "
            + "    UNION ALL SELECT ct.tag_id FROM clip_tag ct JOIN clips c2 ON c2.id = ct.clip_id JOIN episode e3 ON e3.id = c2.episode_id WHERE e3.media_id = a.id"
            + "  ) r ON r.tid = t.id) AS tags "
            + "FROM media a "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + STATUS_FILTER
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + COLLECTION_FILTER
            + YEAR_FILTER
            + "<if test='source != null'> AND a.id IN (SELECT ew.media_id FROM external_work ew WHERE ew.provider = #{source})</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + TAG_FILTER
            + "<if test='ids != null and !ids.isEmpty()'> AND a.id IN <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></if>"
            + GENRE_FILTER
            + SEASON_FILTER
            + "</where>"
            + "GROUP BY a.id ORDER BY (a.year IS NULL), a.year DESC, a.id DESC"
            + "</script>")
    List<MediaExportRow> listExportRows(@Param("status") List<String> status, @Param("format") String format,
                                       @Param("subcategoryId") Long subcategoryId,
                                       @Param("confirmed") Integer confirmed, @Param("collectionId") List<Long> collectionId,
                                       @Param("year") List<Integer> year, @Param("source") String source,
                                       @Param("tagIds") List<Long> tagIds, @Param("tagMode") String tagMode,
                                       @Param("genreMode") String genreMode, @Param("collectionMode") String collectionMode,
                                       @Param("q") String q,
                                       @Param("ids") List<Long> ids,
                                       @Param("genres") List<String> genres, @Param("season") List<String> season);

    /** 媒体列表筛选：状态/格式/子分类/待确认/年份 组合，sort=latest 按最近标记倒序。 */
    @Select("<script>"
            + "SELECT a.id, a.title, a.year, a.media_format AS mediaFormat, a.subcategory, a.subcategory_id AS subcategoryId, a.status, a.rating, a.cover_path AS coverPath, a.confirmed, (SELECT ew.provider FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS source,"
            + "COUNT(c.id) AS clipCount, MAX(c.created_at) AS latestAt, "
            + "(SELECT COUNT(*) FROM media_collection mc WHERE mc.media_id = a.id) AS collectionCount, "
            + FALLBACK_COVER + ", (SELECT ew.cover_url FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS externalCoverUrl " + TAG_NAMES_COL + GROUP_KEYS_COL
            + "FROM media a "
            + "LEFT JOIN episode e ON e.media_id = a.id "
            + "LEFT JOIN clips c ON c.episode_id = e.id "
            + "<where>"
            + "<if test='true'> AND a.deleted_at IS NULL</if>"
            + STATUS_FILTER
            + "<if test='format != null'> AND a.media_format = #{format}</if>"
            + "<if test='subcategoryId != null'> AND a.subcategory_id IN ("
            + "WITH RECURSIVE cte AS ("
            + "SELECT id FROM media_subcategory WHERE id = #{subcategoryId} "
            + "UNION ALL SELECT s.id FROM media_subcategory s JOIN cte ON s.parent_id = cte.id"
            + ") SELECT id FROM cte)</if>"
            + "<if test='confirmed != null'> AND a.confirmed = #{confirmed}</if>"
            + COLLECTION_FILTER
            + YEAR_FILTER
            + "<if test='source != null'> AND a.id IN (SELECT ew.media_id FROM external_work ew WHERE ew.provider = #{source})</if>"
            + "<if test='q != null and q != \"\"'> AND a.title LIKE CONCAT('%', #{q}, '%')</if>"
            + TAG_FILTER
            + "<if test='ids != null and !ids.isEmpty()'> AND a.id IN <foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach></if>"
            + GENRE_FILTER
            + SEASON_FILTER
            + "</where>"
            + "GROUP BY a.id "
            + "<choose>"
            + "<when test='sort != null and sort == \"latest\"'>ORDER BY latestAt DESC, a.id DESC</when>"
            // ⚠️ 分页排序**必须是全序**：每个分支末尾的 `, a.id <dir>` 不是装饰 —— 去掉它，并列行
            // （同一年 / 同评分 / 同 latestAt）在 MySQL 里顺序不稳定，LIMIT/OFFSET 会让某些行重复出现、
            // 另一些被跳过（2026-09-26 实测：5 页艹 150 行只有 116 行唯一，前端按 id 去重后加载数变少
            // —— 用户报「2026 异世界有 87 部，只加载 57 部」）。
            + "<when test='sort != null and sort == \"rating\"'>ORDER BY (a.rating IS NULL), a.rating "
            + "<choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose>"
            + ", a.id <choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose></when>"
            + "<when test='sort != null and sort == \"year\"'>ORDER BY (a.year IS NULL), a.year "
            + "<choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose>"
            + ", a.id <choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose></when>"
            + "<otherwise>ORDER BY a.id "
            + "<choose><when test='order != null and order == \"asc\"'>ASC</when><otherwise>DESC</otherwise></choose></otherwise>"
            + "</choose>"
            + " LIMIT #{limit} OFFSET #{offset}"
            + "</script>")


    List<MediaSummary> listFiltered(@Param("status") List<String> status, @Param("format") String format,
                                    @Param("subcategoryId") Long subcategoryId,
                                    @Param("confirmed") Integer confirmed, @Param("collectionId") List<Long> collectionId,
                                    @Param("sort") String sort, @Param("order") String order,
                                    @Param("year") List<Integer> year,
                                    @Param("source") String source,
                                    @Param("tagIds") List<Long> tagIds, @Param("tagMode") String tagMode,
                                    @Param("genreMode") String genreMode, @Param("collectionMode") String collectionMode,
                                    @Param("q") String q,
                                    @Param("ids") List<Long> ids,
                                    @Param("genres") List<String> genres, @Param("season") List<String> season,
                                    @Param("limit") int limit, @Param("offset") int offset);

    /**
     * 题材选项字典：白名单 ∩ 库内实际出现的题材 + 各自动媒体数（降序）。
     *
     * <p>只算「已关联外部作品」的媒体 —— 没关联就没有题材可谈。
     */
    @Select("<script>"
            + "SELECT t.g AS genre, COUNT(DISTINCT w.media_id) AS count "
            + "FROM external_work w "
            + "JOIN media m ON m.id = w.media_id AND m.deleted_at IS NULL "
            + "JOIN JSON_TABLE(w.genres_json, '$[*]' COLUMNS (g VARCHAR(64) PATH '$')) t "
            + "WHERE w.media_id IS NOT NULL AND w.genres_json IS NOT NULL "
            + "AND t.g IN <foreach collection='whitelist' item='g' open='(' separator=',' close=')'>#{g}</foreach> "
            + "GROUP BY t.g ORDER BY count DESC"
            + "</script>")
    List<GenreCount> listGenreCounts(@Param("whitelist") List<String> whitelist);

    /**
     * 媒体标签选项字典：**只列真正能筛出结果的标签** + 各自媒体数（降序）。
     *
     * <p>v0.31：口径与筛选语义对齐 —— 筛选是「三级任一层命中即算」，所以字典也是
     * 三级并集后数 `COUNT(DISTINCT media_id)`（否则只挂在片段上的标签在面板里根本列不出来）。
     */
    @Select("SELECT t.id AS tagId, t.name AS name, COUNT(DISTINCT x.media_id) AS count FROM ("
            + "  SELECT mt.tag_id AS tag_id, mt.media_id AS media_id FROM media_tag mt"
            + "  UNION SELECT et.tag_id, e.media_id FROM episode_tag et JOIN episode e ON e.id = et.episode_id"
            + "  UNION SELECT ct.tag_id, e.media_id FROM clip_tag ct JOIN clips c ON c.id = ct.clip_id"
            + "    JOIN episode e ON e.id = c.episode_id"
            + ") x JOIN tag t ON t.id = x.tag_id JOIN media m ON m.id = x.media_id AND m.deleted_at IS NULL "
            + "GROUP BY t.id, t.name ORDER BY count DESC, t.id")
    List<TagCount> listTagCounts();

    /** 媒体关键词召回：标题/别名/备注/作品标签命中。 */
    @Select("<script>"
            + "SELECT DISTINCT a.id, a.title, a.year, a.aliases, a.note, a.media_format AS mediaFormat, a.subcategory, "
            + "a.subcategory_id AS subcategoryId, "
            + "a.status, a.rating, a.cover_path AS coverPath, a.confirmed, (SELECT ew.provider FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS source, a.created_at "
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

    /**
     * 回收站：已删媒体列表（deleted_at 非空），可按标题模糊过滤，按删除时间倒序。
     *
     * ⚠️ `, id DESC` 是全序兜底：批量删除时多行的 `deleted_at` 会**完全相同**，
     * 没有它 LIMIT/OFFSET 翻页就会重复/跳行（同 `listFiltered` 的并列排序坑，2026-09-26）。
     */
    @Select("<script>"
            + "SELECT * FROM media WHERE deleted_at IS NOT NULL "
            + "<if test='q != null and q != \"\"'> AND title LIKE CONCAT('%', #{q}, '%')</if> "
            + "ORDER BY deleted_at DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<Media> listTrash(@Param("q") String q, @Param("limit") int limit, @Param("offset") int offset);

    /** 回收站数量（可按标题过滤）。 */
    @Select("<script>"
            + "SELECT COUNT(*) FROM media WHERE deleted_at IS NOT NULL "
            + "<if test='q != null and q != \"\"'> AND title LIKE CONCAT('%', #{q}, '%')</if>"
            + "</script>")
    long countTrash(@Param("q") String q);

    /** 换绑重建：清除旧条目封面路径（展示改走新条目远程封面）。 */
    @Update("UPDATE media SET cover_path = NULL WHERE id = #{id}")
    int clearCover(@Param("id") long id);

    /**
     * 渲染输入用的**批量投影**：一次把几十~几百部的渲染字段取齐。
     *
     * **为什么要有它**（2026-09-26 用户报「全选后预览不生效」）：原先 `RecommendService.buildRenderInput`
     * 是 `for (id : ids) mediaService.get(id)`，而 `get()` 每次 8 条 SQL，再加构建循环里逐部的
     * tags / external_work / collections / 子分类 —— 实测 **18 条 SQL/部**、185-207ms/部，
     * 137 部要 25 秒（首启 40 秒）。这里用一条带标量子查询的 SQL 顶掉 `get()` 的 8 条。
     */
    @Select("<script>"
            + "SELECT a.id, a.title, a.year, a.season, a.aliases, a.media_format AS mediaFormat, a.status, a.rating, "
            + "IFNULL(a.note,'') AS note, a.cover_path AS coverPath, a.subcategory, a.subcategory_id AS subcategoryId, "
            + "(SELECT ew.cover_url FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS externalCoverUrl, "
            + "(SELECT ew.provider FROM external_work ew WHERE ew.media_id = a.id ORDER BY ew.id LIMIT 1) AS provider, "
            + "(SELECT COUNT(*) FROM episode e WHERE e.media_id = a.id) AS episodeRows, "
            + "(SELECT COUNT(*) FROM clips c JOIN episode e ON e.id = c.episode_id WHERE e.media_id = a.id) AS clipCount, "
            + "(SELECT c.cover_path FROM clips c JOIN episode e2 ON e2.id = c.episode_id "
            + "WHERE e2.media_id = a.id AND c.cover_path IS NOT NULL "
            + "ORDER BY (SELECT COUNT(*) FROM clip_tag WHERE clip_id = c.id) DESC, c.created_at DESC LIMIT 1) AS fallbackCoverPath "
            + "FROM media a WHERE a.deleted_at IS NULL AND a.id IN "
            + "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>"
            + "</script>")
    List<RenderMediaRow> listRenderBatch(@Param("ids") List<Long> ids);

    /**
     * 渲染输入的媒体投影行。**列顺序必须与 SELECT 一致**（record 按位映射）。
     *
     * 同时供「渲染输入」与「素材指纹」两条路用（两者要的列都在这里，合并后各自省掉一轮逐部取数）。
     */
    record RenderMediaRow(Long id, String title, Integer year, Integer season, String aliases, String mediaFormat,
                          String status, java.math.BigDecimal rating, String note, String coverPath, String subcategory,
                          Long subcategoryId, String externalCoverUrl, String provider, long episodeRows, long clipCount,
                          String fallbackCoverPath) {
    }

    /** 聚合行。 */
    record GenreCount(String genre, long count) {
    }

    record TagCount(Long tagId, String name, long count) {
    }

    record FormatCount(String format, long count) {
    }

    record SubcategoryCount(Long subcategoryId, String subcategory, long count) {
    }

    record SubcategoryDirectCount(Long subcategoryId, long count) {
    }
}
