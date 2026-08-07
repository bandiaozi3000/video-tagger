package com.videotagger.controller;

import com.videotagger.entity.Collection;
import com.videotagger.service.CollectionService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.NoSuchElementException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CollectionController.class)
class CollectionControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    CollectionService collectionService;

    private Collection sample(Long id, String name) {
        Collection c = new Collection();
        c.setId(id);
        c.setName(name);
        return c;
    }

    @Test
    void renameReturnsUpdated() throws Exception {
        Mockito.when(collectionService.rename(1L, "新名字")).thenReturn(sample(1L, "新名字"));

        mvc.perform(put("/api/collections/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"新名字\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("新名字"));

        Mockito.verify(collectionService).rename(1L, "新名字");
    }

    @Test
    void renameBlankNameReturns400() throws Exception {
        Mockito.when(collectionService.rename(1L, "  "))
                .thenThrow(new IllegalArgumentException("name 不能为空"));

        mvc.perform(put("/api/collections/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void renameMissingReturns404() throws Exception {
        Mockito.when(collectionService.rename(99L, "x"))
                .thenThrow(new NoSuchElementException("collection not found: 99"));

        mvc.perform(put("/api/collections/99")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }
}
