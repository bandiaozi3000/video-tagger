package com.videotagger.controller;
import com.videotagger.entity.Clip;
import com.videotagger.service.VideoAssetClipService;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/episodes/{episodeId}/video-assets/{assetId}/clips")
public class VideoAssetClipController {private final VideoAssetClipService service;public VideoAssetClipController(VideoAssetClipService service){this.service=service;}@PostMapping public Clip create(@PathVariable long episodeId,@PathVariable long assetId,@RequestBody VideoAssetClipService.CreateReferenceClipRequest request){return service.create(episodeId,assetId,request);}}