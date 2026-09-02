package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** v0.24 批量素材化单测：在场即剪 / 不在场进待预取 / 未建档提示。 */
class MaterializeBatchServiceTest {

    private ClipMapper clipMapper;
    private ExternalEpisodeMapper externalEpisodeMapper;
    private ExternalWorkMapper externalWorkMapper;
    private MaterializationService channelService;
    private ClipMaterializationService clipMaterializationService;
    private MaterializeBatchService service;

    @BeforeEach
    void setUp() {
        clipMapper = mock(ClipMapper.class);
        externalEpisodeMapper = mock(ExternalEpisodeMapper.class);
        externalWorkMapper = mock(ExternalWorkMapper.class);
        channelService = mock(MaterializationService.class);
        clipMaterializationService = mock(ClipMaterializationService.class);
        service = new MaterializeBatchService(clipMapper, externalEpisodeMapper, externalWorkMapper,
                channelService, clipMaterializationService);
    }

    private Clip clip(long id, Long epId) {
        Clip c = new Clip();
        c.setId(id);
        c.setEpisodeId(epId);
        c.setTitle("片段 " + id);
        return c;
    }

    private void stubBangumiBridge(long localEpId, String subjectId, String bangumiEpId) {
        ExternalEpisode b = new ExternalEpisode();
        b.setExternalWorkId(9L);
        b.setProviderEpisodeId(bangumiEpId);
        when(externalEpisodeMapper.listByLocalEpisode(localEpId)).thenReturn(List.of(b));
        ExternalWork w = new ExternalWork();
        w.setId(9L);
        w.setProvider("BANGUMI");
        w.setExternalId(subjectId);
        when(externalWorkMapper.selectById(9L)).thenReturn(w);
    }

    @Test
    @DisplayName("本地在场（已绑资产）→ 立即剪出产物")
    void materializeWhenPresentLocal() throws Exception {
        Clip c = clip(1, 40L);
        c.setVideoAssetId(5L);   // 已绑定资产 → 走 TRIM_LOCAL_ASSET materialize
        when(clipMapper.selectById(1L)).thenReturn(c);
        when(channelService.evaluate(1L, true)).thenReturn(new MaterializationService.Evaluation(
                1L, "C1", "PRESENT", "TRIM_LOCAL_ASSET", 5L, "D:/pool/v.mp4", null, "命中"));
        when(clipMaterializationService.materialize(1L))
                .thenReturn(new ClipMaterializationService.Result(1L, 50L, "clips/1.mp4", 3000L, "READY"));

        MaterializeBatchService.BatchResult r = service.materialize(List.of(1L));
        assertEquals(1, r.okCount());
        assertTrue(r.results().get(0).ok());
        assertEquals("READY", r.results().get(0).state());
        assertTrue(r.prefetchNeeded().isEmpty());
        assertEquals("clips/1.mp4", r.results().get(0).assetUrl());
    }

    @Test
    @DisplayName("外部/未绑资产但文件在场（C1/C2 按集兜底）→ materializeFromFile")
    void materializeExternalFileByEpisode() throws Exception {
        when(clipMapper.selectById(2L)).thenReturn(clip(2, 41L));   // 无 videoAssetId
        when(channelService.evaluate(2L, true)).thenReturn(new MaterializationService.Evaluation(
                2L, "C1", "PRESENT", "TRIM_LOCAL_ASSET", null, "D:/pool/v.mp4", null, "按集兜底"));
        when(clipMaterializationService.materializeFromFile(anyLong(), anyString()))
                .thenReturn(new ClipMaterializationService.Result(2L, 51L, "clips/2.mp4", 5000L, "READY"));

        MaterializeBatchService.BatchResult r = service.materialize(List.of(2L));
        assertEquals(1, r.okCount());
        assertTrue(r.results().get(0).ok());
        verify(clipMaterializationService).materializeFromFile(anyLong(), anyString());
    }

    @Test
    @DisplayName("文件不在场 → 归入待预取（Bangumi 集去重）")
    void noFileGoesToPrefetch() throws Exception {
        when(clipMapper.selectById(3L)).thenReturn(clip(3, 42L));
        when(channelService.evaluate(3L, true)).thenReturn(new MaterializationService.Evaluation(
                3L, "C2", "PENDING", "SOURCE_REQUIRED", null, null, null, "需缓存"));
        stubBangumiBridge(42L, "40310", "198749");
        when(clipMapper.selectById(4L)).thenReturn(clip(4, 42L));   // 同集另一片段 → 去重
        when(channelService.evaluate(4L, true)).thenReturn(new MaterializationService.Evaluation(
                4L, "C2", "UNAVAILABLE", "SOURCE_REQUIRED", null, null, null, "不可用"));

        MaterializeBatchService.BatchResult r = service.materialize(List.of(3L, 4L));
        assertEquals(0, r.okCount());
        assertEquals(1, r.prefetchNeeded().size(), "同集多片段只出现一条待预取");
        assertEquals("40310", r.prefetchNeeded().get(0).subjectId());
        assertEquals("198749", r.prefetchNeeded().get(0).episodeId());
        verify(clipMaterializationService, never()).materialize(anyLong());
    }

    @Test
    @DisplayName("未建档（反查不到 Bangumi）→ 失败提示且无待预取")
    void unmappedClipReports() {
        when(clipMapper.selectById(5L)).thenReturn(clip(5, 43L));
        when(channelService.evaluate(5L, true)).thenReturn(new MaterializationService.Evaluation(
                5L, "C2", "UNAVAILABLE", "SOURCE_REQUIRED", null, null, null, "Animeko 未配置"));
        when(externalEpisodeMapper.listByLocalEpisode(43L)).thenReturn(List.of());

        MaterializeBatchService.BatchResult r = service.materialize(List.of(5L));
        assertFalse(r.results().get(0).ok());
        assertNull(r.results().get(0).prefetch(), "无法反查集号 → 无待预取条目");
        assertTrue(r.prefetchNeeded().isEmpty());
    }
}
