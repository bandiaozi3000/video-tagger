package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.HighlightProject;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface HighlightProjectMapper extends BaseMapper<HighlightProject> {
    @Select("SELECT * FROM highlight_project WHERE media_id = #{mediaId} LIMIT 1")
    HighlightProject selectByMediaId(long mediaId);
}
