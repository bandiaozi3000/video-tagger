package com.videotagger.controller;

import com.videotagger.entity.VideoAsset;
import com.videotagger.service.VideoAssetService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/episodes/{episodeId}/video-assets")
public class VideoAssetController {
    private final VideoAssetService service;
    public VideoAssetController(VideoAssetService service){this.service=service;}
    @GetMapping public List<VideoAsset> list(@PathVariable long episodeId){return service.list(episodeId);}
    @GetMapping("/selected") public VideoAsset selected(@PathVariable long episodeId){return service.select(episodeId);}
    @PostMapping public VideoAsset create(@PathVariable long episodeId,@RequestBody VideoAsset asset){asset.setEpisodeId(episodeId);return service.create(asset);}
    @PostMapping("/{assetId}/role") public VideoAsset role(@PathVariable long assetId,@RequestParam String value){return service.setRole(assetId,value);}
    @DeleteMapping("/{assetId}") public void delete(@PathVariable long assetId){service.delete(assetId);}
}