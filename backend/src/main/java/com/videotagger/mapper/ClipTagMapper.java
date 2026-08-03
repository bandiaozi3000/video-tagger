package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.ClipTag;
import com.videotagger.entity.Tag;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface ClipTagMapper extends BaseMapper<ClipTag> {

    @Insert("INSERT IGNORE INTO clip_tag(clip_id, tag_id) VALUES(#{clipId}, #{tagId})")
    void insertIgnore(@Param("clipId") long clipId, @Param("tagId") long tagId);

    @Delete("DELETE FROM clip_tag WHERE clip_id = #{clipId}")
    void deleteByClip(@Param("clipId") long clipId);

    @Select("SELECT t.* FROM tag t JOIN clip_tag ct ON ct.tag_id = t.id "
            + "WHERE ct.clip_id = #{clipId} ORDER BY t.id")
    List<Tag> selectTags(@Param("clipId") long clipId);
}
