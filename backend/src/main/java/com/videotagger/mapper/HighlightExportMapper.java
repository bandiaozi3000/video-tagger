package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.HighlightExport;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface HighlightExportMapper extends BaseMapper<HighlightExport> {
    @Select("SELECT * FROM highlight_export WHERE project_id = #{projectId} ORDER BY created_at DESC, id DESC")
    List<HighlightExport> listByProjectId(long projectId);
}
