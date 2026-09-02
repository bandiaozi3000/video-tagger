package com.videotagger.controller;

import com.videotagger.service.VideoSourcePlaybackService;
import com.videotagger.videosource.VideoSourceProbeResult;
import com.videotagger.videosource.VideoSourceResolution;
import org.springframework.web.bind.annotation.*;

@RestController
public class VideoSourcePlaybackController {
    private final VideoSourcePlaybackService service;
    public VideoSourcePlaybackController(VideoSourcePlaybackService service){this.service=service;}
    @GetMapping("/api/video-sources/{provider}/{packageId}/{itemId}/resolve") public VideoSourceResolution resolve(@PathVariable String provider,@PathVariable String packageId,@PathVariable String itemId,@RequestParam String revision){return service.resolve(provider,packageId,itemId,revision);}
    @GetMapping("/api/video-sources/{provider}/{packageId}/{itemId}/probe") public VideoSourceProbeResult probe(@PathVariable String provider,@PathVariable String packageId,@PathVariable String itemId,@RequestParam String revision){return service.probe(provider,packageId,itemId,revision);}
    @PostMapping("/api/video-assets/{assetId}/play-session") public VideoSourcePlaybackService.PlaySession play(@PathVariable long assetId){return service.playSession(assetId);}
}