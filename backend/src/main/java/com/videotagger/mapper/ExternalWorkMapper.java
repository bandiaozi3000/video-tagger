package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.ExternalWork;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ExternalWorkMapper extends BaseMapper<ExternalWork> {
    @Select("SELECT * FROM external_work WHERE provider = #{provider} AND external_id = #{externalId} LIMIT 1")
    ExternalWork selectByProviderAndExternalId(@Param("provider") String provider, @Param("externalId") String externalId);

    @Select("SELECT ew.* FROM external_work ew LEFT JOIN media_entry me ON me.id = ew.media_entry_id "
            + "WHERE ew.media_id = #{mediaId} ORDER BY COALESCE(me.sort_order, 2147483647), ew.id")
    java.util.List<ExternalWork> listByMedia(@Param("mediaId") long mediaId);

    @Select("SELECT * FROM external_work WHERE media_entry_id = #{mediaEntryId} ORDER BY id")
    java.util.List<ExternalWork> listByEntry(@Param("mediaEntryId") long mediaEntryId);
}
