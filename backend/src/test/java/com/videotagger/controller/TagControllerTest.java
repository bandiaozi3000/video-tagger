package com.videotagger.controller;

import com.videotagger.service.ClipService;
import com.videotagger.service.PageResult;
import com.videotagger.service.TagAdminService;
import com.videotagger.service.TagSuggestion;
import com.videotagger.service.TagUsage;
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

@WebMvcTest(TagController.class)
class TagControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    ClipService clipService;

    @MockBean
    TagAdminService tagAdminService;

    @Test
    void suggestReturnsTags() throws Exception {
        when(clipService.suggestTags("高", 10, null))
                .thenReturn(List.of(new TagSuggestion("高燃", 3L)));

        mvc.perform(get("/api/tags").param("prefix", "高"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].tag").value("高燃"))
                .andExpect(jsonPath("$[0].count").value(3));
    }

    @Test
    void suggestWithMediaIdPassesThrough() throws Exception {
        when(clipService.suggestTags("", 10, 42L))
                .thenReturn(List.of(new TagSuggestion("乱马专有", 2L)));

        mvc.perform(get("/api/tags").param("mediaId", "42"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].tag").value("乱马专有"));
    }

    @Test
    void manageReturnsPagedTagUsages() throws Exception {
        when(tagAdminService.list("", null, 1, 50)).thenReturn(new PageResult<>(
                List.of(new TagUsage(1L, "高燃", 1L, 1, 2, 5, 0)), 1L));

        mvc.perform(get("/api/tags/manage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("高燃"))
                .andExpect(jsonPath("$.items[0].mediaCount").value(1))
                .andExpect(jsonPath("$.items[0].episodeCount").value(2))
                .andExpect(jsonPath("$.items[0].clipCount").value(5))
                .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void episodeStatsReturnsAggregatedTags() throws Exception {
        when(tagAdminService.episodeStats(7L))
                .thenReturn(List.of(new TagUsage(1L, "神作", 1L, 0, 0, 0, 5)));

        mvc.perform(get("/api/tags/episode-stats").param("episodeId", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("神作"))
                .andExpect(jsonPath("$[0].refCount").value(5));
    }
}
