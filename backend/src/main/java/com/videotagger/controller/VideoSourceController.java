package com.videotagger.controller;

import com.videotagger.entity.VideoSourcePackage;
import com.videotagger.service.VideoSourceDiscoveryService;
import com.videotagger.videosource.VideoSourceDiscoveryRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/media-entries/{mediaEntryId}/video-sources")
public class VideoSourceController {
    private final VideoSourceDiscoveryService service;
    public VideoSourceController(VideoSourceDiscoveryService service) { this.service = service; }
    @GetMapping public List<VideoSourcePackage> cached(@PathVariable long mediaEntryId) { return service.cached(mediaEntryId); }
    @PostMapping("/discover") public List<VideoSourcePackage> discover(@PathVariable long mediaEntryId, @RequestBody(required = false) VideoSourceDiscoveryRequest request) { return service.discover(mediaEntryId, request); }
    @GetMapping("/{packageId}") public VideoSourcePackage detail(@PathVariable long packageId) { return service.requireCached(packageId); }
    @PostMapping("/{packageId}/adopt") public VideoSourcePackage adopt(@PathVariable long packageId) { return service.adopt(packageId); }
    @PostMapping("/{packageId}/refresh") public VideoSourcePackage refresh(@PathVariable long packageId) { return service.refresh(packageId); }
}