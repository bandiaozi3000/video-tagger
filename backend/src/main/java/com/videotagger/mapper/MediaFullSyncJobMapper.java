package com.videotagger.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.MediaFullSyncJobRow;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface MediaFullSyncJobMapper extends BaseMapper<MediaFullSyncJobRow> {
}
