package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** ReviewClipService：集详情新建（C1 资产 / C2 引用）/ 片段详情更新（产物坐标平移 + 旧产物作废）/ 入参校验。 */
class ReviewClipServiceTest {

    private final EpisodeReviewService reviewService = mock(EpisodeReviewService.class);
    private final EpisodeMapper episodeMapper = mock(EpisodeMapper.class);
    private final ClipMapper clipMapper = mock(ClipMapper.class);
    private final VideoAssetClipService assetClipService = mock(VideoAssetClipService.class);
    private final MaterializationService channelService = mock(MaterializationService.class);
    private final ClipService clipService = mock(ClipService.class);
    private final EmbeddingTaskService embeddingTaskService = mock(EmbeddingTaskService.class);

    private ReviewClipService service() {
        return new ReviewClipService(reviewService, episodeMapper, clipMapper, assetClipService,
                channelService, clipService, embeddingTaskService);
    }

    private void episodeExists(long id) {
        Episode ep = new Episode();
        ep.setId(id);
        ep.setTitle("第3集");
        when(episodeMapper.selectById(id)).thenReturn(ep);
    }

    /** 集 9 上的片段 5：源坐标 12s → 20s，来源 url 为 animeko 引用。 */
    private Clip existingClip() {
        Clip c = new Clip();
        c.setId(5L);
        c.setEpisodeId(9L);
        c.setTitle("战车道，开始了！");
        c.setUrl("animeko://bangumi/40310/ep/198748");
        c.setStartMs(12000L);
        c.setEndMs(20000L);
        c.setTimestampSec(12.0d);
        c.setEndSec(20.0d);
        c.setTag("旧标签");
        c.setNote("旧备注");
        return c;
    }

    private static Clip savedClip(long id) {
        Clip c = new Clip();
        c.setId(id);
        return c;
    }

    private static MaterializationService.Evaluation ev(String strategy) {
        return new MaterializationService.Evaluation(5L, "C1", "PRESENT", strategy, 18L, "x.mp4", "u", "m");
    }

    @Test
    @DisplayName("集详情新建·C1：本地资产在场 → 落成引用该资产的片段（区间原样）")
    void c1CreatesAssetClip() {
        episodeExists(9L);
        when(reviewService.resolve(9L))
                .thenReturn(new EpisodeReviewService.ReviewSource("C1", "PRESENT", "x.mp4", "ok", 77L, null));
        when(assetClipService.create(eq(9L), eq(77L), any())).thenReturn(savedClip(501L));

        Clip clip = service().create(9L, new ReviewClipService.CreateRequest(1000L, 3000L, "高燃", "备注", null));

        assertEquals(501L, clip.getId().longValue());
        ArgumentCaptor<VideoAssetClipService.CreateReferenceClipRequest> req =
                ArgumentCaptor.forClass(VideoAssetClipService.CreateReferenceClipRequest.class);
        verify(assetClipService).create(eq(9L), eq(77L), req.capture());
        assertEquals(1000L, req.getValue().startMs());
        assertEquals(3000L, req.getValue().endMs().longValue());
        assertEquals("第3集", req.getValue().title(), "标题留空时回落集标题");
        verify(clipService).linkClipTags(eq(501L), eq("高燃"), anyLong());
        verify(embeddingTaskService).enqueue(EntityType.CLIP, 501L);
    }

    @Test
    @DisplayName("集详情新建·C2：无本地资产行 → animeko:// 引用片段")
    void c2CreatesReferenceClip() {
        episodeExists(9L);
        String ref = "animeko://bangumi/42/ep/7";
        when(reviewService.resolve(9L))
                .thenReturn(new EpisodeReviewService.ReviewSource("C2", "PRESENT", "x.mkv", "缓存", null, ref));
        // 模拟 MyBatis-Plus 回填自增 id
        doAnswer(inv -> { ((Clip) inv.getArgument(0)).setId(601L); return 1; })
                .when(clipMapper).insert(any(Clip.class));

        Clip clip = service().create(9L, new ReviewClipService.CreateRequest(5000L, 8000L, "日常", "n", null));

        assertEquals(601L, clip.getId().longValue());
        ArgumentCaptor<Clip> inserted = ArgumentCaptor.forClass(Clip.class);
        verify(clipMapper).insert((Clip) inserted.capture());
        assertEquals(ref, inserted.getValue().getUrl());
        assertEquals(9L, inserted.getValue().getEpisodeId().longValue());
        assertEquals("第3集", inserted.getValue().getTitle());
        assertEquals(5000L, inserted.getValue().getStartMs().longValue());
        assertEquals(8.0d, inserted.getValue().getEndSec().doubleValue());
        assertEquals("REFERENCE_ONLY", inserted.getValue().getMaterialState());
        verify(assetClipService, never()).create(anyLong(), anyLong(), any());
    }

    @Test
    @DisplayName("集详情新建·校验：无本地源 / 缺标签 / 终点不大于起点 → 报错且不落库")
    void createRejectsInvalid() {
        episodeExists(9L);
        when(reviewService.resolve(9L))
                .thenReturn(new EpisodeReviewService.ReviewSource(null, "UNAVAILABLE", null, "无本地源", null, null));

        ReviewClipService svc = service();
        assertThrows(IllegalArgumentException.class,
                () -> svc.create(9L, new ReviewClipService.CreateRequest(0L, null, "  ", null, null)));
        assertThrows(IllegalArgumentException.class,
                () -> svc.create(9L, new ReviewClipService.CreateRequest(3000L, 3000L, "标签", null, null)));
        assertThrows(IllegalStateException.class,
                () -> svc.create(9L, new ReviewClipService.CreateRequest(0L, 1000L, "标签", null, null)));
        verify(clipMapper, never()).insert(any(Clip.class));
    }

    @Test
    @DisplayName("片段详情更新·弹窗在放产物：弹窗坐标 + 片段 startMs → 原视频坐标，并作废旧产物")
    void updateFromArtifactShiftsRange() {
        when(clipMapper.selectById(5L)).thenReturn(existingClip());
        when(channelService.evaluate(5L, false)).thenReturn(ev("ALREADY_READY"));
        when(clipService.update(eq(5L), any(), anyBoolean())).thenReturn(savedClip(5L));

        service().updateRange(5L, new ReviewClipService.RangeRequest(1000L, 3000L, "新标签", "新备注"));

        ArgumentCaptor<SaveClipRequest> req = ArgumentCaptor.forClass(SaveClipRequest.class);
        verify(clipService).update(eq(5L), req.capture(), eq(false));
        assertEquals(13000L, req.getValue().startMs().longValue(), "1s + 12s 偏移");
        assertEquals(15000L, req.getValue().endMs().longValue());
        assertEquals(13.0d, req.getValue().timestampSec().doubleValue());
        assertEquals("新标签", req.getValue().tag());
        assertNull(req.getValue().videoAssetId(), "产物已作废，不能把旧产物 id 写回去");
        verify(channelService).deleteSource(5L);
    }

    @Test
    @DisplayName("片段详情更新·区间没变：不动产物、不重复删文件")
    void updateKeepsProductWhenRangeUnchanged() {
        when(clipMapper.selectById(5L)).thenReturn(existingClip());
        when(channelService.evaluate(5L, false)).thenReturn(ev("ALREADY_READY"));
        when(clipService.update(eq(5L), any(), anyBoolean())).thenReturn(savedClip(5L));

        // 弹窗坐标 0s → 8s，偏移 +12s = 原区间 12s → 20s
        service().updateRange(5L, new ReviewClipService.RangeRequest(0L, 8000L, "旧标签", "旧备注"));

        verify(channelService, never()).deleteSource(anyLong());
        ArgumentCaptor<SaveClipRequest> req = ArgumentCaptor.forClass(SaveClipRequest.class);
        verify(clipService).update(eq(5L), req.capture(), eq(false));
        assertEquals(12000L, req.getValue().startMs().longValue());
        assertEquals(20000L, req.getValue().endMs().longValue());
    }

    @Test
    @DisplayName("片段详情更新·弹窗在放整集源（非产物）：不平移")
    void updateWithoutProductDoesNotShift() {
        when(clipMapper.selectById(5L)).thenReturn(existingClip());
        when(channelService.evaluate(5L, false)).thenReturn(ev("TRIM_EXTERNAL_FILE"));
        when(clipService.update(eq(5L), any(), anyBoolean())).thenReturn(savedClip(5L));

        service().updateRange(5L, new ReviewClipService.RangeRequest(1000L, null, "标签", null));

        ArgumentCaptor<SaveClipRequest> req = ArgumentCaptor.forClass(SaveClipRequest.class);
        verify(clipService).update(eq(5L), req.capture(), eq(false));
        assertEquals(1000L, req.getValue().startMs().longValue());
        assertNull(req.getValue().endMs(), "终点可留空 = 单点");
    }

    @Test
    @DisplayName("片段详情更新·校验：缺标签 / 终点不大于起点 → 报错且不写库")
    void updateRangeRejectsInvalid() {
        when(clipMapper.selectById(5L)).thenReturn(existingClip());

        ReviewClipService svc = service();
        assertThrows(IllegalArgumentException.class,
                () -> svc.updateRange(5L, new ReviewClipService.RangeRequest(1000L, null, "  ", null)));
        assertThrows(IllegalArgumentException.class,
                () -> svc.updateRange(5L, new ReviewClipService.RangeRequest(5000L, 4000L, "标签", null)));
        verify(clipService, never()).update(anyLong(), any(), anyBoolean());
        verify(channelService, never()).deleteSource(anyLong());
    }
}
