package com.videotagger.controller;

import com.videotagger.metadata.MetadataCandidate;
import com.videotagger.metadata.MetadataSyncDraftRequest;
import com.videotagger.metadata.MetadataSyncDraftView;
import com.videotagger.metadata.MetadataSyncRequest;
import com.videotagger.metadata.MetadataSyncResult;
import com.videotagger.metadata.MetadataSyncService;
import com.videotagger.metadata.MetadataSyncTaskCreateRequest;
import com.videotagger.metadata.MetadataSyncTaskDetail;
import com.videotagger.metadata.MetadataSyncTaskItemRetryRequest;
import com.videotagger.metadata.MetadataSyncWorkspaceService;
import com.videotagger.entity.MetadataSyncTask;
import com.videotagger.metadata.ProviderCapabilities;
import com.videotagger.service.ExternalMetadataDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/metadata-sync")
public class MetadataSyncController {
    private final MetadataSyncService service;
    private final MetadataSyncWorkspaceService workspaceService;

    public MetadataSyncController(MetadataSyncService service, MetadataSyncWorkspaceService workspaceService) {
        this.service = service;
        this.workspaceService = workspaceService;
    }

    @GetMapping("/providers")
    public List<ProviderCapabilities> providers() {
        return List.of(service.capabilities());
    }

    @PostMapping("/preview")
    public List<MetadataCandidate> preview(@RequestBody MetadataSyncRequest request) {
        return service.preview(request);
    }

    @PostMapping("/sync")
    public ResponseEntity<MetadataSyncResult> sync(@RequestBody MetadataSyncRequest request) {
        return ResponseEntity.ok(service.sync(request));
    }

    @GetMapping("/draft")
    public ResponseEntity<MetadataSyncDraftView> draft() {
        MetadataSyncDraftView draft = workspaceService.getDraft();
        return draft == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(draft);
    }

    @PutMapping("/draft")
    public MetadataSyncDraftView saveDraft(@RequestBody MetadataSyncDraftRequest request) {
        return workspaceService.saveDraft(request);
    }

    @DeleteMapping("/draft")
    public ResponseEntity<Void> deleteDraft() {
        workspaceService.deleteDraft();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/tasks")
    public ResponseEntity<MetadataSyncTaskDetail> createTask(@RequestBody MetadataSyncTaskCreateRequest request) {
        return ResponseEntity.accepted().body(workspaceService.createTask(request));
    }

    @GetMapping("/tasks")
    public List<MetadataSyncTask> tasks() {
        return workspaceService.listTasks();
    }

    @GetMapping("/tasks/{taskId}")
    public MetadataSyncTaskDetail task(@PathVariable String taskId) {
        return workspaceService.getTask(taskId);
    }

    @DeleteMapping("/tasks/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable String taskId) {
        workspaceService.deleteTask(taskId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/tasks/{taskId}/items/{itemId}/retry")
    public MetadataSyncTaskDetail retryTaskItem(@PathVariable String taskId, @PathVariable long itemId,
                                                @RequestBody MetadataSyncTaskItemRetryRequest request) {
        return workspaceService.retryItem(taskId, itemId, request);
    }

    @GetMapping("/media/{mediaId}/metadata")
    public ExternalMetadataDetail metadata(@PathVariable long mediaId) {
        return service.metadata(mediaId);
    }

    @PostMapping("/media/{mediaId}")
    public ResponseEntity<MetadataSyncResult> refreshMedia(@PathVariable long mediaId) {
        return ResponseEntity.ok(service.refreshMedia(mediaId));
    }
}
