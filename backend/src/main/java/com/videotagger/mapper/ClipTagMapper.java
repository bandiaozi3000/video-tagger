package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.ClipTag;
import com.videotagger.entity.Tag;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ClipTagMapper extends BaseMapper<ClipTag> {

    @Insert(value = "INSERT OR IGNORE INTO clip_tag(clip_id, tag_id) VALUES(#{clipId}, #{tagId})", databaseId = "sqlite")
    @Insert(value = "INSERT IGNORE INTO clip_tag(clip_id, tag_id) VALUES(#{clipId}, #{tagId})", databaseId = "mysql")
    void insertIgnore(@Param("clipId") long clipId, @Param("tagId") long tagId);

    @Delete("DELETE FROM clip_tag WHERE clip_id = #{clipId}")
    void deleteByClip(@Param("clipId") long clipId);

    @Select("SELECT t.* FROM tag t JOIN clip_tag ct ON ct.tag_id = t.id "
            + "WHERE ct.clip_id = #{clipId} ORDER BY t.id")
    List<Tag> selectTags(@Param("clipId") long clipId);

    /** 标签合并：源引用迁移到目标（幂等防重复）。 */
    @Insert(value = "INSERT OR IGNORE INTO clip_tag(clip_id, tag_id) SELECT clip_id, #{toId} FROM clip_tag WHERE tag_id = #{fromId}", databaseId = "sqlite")
    @Insert(value = "INSERT IGNORE INTO clip_tag(clip_id, tag_id) SELECT clip_id, #{toId} FROM clip_tag WHERE tag_id = #{fromId}", databaseId = "mysql")
    void moveRefs(@Param("fromId") long fromId, @Param("toId") long toId);

    @Delete("DELETE FROM clip_tag WHERE tag_id = #{fromId}")
    void deleteRefs(@Param("fromId") long fromId);
}
