package com.videotagger.controller;

import com.videotagger.service.JumpQueue;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(JumpController.class)
class JumpControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    JumpQueue jumpQueue;

    @Test
    void postJumpPutsIntoQueue() throws Exception {
        mvc.perform(post("/api/jump")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"https://a.com/v\",\"timestampSec\":123.0}"))
                .andExpect(status().isOk());

        Mockito.verify(jumpQueue).put("https://a.com/v", 123.0);
    }

    @Test
    void pendingReturnsTimestampWhenPresent() throws Exception {
        Mockito.when(jumpQueue.poll("https://a.com/v")).thenReturn(Optional.of(123.0));

        mvc.perform(get("/api/jump/pending").param("url", "https://a.com/v"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timestampSec").value(123.0));
    }

    @Test
    void pendingReturns204WhenAbsent() throws Exception {
        Mockito.when(jumpQueue.poll("https://a.com/v")).thenReturn(Optional.empty());

        mvc.perform(get("/api/jump/pending").param("url", "https://a.com/v"))
                .andExpect(status().isNoContent());
    }
}
