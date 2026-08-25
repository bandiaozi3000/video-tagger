package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.HighlightProject;
import org.apache.ibatis.annotations.Select;

public interface HighlightProjectMapper extends BaseMapper<HighlightProject> {
    @Select("SELECT * FROM highlight_project WHERE media_id = #{mediaId} LIMIT 1")
    HighlightProject selectByMediaId(long mediaId);
}
