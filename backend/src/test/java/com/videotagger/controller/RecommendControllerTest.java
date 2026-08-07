package com.videotagger.controller;

import com.videotagger.service.RecommendService;
import com.videotagger.service.RecommendVideoService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;

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

    @Test
    void htmlReturnsSelfContainedFile() throws Exception {
        Mockito.when(recommendService.buildHtml(Mockito.anyList(), Mockito.any()))
                .thenReturn("<!DOCTYPE html><h1>我的番剧推荐</h1>");

        mvc.perform(post("/api/recommend/html")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2,3]}"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/html;charset=UTF-8"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("我的番剧推荐")))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("video-tagger-recommend.html")));

        Mockito.verify(recommendService).buildHtml(Mockito.anyList(), Mockito.any());
    }

    @Test
    void htmlPassesTitleThrough() throws Exception {
        Mockito.when(recommendService.buildHtml(Mockito.anyList(), Mockito.any()))
                .thenReturn("<!DOCTYPE html><h1>2026 春季补番</h1>");

        mvc.perform(post("/api/recommend/html")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2],\"title\":\"2026 春季补番\"}"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("2026 春季补番")));

        Mockito.verify(recommendService).buildHtml(Mockito.anyList(), Mockito.eq("2026 春季补番"));
    }

    @Test
    void htmlEmptyIdsReturns400() throws Exception {
        Mockito.when(recommendService.buildHtml(Mockito.anyList(), Mockito.any()))
                .thenThrow(new IllegalArgumentException("ids 不能为空"));

        mvc.perform(post("/api/recommend/html")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void videoReturnsMp4Download() throws Exception {
        Path mp4 = Files.createTempFile("vt-recommend-test-", ".mp4");
        Files.write(mp4, new byte[]{0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50});
        try {
            Mockito.when(recommendVideoService.render(Mockito.anyList(), Mockito.any(), Mockito.any(), Mockito.eq("1080P")))
                    .thenReturn(mp4);

            mvc.perform(post("/api/recommend/video")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"ids\":[1,2],\"resolution\":\"1080P\"}"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType("video/mp4"))
                    .andExpect(header().string("Content-Disposition",
                            org.hamcrest.Matchers.containsString(".mp4")))
                    .andExpect(content().bytes(new byte[]{0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50}));

            Mockito.verify(recommendVideoService).render(Mockito.anyList(), Mockito.any(), Mockito.any(), Mockito.eq("1080P"));
        } finally {
            Files.deleteIfExists(mp4);
        }
    }

    @Test
    void videoWebmReturnsWebmContentType() throws Exception {
        Path webm = Files.createTempFile("vt-recommend-test-", ".webm");
        Files.write(webm, new byte[]{(byte) 0x1A, (byte) 0x45, (byte) 0xDF, (byte) 0xA3});
        try {
            Mockito.when(recommendVideoService.render(Mockito.anyList(), Mockito.any(), Mockito.any(), Mockito.eq("720P")))
                    .thenReturn(webm);

            mvc.perform(post("/api/recommend/video")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"ids\":[1],\"format\":\"WEBM\",\"resolution\":\"720P\"}"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType("video/webm"))
                    .andExpect(header().string("Content-Disposition",
                            org.hamcrest.Matchers.containsString(".webm")));

            Mockito.verify(recommendVideoService).render(Mockito.anyList(), Mockito.any(), Mockito.eq("WEBM"), Mockito.eq("720P"));
        } finally {
            Files.deleteIfExists(webm);
        }
    }

    @Test
    void videoUnknownResolutionReturns400() throws Exception {
        Mockito.when(recommendVideoService.render(Mockito.anyList(), Mockito.any(), Mockito.any(), Mockito.eq("4KXX")))
                .thenThrow(new IllegalArgumentException("未知清晰度: 4KXX（可选 720P/1080P/4K）"));

        mvc.perform(post("/api/recommend/video")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1],\"resolution\":\"4KXX\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }
}
