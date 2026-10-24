package com.videotagger.controller;

import com.videotagger.service.StatsResponse;
import com.videotagger.service.StatsService;
import com.videotagger.service.StatsTrendVideoService;
import com.videotagger.service.TagSuggestion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StatsController.class)
class StatsControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    StatsService statsService;

    /** v0.32：控制器多了一个渲染服务依赖（不 mock 就起不来上下文）。 */
    @MockBean
    StatsTrendVideoService videoService;

    @Test
    void statsReturnsAggregates() throws Exception {
        StatsResponse stats = new StatsResponse(10, 3, 5,
                List.of(new TagSuggestion("高燃", 4L)),
                List.of(new StatsResponse.SiteCount("www.bilibili.com", 6L)),
                List.of(new StatsResponse.TrendPoint("2026-07-30", 2L)),
                List.of(new StatsResponse.TrendPoint("2026-07-30", 2L)),
                List.of(new StatsResponse.MediaFormatStat("VIDEO", "视频", 8L)),
                List.of(new StatsResponse.SubcategoryStat(2L, "番剧", 6L)));
        when(statsService.stats()).thenReturn(stats);

        mvc.perform(get("/api/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalClips").value(10))
                .andExpect(jsonPath("$.totalVideos").value(3))
                .andExpect(jsonPath("$.topTags[0].tag").value("高燃"))
                .andExpect(jsonPath("$.bySite[0].site").value("www.bilibili.com"))
                .andExpect(jsonPath("$.trend30[0].date").value("2026-07-30"));
    }

    /** v0.32 第一部分：趋势端点把多值参数绑到 List，并把响应原样透出。 */
    @Test
    void mediaTrendBindsMultiValueFilters() throws Exception {
        when(statsService.trend(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any())).thenReturn(new com.videotagger.service.StatsTrendResponse(
                List.of(2023, 2024), 5,
                List.of(new com.videotagger.service.StatsTrendResponse.Point(2023, 2),
                        new com.videotagger.service.StatsTrendResponse.Point(2024, 3))));

        mvc.perform(get("/api/stats/media-trend")
                        .param("tagIds", "417,418").param("tagMode", "AND")
                        .param("year", "2023,2024").param("genres", "科幻"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(5))
                .andExpect(jsonPath("$.years[0]").value(2023))
                .andExpect(jsonPath("$.points[1].count").value(3));
    }

    /** v0.32 第二部分：起渲染返回任务态；并发冲突由控制器层原样上抛（全局处理器转 409）。 */
    @Test
    void trendVideoStartAndStatus() throws Exception {
        StatsTrendVideoService.Task task = new StatsTrendVideoService.Task(
                "trend-20261004-1", "RUNNING", 0.25, null, null, null, "渲染中 25%", 1L);
        when(videoService.start(any())).thenReturn(task);
        when(videoService.status("trend-20261004-1")).thenReturn(task);

        mvc.perform(post("/api/stats/media-trend/video").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lines\":[{\"name\":\"异世界\",\"filter\":{\"tagIds\":[417]}}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RUNNING"));

        mvc.perform(get("/api/stats/media-trend/video/trend-20261004-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progress").value(0.25))
                .andExpect(jsonPath("$.message").value("渲染中 25%"));
    }
}
