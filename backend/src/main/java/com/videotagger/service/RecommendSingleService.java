package com.videotagger.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.HighlightProject;
import com.videotagger.entity.HighlightProjectItem;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Builds the single-media recommendation page from the existing highlight project. */
@Service
public class RecommendSingleService {
    private final HighlightProjectService projectService;
    private final MediaService mediaService;
    private final ClipMapper clipMapper;
    private final EpisodeMapper episodeMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;

    public RecommendSingleService(HighlightProjectService projectService, MediaService mediaService,
                                  ClipMapper clipMapper, EpisodeMapper episodeMapper,
                                  ExternalWorkMapper externalWorkMapper,
                                  ObjectMapper objectMapper, ResourceLoader resourceLoader) {
        this.projectService = projectService;
        this.mediaService = mediaService;
        this.clipMapper = clipMapper;
        this.episodeMapper = episodeMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.objectMapper = objectMapper;
        this.resourceLoader = resourceLoader;
    }

    public String buildHtml(long projectId) {
        HighlightProject project = projectService.requireProject(projectId);
        MediaDetail media = mediaService.get(project.getMediaId());
        List<HighlightProjectItem> items = projectService.items(projectId);
        Map<String, Object> data = data(project, media, items);
        try {
            String json = objectMapper.writeValueAsString(data)
                    .replace("<", "\\u003c")
                    .replace(">", "\\u003e")
                    .replace("&", "\\u0026");
            String template = readTemplate();
            return template.replace("__SINGLE_DATA__", json)
                    .replace("__TITLE__", HtmlUtils.htmlEscape(media.title() == null ? "单媒体推荐" : media.title()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("序列化单媒体推荐数据失败", e);
        }
    }

    private Map<String, Object> data(HighlightProject project, MediaDetail media,
                                     List<HighlightProjectItem> items) {
        Map<Long, Clip> clips = new LinkedHashMap<>();
        for (Clip clip : clipMapper.listByMedia(media.id())) clips.put(clip.getId(), clip);
        Map<Long, Episode> episodes = new LinkedHashMap<>();
        for (Episode episode : episodeMapper.listByMedia(media.id())) episodes.put(episode.getId(), episode);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("projectId", project.getId());
        result.put("title", media.title());
        result.put("year", media.year());
        result.put("season", media.season());
        result.put("format", media.mediaFormat());
        result.put("cover", firstCover(media, clips.values()));
        result.put("description", description(media.id()));
        result.put("tags", media.tags() == null ? List.of() : media.tags().stream()
                .map(tag -> tag.getName()).filter(name -> name != null && !name.isBlank()).limit(8).toList());
        result.put("episodeCount", media.episodeCount());
        result.put("clipCount", items.size());
        result.put("estimatedSeconds", items.stream().mapToDouble(this::duration).sum());
        result.put("chaptersEnabled", chaptersEnabled(project.getConfigJson()));
        result.put("items", items.stream().map(item -> itemView(project, item, clips.get(item.getClipId()), episodes)).toList());
        return result;
    }

    private Map<String, Object> itemView(HighlightProject project, HighlightProjectItem item, Clip clip,
                                          Map<Long, Episode> episodes) {
        Episode episode = clip == null ? null : episodes.get(clip.getEpisodeId());
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", item.getId());
        view.put("clipId", item.getClipId());
        view.put("title", item.getCaption() == null || item.getCaption().isBlank()
                ? clip == null ? "未命名片段" : clip.getTitle() : item.getCaption());
        view.put("note", clip == null ? "" : clip.getNote());
        view.put("episodeNo", episode == null ? null : episode.getEpisodeNo());
        view.put("episodeTitle", episode == null ? null : episode.getTitle());
        view.put("inSec", item.getInSec());
        view.put("outSec", item.getOutSec());
        view.put("duration", duration(item));
        view.put("poster", clip == null ? null : clip.getCoverPath());
        view.put("spoilerState", item.getSpoilerState());
        view.put("sourceReady", "READY".equals(item.getSourceState()) && item.getSourcePath() != null);
        view.put("sourceMessage", item.getSourceMessage());
        view.put("sourceUrl", "READY".equals(item.getSourceState())
                ? "/api/highlight-projects/" + project.getId() + "/items/" + item.getId() + "/preview" : null);
        return view;
    }

    private double duration(HighlightProjectItem item) {
        if (item.getInSec() == null || item.getOutSec() == null) return 0;
        return Math.max(0, item.getOutSec() - item.getInSec());
    }

    private String firstCover(MediaDetail media, Iterable<Clip> clips) {
        if (media.coverPath() != null && !media.coverPath().isBlank()) return media.coverPath();
        if (media.fallbackCoverPath() != null && !media.fallbackCoverPath().isBlank()) return media.fallbackCoverPath();
        for (Clip clip : clips) {
            if (clip.getDetailCoverPath() != null && !clip.getDetailCoverPath().isBlank()) return clip.getDetailCoverPath();
            if (clip.getCoverPath() != null && !clip.getCoverPath().isBlank()) return clip.getCoverPath();
        }
        return media.externalCoverUrl();
    }

    private String description(long mediaId) {
        try {
            return externalWorkMapper.listByMedia(mediaId).stream()
                    .map(ExternalWork::getDescription)
                    .filter(text -> text != null && !text.isBlank())
                    .findFirst().orElse("");
        } catch (RuntimeException e) {
            return "";
        }
    }

    private boolean chaptersEnabled(String configJson) {
        try {
            return objectMapper.readTree(configJson == null ? "{}" : configJson)
                    .path("chaptersEnabled").asBoolean(true);
        } catch (IOException e) {
            return true;
        }
    }

    private String readTemplate() {
        try (var in = resourceLoader.getResource("classpath:templates/recommend-single.html").getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("读取单媒体推荐模板失败", e);
        }
    }
}
