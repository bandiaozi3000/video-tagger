package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Clip;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface ClipMapper extends BaseMapper<Clip> {

    @Select("SELECT * FROM clips WHERE url = #{url} AND created_at > #{since} ORDER BY id DESC LIMIT 1")
    Clip findRecentByUrl(@Param("url") String url, @Param("since") long since);
}
