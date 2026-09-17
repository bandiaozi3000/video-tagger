package com.videotagger.controller;

import com.videotagger.mapper.*;
import com.videotagger.service.RecommendClipSourceService;
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

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
    VideoExportTaskService exportTaskService;
    @Test
    void htmlShareEndpointRetired() throws Exception {
        // `/html`（HTML 分享包）随旧模板链路退役：该路径不再存在（无处理器 → 500 包裹）
        mvc.perform(post("/api/recommend/html")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2,3]}"))
                .andExpect(status().is5xxServerError());
    }

    @Test
    void previewWithoutPlayerBundleFailsLoud() throws Exception {
        // Player 静态包未构建 → 409 并给出可操作的中文提示（不是静默回退到旧 HTML）
        Mockito.when(recommendVideoService.playerPagePath()).thenReturn(null);
        mvc.perform(post("/api/recommend/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\":[1,2,3]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("build:player")));
    }

    @Test
    void videoCreatesAsyncTaskReturnsTaskId() throws Exception {
        VideoExportTaskService.VideoExportTask task =
                new VideoExportTaskService.VideoExportTask(7L, "标题", 2, "RUNNING", null, null, "MP4", 1L, 0L);
        Mockito.when(exportTaskService.create(Mockito.anyList(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any()))
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
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any());
    }
}
