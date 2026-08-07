package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Tag;
import com.videotagger.service.TagUsage;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface TagMapper extends BaseMapper<Tag> {

    /** 无则插入（INSERT IGNORE 防并发冲突），用于"无则建有则关联"。 */
    @Insert("INSERT IGNORE INTO tag(name, created_at) VALUES(#{name}, #{createdAt})")
    void insertIgnore(@Param("name") String name, @Param("createdAt") long createdAt);

    @Select("SELECT * FROM tag WHERE name = #{name} LIMIT 1")
    Tag selectByName(@Param("name") String name);

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

    /** 某标签被三级引用的总数（删孤儿检查）。 */
    @Select("SELECT (SELECT COUNT(*) FROM media_tag WHERE tag_id = #{tagId}) "
            + "+ (SELECT COUNT(*) FROM episode_tag WHERE tag_id = #{tagId}) "
            + "+ (SELECT COUNT(*) FROM clip_tag WHERE tag_id = #{tagId})")
    long countRefs(@Param("tagId") long tagId);

    @Select("SELECT media_id FROM media_tag WHERE tag_id = #{tagId}")
    List<Long> mediaIdsByTag(@Param("tagId") long tagId);

    @Select("SELECT episode_id FROM episode_tag WHERE tag_id = #{tagId}")
    List<Long> episodeIdsByTag(@Param("tagId") long tagId);

    @Select("SELECT clip_id FROM clip_tag WHERE tag_id = #{tagId}")
    List<Long> clipIdsByTag(@Param("tagId") long tagId);
}
