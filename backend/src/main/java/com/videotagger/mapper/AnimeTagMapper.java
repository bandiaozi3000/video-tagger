package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.AnimeTag;
import com.videotagger.entity.Tag;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface AnimeTagMapper extends BaseMapper<AnimeTag> {

    @Insert("INSERT IGNORE INTO anime_tag(anime_id, tag_id) VALUES(#{animeId}, #{tagId})")
    void insertIgnore(@Param("animeId") long animeId, @Param("tagId") long tagId);

    @Delete("DELETE FROM anime_tag WHERE anime_id = #{animeId} AND tag_id = #{tagId}")
    void deleteLink(@Param("animeId") long animeId, @Param("tagId") long tagId);

    @Delete("DELETE FROM anime_tag WHERE anime_id = #{animeId}")
    void deleteByAnime(@Param("animeId") long animeId);

    @Select("SELECT t.* FROM tag t JOIN anime_tag at ON at.tag_id = t.id "
            + "WHERE at.anime_id = #{animeId} ORDER BY t.id")
    List<Tag> selectTags(@Param("animeId") long animeId);
}
