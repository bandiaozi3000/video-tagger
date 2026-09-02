package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.videotagger.entity.MetadataSyncDraft;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MetadataSyncDraftMapper extends BaseMapper<MetadataSyncDraft> {
    @Select("SELECT * FROM metadata_sync_draft ORDER BY updated_at DESC LIMIT 1")
    MetadataSyncDraft selectLatest();

    @Delete("DELETE FROM metadata_sync_draft")
    int deleteAll();
}
