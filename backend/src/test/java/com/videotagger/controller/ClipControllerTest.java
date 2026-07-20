package com.videotagger.controller;

import com.videotagger.service.ClipService;
import com.videotagger.service.SaveClipResult;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ClipController.class)
class ClipControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    ClipService clipService;

    @Test
    void saveReturnsId() throws Exception {
        Mockito.when(clipService.save(any())).thenReturn(new SaveClipResult(42L, false));

        mvc.perform(post("/api/clips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"某动画 第3集","url":"https://www.bilibili.com/video/BV1",
                                 "timestampSec":754.5,"tag":"高燃战斗","note":""}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.deduped").value(false));
    }

    @Test
    void saveRejectsBlankTag() throws Exception {
        mvc.perform(post("/api/clips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"t","url":"https://a.com","timestampSec":1.0,"tag":""}
                                """))
                .andExpect(status().isBadRequest());
    }
}
