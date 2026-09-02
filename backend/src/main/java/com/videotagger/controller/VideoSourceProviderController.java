package com.videotagger.controller;

import com.videotagger.videosource.VideoSourceProviderCapabilities;
import com.videotagger.videosource.VideoSourceProviderRegistry;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/video-source-providers")
public class VideoSourceProviderController {
    private final VideoSourceProviderRegistry registry;

    public VideoSourceProviderController(VideoSourceProviderRegistry registry) {
        this.registry = registry;
    }

    @GetMapping
    public List<VideoSourceProviderCapabilities> list() {
        return registry.capabilities();
    }
}
