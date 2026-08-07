package com.videotagger.controller;

import com.videotagger.entity.Media;
import com.videotagger.service.AniListSyncService;
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
    private final AniListSyncService aniListSyncService;

    public MediaController(MediaService mediaService, EpisodeService episodeService, CoverService coverService,
                           AniListSyncService aniListSyncService) {
        this.mediaService = mediaService;
        this.episodeService = episodeService;
        this.coverService = coverService;
        this.aniListSyncService = aniListSyncService;
    }

    @GetMapping
    public List<MediaSummary> list(@RequestParam(defaultValue = "50") int limit,
                                   @RequestParam(defaultValue = "0") int offset,
                                   @RequestParam(required = false) String status,
                                   @RequestParam(required = false) String format,
                                   @RequestParam(required = false) Long subcategoryId,
                                   @RequestParam(required = false) Integer confirmed,
                                   @RequestParam(required = false) Long collectionId,
                                   @RequestParam(required = false) String sort,
                                   @RequestParam(required = false) Integer year,
                                   @RequestParam(required = false) Long tagId) {
        return mediaService.list(limit, offset, status, format, subcategoryId, confirmed, collectionId, sort, year, tagId);
    }

    @GetMapping("/recent")
    public List<MediaSummary> recent(@RequestParam(defaultValue = "20") int limit,
                                     @RequestParam(defaultValue = "0") int offset,
                                     @RequestParam(required = false) String status,
                                     @RequestParam(required = false) String format,
                                     @RequestParam(required = false) Long subcategoryId,
                                     @RequestParam(required = false) Integer confirmed,
                                     @RequestParam(required = false) Long collectionId,
                                     @RequestParam(required = false) Integer year) {
        return mediaService.recent(limit, offset, status, format, subcategoryId, confirmed, collectionId, year);
    }

    /** 带筛选的媒体总数（分页页码导航用）；latest=true 时按「最近观看」口径只统计打过标记的媒体。 */
    @GetMapping("/count")
    public long count(@RequestParam(required = false) String status,
                      @RequestParam(required = false) String format,
                      @RequestParam(required = false) Long subcategoryId,
                      @RequestParam(required = false) Integer confirmed,
                      @RequestParam(required = false) Long collectionId,
                      @RequestParam(required = false) Integer year,
                      @RequestParam(required = false) Long tagId,
                      @RequestParam(defaultValue = "false") boolean latest) {
        return mediaService.count(status, format, subcategoryId, confirmed, collectionId, year, tagId, latest);
    }

    /** 库中已有的全部首播年份（年份筛选下拉选项）。 */
    @GetMapping("/years")
    public List<Integer> years() {
        return mediaService.years();
    }

    /** 补下缺失封面：遍历留存了 AniList 封面 URL 但尚无封面的媒体，重新触发异步下载。 */
    @PostMapping("/retry-covers")
    public Map<String, Object> retryCovers() {
        int n = mediaService.retryCovers();
        return Map.of("triggered", n);
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

    /** 番剧同步（AniList）：按勾选年份批量建媒体（名称/年份/封面），命中库中已有则跳过。 */
    @PostMapping("/sync-anilist")
    public AniListSyncService.SyncResult syncAnilist(@RequestBody Map<String, List<Integer>> body) {
        List<Integer> years = body.getOrDefault("years", List.of());
        if (years.isEmpty()) {
            throw new IllegalArgumentException("请至少勾选一个年份");
        }
        return aniListSyncService.sync(years);
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
