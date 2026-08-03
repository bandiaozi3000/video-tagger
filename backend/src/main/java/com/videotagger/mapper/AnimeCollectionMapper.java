package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.AnimeCollection;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface AnimeCollectionMapper extends BaseMapper<AnimeCollection> {

    @Insert("INSERT IGNORE INTO anime_collection(anime_id, collection_id) VALUES(#{animeId}, #{collectionId})")
    void insertIgnore(@Param("animeId") long animeId, @Param("collectionId") long collectionId);

    @Delete("DELETE FROM anime_collection WHERE anime_id = #{animeId} AND collection_id = #{collectionId}")
    void deleteLink(@Param("animeId") long animeId, @Param("collectionId") long collectionId);

    @Delete("DELETE FROM anime_collection WHERE anime_id = #{animeId}")
    void deleteByAnime(@Param("animeId") long animeId);

    @Delete("DELETE FROM anime_collection WHERE collection_id = #{collectionId}")
    void deleteByCollection(@Param("collectionId") long collectionId);

    @Select("SELECT collection_id FROM anime_collection WHERE anime_id = #{animeId} ORDER BY collection_id")
    List<Long> selectCollectionIdsByAnime(@Param("animeId") long animeId);
}
