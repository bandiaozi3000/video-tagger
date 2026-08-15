package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.MediaTag;
import com.videotagger.entity.Tag;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface MediaTagMapper extends BaseMapper<MediaTag> {

    @Insert("INSERT OR IGNORE INTO media_tag(media_id, tag_id) VALUES(#{mediaId}, #{tagId})")
    int insertIgnore(@Param("mediaId") long mediaId, @Param("tagId") long tagId);

    @Delete("DELETE FROM media_tag WHERE media_id = #{mediaId} AND tag_id = #{tagId}")
    void deleteLink(@Param("mediaId") long mediaId, @Param("tagId") long tagId);

    @Delete("DELETE FROM media_tag WHERE media_id = #{mediaId}")
    void deleteByMedia(@Param("mediaId") long mediaId);

    @Select("SELECT t.* FROM tag t JOIN media_tag at ON at.tag_id = t.id "
            + "WHERE at.media_id = #{mediaId} ORDER BY t.id")
    List<Tag> selectTags(@Param("mediaId") long mediaId);

    /** 标签合并：源引用迁移到目标（INSERT OR IGNORE 防重复）。 */
    @Insert("INSERT OR IGNORE INTO media_tag(media_id, tag_id) SELECT media_id, #{toId} FROM media_tag WHERE tag_id = #{fromId}")
    void moveRefs(@Param("fromId") long fromId, @Param("toId") long toId);

    @Delete("DELETE FROM media_tag WHERE tag_id = #{fromId}")
    void deleteRefs(@Param("fromId") long fromId);
}
