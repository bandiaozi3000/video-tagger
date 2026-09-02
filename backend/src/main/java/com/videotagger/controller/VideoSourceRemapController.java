package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoTimeMapping;
import com.videotagger.entity.VideoTimeMappingAnchor;
import com.videotagger.service.VideoSourceRemapService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/video-time-mappings")
public class VideoSourceRemapController {
    public record CreateRequest(long oldAssetId,long newAssetId,List<VideoTimeMappingAnchor> anchors){}
    private final VideoSourceRemapService service;
    public VideoSourceRemapController(VideoSourceRemapService service){this.service=service;}
    @PostMapping public VideoTimeMapping create(@RequestBody CreateRequest request){return service.create(request.oldAssetId(),request.newAssetId(),request.anchors());}
    @GetMapping("/{mappingId}/preview") public List<VideoSourceRemapService.Preview> preview(@PathVariable long mappingId){return service.preview(mappingId);}
    @PostMapping("/{mappingId}/confirm") public List<Clip> confirm(@PathVariable long mappingId,@RequestBody(required=false) List<Long> clipIds){return service.confirm(mappingId,clipIds);}
}