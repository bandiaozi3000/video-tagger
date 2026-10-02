package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Tag;
import com.videotagger.service.TagUsage;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TagMapper extends BaseMapper<Tag> {

    /** 无则插入（幂等防并发冲突）：SQLite INSERT OR IGNORE / MySQL INSERT IGNORE（databaseId 方言分支）。 */
    @Insert(value = "INSERT OR IGNORE INTO tag(name, created_at) VALUES(#{name}, #{createdAt})", databaseId = "sqlite")
    @Insert(value = "INSERT IGNORE INTO tag(name, created_at) VALUES(#{name}, #{createdAt})", databaseId = "mysql")
    void insertIgnore(@Param("name") String name, @Param("createdAt") long createdAt);

    @Select("SELECT * FROM tag WHERE name = #{name} LIMIT 1")
    Tag selectByName(@Param("name") String name);

    /** 词表总数（统计页口径 = 词表，与标签管理页一致；v0.31 起不再数 `clips.tag`）。 */
    @Select("SELECT COUNT(*) FROM tag")
    long countAll();

    /** 批量取片段的标签（派发展示用 `Clip.tag/tagIds/tagNames`；按 clip_id + tag id 排序）。 */
    @Select("<script>"
            + "SELECT ct.clip_id AS clipId, t.id AS tagId, t.name AS name "
            + "FROM clip_tag ct JOIN tag t ON t.id = ct.tag_id WHERE ct.clip_id IN "
            + "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach> "
            + "ORDER BY ct.clip_id, t.id"
            + "</script>")
    List<ClipTagName> namesByClipIds(@Param("ids") List<Long> ids);

    /** 片段标签行（batch 查询结果）。 */
    record ClipTagName(Long clipId, Long tagId, String name) {
    }

    /** 标签词库补全（前缀模糊，按词条先后）。 */
    @Select("SELECT * FROM tag WHERE name LIKE CONCAT('%', #{prefix}, '%') ORDER BY id LIMIT #{limit}")
    List<Tag> searchByPrefix(@Param("prefix") String prefix, @Param("limit") int limit);

    /** 全局词条 + 三级引用计数（补全兜底 / 管理页通用池）。 */
    @Select("SELECT t.id, t.name, t.created_at, "
            + "(SELECT COUNT(*) FROM media_tag mt WHERE mt.tag_id = t.id) AS media_count, "
            + "(SELECT COUNT(*) FROM episode_tag et WHERE et.tag_id = t.id) AS episode_count, "
            + "(SELECT COUNT(*) FROM clip_tag ct WHERE ct.tag_id = t.id) AS clip_count, "
            + "0 AS ref_count "
            + "FROM tag t "
            + "ORDER BY media_count + episode_count + clip_count DESC, t.id")
    List<TagUsage> countGlobal();

    /** **实体视角**：某媒体**自己**挂的标签 + 引用次数（v0.31：不带下级并集；筛选用媒体视角见 {@code MediaMapper.TAG_FILTER}）。 */
    @Select("SELECT t.id, t.name, t.created_at, 1 AS media_count, 0 AS episode_count, 0 AS clip_count, 1 AS ref_count "
            + "FROM tag t JOIN media_tag mt ON mt.tag_id = t.id WHERE mt.media_id = #{mediaId} ORDER BY t.id")
    List<TagUsage> ownTagsOfMedia(@Param("mediaId") long mediaId);

    /** **实体视角**：某集**自己**挂的标签 + 引用次数（不带其下片段）。 */
    @Select("SELECT t.id, t.name, t.created_at, 0 AS media_count, 1 AS episode_count, 0 AS clip_count, 1 AS ref_count "
            + "FROM tag t JOIN episode_tag et ON et.tag_id = t.id WHERE et.episode_id = #{episodeId} ORDER BY t.id")
    List<TagUsage> ownTagsOfEpisode(@Param("episodeId") long episodeId);

    /** 某媒体范围内标签 + 该媒体内引用次数（media_tag ∪ 其下 episode_tag ∪ 其下 clip_tag）。 */
    @Select("SELECT t.id, t.name, t.created_at, 0 AS media_count, 0 AS episode_count, 0 AS clip_count, COUNT(*) AS ref_count "
            + "FROM tag t JOIN ("
            + "SELECT tag_id AS tid FROM media_tag WHERE media_id = #{mediaId} "
            + "UNION ALL "
            + "SELECT et.tag_id FROM episode_tag et JOIN episode e ON e.id = et.episode_id WHERE e.media_id = #{mediaId} "
            + "UNION ALL "
            + "SELECT ct.tag_id FROM clip_tag ct JOIN clips c ON c.id = ct.clip_id "
            + "JOIN episode e ON e.id = c.episode_id WHERE e.media_id = #{mediaId}"
            + ") r ON r.tid = t.id "
            + "GROUP BY t.id, t.name, t.created_at "
            + "ORDER BY ref_count DESC, t.id")
    List<TagUsage> countByMedia(@Param("mediaId") long mediaId);

    /** 批量版标签计数（渲染输入用）：一次取多部媒体的标签名与引用数，按 media_id + 引用次数倒序。 */
    @Select("<script>"
            + "SELECT x.media_id AS mediaId, t.name AS name, COUNT(*) AS refCount "
            + "FROM tag t JOIN ("
            + "SELECT mt.tag_id AS tid, mt.media_id AS media_id FROM media_tag mt WHERE mt.media_id IN "
            + "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach> "
            + "UNION ALL "
            + "SELECT et.tag_id AS tid, e.media_id AS media_id FROM episode_tag et JOIN episode e ON e.id = et.episode_id WHERE e.media_id IN "
            + "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach> "
            + "UNION ALL "
            + "SELECT ct.tag_id AS tid, e.media_id AS media_id FROM clip_tag ct JOIN clips c ON c.id = ct.clip_id "
            + "JOIN episode e ON e.id = c.episode_id WHERE e.media_id IN "
            + "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>"
            + ") x ON x.tid = t.id "
            + "GROUP BY x.media_id, t.id, t.name ORDER BY x.media_id, refCount DESC, t.id"
            + "</script>")
    List<MediaTagUsage> countByMediaIds(@Param("ids") List<Long> ids);

    /** 媒体维度的标签使用行（批量用；与 {@link TagUsage} 的区别是带上了 media_id）。 */
    record MediaTagUsage(Long mediaId, String name, long refCount) {
    }

    /** 某集范围内标签 + 该集内引用次数（集本身 episode_tag ∪ 其下片段 clip_tag）。 */
    @Select("SELECT t.id, t.name, t.created_at, 0 AS media_count, 0 AS episode_count, 0 AS clip_count, COUNT(*) AS ref_count "
            + "FROM tag t JOIN ("
            + "SELECT tag_id AS tid FROM episode_tag WHERE episode_id = #{episodeId} "
            + "UNION ALL "
            + "SELECT ct.tag_id FROM clip_tag ct JOIN clips c ON c.id = ct.clip_id WHERE c.episode_id = #{episodeId}"
            + ") r ON r.tid = t.id "
            + "GROUP BY t.id, t.name, t.created_at "
            + "ORDER BY ref_count DESC, t.id")
    List<TagUsage> countByEpisode(@Param("episodeId") long episodeId);

    /** 某标签被三级引用的总数（删孤儿检查）。 */    @Select("SELECT (SELECT COUNT(*) FROM media_tag WHERE tag_id = #{tagId}) "
            + "+ (SELECT COUNT(*) FROM episode_tag WHERE tag_id = #{tagId}) "
            + "+ (SELECT COUNT(*) FROM clip_tag WHERE tag_id = #{tagId})")
    long countRefs(@Param("tagId") long tagId);

    @Select("SELECT media_id FROM media_tag WHERE tag_id = #{tagId}")
    List<Long> mediaIdsByTag(@Param("tagId") long tagId);

    /** 反查：挂了这个词的媒体（带标题，供标签管理页点开看“谁在用”）。 */
    @Select("SELECT m.id AS id, m.title AS title, NULL AS parentId, NULL AS episodeNo "
            + "FROM media m JOIN media_tag mt ON mt.media_id = m.id "
            + "WHERE mt.tag_id = #{tagId} AND m.deleted_at IS NULL ORDER BY m.id")
    List<UsageRow> mediaRowsByTag(@Param("tagId") long tagId);

    /** 反查：挂了这个词的集（带所属媒体，供跳转）。 */
    @Select("SELECT e.id AS id, e.title AS title, e.media_id AS parentId, e.episode_no AS episodeNo "
            + "FROM episode e JOIN episode_tag et ON et.episode_id = e.id "
            + "WHERE et.tag_id = #{tagId} ORDER BY e.media_id, e.episode_no")
    List<UsageRow> episodeRowsByTag(@Param("tagId") long tagId);

    /** 反查：挂了这个词的片段。 */
    @Select("SELECT c.id AS id, c.title AS title, c.episode_id AS parentId, NULL AS episodeNo FROM clips c "
            + "JOIN clip_tag ct ON ct.clip_id = c.id WHERE ct.tag_id = #{tagId} ORDER BY c.episode_id, c.timestamp_sec")
    List<UsageRow> clipRowsByTag(@Param("tagId") long tagId);

    /** 使用位置行（id + 标题 + 所属 id/episode_no，按层级不同部分字段为空）。 */
    record UsageRow(Long id, String title, Long parentId, Integer episodeNo) {
    }

    @Select("SELECT episode_id FROM episode_tag WHERE tag_id = #{tagId}")
    List<Long> episodeIdsByTag(@Param("tagId") long tagId);

    @Select("SELECT clip_id FROM clip_tag WHERE tag_id = #{tagId}")
    List<Long> clipIdsByTag(@Param("tagId") long tagId);
}
