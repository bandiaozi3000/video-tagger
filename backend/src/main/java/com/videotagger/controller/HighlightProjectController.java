package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.entity.HighlightProjectItem;
import com.videotagger.service.HighlightExportService;
import com.videotagger.service.HighlightExportService.HighlightExportView;
import com.videotagger.service.HighlightProjectService;
import com.videotagger.service.HighlightProjectService.AddItemRequest;
import com.videotagger.service.HighlightProjectService.HighlightProjectView;
import com.videotagger.service.HighlightProjectService.ItemUpdateRequest;
import com.videotagger.service.HighlightProjectService.ProjectUpdateRequest;
import com.videotagger.service.HighlightSourceService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/highlight-projects")
public class HighlightProjectController {
    private final HighlightProjectService projectService;
    private final HighlightSourceService sourceService;
    private final HighlightExportService exportService;

    public HighlightProjectController(HighlightProjectService projectService, HighlightSourceService sourceService,
                                      HighlightExportService exportService) {
        this.projectService = projectService;
        this.sourceService = sourceService;
        this.exportService = exportService;
    }

    @GetMapping("/{id}")
    public HighlightProjectView get(@PathVariable long id) {
        return projectService.get(id);
    }

    @PutMapping("/{id}")
    public HighlightProjectView update(@PathVariable long id, @RequestBody(required = false) ProjectUpdateRequest request) {
        return projectService.updateProject(id, request);
    }

    @GetMapping("/{id}/clips")
    public List<Clip> clips(@PathVariable long id) {
        return projectService.clips(id);
    }

    @PostMapping("/{id}/items")
    public HighlightProjectView addItem(@PathVariable long id, @RequestBody AddItemRequest request) {
        return projectService.addItem(id, request);
    }

    @PutMapping("/{id}/items/{itemId}")
    public HighlightProjectView updateItem(@PathVariable long id, @PathVariable long itemId,
                                           @RequestBody(required = false) ItemUpdateRequest request) {
        return projectService.updateItem(id, itemId, request);
    }

    @DeleteMapping("/{id}/items/{itemId}")
    public ResponseEntity<Void> removeItem(@PathVariable long id, @PathVariable long itemId) {
        projectService.removeItem(id, itemId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/items/reorder")
    public HighlightProjectView reorder(@PathVariable long id, @RequestBody Map<String, List<Long>> body) {
        return projectService.reorder(id, body == null ? null : body.get("itemIds"));
    }

    @GetMapping("/{id}/items/{itemId}/preview")
    public ResponseEntity<Resource> preview(@PathVariable long id, @PathVariable long itemId) throws java.io.IOException {
        HighlightProjectItem item = projectService.requireItem(id, itemId);
        if (!"READY".equals(item.getSourceState()) || item.getSourcePath() == null) {
            throw new IllegalStateException("素材尚未就绪");
        }
        Path path = sourceService.previewPath(id, itemId);
        Resource resource = new FileSystemResource(path);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"highlight-item-" + itemId + ".mp4\"")
                .contentType(MediaType.parseMediaType(Files.probeContentType(path) == null ? "video/mp4" : Files.probeContentType(path)))
                .contentLength(Files.size(path))
                .body(resource);
    }

    @PostMapping("/{id}/items/{itemId}/stream-probe")
    public HighlightSourceService.StreamProbe streamProbe(@PathVariable long id, @PathVariable long itemId,
                                                          @RequestBody Map<String, String> body) {
        return sourceService.probePublicStream(id, itemId, body == null ? null : body.get("url"));
    }

    @PostMapping("/{id}/items/{itemId}/prepare")
    public SourceStatus prepare(@PathVariable long id, @PathVariable long itemId) {
        return sourceStatus(sourceService.prepare(id, itemId));
    }

    @PostMapping("/{id}/items/{itemId}/direct-url")
    public SourceStatus directUrl(@PathVariable long id, @PathVariable long itemId,
                                  @RequestBody Map<String, String> body) {
        return sourceStatus(sourceService.prepareDirectUrl(id, itemId, body == null ? null : body.get("url")));
    }

    @PostMapping(value = "/{id}/items/{itemId}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SourceStatus upload(@PathVariable long id, @PathVariable long itemId,
                               @RequestPart("file") MultipartFile file) {
        return sourceStatus(sourceService.upload(id, itemId, file));
    }

    @PostMapping(value = "/{id}/bgm", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadBgm(@PathVariable long id, @RequestPart("file") MultipartFile file) {
        return Map.of("path", sourceService.uploadBgm(id, file));
    }

    @PostMapping("/{id}/exports")
    public HighlightExportView export(@PathVariable long id, @RequestBody(required = false) HighlightExportService.ExportRequest request) {
        return exportService.create(id, request);
    }

    @PostMapping("/{id}/preview")
    public HighlightExportView preview(@PathVariable long id, @RequestBody(required = false) HighlightExportService.ExportRequest request) {
        HighlightExportService.ExportRequest source = request == null
                ? new HighlightExportService.ExportRequest("FULL", "720P", null, null, true, true)
                : new HighlightExportService.ExportRequest(request.mode(), "720P", request.bgmPath(), request.bgmVolume(), true, true);
        return exportService.create(id, source);
    }

    @GetMapping("/{id}/exports")
    public List<HighlightExportView> exports(@PathVariable long id) {
        return projectService.exports(id);
    }

    @GetMapping("/exports/{exportId}")
    public HighlightExportView export(@PathVariable long exportId) {
        return exportService.get(exportId);
    }

    @GetMapping("/exports/{exportId}/file")
    public ResponseEntity<Resource> exportFile(@PathVariable long exportId) throws java.io.IOException {
        Path path = exportService.outputPath(exportId);
        Resource resource = new FileSystemResource(path);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"highlight-export-" + exportId + ".mp4\"")
                .contentType(MediaType.parseMediaType(Files.probeContentType(path) == null ? "video/mp4" : Files.probeContentType(path)))
                .contentLength(Files.size(path))
                .body(resource);
    }

    @PostMapping("/exports/{exportId}/cancel")
    public HighlightExportView cancel(@PathVariable long exportId) {
        return exportService.cancel(exportId);
    }

    @DeleteMapping("/exports/{exportId}")
    public ResponseEntity<Void> deleteExport(@PathVariable long exportId) {
        exportService.delete(exportId);
        return ResponseEntity.noContent().build();
    }

    private static SourceStatus sourceStatus(HighlightProjectItem item) {
        return new SourceStatus(item.getId(), item.getSourceState(), item.getSourceMessage());
    }

    public record SourceStatus(long itemId, String sourceState, String sourceMessage) { }
}
