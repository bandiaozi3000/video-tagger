package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.service.VideoService;
import com.videotagger.service.VideoSummary;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/videos")
public class VideoController {

    private final VideoService videoService;

    public VideoController(VideoService videoService) {
        this.videoService = videoService;
    }

    @GetMapping
    public List<VideoSummary> list(@RequestParam(defaultValue = "20") int limit,
                                   @RequestParam(required = false) Long cursorLatest,
                                   @RequestParam(required = false) String cursorFp) {
        return videoService.listVideos(limit, cursorLatest, cursorFp);
    }

    @GetMapping("/{fp}/clips")
    public List<Clip> clips(@PathVariable String fp) {
        return videoService.listClipsByFingerprint(fp);
    }
}
