package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.HighlightProject;
import com.videotagger.entity.HighlightProjectItem;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RecommendSingleServiceTest {
    private HighlightProjectService projectService;
    private MediaService mediaService;
    private ClipMapper clipMapper;
    private EpisodeMapper episodeMapper;
    private ExternalWorkMapper externalWorkMapper;
    private RecommendSingleService service;

    @BeforeEach
    void setUp() {
        projectService = mock(HighlightProjectService.class);
        mediaService = mock(MediaService.class);
        clipMapper = mock(ClipMapper.class);
        episodeMapper = mock(EpisodeMapper.class);
        externalWorkMapper = mock(ExternalWorkMapper.class);
        service = new RecommendSingleService(projectService, mediaService, clipMapper, episodeMapper,
                externalWorkMapper, new ObjectMapper(), new DefaultResourceLoader());
    }

    @Test
    void buildsRealSingleMediaTemplateAndKeepsMissingItems() {
        HighlightProject project = new HighlightProject();
        project.setId(7L);
        project.setMediaId(39L);
        when(projectService.requireProject(7L)).thenReturn(project);
        when(mediaService.get(39L)).thenReturn(new MediaDetail(39L, "<作品>", 2015, "原名", null,
                "VIDEO", null, null, null, "DONE", BigDecimal.ONE, "/covers/39.jpg", 1,
                "MANUAL", 1L, 2L, 1L, List.of(), List.of(), "/covers/clip/39.jpg"));

        Clip clip = new Clip();
        clip.setId(100L);
        clip.setTitle("关键转折");
        clip.setNote("片段说明");
        clip.setEpisodeId(3L);
        clip.setCoverPath("/covers/clip/100.jpg");
        when(clipMapper.listByMedia(39L)).thenReturn(List.of(clip));
        Episode episode = new Episode();
        episode.setId(3L);
        episode.setEpisodeNo(4);
        episode.setTitle("转折的一集");
        when(episodeMapper.listByMedia(39L)).thenReturn(List.of(episode));

        HighlightProjectItem ready = item(11L, 100L, "READY", "片段范围");
        HighlightProjectItem missing = item(12L, 100L, "UNAVAILABLE", "原始素材缺失");
        when(projectService.items(7L)).thenReturn(List.of(ready, missing));

        String html = service.buildHtml(7L);

        assertTrue(html.contains("__SINGLE_DATA__") == false);
        assertTrue(html.contains("&lt;作品&gt;"));
        assertTrue(html.contains("关键转折"));
        assertTrue(html.contains("/api/highlight-projects/7/items/11/preview"));
        assertTrue(html.contains("原始素材缺失"));
        assertTrue(html.contains("\"episodeNo\":4"));
    }

    @Test
    void templateDoesNotExposeStoredSourcePath() {
        HighlightProject project = new HighlightProject();
        project.setId(8L);
        project.setMediaId(39L);
        when(projectService.requireProject(8L)).thenReturn(project);
        when(mediaService.get(39L)).thenReturn(new MediaDetail(39L, "作品", null, null, null,
                "VIDEO", null, null, null, null, null, null, 1, "MANUAL", 1L, 1L, 1L,
                List.of(), List.of(), null));
        when(clipMapper.listByMedia(39L)).thenReturn(List.of());
        when(episodeMapper.listByMedia(39L)).thenReturn(List.of());
        HighlightProjectItem item = item(13L, null, "READY", "sources/13.mp4");
        when(projectService.items(8L)).thenReturn(List.of(item));

        String html = service.buildHtml(8L);

        assertFalse(html.contains("sources/13.mp4"));
        assertTrue(html.contains("/api/highlight-projects/8/items/13/preview"));
    }

    private static HighlightProjectItem item(long id, Long clipId, String state, String pathOrMessage) {
        HighlightProjectItem item = new HighlightProjectItem();
        item.setId(id);
        item.setClipId(clipId);
        item.setInSec(10D);
        item.setOutSec(25D);
        item.setSourceState(state);
        if ("READY".equals(state)) item.setSourcePath(pathOrMessage);
        else item.setSourceMessage(pathOrMessage);
        return item;
    }
}
