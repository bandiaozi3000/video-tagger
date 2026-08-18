package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.EpisodeTag;
import com.videotagger.entity.Tag;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface EpisodeTagMapper extends BaseMapper<EpisodeTag> {

    @Insert(value = "INSERT OR IGNORE INTO episode_tag(episode_id, tag_id) VALUES(#{episodeId}, #{tagId})", databaseId = "sqlite")
    @Insert(value = "INSERT IGNORE INTO episode_tag(episode_id, tag_id) VALUES(#{episodeId}, #{tagId})", databaseId = "mysql")
    void insertIgnore(@Param("episodeId") long episodeId, @Param("tagId") long tagId);

    @Delete("DELETE FROM episode_tag WHERE episode_id = #{episodeId} AND tag_id = #{tagId}")
    void deleteLink(@Param("episodeId") long episodeId, @Param("tagId") long tagId);

    @Delete("DELETE FROM episode_tag WHERE episode_id = #{episodeId}")
    void deleteByEpisode(@Param("episodeId") long episodeId);

    @Select("SELECT t.* FROM tag t JOIN episode_tag et ON et.tag_id = t.id "
            + "WHERE et.episode_id = #{episodeId} ORDER BY t.id")
    List<Tag> selectTags(@Param("episodeId") long episodeId);

    /** 标签合并：源引用迁移到目标（幂等防重复）。 */
    @Insert(value = "INSERT OR IGNORE INTO episode_tag(episode_id, tag_id) SELECT episode_id, #{toId} FROM episode_tag WHERE tag_id = #{fromId}", databaseId = "sqlite")
    @Insert(value = "INSERT IGNORE INTO episode_tag(episode_id, tag_id) SELECT episode_id, #{toId} FROM episode_tag WHERE tag_id = #{fromId}", databaseId = "mysql")
    void moveRefs(@Param("fromId") long fromId, @Param("toId") long toId);

    @Delete("DELETE FROM episode_tag WHERE tag_id = #{fromId}")
    void deleteRefs(@Param("fromId") long fromId);
}
