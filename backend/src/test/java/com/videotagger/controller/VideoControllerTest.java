package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.service.VideoService;
import com.videotagger.service.VideoSummary;
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

@WebMvcTest(VideoController.class)
class VideoControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    VideoService videoService;

    @Test
    void listVideos() throws Exception {
        when(videoService.listVideos(20, 0))
                .thenReturn(List.of(new VideoSummary("fp1", 3L, 1700000000000L, "某动画 第3集")));

        mvc.perform(get("/api/videos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fp").value("fp1"))
                .andExpect(jsonPath("$[0].count").value(3))
                .andExpect(jsonPath("$[0].title").value("某动画 第3集"));
    }

    @Test
    void clipsByFingerprint() throws Exception {
        Clip c = new Clip();
        c.setId(1L);
        c.setTag("高燃");
        c.setTimestampSec(12.0);
        when(videoService.listClipsByFingerprint("fp1")).thenReturn(List.of(c));

        mvc.perform(get("/api/videos/fp1/clips"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].tag").value("高燃"));
    }
}
