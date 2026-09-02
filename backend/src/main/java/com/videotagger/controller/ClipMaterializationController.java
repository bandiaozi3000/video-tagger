package com.videotagger.controller;

import com.videotagger.service.ClipMaterializationService;
import com.videotagger.service.MaterializationService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;

/**
 * v0.24 M3 素材渠道求值端点：
 * <ul>
 *   <li>GET /plan            → 既有本地策略计划（保留，兼容素材工作台）</li>
 *   <li>GET /channels        → C1→C4 渠道求值（新）</li>
 *   <li>POST /channels/refresh → 求值并回写 channel_hints</li>
 *   <li>POST /materialize-from-file?path= → 外部文件（C2/C3）裁剪</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/clips/{clipId}/material")
public class ClipMaterializationController {
    private final ClipMaterializationService service;
    private final MaterializationService channelService;
    public ClipMaterializationController(ClipMaterializationService service, MaterializationService channelService){
        this.service=service;this.channelService=channelService;
    }
    @GetMapping("/plan") public ClipMaterializationService.Plan plan(@PathVariable long clipId){return service.plan(clipId);}
    @PostMapping public ClipMaterializationService.Result materialize(@PathVariable long clipId) throws Exception{return service.materialize(clipId);}
    @PostMapping("/state") public com.videotagger.entity.Clip state(@PathVariable long clipId,@RequestParam String value){return service.state(clipId,value);}

    @GetMapping("/channels")
    public MaterializationService.Evaluation channels(@PathVariable long clipId) {
        return channelService.evaluate(clipId, false);
    }

    @PostMapping("/channels/refresh")
    public MaterializationService.Evaluation refreshChannels(@PathVariable long clipId) {
        return channelService.evaluate(clipId, true);
    }

    @PostMapping("/materialize-from-file")
    public ClipMaterializationService.Result materializeFromFile(@PathVariable long clipId,
                                                                 @RequestParam String path) throws Exception {
        return service.materializeFromFile(clipId, path);
    }

    /**
     * 本地回顾播放源（M3）：按渠道求值（含既有 PRESENT 线索）定位本地文件并流式返回。
     * 仅服务求值得出的文件路径（不接收任意路径）；仅放行视频扩展名；无可用本地源返回 409。
     */
    @GetMapping("/play-source")
    public ResponseEntity<org.springframework.core.io.Resource> playSource(@PathVariable long clipId) {
        MaterializationService.Evaluation ev = channelService.evaluate(clipId, false);
        String path = ev.filePath();
        if (path == null || !"PRESENT".equals(ev.state())) {
            return ResponseEntity.status(409).build();
        }
        File file = new File(path);
        if (!file.isFile()) return ResponseEntity.status(409).build();
        String lower = path.toLowerCase();
        MediaType mt = null;
        if (lower.endsWith(".mp4")) mt = MediaType.parseMediaType("video/mp4");
        else if (lower.endsWith(".webm")) mt = MediaType.parseMediaType("video/webm");
        else if (lower.endsWith(".mkv")) mt = MediaType.parseMediaType("video/x-matroska");
        else if (lower.endsWith(".mov")) mt = MediaType.parseMediaType("video/quicktime");
        else if (lower.endsWith(".ts")) mt = MediaType.parseMediaType("video/mp2t");
        else return ResponseEntity.status(409).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, mt.toString())
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .body(new FileSystemResource(file));
    }
}
