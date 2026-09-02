package com.videotagger.controller;

import com.videotagger.entity.VideoSourceTask;
import com.videotagger.entity.VideoSourceTaskItem;
import com.videotagger.service.VideoSourceTaskExecutor;
import com.videotagger.service.VideoSourceTaskService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/video-source-tasks")
public class VideoSourceTaskController {
    private final VideoSourceTaskService service; private final VideoSourceTaskExecutor executor;
    public VideoSourceTaskController(VideoSourceTaskService service, VideoSourceTaskExecutor executor){this.service=service;this.executor=executor;}
    @GetMapping public List<VideoSourceTask> recoverable(){return service.recoverable();}
    @GetMapping("/{taskId}") public VideoSourceTask get(@PathVariable String taskId){return service.get(taskId);}
    @GetMapping("/{taskId}/items") public List<VideoSourceTaskItem> items(@PathVariable String taskId){return service.items(service.get(taskId).getId());}
    @PostMapping public VideoSourceTask create(@RequestParam String type,@RequestParam(required=false) String provider,@RequestParam(required=false) Integer total){return service.create(type,provider,total);}
    @PostMapping("/downloads") public VideoSourceTask download(@RequestBody VideoSourceTaskExecutor.DownloadPlan plan){return executor.queueDownload(plan);}
    @PostMapping("/{taskId}/state") public VideoSourceTask transition(@PathVariable String taskId,@RequestParam String value,@RequestParam(required=false) String message){return service.transition(taskId,value,message);}
    @PostMapping("/{taskId}/pause") public VideoSourceTask pause(@PathVariable String taskId){return service.pause(taskId);}
    @PostMapping("/{taskId}/resume") public VideoSourceTask resume(@PathVariable String taskId){return executor.resume(taskId);}
    @PostMapping("/{taskId}/retry") public VideoSourceTask retry(@PathVariable String taskId){return executor.resume(taskId);}
    @PostMapping("/{taskId}/cancel") public VideoSourceTask cancel(@PathVariable String taskId){return service.cancel(taskId);}
}