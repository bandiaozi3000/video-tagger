package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.VideoSourceSubscription;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface VideoSourceSubscriptionMapper extends BaseMapper<VideoSourceSubscription> {
    @Select("SELECT * FROM video_source_subscription ORDER BY id")
    List<VideoSourceSubscription> listAll();
    @Select("SELECT * FROM video_source_subscription WHERE url = #{url} LIMIT 1")
    VideoSourceSubscription selectByUrl(@Param("url") String url);
    @Select("SELECT * FROM video_source_subscription WHERE enabled = 1 AND (last_attempt_at IS NULL OR last_attempt_at + refresh_interval_minutes * 60000 <= #{now}) ORDER BY id")
    List<VideoSourceSubscription> listDue(@Param("now") long now);
}
