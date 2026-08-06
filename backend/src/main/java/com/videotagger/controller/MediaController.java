package com.videotagger.controller;

import com.videotagger.entity.Media;
import com.videotagger.service.MediaDetail;
import com.videotagger.service.MediaRequest;
import com.videotagger.service.MediaService;
import com.videotagger.service.MediaSummary;
import com.videotagger.service.CoverService;
import com.videotagger.service.EpisodeDetail;
import com.videotagger.service.EpisodeService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final MediaService mediaService;
    private final EpisodeService episodeService;
    private final CoverService coverService;

    public MediaController(MediaService mediaService, EpisodeService episodeService, CoverService coverService) {
        this.mediaService = mediaService;
        this.episodeService = episodeService;
        this.coverService = coverService;
    }

    @GetMapping
    public List<MediaSummary> list(@RequestParam(defaultValue = "50") int limit,
                                   @RequestParam(required = false) String status,
                                   @RequestParam(required = false) String format,
                                   @RequestParam(required = false) String subcategory,
                                   @RequestParam(required = false) Integer confirmed,
                                   @RequestParam(required = false) String sort) {
        return mediaService.list(limit, status, format, subcategory, confirmed, sort);
    }

    @GetMapping("/recent")
    public List<MediaSummary> recent(@RequestParam(defaultValue = "20") int limit,
                                     @RequestParam(required = false) String status,
                                     @RequestParam(required = false) Integer confirmed,
                                     @RequestParam(required = false) Long collectionId) {
        return mediaService.recent(limit, status, confirmed, collectionId);
    }

    @GetMapping("/{id}")
    public MediaDetail get(@PathVariable Long id) {
        return mediaService.get(id);
    }

    @PostMapping
    public Media create(@Valid @RequestBody MediaRequest req) {
        return mediaService.create(req);
    }

    @PutMapping("/{id}")
    public Media update(@PathVariable Long id, @Valid @RequestBody MediaRequest req) {
        return mediaService.update(id, req);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteBatch(@RequestParam List<Long> ids) {
        mediaService.deleteBatch(ids);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        mediaService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/rename")
    public Media rename(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return mediaService.rename(id, body.get("title"));
    }

    @PostMapping("/{id}/confirm")
    public Media confirm(@PathVariable Long id) {
        return mediaService.confirm(id);
    }

    @PostMapping("/{id}/merge")
    public ResponseEntity<Void> merge(@PathVariable Long id, @RequestParam Long into) {
        mediaService.merge(id, into);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/episodes")
    public List<EpisodeDetail> episodes(@PathVariable Long id) {
        return mediaService.episodes(id);
    }

    @PostMapping("/{id}/tags")
    public void addTag(@PathVariable Long id, @RequestBody Map<String, String> body) {
        mediaService.addTag(id, body.get("tag"));
    }

    @DeleteMapping("/{id}/tags/{tagId}")
    public void removeTag(@PathVariable Long id, @PathVariable Long tagId) {
        mediaService.removeTag(id, tagId);
    }

    /** 手动上传封面文件（multipart）。 */
    @PostMapping(value = "/{id}/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> uploadCover(@PathVariable Long id, @RequestPart("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            coverService.saveFromBytes(id, file.getBytes(), file.getOriginalFilename());
        } catch (IOException e) {
            throw new IllegalArgumentException("读取上传文件失败: " + e.getMessage(), e);
        }
        return ResponseEntity.noContent().build();
    }

    /** 手动粘贴图片 URL 作为封面。 */
    @PostMapping("/{id}/cover-url")
    public ResponseEntity<Void> setCoverUrl(@PathVariable Long id, @RequestBody Map<String, String> body) {
        coverService.saveFromUrl(id, body.get("url"));
        return ResponseEntity.noContent().build();
    }
}
