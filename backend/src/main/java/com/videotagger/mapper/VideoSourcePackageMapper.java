package com.videotagger.mapper;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import java.util.List;

import com.videotagger.entity.VideoSourcePackage;

@Mapper
public interface VideoSourcePackageMapper extends BaseMapper<VideoSourcePackage> {
    @Select("SELECT * FROM video_source_package WHERE media_entry_id = #{mediaEntryId} ORDER BY status, id DESC")
    List<VideoSourcePackage> listByMediaEntry(@Param("mediaEntryId") long mediaEntryId);
    @Select("SELECT * FROM video_source_package WHERE provider = #{provider} AND provider_package_id = #{providerPackageId} AND revision = #{revision} LIMIT 1")
    VideoSourcePackage selectStable(@Param("provider") String provider, @Param("providerPackageId") String providerPackageId, @Param("revision") String revision);
    @Select("SELECT * FROM video_source_package WHERE provider = #{provider} AND provider_package_id = #{providerPackageId} ORDER BY id DESC LIMIT 1")
    VideoSourcePackage selectLatestStable(@Param("provider") String provider, @Param("providerPackageId") String providerPackageId);
}
