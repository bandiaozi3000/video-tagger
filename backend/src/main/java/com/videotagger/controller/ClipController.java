package com.videotagger.controller;

import com.videotagger.service.ClipService;
import com.videotagger.service.SaveClipRequest;
import com.videotagger.service.SaveClipResult;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/clips")
public class ClipController {

    private final ClipService clipService;

    public ClipController(ClipService clipService) {
        this.clipService = clipService;
    }

    @PostMapping
    public SaveClipResult save(@Valid @RequestBody SaveClipRequest req) {
        return clipService.save(req);
    }
}
