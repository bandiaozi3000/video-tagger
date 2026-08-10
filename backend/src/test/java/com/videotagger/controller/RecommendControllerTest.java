package com.videotagger.controller;

import com.videotagger.service.RecommendService;
import com.videotagger.service.RecommendVideoService;
import com.videotagger.service.VideoExportTaskService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RecommendController.class)
class RecommendControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    RecommendService recommendService;

    @MockBean
    RecommendVideoService recommendVideoService;

    @MockBean
    VideoExportTaskService exportTaskService;

    @Test
    void htmlReturnsSelfContainedFile() throws Exception {
        Mockito.when(recommendService.buildHtml(Mockito.anyList(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any())).thenReturn("<!DOCTYPE html><h1>我的番剧推荐</h1>");

        mvc.perform(post("/api/recommend/html")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2,3]}"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/html;charset=UTF-8"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("我的番剧推荐")))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("video-tagger-recommend.html")));
    }

    @Test
    void htmlPassesTitleThrough() throws Exception {
        Mockito.when(recommendService.buildHtml(Mockito.anyList(),
                Mockito.eq("2026 春季补番"), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any())).thenReturn("<!DOCTYPE html><h1>2026 春季补番</h1>");

        mvc.perform(post("/api/recommend/html")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2],\"title\":\"2026 春季补番\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("2026 春季补番")));
    }

    @Test
    void htmlEmptyIdsReturns400() throws Exception {
        Mockito.when(recommendService.buildHtml(Mockito.anyList(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any()))
                .thenThrow(new IllegalArgumentException("ids 不能为空"));

        mvc.perform(post("/api/recommend/html")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void videoCreatesAsyncTaskReturnsTaskId() throws Exception {
        VideoExportTaskService.VideoExportTask task =
                new VideoExportTaskService.VideoExportTask(7L, "标题", 2, "RUNNING", null, null, "MP4", 1L, 0L);
        Mockito.when(exportTaskService.create(Mockito.anyList(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any()))
                .thenReturn(task);

        mvc.perform(post("/api/recommend/video")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2],\"resolution\":\"1080P\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taskId").value(7))
                .andExpect(jsonPath("$.status").value("RUNNING"));

        Mockito.verify(exportTaskService).create(Mockito.anyList(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any());
    }
}
