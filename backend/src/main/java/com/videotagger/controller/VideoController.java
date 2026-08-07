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
                                   @RequestParam(defaultValue = "0") int offset) {
        return videoService.listVideos(limit, offset);
    }

    /** 有标记的视频总数，供列表分页导航。 */
    @GetMapping("/count")
    public long count() {
        return videoService.countVideos();
    }

    @GetMapping("/{fp}/clips")
    public List<Clip> clips(@PathVariable String fp) {
        return videoService.listClipsByFingerprint(fp);
    }
}
