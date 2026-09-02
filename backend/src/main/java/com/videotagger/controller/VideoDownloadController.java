package com.videotagger.controller;

import com.videotagger.service.VideoDownloadService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;

@RestController
@RequestMapping("/api/video-assets")
public class VideoDownloadController {
    private final VideoDownloadService service;
    public VideoDownloadController(VideoDownloadService service){this.service=service;}
    @PostMapping("/{assetId}/download") public ResponseEntity<VideoDownloadService.DownloadResult> download(@PathVariable long assetId,@RequestParam long mediaId,@RequestParam long entryId,@RequestParam long episodeId,@RequestParam String locator,@RequestParam(defaultValue="524288000") long maxBytes) throws Exception{return ResponseEntity.ok(service.download(assetId,mediaId,entryId,episodeId,locator,maxBytes));}
}