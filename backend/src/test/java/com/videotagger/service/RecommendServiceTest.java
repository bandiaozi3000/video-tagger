package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
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
    ResourceLoader resourceLoader;
    RecommendService service;

    @BeforeEach
    void setUp() {
        mediaService = mock(MediaService.class);
        tagMapper = mock(TagMapper.class);
        subMapper = mock(MediaSubcategoryMapper.class);
        formatMapper = mock(MediaFormatMapper.class);
        coverService = mock(CoverService.class);
        resourceLoader = new DefaultResourceLoader();
        service = new RecommendService(mediaService, tagMapper, subMapper, formatMapper,
                coverService, new ObjectMapper(), resourceLoader);
    }

    private MediaDetail media(long id, String title, String note, String status) {
        return new MediaDetail(id, title, 2004, "原名" + id, "别名", "ANIME", "异世界", 5L, note, status,
                BigDecimal.ONE, "/covers/" + id + ".jpg", 1, "MANUAL", 1L, 3L, 1L,
                List.of(), List.of(), "/covers/clip/" + id + "-fallback.jpg");
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
