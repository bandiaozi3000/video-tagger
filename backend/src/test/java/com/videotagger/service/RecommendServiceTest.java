package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Collection;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.CollectionMapper;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.ResourceLoader;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecommendServiceTest {

    MediaService mediaService;
    TagMapper tagMapper;
    MediaSubcategoryMapper subMapper;
    MediaFormatMapper formatMapper;
    CoverService coverService;
    CollectionMapper collectionMapper;
    ResourceLoader resourceLoader;
    RecommendService service;

    @BeforeEach
    void setUp() {
        mediaService = mock(MediaService.class);
        tagMapper = mock(TagMapper.class);
        subMapper = mock(MediaSubcategoryMapper.class);
        formatMapper = mock(MediaFormatMapper.class);
        coverService = mock(CoverService.class);
        collectionMapper = mock(CollectionMapper.class);
        resourceLoader = new DefaultResourceLoader();
        service = new RecommendService(mediaService, tagMapper, subMapper, formatMapper,
                coverService, collectionMapper, new ObjectMapper(), resourceLoader);
    }

    private MediaDetail media(long id, String title, String note, String status) {
        return media(id, title, note, status, 2004);
    }

    private MediaDetail media(long id, String title, String note, String status, Integer year) {
        return new MediaDetail(id, title, year, "原名" + id, "别名", "ANIME", "异世界", 5L, note, status,
                BigDecimal.ONE, "/covers/" + id + ".jpg", 1, "MANUAL", 1L, 3L, 1L,
                List.of(), List.of(), "/covers/clip/" + id + "-fallback.jpg");
    }

    @Test
    void computeGroupCountUsesRealGrouping() {
        // 按年份：2022/2024/2023 + 未知年份 → 4 组（含「未知年份」兜底组，与 buildHtml 同口径）
        when(mediaService.get(1L)).thenReturn(media(1L, "A", "n", "WANT", 2022));
        when(mediaService.get(2L)).thenReturn(media(2L, "B", "n", "WANT", 2024));
        when(mediaService.get(3L)).thenReturn(media(3L, "C", "n", "WANT", 2023));
        when(mediaService.get(4L)).thenReturn(media(4L, "D", "n", "WANT", null));
        assertEquals(4, service.computeGroupCount(List.of(1L, 2L, 3L, 4L), "year"));
        // 同年合并为同一组
        when(mediaService.get(5L)).thenReturn(media(5L, "E", "n", "WANT", 2022));
        assertEquals(4, service.computeGroupCount(List.of(1L, 2L, 3L, 4L, 5L), "year"));
        // 不分组 → 0 组
        assertEquals(0, service.computeGroupCount(List.of(1L, 2L), "none"));
        assertEquals(0, service.computeGroupCount(List.of(1L, 2L), null));
        // 缺失媒体跳过（与 buildSlidesJson 一致），只剩 2022 一组
        when(mediaService.get(9L)).thenThrow(new RuntimeException("not found"));
        assertEquals(1, service.computeGroupCount(List.of(9L, 5L), "year"));
    }

    @Test
    void buildHtmlContainsDataAndBase64Cover() {
        when(mediaService.get(1L)).thenReturn(media(1L, "星屑与黄昏", "神作", "WATCHING"));
        when(mediaService.get(2L)).thenReturn(media(2L, "迷宫都市", "", "DONE"));
        when(coverService.base64ForCoverPath("/covers/1.jpg"))
                .thenReturn("data:image/jpeg;base64,QUJD");
        when(coverService.base64ForCoverPath("/covers/2.jpg"))
                .thenReturn("data:image/jpeg;base64,REVG");
        MediaFormat fmt = new MediaFormat();
        fmt.setId(1L);
        fmt.setCode("ANIME");
        fmt.setName("番剧");
        when(formatMapper.selectOne(any())).thenReturn(fmt);
        MediaSubcategory sub = new MediaSubcategory();
        sub.setId(5L);
        sub.setName("异世界");
        sub.setParentId(0L);
        when(subMapper.selectById(5L)).thenReturn(sub);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of(
                new TagUsage(1L, "热血", 1L, 0, 0, 0, 14),
                new TagUsage(2L, "战斗", 1L, 0, 0, 0, 3)));

        String html = service.buildHtml(List.of(1L, 2L));

        assertTrue(html.contains("星屑与黄昏"));
        assertTrue(html.contains("神作"));
        assertTrue(html.contains("data:image/jpeg;base64,QUJD"));
        // · 被 HtmlUtils.htmlEscape 转成 &middot;（安全且可还原显示）
        assertTrue(html.contains("番剧 &middot; 异世界"));
        // 标签热度以 JSON 数组形式注入模板（chips 由模板 JS 运行时渲染）
        assertTrue(html.contains("\"tags\":[[\"热血\",14],[\"战斗\",3]]"));
        assertTrue(html.contains("在看"));
        // 空备注 → 占位
        assertTrue(html.contains("（暂无备注）"));
        // 模板占位符已被替换
        assertFalse(html.contains("__SLIDES_JSON__"));
    }

    @Test
    void buildHtmlEscapesHtmlSpecialChars() {
        when(mediaService.get(1L)).thenReturn(
                media(1L, "<script>alert(1)</script>", "含 & 与 \"引号\"", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(coverService.base64ForCoverPath(eq("/covers/clip/1-fallback.jpg"))).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L));

        // 原始尖括号不得原样出现在 HTML 中（防注入/破坏结构）
        assertFalse(html.contains("<script>alert(1)</script>"));
        assertTrue(html.contains("&lt;script&gt;"));
    }

    @Test
    void buildHtmlSkipsMissingMediaKeepsOrder() {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", "n", "WANT"));
        when(mediaService.get(2L)).thenThrow(new RuntimeException("not found"));
        when(mediaService.get(3L)).thenReturn(media(3L, "B", "n", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(anyLong())).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L, 2L, 3L));

        int a = html.indexOf("\"title\":\"A\"");
        int b = html.indexOf("\"title\":\"B\"");
        assertTrue(a >= 0 && b >= 0 && a < b, "按 ids 顺序排列");
    }

    @Test
    void buildHtmlGroupsByYearDescending() {
        when(mediaService.get(1L)).thenReturn(media(1L, "旧作", "n", "WANT", 2022));
        when(mediaService.get(2L)).thenReturn(media(2L, "新作", "n", "WANT", 2024));
        when(mediaService.get(3L)).thenReturn(media(3L, "中作", "n", "WANT", 2023));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(anyLong())).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L, 2L, 3L), null, null, null, "year", "stream");

        // 每项带 group「年份 年」
        assertTrue(html.contains("\"group\":\"2024 年\""));
        assertTrue(html.contains("\"group\":\"2023 年\""));
        assertTrue(html.contains("\"group\":\"2022 年\""));
        // 年份降序：2024 → 2023 → 2022
        int i24 = html.indexOf("\"group\":\"2024 年\"");
        int i23 = html.indexOf("\"group\":\"2023 年\"");
        int i22 = html.indexOf("\"group\":\"2022 年\"");
        assertTrue(i24 >= 0 && i23 > i24 && i22 > i23, "按年份降序分组排列");
    }

    @Test
    void buildHtmlGroupsByYearFallsBackUnknown() {
        when(mediaService.get(1L)).thenReturn(media(1L, "无年份", "n", "WANT", null));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L), null, null, null, "year", "stream");

        assertTrue(html.contains("\"group\":\"未知年份\""));
    }

    @Test
    void buildHtmlGroupsBySubcategoryFallsBackToUnclassified() {
        when(mediaService.get(1L)).thenReturn(media(1L, "有分类", "n", "WANT"));
        MediaDetail noSub = new MediaDetail(2L, "无分类", 2004, "原名2", "别名", "ANIME", null, null, "n", "WANT",
                BigDecimal.ONE, "/covers/2.jpg", 1, "MANUAL", 1L, 3L, 1L, List.of(), List.of(), "/covers/clip/2-fallback.jpg");
        when(mediaService.get(2L)).thenReturn(noSub);
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(anyLong())).thenReturn(List.of());
        MediaSubcategory sub = new MediaSubcategory();
        sub.setId(5L); sub.setName("异世界"); sub.setParentId(0L);
        when(subMapper.selectById(5L)).thenReturn(sub);

        String html = service.buildHtml(List.of(1L, 2L), null, null, null, "subcategory", "stream");

        assertTrue(html.contains("\"group\":\"异世界\""));
        assertTrue(html.contains("\"group\":\"未分类\""));
    }

    @Test
    void buildHtmlGroupsByCollectionUsesFirstAndFallsBack() {
        when(mediaService.get(1L)).thenReturn(new MediaDetail(1L, "收藏中", 2004, "原名1", "别名", "ANIME", "异世界", 5L,
                "n", "WANT", BigDecimal.ONE, "/covers/1.jpg", 1, "MANUAL", 1L, 3L, 1L, List.of(), List.of(7L), "/covers/clip/1-fallback.jpg"));
        when(mediaService.get(2L)).thenReturn(media(2L, "未收藏", "n", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(anyLong())).thenReturn(List.of());
        Collection c = new Collection();
        c.setId(7L); c.setName("年度神作");
        when(collectionMapper.selectById(7L)).thenReturn(c);

        String html = service.buildHtml(List.of(1L, 2L), null, null, null, "collection", "stream");

        assertTrue(html.contains("\"group\":\"年度神作\""));
        assertTrue(html.contains("\"group\":\"未收藏\""));
    }

    @Test
    void buildHtmlNoGroupFieldWhenNone() {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", "n", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L), null, null, null, "none", null);
        assertFalse(html.contains("\"group\""));
    }

    @Test
    void buildHtmlSelectsStyleTemplate() {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", "n", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String stream = service.buildHtml(List.of(1L), null, null, null, null, "stream");
        assertTrue(stream.contains("interlude"), "stream 模板含组横幅样式");
        String chapter = service.buildHtml(List.of(1L), null, null, null, null, "chapter");
        assertTrue(chapter.contains(".chapter"), "chapter 模板含章节页样式");
        String overview = service.buildHtml(List.of(1L), null, null, null, null, "overview");
        assertTrue(overview.contains("group-view"), "overview 模板含组视图样式");
        String unknown = service.buildHtml(List.of(1L), null, null, null, null, "bogus");
        assertTrue(unknown.contains("interlude"), "未知样式回退 stream");
    }

    @Test
    void buildHtmlInjectsBgmTracksSubtitleAndOpen() {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", "n", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L), "标题",
                List.of(new RecommendService.BgmTrack("a.mp3", "QUJD"),
                        new RecommendService.BgmTrack("b.mp3", "REVG")),
                "副题", "lg", "year", "stream", List.of(1L));

        // 多曲 BGM 注入模板（视频导出时 BGM 条能显示曲名）
        assertTrue(html.contains("a.mp3"));
        assertTrue(html.contains("audio/mpeg;base64,QUJD"));
        assertTrue(html.contains("b.mp3"));
        assertTrue(html.contains("REVG"));
        // 副题注入
        assertTrue(html.contains("副题"));
        // group + open 标记（开场子集）
        assertTrue(html.contains("\"group\":\"2004 年\""));
        assertTrue(html.contains("\"open\":true"));
        // 封面大小
        assertTrue(html.contains("{ sm: .85, md: 1.15, lg: 1.4 }['lg']"));
    }

    @Test
    void buildHtmlEmptyIdsThrows() {
        assertThrows(IllegalArgumentException.class, () -> service.buildHtml(List.of()));
        assertThrows(IllegalArgumentException.class, () -> service.buildHtml(null));
    }

    @Test
    void buildHtmlUsesDefaultTitleWhenBlank() {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", "n", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L), null);
        assertTrue(html.contains("<title>我的番剧推荐</title>"));
        assertTrue(html.contains("<h1>我的番剧推荐</h1>"));
        assertFalse(html.contains("__TITLE__"));

        String htmlBlank = service.buildHtml(List.of(1L), "  ");
        assertTrue(htmlBlank.contains("<title>我的番剧推荐</title>"));
    }

    @Test
    void buildHtmlInjectsCustomTitle() {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", "n", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L), "2026 春季补番清单");
        assertTrue(html.contains("<title>2026 春季补番清单</title>"));
        assertTrue(html.contains("<h1>2026 春季补番清单</h1>"));
    }

    @Test
    void buildHtmlEscapesTitle() {
        when(mediaService.get(1L)).thenReturn(media(1L, "A", "n", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L), "<b>春季</b>&\"番剧\"");
        assertFalse(html.contains("<b>春季</b>"));
        assertTrue(html.contains("&lt;b&gt;春季&lt;/b&gt;"));
    }

    @Test
    void buildHtmlFallsBackToFallbackCover() {
        when(mediaService.get(1L)).thenReturn(media(1L, "X", "n", "WANT"));
        when(coverService.base64ForCoverPath("/covers/1.jpg")).thenReturn(null);
        when(coverService.base64ForCoverPath("/covers/clip/1-fallback.jpg"))
                .thenReturn("data:image/png;base64,QUJD");
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L));

        assertTrue(html.contains("data:image/png;base64,QUJD"));
        verify(coverService).base64ForCoverPath("/covers/1.jpg");
        verify(coverService).base64ForCoverPath("/covers/clip/1-fallback.jpg");
    }

    @Test
    void buildHtmlNoCoverRendersPlaceholderPath() {
        when(mediaService.get(1L)).thenReturn(media(1L, "X", "n", "WANT"));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L));

        // 无封面：cover 序列化为 null（模板 img src 空串 onerror 隐藏），仍可正常生成
        assertTrue(html.contains("\"cover\":null"));
    }

    @Test
    void buildHtmlUsesSubcategorySnapshotWhenIdAbsent() {
        when(mediaService.get(1L)).thenReturn(
                new MediaDetail(1L, "Y", null, null, "别名", "ANIME", "治愈", null, "n", "WANT",
                        BigDecimal.ONE, "/covers/1.jpg", 1, "MANUAL", 1L, 0L, 0L,
                        List.of(), List.of(), null));
        when(coverService.base64ForCoverPath(any())).thenReturn(null);
        when(tagMapper.countByMedia(1L)).thenReturn(List.of());

        String html = service.buildHtml(List.of(1L));

        assertTrue(html.contains("治愈"));
        verify(subMapper, never()).selectById(anyLong());
    }
}
