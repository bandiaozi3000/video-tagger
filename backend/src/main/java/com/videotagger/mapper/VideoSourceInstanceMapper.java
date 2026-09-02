package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.VideoSourceInstance;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface VideoSourceInstanceMapper extends BaseMapper<VideoSourceInstance> {
    @Select("SELECT * FROM video_source_instance WHERE definition_id = #{definitionId} LIMIT 1")
    VideoSourceInstance selectByDefinition(@Param("definitionId") long definitionId);
    @Select("SELECT * FROM video_source_instance ORDER BY sort_order, id")
    List<VideoSourceInstance> listAll();
    @Select("SELECT * FROM video_source_instance WHERE enabled = 1 ORDER BY sort_order, id")
    List<VideoSourceInstance> listEnabled();
}
