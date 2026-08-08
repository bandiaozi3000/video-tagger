package com.videotagger.controller;

import com.videotagger.service.OmofunaSyncTaskService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** OmofunaSyncController 切片测试：POST 建任务 / 轮询状态 / 404 / current。 */
@WebMvcTest(OmofunaSyncController.class)
class OmofunaSyncControllerTest {

    @Autowired
    MockMvc mvc;

    @MockBean
    OmofunaSyncTaskService taskService;

    private OmofunaSyncTaskService.OmofunaTask task(String id, String status, long createdAt) {
        return task(id, status, createdAt, List.of());
    }

    private OmofunaSyncTaskService.OmofunaTask task(String id, String status, long createdAt, List<Integer> types) {
        return new OmofunaSyncTaskService.OmofunaTask(id, status, List.of(2026), types, 0, 0, 0, 0, "", createdAt, createdAt);
    }

    @Test
    void startCreatesAndExecutesTask() throws Exception {
        var task = task("abc123", "RUNNING", 1000L);
        when(taskService.create(List.of(2026), null)).thenReturn(task);

        mvc.perform(post("/api/media/sync-omofuna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"years\":[2026]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taskId").value("abc123"))
                .andExpect(jsonPath("$.status").value("RUNNING"));

        verify(taskService).execute("abc123", List.of(2026), List.of());
    }

    @Test
    void startWithTypesPassesTypes() throws Exception {
        var task = task("def456", "RUNNING", 1000L, List.of(24));
        when(taskService.create(List.of(2026), List.of(24))).thenReturn(task);

        mvc.perform(post("/api/media/sync-omofuna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"years\":[2026],\"types\":[24]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taskId").value("def456"));

        verify(taskService).execute("def456", List.of(2026), List.of(24));
    }

    @Test
    void emptyYearsReturns400() throws Exception {
        when(taskService.create(List.of(), null)).thenThrow(new IllegalArgumentException("请至少勾选一个年份"));

        mvc.perform(post("/api/media/sync-omofuna")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"years\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getTaskReturnsState() throws Exception {
        var task = task("abc123", "DONE", 1000L);
        when(taskService.get("abc123")).thenReturn(task);

        mvc.perform(get("/api/media/sync-omofuna/abc123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taskId").value("abc123"))
                .andExpect(jsonPath("$.status").value("DONE"));
    }

    @Test
    void getMissingTaskReturns404() throws Exception {
        when(taskService.get("nope")).thenReturn(null);

        mvc.perform(get("/api/media/sync-omofuna/nope"))
                .andExpect(status().isNotFound());
    }

    @Test
    void currentReturnsLatestTask() throws Exception {
        var task = task("latest", "RUNNING", 2000L);
        when(taskService.current()).thenReturn(task);

        mvc.perform(get("/api/media/sync-omofuna/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taskId").value("latest"));
    }
}
