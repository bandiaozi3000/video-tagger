package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.MediaEntry;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MediaEntryMapper extends BaseMapper<MediaEntry> {
    @Select("SELECT * FROM media_entry WHERE media_id = #{mediaId} ORDER BY sort_order, id")
    List<MediaEntry> listByMedia(@Param("mediaId") long mediaId);

    @Select("SELECT * FROM media_entry WHERE media_id = #{mediaId} AND entry_type = #{entryType} AND sort_order = #{sortOrder} LIMIT 1")
    MediaEntry selectLegacy(@Param("mediaId") long mediaId, @Param("entryType") String entryType,
                            @Param("sortOrder") int sortOrder);

    @Select("SELECT * FROM media_entry WHERE media_id = #{mediaId} ORDER BY sort_order, id LIMIT 1")
    MediaEntry selectPrimary(@Param("mediaId") long mediaId);

    @Select("SELECT COALESCE(MAX(sort_order), -1) FROM media_entry WHERE media_id = #{mediaId}")
    int maxSortOrder(@Param("mediaId") long mediaId);
}
