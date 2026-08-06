package com.videotagger.controller;

import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.service.MediaFormatService;
import com.videotagger.service.MediaFormatView;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** 媒体格式/子分类字典维护（快功能）。删除保护由 service 负责。 */
@RestController
@RequestMapping("/api/media-formats")
public class MediaFormatController {

    private final MediaFormatService mediaFormatService;

    public MediaFormatController(MediaFormatService mediaFormatService) {
        this.mediaFormatService = mediaFormatService;
    }

    @GetMapping
    public List<MediaFormatView> list() {
        return mediaFormatService.listFormats();
    }

    @PostMapping
    public MediaFormat create(@RequestBody Map<String, Object> body) {
        Object hasChildren = body.get("hasChildren");
        return mediaFormatService.createFormat(
                (String) body.get("code"),
                (String) body.get("name"),
                hasChildren == null ? 0 : Integer.valueOf(hasChildren.toString()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        mediaFormatService.deleteFormat(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/subcategories")
    public MediaSubcategory addSubcategory(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Object parentId = body.get("parentId");
        return mediaFormatService.addSubcategory(id,
                parentId == null ? null : Long.valueOf(parentId.toString()),
                (String) body.get("name"));
    }

    @DeleteMapping("/subcategories/{subId}")
    public ResponseEntity<Void> deleteSubcategory(@PathVariable Long subId) {
        mediaFormatService.deleteSubcategory(subId);
        return ResponseEntity.noContent().build();
    }
}
