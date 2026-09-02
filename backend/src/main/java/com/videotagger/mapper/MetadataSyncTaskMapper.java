package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.MetadataSyncTask;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MetadataSyncTaskMapper extends BaseMapper<MetadataSyncTask> {
    @Select("SELECT * FROM metadata_sync_task WHERE task_id = #{taskId} LIMIT 1")
    MetadataSyncTask selectByTaskId(@Param("taskId") String taskId);

    @Select("SELECT * FROM metadata_sync_task ORDER BY created_at DESC, id DESC")
    List<MetadataSyncTask> listRecent();

    @Select("SELECT * FROM metadata_sync_task WHERE status IN ('QUEUED', 'RUNNING') ORDER BY created_at, id")
    List<MetadataSyncTask> listRecoverable();

    @Select("SELECT * FROM metadata_sync_task WHERE status = 'DONE' AND retention_until IS NOT NULL AND retention_until < #{now} ORDER BY retention_until")
    List<MetadataSyncTask> listExpired(@Param("now") long now);
}
