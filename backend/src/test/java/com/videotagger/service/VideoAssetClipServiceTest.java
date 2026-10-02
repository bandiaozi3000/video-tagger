package com.videotagger.service;

import java.util.List;
import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class VideoAssetClipServiceTest {
    @Test
    void createsReferenceClipBoundToConcreteAssetAndRevision() {
        VideoAssetMapper assets = mock(VideoAssetMapper.class);
        ClipMapper clips = mock(ClipMapper.class);
        VideoAsset asset = new VideoAsset();
        asset.setId(11L);
        asset.setEpisodeId(7L);
        asset.setDisplayName("线路 A");
        asset.setSourceRevision("r2");
        asset.setAvailabilityState("AVAILABLE");
        when(assets.selectById(11L)).thenReturn(asset);
        VideoAssetClipService service = new VideoAssetClipService(assets, clips, mock(TagLinkService.class));

        when(clips.insert(any(Clip.class))).thenAnswer(inv -> { ((Clip) inv.getArgument(0)).setId(99L); return 1; });
        Clip clip = service.create(7L, 11L,
                new VideoAssetClipService.CreateReferenceClipRequest("高燃片段", 12_345L, 18_000L, List.of(9L), "测试" , null));

        assertEquals(7L, clip.getEpisodeId());
        assertEquals(11L, clip.getVideoAssetId());
        assertEquals("r2", clip.getSourceRevision());
        assertEquals(12_345L, clip.getStartMs());
        assertEquals(18_000L, clip.getEndMs());
        assertEquals("REFERENCE_ONLY", clip.getMaterialState());
        verify(clips).insert(any(Clip.class));
    }

    @Test
    void rejectsEndBeforeStartWithoutWriting() {
        VideoAssetMapper assets = mock(VideoAssetMapper.class);
        ClipMapper clips = mock(ClipMapper.class);
        VideoAsset asset = new VideoAsset();
        asset.setId(11L);
        asset.setEpisodeId(7L);
        when(assets.selectById(11L)).thenReturn(asset);
        VideoAssetClipService service = new VideoAssetClipService(assets, clips, mock(TagLinkService.class));

        assertThrows(IllegalArgumentException.class, () -> service.create(7L, 11L,
                new VideoAssetClipService.CreateReferenceClipRequest("x", 20_000L, 19_000L, List.of(9L), "", null)));
    }
}
