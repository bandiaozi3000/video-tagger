package com.videotagger.controller;

import com.videotagger.service.EpisodeService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** 集级打标入口（Web UI 手动，Phase 1 形态）。 */
@RestController
@RequestMapping("/api/episodes")
public class EpisodeController {

    private final EpisodeService episodeService;

    public EpisodeController(EpisodeService episodeService) {
        this.episodeService = episodeService;
    }

    @PostMapping("/{id}/tags")
    public void addTag(@PathVariable Long id, @RequestBody Map<String, String> body) {
        episodeService.addTag(id, body.get("tag"));
    }

    @DeleteMapping("/{id}/tags/{tagId}")
    public void removeTag(@PathVariable Long id, @PathVariable Long tagId) {
        episodeService.removeTag(id, tagId);
    }
}
