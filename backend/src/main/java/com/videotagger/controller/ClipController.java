package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.service.ClipService;
import com.videotagger.service.SaveClipRequest;
import com.videotagger.service.SaveClipResult;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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

    @GetMapping("/near")
    public List<Clip> near(@RequestParam String url,
                           @RequestParam double timestampSec,
                           @RequestParam(defaultValue = "10") double window) {
        return clipService.findNearby(url, timestampSec, window);
    }

    @PutMapping("/{id}")
    public Clip update(@PathVariable Long id,
                       @RequestParam(defaultValue = "false") boolean appendTag,
                       @Valid @RequestBody SaveClipRequest req) {
        return clipService.update(id, req, appendTag);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        boolean deleted = clipService.delete(id);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
