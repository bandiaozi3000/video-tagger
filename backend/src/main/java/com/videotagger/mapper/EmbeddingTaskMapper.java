package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.EmbeddingTask;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface EmbeddingTaskMapper extends BaseMapper<EmbeddingTask> {

    @Select("SELECT * FROM embedding_tasks WHERE status = 'PENDING' AND retry_count < 5")
    List<EmbeddingTask> selectPending();

    @Select("SELECT * FROM embedding_tasks WHERE entity_type = #{type} AND entity_id = #{id} LIMIT 1")
    EmbeddingTask selectByEntity(@Param("type") String type, @Param("id") long id);

    @Delete("DELETE FROM embedding_tasks WHERE entity_type = #{type} AND entity_id = #{id}")
    void deleteByEntity(@Param("type") String type, @Param("id") long id);
}
