package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.Clip;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface ClipMapper extends BaseMapper<Clip> {

    @Select("SELECT * FROM clips WHERE url = #{url} AND created_at > #{since} ORDER BY id DESC LIMIT 1")
    Clip findRecentByUrl(@Param("url") String url, @Param("since") long since);

    @Select("SELECT * FROM clips "
            + "WHERE MATCH(title, tag, note) AGAINST(#{q} IN NATURAL LANGUAGE MODE) "
            + "ORDER BY MATCH(title, tag, note) AGAINST(#{q} IN NATURAL LANGUAGE MODE) DESC "
            + "LIMIT #{limit}")
    List<Clip> fullTextSearch(@Param("q") String q, @Param("limit") int limit);
}
