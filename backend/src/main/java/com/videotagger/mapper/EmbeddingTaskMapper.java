package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.EmbeddingTask;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface EmbeddingTaskMapper extends BaseMapper<EmbeddingTask> {

    @Select("SELECT * FROM embedding_tasks WHERE status = 'PENDING' AND retry_count < 5")
    List<EmbeddingTask> selectPending();
}
