package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.ExternalWork;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ExternalWorkMapper extends BaseMapper<ExternalWork> {
    @Select("SELECT * FROM external_work WHERE provider = #{provider} AND external_id = #{externalId} LIMIT 1")
    ExternalWork selectByProviderAndExternalId(@Param("provider") String provider, @Param("externalId") String externalId);

    @Select("SELECT ew.* FROM external_work ew LEFT JOIN media_entry me ON me.id = ew.media_entry_id "
            + "WHERE ew.media_id = #{mediaId} ORDER BY COALESCE(me.sort_order, 2147483647), ew.id")
    java.util.List<ExternalWork> listByMedia(@Param("mediaId") long mediaId);

    @Select("SELECT * FROM external_work WHERE media_entry_id = #{mediaEntryId} ORDER BY id")
    java.util.List<ExternalWork> listByEntry(@Param("mediaEntryId") long mediaEntryId);

    /** 换绑重建：解除旧外部条目与本地媒体的关联（updateById 会跳过 null，必须原生 SQL 置 NULL）。 */
    @Update("UPDATE external_work SET media_id = NULL, media_entry_id = NULL, updated_at = #{updatedAt} WHERE id = #{id}")
    int detachFromMedia(@Param("id") long id, @Param("updatedAt") long updatedAt);
}
