package com.videotagger.controller;

import com.videotagger.entity.Episode;
import com.videotagger.entity.VideoSourceEpisodeMap;
import com.videotagger.service.VideoSourceMappingService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/video-source")
public class VideoSourceMappingController {
    private final VideoSourceMappingService service;
    public VideoSourceMappingController(VideoSourceMappingService service){this.service=service;}
    @GetMapping("/packages/{packageId}/suggestions") public List<VideoSourceMappingService.Suggestion> suggestions(@PathVariable long packageId){return service.suggest(packageId);}
    @PostMapping("/items/{sourceItemId}/mapping") public VideoSourceEpisodeMap confirm(@PathVariable long sourceItemId,@RequestParam long episodeId,@RequestParam(required=false) String reason){return service.confirm(sourceItemId,episodeId,reason);}
    @PostMapping("/items/{sourceItemId}/ignore") public VideoSourceEpisodeMap ignore(@PathVariable long sourceItemId,@RequestParam(required=false) String reason){return service.ignore(sourceItemId,reason);}
    @PostMapping("/packages/{packageId}/items/{sourceItemId}/episodes") public Episode create(@PathVariable long packageId,@PathVariable long sourceItemId,@RequestParam Integer episodeNo,@RequestParam String title){return service.createEpisode(packageId,sourceItemId,episodeNo,title);}
}