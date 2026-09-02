package com.videotagger.controller;

import com.videotagger.metadata.MediaMetadataLinkRequest;
import com.videotagger.metadata.MediaMetadataReplacePreview;
import com.videotagger.metadata.MediaMetadataSearchRequest;
import com.videotagger.metadata.MetadataCandidate;
import com.videotagger.metadata.MetadataSyncResult;
import com.videotagger.metadata.MetadataSyncService;
import com.videotagger.service.ExternalMetadataDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/media")
public class MediaMetadataController {
    private final MetadataSyncService service;

    public MediaMetadataController(MetadataSyncService service) {
        this.service = service;
    }

    @GetMapping("/{mediaId}/metadata")
    public ExternalMetadataDetail metadata(@PathVariable long mediaId) {
        return service.metadata(mediaId);
    }

    @PostMapping("/{mediaId}/metadata-refresh")
    public ResponseEntity<MetadataSyncResult> refresh(@PathVariable long mediaId) {
        return ResponseEntity.ok(service.refreshMedia(mediaId));
    }

    @PostMapping("/{mediaId}/metadata-search")
    public List<MetadataCandidate> search(@PathVariable long mediaId,
                                          @RequestBody MediaMetadataSearchRequest request) {
        return service.searchForMedia(mediaId, request == null ? null : request.keyword());
    }

    @PostMapping("/{mediaId}/metadata-link")
    public ResponseEntity<MetadataSyncResult> link(@PathVariable long mediaId,
                                                    @RequestBody MediaMetadataLinkRequest request) {
        return ResponseEntity.ok(service.linkMedia(mediaId, request));
    }

    @PostMapping("/{mediaId}/metadata-link-preview")
    public MediaMetadataReplacePreview replacePreview(@PathVariable long mediaId,
                                                       @RequestBody MediaMetadataLinkRequest request) {
        return service.replacePreview(mediaId, request);
    }

    @PostMapping("/{mediaId}/metadata-entries")
    public ResponseEntity<MetadataSyncResult> addEntry(@PathVariable long mediaId,
                                                        @RequestBody MediaMetadataLinkRequest request) {
        return ResponseEntity.ok(service.addMediaEntry(mediaId, request));
    }
}
