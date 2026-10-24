package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * v0.32 第二部分：统计视频的**取数组装**门禁（不真起 Remotion —— 那要 node/Chrome/几十秒）。
 *
 * <p>这里钉住的是「视频与网页共用同一套取数」的契约：线 → 各筛选快照的逐年计数、横轴取并集、
 * 定格代表作取**横轴最后一年**、封面下载失败不炸、秒/年非法值时不让总帧数变 0。
 */
class StatsTrendVideoServiceTest {

    private final StatsService statsService = mock(StatsService.class);
    private final StatsTrendVideoService service = new StatsTrendVideoService(
            statsService, new ObjectMapper(), "node", "backend/remotion", "data/exports");

    private static TrendVideoRequest.Line line(String name, String color, Integer... years) {
        return new TrendVideoRequest.Line(name, color,
                new TrendVideoRequest.Snapshot(null, null, null, null, null, null, null, List.of(years),
                        null, null, null));
    }

    @Test
    void axesAreUnionOfAllLinesAndPointsFollowEachSnapshot() throws Exception {
        when(statsService.trend(any(), any(), any(), any(), any(), eq(List.of(2020)), any(), any(), any(), any(),
                any(), any(), any(), any())).thenReturn(new StatsTrendResponse(
                List.of(2020), 10, List.of(new StatsTrendResponse.Point(2020, 10))));
        when(statsService.trend(any(), any(), any(), any(), any(), eq(List.of(2021, 2022)), any(), any(), any(), any(),
                any(), any(), any(), any())).thenReturn(new StatsTrendResponse(
                List.of(2021, 2022), 7,
                List.of(new StatsTrendResponse.Point(2021, 3), new StatsTrendResponse.Point(2022, 4))));
        when(statsService.trendRefs(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), eq(2022), any(), anyInt())).thenReturn(List.of());

        Map<String, Object> input = service.buildInput("t1", new TrendVideoRequest("标题", List.of(
                line("异世界", "#cba6f7", 2020), line("科幻", "#89b4fa", 2021, 2022)), "bar", 2.0, "bgm", "light"));

        assertEquals(List.of(2020, 2021, 2022), input.get("years"), "横轴 = 各线年份的并集（升序）");
        assertEquals("bar", input.get("chartType"));
        assertEquals(2.0, input.get("secPerYear"));
        assertEquals(3, input.get("holdSec"), "定格固定 3 秒（规格 Q26 定死）");
        @SuppressWarnings("unchecked") List<Map<String, Object>> lines = (List<Map<String, Object>>) input.get("lines");
        assertEquals(2, lines.size());
        assertEquals("异世界", lines.get(0).get("name"));
        assertEquals(List.of(Map.of("year", 2020, "count", 10L)), lines.get(0).get("points"));
    }

    @Test
    void refsComeFromTheLastYearOfTheAxis() throws Exception {
        when(statsService.trend(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any())).thenReturn(new StatsTrendResponse(List.of(2019, 2020), 3,
                List.of(new StatsTrendResponse.Point(2019, 1), new StatsTrendResponse.Point(2020, 2))));
        when(statsService.trendRefs(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), eq(2020), eq("personal"), eq(5))).thenReturn(List.of(
                new TrendRef(1L, "某作品", 2020, "VIDEO", null, null, null, 12, 3,
                        new BigDecimal("8.0"), new BigDecimal("7.2"), 3303L)));

        Map<String, Object> input = service.buildInput("t2", new TrendVideoRequest(null, List.of(line("A", null, 2020)),
                "line", null, "personal", null));

        @SuppressWarnings("unchecked") List<Map<String, Object>> refs = (List<Map<String, Object>>) input.get("refs");
        assertEquals(1, refs.size(), "定格代表作来自横轴最后一年");
        assertEquals("某作品", refs.get(0).get("title"));
        assertEquals(new BigDecimal("8.0"), refs.get(0).get("personalRating"), "两套评分都要带给视频（卡片要显）");
        assertEquals("媒体趋势", input.get("title"), "标题缺省兜底");
        assertEquals(1.5, input.get("secPerYear"), "秒/年没传 → 默认 1.5");
    }

    @Test
    void coverFailuresDoNotBreakTheInput() {
        List<Map<String, Object>> cards = service.textOnlyRefs(List.of(
                new TrendRef(2L, "无封面作品", 2021, "VIDEO", null, null, null, 0, 0, null, BigDecimal.ONE, 5L)));
        assertEquals(1, cards.size());
        assertTrue(cards.get(0).get("title").equals("无封面作品"));
        assertEquals(null, cards.get(0).get("coverUrl"), "没有封面就是 null（渲染侧退化成纯文字卡）");
    }

    @Test
    void emptyLinesIsRejectedFast() {
        assertThrows(IllegalArgumentException.class,
                () -> service.start(new TrendVideoRequest("x", List.of(), "line", 1.0, "mixed", null)));
        assertThrows(IllegalArgumentException.class, () -> service.start(null));
    }

    /** 未抓住的映射错位（比如把 year 快照当 source 传）会在这里露出来：详情用 listTrendRefs 的入参断言。 */
    @Test
    void snapshotIsMappedOntoTheSameQueryParamsAsTheMediaPage() throws Exception {
        when(statsService.trend(isNull(), eq("VIDEO"), isNull(), isNull(), isNull(), eq(List.of(2024)), isNull(),
                eq(List.of(1L, 2L)), eq("AND"), eq("OR"), eq("OR"), isNull(), eq(List.of("奇幻")), eq(List.of("SPRING"))))
                .thenReturn(new StatsTrendResponse(List.of(2024), 1, List.of(new StatsTrendResponse.Point(2024, 1))));
        when(statsService.trendRefs(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), anyInt())).thenReturn(List.of());

        TrendVideoRequest.Snapshot snapshot = new TrendVideoRequest.Snapshot(null, "VIDEO", null, null,
                List.of("奇幻"), List.of(1L, 2L), null, List.of(2024), List.of("SPRING"), null,
                new TrendVideoRequest.Mode("OR", "AND", "OR"));
        Map<String, Object> input = service.buildInput("t3",
                new TrendVideoRequest("t", List.of(new TrendVideoRequest.Line("线", "#fff", snapshot)), "line", 1.0, "mixed", null));
        assertEquals(List.of(2024), input.get("years"));
    }

    /** 快照里的「只看待确认」→ `confirmed=0`（与媒体页同口径）；对不上这一步的桩就会 NPE。 */
    @Test
    void unconfirmedFlagBecomesConfirmedZero() throws Exception {
        when(statsService.trend(any(), any(), any(), eq(0), any(), eq(List.of(2024)), any(), any(), any(), any(),
                any(), any(), any(), any())).thenReturn(new StatsTrendResponse(List.of(2024), 2,
                List.of(new StatsTrendResponse.Point(2024, 2))));
        when(statsService.trendRefs(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), anyInt())).thenReturn(List.of());
        TrendVideoRequest.Snapshot snapshot = new TrendVideoRequest.Snapshot(null, null, null, true,
                null, null, null, List.of(2024), null, null, null);
        Map<String, Object> input = service.buildInput("t4",
                new TrendVideoRequest("t", List.of(new TrendVideoRequest.Line("线", "#fff", snapshot)), "line", 1.0, "mixed", null));
        assertEquals(List.of(2024), input.get("years"));
    }
}
