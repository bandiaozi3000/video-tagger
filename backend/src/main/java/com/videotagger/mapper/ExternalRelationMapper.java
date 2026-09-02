package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.ExternalRelation;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ExternalRelationMapper extends BaseMapper<ExternalRelation> {
    @Select("SELECT * FROM external_relation WHERE external_work_id = #{workId} ORDER BY id")
    List<ExternalRelation> listByWork(@Param("workId") long workId);

    @org.apache.ibatis.annotations.Delete("DELETE FROM external_relation WHERE external_work_id = #{workId}")
    void deleteByWork(@Param("workId") long workId);

}
