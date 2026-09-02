package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.VideoSourceDefinition;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import java.util.List;

@Mapper
public interface VideoSourceDefinitionMapper extends BaseMapper<VideoSourceDefinition> {
    @Select("SELECT * FROM video_source_definition WHERE subscription_id = #{subscriptionId} ORDER BY id")
    List<VideoSourceDefinition> listBySubscription(@Param("subscriptionId") long subscriptionId);
    @Select("SELECT * FROM video_source_definition WHERE subscription_id = #{subscriptionId} AND import_key = #{importKey} LIMIT 1")
    VideoSourceDefinition selectImported(@Param("subscriptionId") long subscriptionId, @Param("importKey") String importKey);
    @Update("UPDATE video_source_definition SET status = 'REMOVED', updated_at = #{now} WHERE subscription_id = #{subscriptionId} AND (last_seen_at IS NULL OR last_seen_at < #{refreshStartedAt})")
    int markMissing(@Param("subscriptionId") long subscriptionId, @Param("refreshStartedAt") long refreshStartedAt, @Param("now") long now);
}
