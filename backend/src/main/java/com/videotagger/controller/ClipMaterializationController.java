package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.service.ClipMaterializationService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/clips/{clipId}/material")
public class ClipMaterializationController {
    private final ClipMaterializationService service;
    public ClipMaterializationController(ClipMaterializationService service){this.service=service;}
    @GetMapping("/plan") public ClipMaterializationService.Plan plan(@PathVariable long clipId){return service.plan(clipId);}
    @PostMapping public ClipMaterializationService.Result materialize(@PathVariable long clipId) throws Exception{return service.materialize(clipId);}
    @PostMapping("/state") public Clip state(@PathVariable long clipId,@RequestParam String value){return service.state(clipId,value);}
}