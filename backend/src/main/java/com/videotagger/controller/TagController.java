package com.videotagger.controller;

import com.videotagger.service.ClipService;
import com.videotagger.service.TagSuggestion;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tags")
public class TagController {

    private final ClipService clipService;

    public TagController(ClipService clipService) {
        this.clipService = clipService;
    }

    @GetMapping
    public List<TagSuggestion> suggest(@RequestParam(value = "prefix", defaultValue = "") String prefix,
                                       @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return clipService.suggestTags(prefix, limit);
    }
}
