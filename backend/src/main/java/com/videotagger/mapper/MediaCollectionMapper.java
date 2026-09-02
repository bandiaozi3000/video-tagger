package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.MediaCollection;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MediaCollectionMapper extends BaseMapper<MediaCollection> {

    @Insert(value = "INSERT OR IGNORE INTO media_collection(media_id, collection_id) VALUES(#{mediaId}, #{collectionId})", databaseId = "sqlite")
    @Insert(value = "INSERT IGNORE INTO media_collection(media_id, collection_id) VALUES(#{mediaId}, #{collectionId})", databaseId = "mysql")
    void insertIgnore(@Param("mediaId") long mediaId, @Param("collectionId") long collectionId);

    @Delete("DELETE FROM media_collection WHERE media_id = #{mediaId} AND collection_id = #{collectionId}")
    void deleteLink(@Param("mediaId") long mediaId, @Param("collectionId") long collectionId);

    @Delete("DELETE FROM media_collection WHERE media_id = #{mediaId}")
    void deleteByMedia(@Param("mediaId") long mediaId);

    @Delete("DELETE FROM media_collection WHERE collection_id = #{collectionId}")
    void deleteByCollection(@Param("collectionId") long collectionId);

    @Select("SELECT collection_id FROM media_collection WHERE media_id = #{mediaId} ORDER BY collection_id")
    List<Long> selectCollectionIdsByMedia(@Param("mediaId") long mediaId);
}
