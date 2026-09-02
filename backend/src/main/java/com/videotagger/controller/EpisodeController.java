package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.service.EpisodeDetail;
import com.videotagger.service.EpisodeReviewService;
import com.videotagger.service.EpisodeService;
import com.videotagger.service.EpisodeUpdateRequest;
import org.springframework.core.io.FileSystemResource;
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

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Map;

/** 集级打标入口（Web UI 手动）+ 集封面（帧封面）+ 集详情页。 */
@RestController
@RequestMapping("/api/episodes")
public class EpisodeController {

    private final EpisodeService episodeService;
    private final EpisodeReviewService reviewService;

    public EpisodeController(EpisodeService episodeService, EpisodeReviewService reviewService) {
        this.episodeService = episodeService;
        this.reviewService = reviewService;
    }

    /** 集详情页：解析封面 + 集级标签 + 片段数。 */
    @GetMapping("/{id}")
    public EpisodeDetail get(@PathVariable Long id) {
        return episodeService.detail(id);
    }

    /** v0.24 集级本地回顾：返回该集可播放的本地源文件（整集，不裁剪）；无可用源返回 409。 */
    @GetMapping("/{id}/review-source")
    public ResponseEntity<org.springframework.core.io.Resource> reviewSource(@PathVariable Long id) {
        EpisodeReviewService.ReviewSource src = reviewService.resolve(id);
        if (!"PRESENT".equals(src.state()) || src.filePath() == null) {
            return ResponseEntity.status(409).body(null);
        }
        File file = new File(src.filePath());
        if (!file.isFile()) return ResponseEntity.status(409).body(null);
        String lower = src.filePath().toLowerCase();
        MediaType mt = null;
        if (lower.endsWith(".mp4")) mt = MediaType.parseMediaType("video/mp4");
        else if (lower.endsWith(".webm")) mt = MediaType.parseMediaType("video/webm");
        else if (lower.endsWith(".mkv")) mt = MediaType.parseMediaType("video/x-matroska");
        else if (lower.endsWith(".mov")) mt = MediaType.parseMediaType("video/quicktime");
        else if (lower.endsWith(".ts")) mt = MediaType.parseMediaType("video/mp2t");
        else return ResponseEntity.status(409).body(null);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, mt.toString())
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .body(new FileSystemResource(file));
    }

    @GetMapping("/{id}/clips")
    public List<Clip> clips(@PathVariable Long id) {
        return episodeService.clips(id);
    }

    /** 删除集：级联清理其下片段、标签、封面与向量。 */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        episodeService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** 更新集信息（备注/季/集号；字段传 null 不改）。 */
    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable Long id, @RequestBody EpisodeUpdateRequest req) {
        episodeService.update(id, req.note(), req.season(), req.episodeNo());
        return ResponseEntity.noContent().build();
    }

    /** 手动上传集封面（multipart，兜底）。 */
    @PostMapping(value = "/{id}/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> uploadCover(@PathVariable Long id, @RequestPart("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            episodeService.setCover(id, file.getBytes());
        } catch (IOException e) {
            throw new IllegalArgumentException("读取上传文件失败: " + e.getMessage(), e);
        }
        return ResponseEntity.noContent().build();
    }

    /** 从该集某片段截帧自选高能画面作为集封面。 */
    @PostMapping("/{id}/cover-from-clip/{clipId}")
    public ResponseEntity<Void> setCoverFromClip(@PathVariable Long id, @PathVariable Long clipId) {
        episodeService.setCoverFromClip(id, clipId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/tags")
    public void addTag(@PathVariable Long id, @RequestBody Map<String, String> body) {
        episodeService.addTag(id, body.get("tag"));
    }

    /** 扩展「看完自动弹」用：按播放 URL 定位集并打标签。 */
    @PostMapping("/by-url/tags")
    public void addTagByUrl(@RequestBody Map<String, String> body) {
        episodeService.addTagByUrl(body.get("url"), body.get("tag"));
    }

    @DeleteMapping("/{id}/tags/{tagId}")
    public void removeTag(@PathVariable Long id, @PathVariable Long tagId) {
        episodeService.removeTag(id, tagId);
    }
}
