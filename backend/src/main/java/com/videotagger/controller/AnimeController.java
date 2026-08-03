package com.videotagger.controller;

import com.videotagger.entity.Anime;
import com.videotagger.service.AnimeDetail;
import com.videotagger.service.AnimeRequest;
import com.videotagger.service.AnimeService;
import com.videotagger.service.AnimeSummary;
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
@RequestMapping("/api/anime")
public class AnimeController {

    private final AnimeService animeService;
    private final EpisodeService episodeService;
    private final CoverService coverService;

    public AnimeController(AnimeService animeService, EpisodeService episodeService, CoverService coverService) {
        this.animeService = animeService;
        this.episodeService = episodeService;
        this.coverService = coverService;
    }

    @GetMapping
    public List<AnimeSummary> list(@RequestParam(defaultValue = "50") int limit) {
        return animeService.list(limit);
    }

    @GetMapping("/recent")
    public List<AnimeSummary> recent(@RequestParam(defaultValue = "20") int limit) {
        return animeService.recent(limit);
    }

    @GetMapping("/{id}")
    public AnimeDetail get(@PathVariable Long id) {
        return animeService.get(id);
    }

    @PostMapping
    public Anime create(@Valid @RequestBody AnimeRequest req) {
        return animeService.create(req);
    }

    @PutMapping("/{id}")
    public Anime update(@PathVariable Long id, @Valid @RequestBody AnimeRequest req) {
        return animeService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        animeService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/rename")
    public Anime rename(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return animeService.rename(id, body.get("title"));
    }

    @PostMapping("/{id}/merge")
    public ResponseEntity<Void> merge(@PathVariable Long id, @RequestParam Long into) {
        animeService.merge(id, into);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/episodes")
    public List<EpisodeDetail> episodes(@PathVariable Long id) {
        return animeService.episodes(id);
    }

    @PostMapping("/{id}/tags")
    public void addTag(@PathVariable Long id, @RequestBody Map<String, String> body) {
        animeService.addTag(id, body.get("tag"));
    }

    @DeleteMapping("/{id}/tags/{tagId}")
    public void removeTag(@PathVariable Long id, @PathVariable Long tagId) {
        animeService.removeTag(id, tagId);
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
