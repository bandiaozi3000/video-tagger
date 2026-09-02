package com.videotagger.controller;
import com.videotagger.entity.VideoAssetTrack;
import com.videotagger.service.VideoAssetTrackService;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController
@RequestMapping("/api/video-assets/{assetId}/tracks")
public class VideoAssetTrackController {
 private final VideoAssetTrackService service; public VideoAssetTrackController(VideoAssetTrackService service){this.service=service;}
 @GetMapping public List<VideoAssetTrack> list(@PathVariable long assetId){return service.list(assetId);}
 @PostMapping public VideoAssetTrack add(@PathVariable long assetId,@RequestBody VideoAssetTrack track){return service.add(assetId,track);}
 @DeleteMapping("/{trackId}") public void delete(@PathVariable long assetId,@PathVariable long trackId){service.delete(assetId,trackId);}
}