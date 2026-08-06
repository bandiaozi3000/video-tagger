package com.videotagger.controller;

import com.videotagger.service.StatsResponse;
import com.videotagger.service.StatsService;
import com.videotagger.service.TagSuggestion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StatsController.class)
class StatsControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    StatsService statsService;

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
}
