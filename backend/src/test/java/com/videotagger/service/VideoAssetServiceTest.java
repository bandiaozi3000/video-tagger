package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.mapper.VideoSourceTaskMapper;
import com.videotagger.mapper.VideoTimeMappingMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VideoAssetServiceTest {
    @Test void selectingPrimaryDemotesEveryExistingPrimaryRegardlessOfAvailability(){VideoAssetMapper assets=mock(VideoAssetMapper.class);ClipMapper clips=mock(ClipMapper.class);VideoTimeMappingMapper mappings=mock(VideoTimeMappingMapper.class);VideoSourceTaskMapper tasks=mock(VideoSourceTaskMapper.class);VideoAsset asset=new VideoAsset();asset.setId(9L);asset.setEpisodeId(3L);when(assets.selectById(9L)).thenReturn(asset);VideoAssetService service=new VideoAssetService(assets,clips,mappings,tasks,null);service.setRole(9L,"PRIMARY");verify(assets).demoteOtherPrimary(eq(3L),eq(9L),anyLong());assertEquals("PRIMARY",asset.getAssetRole());}
    @Test void referencedAssetCannotBeDeleted(){VideoAssetMapper assets=mock(VideoAssetMapper.class);ClipMapper clips=mock(ClipMapper.class);VideoTimeMappingMapper mappings=mock(VideoTimeMappingMapper.class);VideoSourceTaskMapper tasks=mock(VideoSourceTaskMapper.class);when(clips.listByVideoAsset(7L)).thenReturn(List.of());when(mappings.countByAsset(7L)).thenReturn(1L);VideoAssetService service=new VideoAssetService(assets,clips,mappings,tasks,null);assertThrows(IllegalStateException.class,()->service.delete(7L));verify(assets,never()).deleteById(anyLong());}
    /** 解除绑定必须走显式 SQL：updateById 忽略 null，setVideoAssetId(null) 写不进去 → 悬空引用（2026-09-29 实测）。 */
    @Test void deleteLocalClearsClipBindingWithExplicitSql(){VideoAssetMapper assets=mock(VideoAssetMapper.class);ClipMapper clips=mock(ClipMapper.class);VideoTimeMappingMapper mappings=mock(VideoTimeMappingMapper.class);VideoSourceTaskMapper tasks=mock(VideoSourceTaskMapper.class);VideoAsset asset=new VideoAsset();asset.setId(58L);asset.setAssetType("UPLOADED");when(assets.selectById(58L)).thenReturn(asset);Clip clip=new Clip();clip.setId(201L);when(clips.listByVideoAsset(58L)).thenReturn(List.of(clip));when(mappings.countByAsset(58L)).thenReturn(0L);when(tasks.countActiveByAsset(58L)).thenReturn(0L);VideoAssetService service=new VideoAssetService(assets,clips,mappings,tasks,null);service.deleteLocal(58L);verify(clips).clearVideoAsset(201L,"REFERENCE_ONLY");verify(clips,never()).updateById(any(Clip.class));}
}