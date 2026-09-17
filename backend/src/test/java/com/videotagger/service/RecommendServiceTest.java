package com.videotagger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.CollectionMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * RecommendService（Remotion 输入契约）单测。
 *
 * 只覆盖 `buildRenderInput`：分组标签、模板形态、BGM 曲长/素材路径、片段素材路径与时长、
 * 缺失媒体跳过与全缺失报错。旧的 HTML 注入相关断言已随模板链路退役删除。
 */
class RecommendServiceTest {

    MediaService mediaService;
    TagMapper tagMapper;
    MediaSubcategoryMapper subMapper;
    MediaFormatMapper formatMapper;
    CoverService coverService;
    CollectionMapper collectionMapper;
    RecommendService service;

    @BeforeEach
    void setUp() {
        mediaService = mock(MediaService.class);
        tagMapper = mock(TagMapper.class);
        subMapper = mock(MediaSubcategoryMapper.class);
        formatMapper = mock(MediaFormatMapper.class);
        coverService = mock(CoverService.class);
        collectionMapper = mock(CollectionMapper.class);
        service = new RecommendService(mediaService, tagMapper, subMapper, formatMapper,
                coverService, collectionMapper, new ObjectMapper());
        when(tagMapper.countByMedia(anyLong())).thenReturn(List.of());
        when(coverService.base64ForCoverPath(org.mockito.ArgumentMatchers.any())).thenReturn("AAA");
    }

    private MediaDetail media(long id, String title, Integer year) {
        return new MediaDetail(id, title, year, "原名" + id, "别名", "ANIME", "异世界", 5L, "简介" + id, "WANT",
                BigDecimal.ONE, "/covers/" + id + ".jpg", 1, "MANUAL", 1L, 3L, 1L,
                List.of(), List.of(), "/covers/clip/" + id + "-fallback.jpg");
    }

    /** 只填必要参数的调用：其余走 Java 默认值（与前端空提交等价）。 */
    private String renderInput(List<Long> ids, String groupBy, String style,
                               List<RecommendService.BgmTrack> bgmTracks, List<String> bgmPaths,
                               Map<Long, List<RecommendClipSourceService.PreparedClip>> clips) {
        return service.buildRenderInput(ids, "标题", bgmTracks, "副标题", "50", groupBy, style,
                List.of(), "序言", service.normalizeDurations(null, null, null, null, null),
                "结尾标题", "结尾文案", "", List.of(), 8, 100, 0, 50,
                "序言标题", "date-desc", 50, 50, 100, 1, 8, "品牌", 1, null,
                clips == null ? Map.of() : clips, "embed", 30, 1280, 720, bgmPaths,
                rel -> rel.startsWith("bgm-") ? 42.5 : 3.5);
    }

    private JsonNode parse(String json) throws Exception {
        return new ObjectMapper().readTree(json);
    }

    @Test
    void 输出模板标识与形态() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        assertEquals("chapter", parse(renderInput(List.of(1L), null, null, null, null, null)).get("style").asText());
        assertEquals("chapter", parse(renderInput(List.of(1L), null, "stream", null, null, null)).get("style").asText());
        assertEquals("clip", parse(renderInput(List.of(1L), null, "clip", null, null, null)).get("style").asText());
        assertEquals("MULTI_MEDIA_RECOMMEND", parse(renderInput(List.of(1L), null, null, null, null, null)).get("template").asText());
    }

    @Test
    void 分组维度写入媒体分组名() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        when(mediaService.get(2L)).thenReturn(media(2L, "B", null));
        JsonNode grouped = parse(renderInput(List.of(1L, 2L), "year", null, null, null, null));
        assertEquals("2024 年", grouped.get("media").get(0).get("group").asText());
        assertEquals("未知年份", grouped.get("media").get(1).get("group").asText());
        // 不分组时不应有 group 字段（Remotion 侧据此判断是否产生章节页）
        JsonNode plain = parse(renderInput(List.of(1L), null, null, null, null, null));
        assertFalse(plain.get("media").get(0).has("group"));
    }

    @Test
    void 子分类分组名走父级路径() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        MediaSubcategory sub = new MediaSubcategory();
        sub.setId(3L);
        sub.setName("异世界");
        sub.setParentId(0L);
        when(subMapper.selectById(3L)).thenReturn(sub);
        JsonNode node = parse(renderInput(List.of(1L), "subcategory", null, null, null, null));
        assertEquals("异世界", node.get("media").get(0).get("group").asText());
    }

    @Test
    void 分组与每屏参数进入参数区() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        JsonNode params = parse(renderInput(List.of(1L), "year", null, null, null, null)).get("params");
        assertEquals("year", params.get("groupBy").asText());
        assertEquals("date-desc", params.get("groupSort").asText());
        assertEquals(1, params.get("perScreen").asInt());
    }

    @Test
    void BGM曲目带曲长与素材路径() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        JsonNode tracks = parse(renderInput(List.of(1L), null, null,
                List.of(new RecommendService.BgmTrack("夜色航线", "QUJD")), List.of("bgm-1.mp3"), null))
                .get("params").get("bgmTracks");
        assertEquals(1, tracks.size());
        assertEquals("夜色航线", tracks.get(0).get("name").asText());
        assertEquals("bgm-1.mp3", tracks.get(0).get("assetPath").asText());
        assertEquals(42.5, tracks.get(0).get("durationSec").asDouble());
    }

    @Test
    void BGM无素材时只输出曲名() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        JsonNode tracks = parse(renderInput(List.of(1L), null, null,
                List.of(new RecommendService.BgmTrack("仅显示", null)), null, null))
                .get("params").get("bgmTracks");
        assertEquals("仅显示", tracks.get(0).get("name").asText());
        assertFalse(tracks.get(0).has("assetPath"));
        assertFalse(tracks.get(0).has("durationSec"));
    }

    @Test
    void 片段素材路径与时长进入媒体视图() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        Map<Long, List<RecommendClipSourceService.PreparedClip>> clips = Map.of(1L, List.of(
                new RecommendClipSourceService.PreparedClip(11L, "爆发瞬间", "备注", 10.0, 14.0, "media/clip-11.mp4", null)));
        JsonNode media = parse(renderInput(List.of(1L), null, null, null, null, clips)).get("media").get(0);
        assertEquals("CLIPS_SELECTED", media.get("mode").asText());
        assertEquals(4000, media.get("clips").get(0).get("durationMs").asLong());
        assertEquals("media/clip-11.mp4", media.get("clips").get(0).get("assetPath").asText());
        assertTrue(media.get("clips").get(0).get("hasAudio").asBoolean());
    }

    @Test
    void 开放时长片段走探测() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        Map<Long, List<RecommendClipSourceService.PreparedClip>> clips = Map.of(1L, List.of(
                new RecommendClipSourceService.PreparedClip(11L, "开放", null, null, null, "media/clip-11.mp4", null)));
        JsonNode media = parse(renderInput(List.of(1L), null, null, null, null, clips)).get("media").get(0);
        assertEquals(3500, media.get("clips").get(0).get("durationMs").asLong());
    }

    @Test
    void 缺失媒体跳过全缺失报错() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        when(mediaService.get(9L)).thenThrow(new IllegalArgumentException("不存在"));
        JsonNode node = parse(renderInput(List.of(1L, 9L), null, null, null, null, null));
        assertEquals(1, node.get("media").size());
        assertThrows(IllegalArgumentException.class, () -> renderInput(List.of(9L), null, null, null, null, null));
        assertThrows(IllegalArgumentException.class, () -> renderInput(List.of(), null, null, null, null, null));
    }

    @Test
    void 显示时长归一化到默认区间() {
        RecommendService.Durations d = service.normalizeDurations(999, 0, null, 1, 99);
        assertEquals(20, d.opening());
        assertEquals(1, d.intro());
        assertEquals(5, d.group());
        assertEquals(3, d.detail());
        assertEquals(10, d.ending());
    }
}
