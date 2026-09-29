package com.videotagger.controller;

import com.videotagger.mapper.*;
import com.videotagger.service.RecommendClipSourceService;
import com.videotagger.service.RecommendService;
import com.videotagger.service.RecommendSessionService;
import com.videotagger.service.RecommendVideoService;
import com.videotagger.service.VideoExportTaskService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Path;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RecommendController.class)
class RecommendControllerTest {

    private static final String TOKEN = "11111111-2222-3333-4444-555555555555";

    @Autowired
    MockMvc mvc;

    @TempDir
    Path sessionDir;

    @MockBean
    RecommendService recommendService;

    @MockBean
    RecommendVideoService recommendVideoService;

    @MockBean
    ClipMapper clipMapper;
    @MockBean MediaMapper mediaMapper;
    @MockBean EpisodeMapper episodeMapper;
    @MockBean ClipTagMapper clipTagMapper;
    @MockBean EpisodeTagMapper episodeTagMapper;
    @MockBean MediaTagMapper mediaTagMapper;
    @MockBean TagMapper tagMapper;
    @MockBean CollectionMapper collectionMapper;
    @MockBean MediaFormatMapper mediaFormatMapper;
    @MockBean MediaSubcategoryMapper mediaSubcategoryMapper;
    @MockBean MediaCollectionMapper mediaCollectionMapper;
    @MockBean SiteSettingMapper siteSettingMapper;
    @MockBean RecommendDraftMapper recommendDraftMapper;
    @MockBean RecommendTemplateMapper recommendTemplateMapper;
    @MockBean TitleMappingMapper titleMappingMapper;
    @MockBean EmbeddingTaskMapper embeddingTaskMapper;
    @MockBean HighlightProjectMapper highlightProjectMapper;
    @MockBean HighlightProjectItemMapper highlightProjectItemMapper;
    @MockBean HighlightExportMapper highlightExportMapper;

    @MockBean
    RecommendClipSourceService clipSourceService;

    @MockBean
    RecommendSessionService sessionService;

    @MockBean
    VideoExportTaskService exportTaskService;

    /** 会话响应：token + 解析后的 RenderInput 对象（不是被转义的字符串）+ missing 清单。 */
    @Test
    void sessionReturnsTokenAndParsedInput() throws Exception {
        Mockito.when(sessionService.create()).thenReturn(new RecommendSessionService.Session(TOKEN, sessionDir, 1L));
        Mockito.when(sessionService.materializeBgm(Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any()))
                .thenReturn(List.of());
        Mockito.when(recommendService.normalizeDurations(Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                        Mockito.any(), Mockito.any()))
                .thenReturn(new RecommendService.Durations(10, 5, 5, 10, 5, 2));
        Mockito.when(recommendService.buildRenderInput(
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.anyInt(), Mockito.anyInt(), Mockito.anyInt(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any()))
                .thenReturn("{\"template\":\"MULTI_MEDIA_RECOMMEND\",\"media\":[]}");

        mvc.perform(post("/api/recommend/session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2],\"resolution\":\"1080P\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value(TOKEN))
                .andExpect(jsonPath("$.input.template").value("MULTI_MEDIA_RECOMMEND"))
                .andExpect(jsonPath("$.missing").isArray());
    }

    @Test
    void sessionDeleteRecyclesWorkspace() throws Exception {
        mvc.perform(delete("/api/recommend/session/" + TOKEN))
                .andExpect(status().isNoContent());
        Mockito.verify(sessionService).delete(TOKEN);
    }

    @Test
    void htmlShareEndpointRetired() throws Exception {
        // `/html`（HTML 分享包）随旧模板链路退役：该路径不再存在（无处理器 → 5xx）
        mvc.perform(post("/api/recommend/html")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2,3]}"))
                .andExpect(status().is5xxServerError());
    }

    @Test
    void previewAndPrepareClipsEndpointsRetired() throws Exception {
        // v0.28：注入式预览 `/preview` 与孤儿端点 `/prepare-clips` 一并退役（编辑器走 /session）
        mvc.perform(post("/api/recommend/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2,3]}"))
                .andExpect(status().is5xxServerError());
        mvc.perform(post("/api/recommend/prepare-clips")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is5xxServerError());
    }

    @Test
    void videoCreatesAsyncTaskReturnsTaskId() throws Exception {
        VideoExportTaskService.VideoExportTask task =
                new VideoExportTaskService.VideoExportTask(7L, "标题", 2, "RUNNING", null, null, "MP4", 1L, 0L);
        Mockito.when(exportTaskService.create(
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any()))
                .thenReturn(task);

        mvc.perform(post("/api/recommend/video")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2],\"resolution\":\"1080P\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taskId").value(7))
                .andExpect(jsonPath("$.status").value("RUNNING"));

        Mockito.verify(exportTaskService).create(
                Mockito.anyList(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any());
}
}
