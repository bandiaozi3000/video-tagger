package com.videotagger.controller;

import com.videotagger.metadata.MetadataCandidate;
import com.videotagger.metadata.MetadataSyncRequest;
import com.videotagger.metadata.MetadataSyncResult;
import com.videotagger.metadata.MetadataSyncCommitService;
import com.videotagger.metadata.MetadataSyncService;
import com.videotagger.metadata.SyncCommitRequest;
import com.videotagger.metadata.SyncCommitResult;
import com.videotagger.metadata.SyncPlanRequest;
import com.videotagger.metadata.SyncPlanResult;
import com.videotagger.metadata.SyncRangeFetchRequest;
import com.videotagger.metadata.SyncRangeFetchResult;
import com.videotagger.metadata.ProviderCapabilities;
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
@RequestMapping("/api/metadata-sync")
public class MetadataSyncController {
    private final MetadataSyncService service;
    private final MetadataSyncCommitService commitService;

    public MetadataSyncController(MetadataSyncService service, MetadataSyncCommitService commitService) {
        this.service = service;
        this.commitService = commitService;
    }

    @GetMapping("/providers")
    public List<ProviderCapabilities> providers() {
        return List.of(service.capabilities());
    }

    /**
     * 年/季/月多选 → 查询区间计划（2026-09-21 新流程第一步）。
     */
    @PostMapping("/discover/plan")
    public SyncPlanResult plan(@RequestBody SyncPlanRequest request) {
        return service.plan(request);
    }

    /**
     * 取某一段区间的候选（**只读**）。前端逐段调用以显示进度。
     */
    @PostMapping("/discover/fetch")
    public SyncRangeFetchResult fetchRange(@RequestBody SyncRangeFetchRequest request) {
        return service.discoverRange(request.from(), request.to());
    }

    /**
     * 提交同步（勾选后直接同步）。每项独立事务，失败不影响其它项；返回「新增/更新/跳过/失败」条数。
     */
    @PostMapping("/commit")
    public SyncCommitResult commit(@RequestBody SyncCommitRequest request) {
        return commitService.commit(request);
    }

    @PostMapping("/preview")
    public List<MetadataCandidate> preview(@RequestBody MetadataSyncRequest request) {
        return service.preview(request);
    }

    @PostMapping("/sync")
    public ResponseEntity<MetadataSyncResult> sync(@RequestBody MetadataSyncRequest request) {
        return ResponseEntity.ok(service.sync(request));
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
