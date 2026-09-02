package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.MetadataSyncTaskItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface MetadataSyncTaskItemMapper extends BaseMapper<MetadataSyncTaskItem> {
    @Select("SELECT * FROM metadata_sync_task_item WHERE task_id = #{taskId} ORDER BY id")
    List<MetadataSyncTaskItem> listByTask(@Param("taskId") long taskId);

    @Select("SELECT * FROM metadata_sync_task_item WHERE task_id = #{taskId} AND id = #{itemId} LIMIT 1")
    MetadataSyncTaskItem selectTaskItem(@Param("taskId") long taskId, @Param("itemId") long itemId);

    @Delete("DELETE FROM metadata_sync_task_item WHERE task_id = #{taskId}")
    int deleteByTask(@Param("taskId") long taskId);

    @Update("UPDATE metadata_sync_task_item SET status = 'QUEUED', stage = 'QUEUED', updated_at = #{now} WHERE task_id = #{taskId} AND status = 'RUNNING'")
    int resetRunning(@Param("taskId") long taskId, @Param("now") long now);
}
