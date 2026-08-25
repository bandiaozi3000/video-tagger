package com.videotagger.controller;

import com.videotagger.service.ClipExportArtifact;
import com.videotagger.service.ClipExportService;
import com.videotagger.service.ClipExportTask;
import com.videotagger.service.SequenceFrameExportRequest;
import com.videotagger.service.SingleFrameExportRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/clips")
public class ClipExportController {
    private final ClipExportService exportService;

    public ClipExportController(ClipExportService exportService) {
        this.exportService = exportService;
    }

    @PostMapping("/{id}/export-video")
    public ClipExportTask exportVideo(@PathVariable long id) {
        return exportService.createVideo(id);
    }

    @PostMapping("/{id}/export-images")
    public ClipExportTask exportImages(@PathVariable long id,
                                       @RequestBody(required = false) SingleFrameExportRequest request) {
        return exportService.createSingleFrame(id, request == null ? new SingleFrameExportRequest("middle", null) : request);
    }

    @PostMapping("/{id}/export-sequence")
    public ClipExportTask exportSequence(@PathVariable long id,
                                         @RequestBody(required = false) SequenceFrameExportRequest request) {
        return exportService.createSequence(id, request == null ? new SequenceFrameExportRequest(1) : request);
    }

    @PostMapping(value = "/{id}/exports/video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ClipExportTask uploadBrowserVideo(@PathVariable long id, @RequestPart("file") MultipartFile file,
                                             @RequestParam(value = "manualStop", required = false) String manualStop) {
        return exportService.uploadBrowserVideo(id, file, Boolean.parseBoolean(manualStop));
    }

    @GetMapping("/export-tasks/{taskId}")
    public ClipExportTask task(@PathVariable long taskId) {
        return exportService.get(taskId);
    }

    @PostMapping("/export-tasks/{taskId}/cancel")
    public ClipExportTask cancel(@PathVariable long taskId) {
        return exportService.cancel(taskId);
    }

    @GetMapping("/{id}/exports")
    public List<ClipExportArtifact> artifacts(@PathVariable long id) {
        return exportService.artifacts(id);
    }

    @DeleteMapping("/{id}/exports/{artifact}")
    public ResponseEntity<Void> deleteArtifact(@PathVariable long id, @PathVariable String artifact) {
        exportService.deleteArtifact(id, artifact);
        return ResponseEntity.noContent().build();
    }
}
