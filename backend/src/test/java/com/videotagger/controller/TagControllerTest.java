package com.videotagger.controller;

import com.videotagger.service.ClipService;
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

@WebMvcTest(TagController.class)
class TagControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    ClipService clipService;

    @Test
    void suggestReturnsTags() throws Exception {
        when(clipService.suggestTags("高", 10))
                .thenReturn(List.of(new TagSuggestion("高燃", 3L)));

        mvc.perform(get("/api/tags").param("prefix", "高"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].tag").value("高燃"))
                .andExpect(jsonPath("$[0].count").value(3));
    }
}
