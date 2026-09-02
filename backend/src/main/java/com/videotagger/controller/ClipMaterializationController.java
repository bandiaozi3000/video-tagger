package com.videotagger.controller;

import com.videotagger.service.ClipMaterializationService;
import com.videotagger.service.MaterializationService;
import org.springframework.web.bind.annotation.*;

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
}
