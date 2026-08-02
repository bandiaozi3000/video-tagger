package com.videotagger.controller;

import com.videotagger.entity.Clip;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.NoSuchElementException;

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
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void saveRejectsNonHttpUrl() throws Exception {
        mvc.perform(post("/api/clips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"t","url":"ftp://a.com","timestampSec":1.0,"tag":"高燃"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void updateMissingReturns404() throws Exception {
        Mockito.doThrow(new NoSuchElementException("clip not found: 99"))
                .when(clipService).update(eq(99L), any(), eq(false));

        mvc.perform(put("/api/clips/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"t","url":"https://a.com/v","timestampSec":1.0,"tag":"高燃"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    void updateReturnsUpdatedClip() throws Exception {
        Clip clip = new Clip();
        clip.setId(1L);
        clip.setTitle("改后标题");
        clip.setUrl("https://a.com/v");
        clip.setTimestampSec(10.0);
        clip.setTag("名场面");
        clip.setNote("改后");
        Mockito.when(clipService.update(eq(1L), any(), eq(false))).thenReturn(clip);

        mvc.perform(put("/api/clips/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"改后标题","url":"https://a.com/v","timestampSec":10.0,
                                 "tag":"名场面","note":"改后"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("改后标题"));
    }

    @Test
    void updateWithAppendTagForwardsFlag() throws Exception {
        Mockito.when(clipService.update(eq(1L), any(), eq(true))).thenReturn(new Clip());

        mvc.perform(put("/api/clips/1?appendTag=true")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"t","url":"https://a.com/v","timestampSec":1.0,"tag":"追加"}
                                """))
                .andExpect(status().isOk());

        Mockito.verify(clipService).update(eq(1L), any(), eq(true));
    }

    @Test
    void nearReturnsNearbyClips() throws Exception {
        Clip c = new Clip();
        c.setId(7L);
        c.setTag("高燃");
        c.setTimestampSec(12.0);
        Mockito.when(clipService.findNearby("https://a.com/v", 10.0, 10.0)).thenReturn(List.of(c));

        mvc.perform(get("/api/clips/near")
                        .param("url", "https://a.com/v")
                        .param("timestampSec", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(7))
                .andExpect(jsonPath("$[0].tag").value("高燃"));
    }

    @Test
    void deleteReturns204() throws Exception {
        Mockito.when(clipService.delete(1L)).thenReturn(true);

        mvc.perform(delete("/api/clips/1"))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteMissingReturns404() throws Exception {
        Mockito.when(clipService.delete(99L)).thenReturn(false);

        mvc.perform(delete("/api/clips/99"))
                .andExpect(status().isNotFound());
    }
}
