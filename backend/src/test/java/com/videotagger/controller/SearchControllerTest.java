package com.videotagger.controller;

import com.videotagger.service.SearchResponse;
import com.videotagger.service.SearchResult;
import com.videotagger.service.SearchService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SearchController.class)
class SearchControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    SearchService searchService;

    @Test
    void searchReturnsResults() throws Exception {
        SearchResult item = new SearchResult(1L, "某动画 第3集",
                "https://www.bilibili.com/video/BV1", "https://www.bilibili.com/video/BV1?t=754",
                754.5, "高燃战斗", "主角觉醒", 0.032);
        Mockito.when(searchService.search(eq("战斗"), eq(20), eq("mixed"), eq(null), eq(null), eq(null), eq(null)))
                .thenReturn(new SearchResponse(true, List.of(item)));

        mvc.perform(get("/api/search").param("q", "战斗"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.semanticEnabled").value(true))
                .andExpect(jsonPath("$.results[0].id").value(1))
                .andExpect(jsonPath("$.results[0].jumpUrl").value("https://www.bilibili.com/video/BV1?t=754"))
                .andExpect(jsonPath("$.results[0].tag").value("高燃战斗"));
    }

    @Test
    void similarReturnsResults() throws Exception {
        SearchResult item = new SearchResult(2L, "某动画 第3集",
                "https://www.bilibili.com/video/BV2", "https://www.bilibili.com/video/BV2?t=100",
                100.0, "高燃", "", 0.05);
        Mockito.when(searchService.similar(eq(1L), eq(10))).thenReturn(List.of(item));

        mvc.perform(get("/api/search/similar").param("id", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(2))
                .andExpect(jsonPath("$[0].tag").value("高燃"));
    }
}
