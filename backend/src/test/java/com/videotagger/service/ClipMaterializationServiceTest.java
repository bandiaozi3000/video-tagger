package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.mapper.VideoTimeMappingMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * plan() 的资产解析口径：绑定可用 → 沿用；绑定悬空/不可用 → 回退到该集可用**本地源**资产。
 * 悬空引用 + 回退缺失 = 求值说「素材在场」、裁剪说「需要本地资产」（2026-09-29 用户报「准备素材报错」）。
 */
class ClipMaterializationServiceTest {

    private final ClipMapper clipMapper = mock(ClipMapper.class);
    private final VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
    private final VideoTimeMappingMapper mappingMapper = mock(VideoTimeMappingMapper.class);
    private final ClipMaterializationService service = new ClipMaterializationService(
            clipMapper, assetMapper, mappingMapper, System.getProperty("java.io.tmpdir"), "ffmpeg");

    private Clip clip(long id, Long boundAssetId) {
        Clip c = new Clip();
        c.setId(id);
        c.setEpisodeId(20091L);
        c.setVideoAssetId(boundAssetId);
        c.setStartMs(0L);
        return c;
    }

    private VideoAsset asset(long id, String type, String state, String path) {
        VideoAsset a = new VideoAsset();
        a.setId(id);
        a.setAssetType(type);
        a.setAvailabilityState(state);
        a.setStoragePath(path);
        return a;
    }

    @Test
    @DisplayName("绑定可用 → 沿用绑定，不查池")
    void boundAssetWins() {
        when(clipMapper.selectById(201L)).thenReturn(clip(201L, 59L));
        when(assetMapper.selectById(59L)).thenReturn(asset(59L, "UPLOADED", "AVAILABLE", "D:/x/ep31.mp4"));

        ClipMaterializationService.Plan plan = service.plan(201L);
        assertEquals("TRIM_LOCAL_ASSET", plan.strategy());
        assertEquals(59L, plan.sourceAssetId());
        verify(assetMapper, never()).selectAvailable(anyLong());
    }

    @Test
    @DisplayName("悬空绑定（资产已删）→ 回退到该集可用本地源，而不是 SOURCE_REQUIRED")
    void danglingBindingFallsBackToEpisodeAsset() {
        when(clipMapper.selectById(201L)).thenReturn(clip(201L, 58L));
        when(assetMapper.selectById(58L)).thenReturn(null);              // 资产已删 → 悬空
        when(assetMapper.selectAvailable(20091L))
                .thenReturn(asset(59L, "UPLOADED", "AVAILABLE", "D:/x/ep31.mp4"));

        ClipMaterializationService.Plan plan = service.plan(201L);
        assertEquals("TRIM_LOCAL_ASSET", plan.strategy());
        assertEquals(59L, plan.sourceAssetId());
    }

    @Test
    @DisplayName("无绑定 → 同样回退到该集可用本地源")
    void unboundClipFallsBack() {
        when(clipMapper.selectById(202L)).thenReturn(clip(202L, null));
        when(assetMapper.selectAvailable(20091L))
                .thenReturn(asset(59L, "LOCAL_ORIGINAL", "AVAILABLE", "D:/x/ep31.mp4"));

        ClipMaterializationService.Plan plan = service.plan(202L);
        assertEquals("TRIM_LOCAL_ASSET", plan.strategy());
        assertEquals(59L, plan.sourceAssetId());
    }

    @Test
    @DisplayName("回退只认本地源：该集可用资产是产物（GENERATED_CLIP）时不当源")
    void fallbackSkipsGeneratedProduct() {
        when(clipMapper.selectById(203L)).thenReturn(clip(203L, null));
        when(assetMapper.selectAvailable(20091L))
                .thenReturn(asset(77L, "GENERATED_CLIP", "AVAILABLE", "media-0/entry-0/episode-20091/asset-77.mp4"));

        ClipMaterializationService.Plan plan = service.plan(203L);
        assertEquals("SOURCE_REQUIRED", plan.strategy());
        assertNull(plan.sourceAssetId());
    }
}
