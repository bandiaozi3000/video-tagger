package com.videotagger.controller;

import com.videotagger.service.VideoSourceQuickPlayService;
import com.videotagger.service.VideoSourceRelayService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.Map;

@RestController
public class VideoSourceQuickPlayController {
    private final VideoSourceQuickPlayService service;
    private final VideoSourceRelayService relayService;

    public VideoSourceQuickPlayController(VideoSourceQuickPlayService service, VideoSourceRelayService relayService) {
        this.service = service;
        this.relayService = relayService;
    }

    @PostMapping("/api/episodes/{episodeId}/quick-play")
    public VideoSourceQuickPlayService.SessionView start(@PathVariable long episodeId,
                                                         @RequestBody(required = false) VideoSourceQuickPlayService.StartRequest request) {
        return service.start(episodeId, request);
    }

    @GetMapping("/api/video-source-quick-play/{sessionId}")
    public VideoSourceQuickPlayService.SessionView get(@PathVariable String sessionId) {
        return service.get(sessionId);
    }

    @PostMapping("/api/video-source-quick-play/{sessionId}/select")
    public VideoSourceQuickPlayService.SessionView select(@PathVariable String sessionId,
                                                          @RequestBody Map<String, String> request) {
        return service.select(sessionId, request.get("candidateId"));
    }

    @PostMapping("/api/video-source-quick-play/{sessionId}/materialize")
    public com.videotagger.entity.VideoAsset materialize(@PathVariable String sessionId,
                                                          @RequestBody Map<String, String> request) {
        return service.materialize(sessionId, request.get("candidateId"));
    }

    @GetMapping("/api/video-source-quick-play/{sessionId}/candidates/{candidateId}/stream")
    public ResponseEntity<StreamingResponseBody> stream(@PathVariable String sessionId,
                                                        @PathVariable String candidateId,
                                                        @RequestHeader(value = "Range", required = false) String range) {
        return relayService.open(service.relayTarget(sessionId, candidateId), range);
    }
}
