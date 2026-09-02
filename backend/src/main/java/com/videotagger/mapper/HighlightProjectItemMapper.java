package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.HighlightProjectItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface HighlightProjectItemMapper extends BaseMapper<HighlightProjectItem> {
    @Select("SELECT * FROM highlight_project_item WHERE project_id = #{projectId} ORDER BY sort_order ASC, id ASC")
    List<HighlightProjectItem> listByProjectId(long projectId);

    @Select("SELECT * FROM highlight_project_item WHERE project_id = #{projectId} AND id = #{itemId} LIMIT 1")
    HighlightProjectItem selectByProjectAndId(long projectId, long itemId);

    @Select("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM highlight_project_item WHERE project_id = #{projectId}")
    int nextSortOrder(long projectId);

    @Update("UPDATE highlight_project_item SET source_state = #{state}, source_message = #{message}, updated_at = #{updatedAt} WHERE clip_id = #{clipId}")
    void markUnavailableByClipId(long clipId, String state, String message, long updatedAt);

    @Delete("DELETE FROM highlight_project_item WHERE project_id = #{projectId}")
    void deleteByProjectId(long projectId);
}
