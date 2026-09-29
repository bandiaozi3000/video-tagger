package com.videotagger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.CollectionMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaCollectionMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyList;
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
    MediaMapper mediaMapper;
    MediaCollectionMapper mediaCollectionMapper;
    TagMapper tagMapper;
    MediaSubcategoryMapper subMapper;
    MediaFormatMapper formatMapper;
    CoverService coverService;
    CollectionMapper collectionMapper;
    ExternalWorkMapper externalWorkMapper;
    EpisodeMapper episodeMapper;
    ClipMapper clipMapper;
    RecommendService service;
    /** 测试夹具：`media(...)` 注册进来，`listRenderBatch` 从这里答复（等价于一条批量 SQL）。 */
    final Map<Long, MediaDetail> fixtures = new LinkedHashMap<>();

    @BeforeEach
    void setUp() {
        mediaService = mock(MediaService.class);
        mediaMapper = mock(MediaMapper.class);
        mediaCollectionMapper = mock(MediaCollectionMapper.class);
        tagMapper = mock(TagMapper.class);
        subMapper = mock(MediaSubcategoryMapper.class);
        formatMapper = mock(MediaFormatMapper.class);
        coverService = mock(CoverService.class);
        collectionMapper = mock(CollectionMapper.class);
        // 银幕式模板新增的三个依赖（番剧元数据 / 剧集 / 片段行）：本测试不关心，给空 mock
        externalWorkMapper = mock(ExternalWorkMapper.class);
        episodeMapper = mock(EpisodeMapper.class);
        clipMapper = mock(ClipMapper.class);
        service = new RecommendService(mediaService, mediaMapper, mediaCollectionMapper, tagMapper, subMapper,
                formatMapper, coverService, collectionMapper, externalWorkMapper, episodeMapper, clipMapper,
                new ObjectMapper());
        // 2026-09-26 起 buildRenderInput 走**批量取数**（不再逐部 mediaService.get）：
        // 下面把夹具表映射成批量投影，原来的 `when(mediaService.get(X)).thenReturn(media(...))` 照样管用。
        when(mediaMapper.listRenderBatch(anyList())).thenAnswer((invocation) -> {
            List<Long> ids = invocation.getArgument(0);
            List<MediaMapper.RenderMediaRow> rows = new ArrayList<>();
            for (Long id : ids) {
                MediaDetail d = fixtures.get(id);
                if (d == null) continue;                 // 缺失媒体 → 不出现在批量结果里 → 渲染输入跳过它
                rows.add(new MediaMapper.RenderMediaRow(d.id(), d.title(), d.year(), d.season(), d.aliases(),
                        d.mediaFormat(), d.status(), d.rating(), d.note(), d.coverPath(), d.subcategory(),
                        d.subcategoryId(), d.externalCoverUrl(), d.source(), d.episodeCount(), d.clipCount(),
                        d.fallbackCoverPath()));
            }
            return rows;
        });
        when(tagMapper.countByMediaIds(anyList())).thenReturn(List.of());
        when(mediaCollectionMapper.listByMediaIds(anyList())).thenReturn(List.of());
        when(collectionMapper.selectList(org.mockito.ArgumentMatchers.any())).thenReturn(List.of());
        when(subMapper.selectList(org.mockito.ArgumentMatchers.any())).thenReturn(List.of());
        when(coverService.base64ForCoverPath(org.mockito.ArgumentMatchers.any())).thenReturn("AAA");
        when(externalWorkMapper.listByMediaIds(anyList())).thenReturn(List.of());
    }

    private MediaDetail media(long id, String title, Integer year) {
        MediaDetail d = new MediaDetail(id, title, year, "原名" + id, "别名", "ANIME", "异世界", 5L, "简介" + id, "WANT",
                BigDecimal.ONE, "/covers/" + id + ".jpg", 1, "MANUAL", 1L, 3L, 1L,
                List.of(), List.of(), "/covers/clip/" + id + "-fallback.jpg");
        fixtures.put(id, d);
        return d;
    }

    /** 只填必要参数的调用：其余走 Java 默认值（与前端空提交等价）。 */
    private String renderInput(List<Long> ids, String groupBy, String style,
                               List<RecommendService.BgmTrack> bgmTracks, List<String> bgmPaths,
                               Map<Long, List<RecommendClipSourceService.PreparedClip>> clips) {
        return renderInput(ids, groupBy, style, bgmTracks, bgmPaths, clips, null);
    }

    /** 同上，但可指定主题预设。 */
    private String renderInput(List<Long> ids, String groupBy, String style,
                               List<RecommendService.BgmTrack> bgmTracks, List<String> bgmPaths,
                               Map<Long, List<RecommendClipSourceService.PreparedClip>> clips, String preset) {
        return service.buildRenderInput(ids, "标题", bgmTracks, "副标题", "50", groupBy, style,
                List.of(), Map.of(), "序言", service.normalizeDurations(null, null, null, null, null, null),
                "结尾标题", "结尾文案", "", List.of(), 8, 100, 0, 50,
                "序言标题", "date-desc", 50, 50, 100, 1, 8, "品牌", 1, null, preset,
                clips == null ? Map.of() : clips, "embed", 30, 1280, 720, bgmPaths,
                rel -> rel.startsWith("bgm-") ? 42.5 : 3.5, 20260920, 100, null, null, 60, null);
    }

    /** 主题预设写入参数区；未指定 → 基线 `starlit`。 */
    @Test
    void 主题预设写入参数区() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "标题一", 2020));
        assertEquals("starlit", parse(renderInput(List.of(1L), null, null, null, null, null))
                .get("params").get("preset").asText());
        assertEquals("ember-dusk", parse(renderInput(List.of(1L), null, null, null, null, null, "ember-dusk"))
                .get("params").get("preset").asText());
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
        // 2026-09-26 起子分类字典**一次取全**（loadGroupContext → selectList），不再逐部 selectById
        when(subMapper.selectList(org.mockito.ArgumentMatchers.any())).thenReturn(List.of(sub));
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
    void 显示时长只限下限不封顶() {
        // 2026-09-26 用户拍板：显示时长不设 (旧上限 20/10/10/15/5/10 已废)，只留下限 + MAX_SEGMENT_SEC=600 防手滑。
        RecommendService.Durations d = service.normalizeDurations(999, 0, null, 1, 9999, 99);
        assertEquals(600, d.opening(), "开场 999 → 只被防手滑上限 600 截");
        assertEquals(1, d.intro(), "序言 0 → 下限 1");
        assertEquals(5, d.group(), "章节 null → 默认 5");
        assertEquals(3, d.detail(), "资料 1 → 下限 3");
        assertEquals(600, d.ending(), "结尾 9999 → 防手滑上限 600");
        assertEquals(99, d.title(), "片名卡不再回落到 5");
    }

    @Test
    void timelineFpsFollowsTemplateStyle() {
        // 2026-09-20 用户拍板：银幕式 24fps（片段素材原生帧率，不再每 5 帧补一帧），其余模板保持 30 不变。
        assertEquals(24, RecommendService.fpsOf("cinema"));
        assertEquals(30, RecommendService.fpsOf("chapter"));
        assertEquals(30, RecommendService.fpsOf("clip"));
        assertEquals(30, RecommendService.fpsOf(null));
    }

    /** 跨媒体借片段：视图里带 sourceTitle（设计规格 §5.3）。 */
    @Test
    void 借来的片段在视图里带来源标题() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        Map<Long, List<RecommendClipSourceService.PreparedClip>> clips = Map.of(1L, List.of(
                new RecommendClipSourceService.PreparedClip(11L, "OVA 那一段", null, 10.0, 14.0,
                        "media/clip-11.mp4", null, 6648L, "草莓棉花糖 OVA 第2期")));
        JsonNode clip = parse(renderInput(List.of(1L), null, null, null, null, clips)).get("media").get(0).get("clips").get(0);
        assertEquals("草莓棉花糖 OVA 第2期", clip.get("sourceTitle").asText());
    }

    /** 本体片段**不能**出现 sourceTitle，否则渲染侧会给不存在的来源画一行字。 */
    @Test
    void 本体片段不带来源标题() throws Exception {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        Map<Long, List<RecommendClipSourceService.PreparedClip>> clips = Map.of(1L, List.of(
                new RecommendClipSourceService.PreparedClip(11L, "爆发瞬间", null, 10.0, 14.0, "media/clip-11.mp4", null)));
        JsonNode clip = parse(renderInput(List.of(1L), null, null, null, null, clips)).get("media").get(0).get("clips").get(0);
        assertFalse(clip.has("sourceTitle"));
    }


    /** A+B 的指纹：同一批资料 → 同一个值；库里改过资料 → 值必须变。 */
    @Test
    void 指纹随资料变化() {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", 2024));
        when(mediaService.get(2L)).thenReturn(media(2L, "B", 2020));
        String before = service.metaFingerprint(List.of(1L, 2L));

        assertEquals(before, service.metaFingerprint(List.of(1L, 2L)), "同一批资料必须稳定");
        assertFalse(before.equals(service.metaFingerprint(List.of(1L))), "换了媒体集要变");

        when(mediaService.get(2L)).thenReturn(media(2L, "B 改了名", 2020));
        assertFalse(before.equals(service.metaFingerprint(List.of(1L, 2L))), "改名后必须变");
    }

    @Test
    void 指纹在空集与缺失媒体时不炸() {
        assertEquals("-", service.metaFingerprint(List.of()));
        when(mediaService.get(9L)).thenReturn(null);
        assertTrue(service.metaFingerprint(List.of(9L)).length() > 0);
    }


    /** 集标题：超 24 字不再整条丢（用户报「有时候显示有时候不显示」），改成截断 + 反转义。 */
    @Test
    void 集标题只截断不丢() {
        assertEquals("战车道，开始了！", RecommendService.cleanEpisodeTitle("  战车道，开始了！ "));
        assertEquals(RecommendService.EPISODE_TITLE_MAX + 1,
                RecommendService.cleanEpisodeTitle("①心跳！全是美少女的游泳大赛／②肉弹！全是兄贵的肌肉大赛／③陶器！全部打碎").length());
        assertTrue(RecommendService.cleanEpisodeTitle("①心跳！全是美少女的游泳大赛／②肉弹！全是兄贵的肌肉大赛").endsWith("…"));
        assertEquals("所谓的\"当做男生来抚养长大\"的模式", RecommendService.cleanEpisodeTitle("所谓的&quot;当做男生来抚养长大&quot;的模式"));
        assertEquals("", RecommendService.cleanEpisodeTitle(null));
    }


    /** BGM 播放范围：只认白名单，垃圾值回落到 all（旧行为）。 */
    @Test
    void BGM播放范围走白名单() {
        assertEquals("all", RecommendService.normalizeBgmRange(null));
        assertEquals("all", RecommendService.normalizeBgmRange(""));
        assertEquals("opening", RecommendService.normalizeBgmRange("opening"));
        assertEquals("none", RecommendService.normalizeBgmRange("none"));
        // 集合：去重 + 固定顺序 + 丢未知项
        assertEquals("opening,cards,ending", RecommendService.normalizeBgmRange("ending, cards ,opening,cards"));
        assertEquals("cards,ending", RecommendService.normalizeBgmRange("cards,nonsense,ending"));
        assertEquals("all", RecommendService.normalizeBgmRange("nonsense"));
    }

}

