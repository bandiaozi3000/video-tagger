package com.videotagger.controller;

import com.videotagger.entity.Collection;
import com.videotagger.service.MediaSummary;
import com.videotagger.service.CollectionService;
import com.videotagger.service.CollectionSummary;
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

@RestController
@RequestMapping("/api/collections")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @GetMapping
    public List<CollectionSummary> list() {
        return collectionService.list();
    }

    @PostMapping
    public Collection create(@RequestBody Map<String, String> body) {
        return collectionService.create(body.get("name"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        collectionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/media")
    public List<MediaSummary> media(@PathVariable Long id) {
        return collectionService.media(id);
    }

    @PostMapping("/{id}/media")
    public ResponseEntity<Void> addMedia(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        collectionService.addMedia(id, body.get("mediaId"));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/media/{mediaId}")
    public ResponseEntity<Void> removeMedia(@PathVariable Long id, @PathVariable Long mediaId) {
        collectionService.removeMedia(id, mediaId);
        return ResponseEntity.noContent().build();
    }
}
