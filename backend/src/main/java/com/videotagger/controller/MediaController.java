package com.videotagger.controller;

import com.videotagger.entity.Media;
import com.videotagger.service.AniListSyncService;
import com.videotagger.service.MediaDetail;
import com.videotagger.service.MediaRequest;
import com.videotagger.service.MediaMatchCandidate;
import com.videotagger.service.MediaService;
import com.videotagger.service.TagLinkService;
import com.videotagger.service.MediaExportRow;
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
import java.util.Objects;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final MediaService mediaService;
    private final EpisodeService episodeService;
    private final CoverService coverService;
    private final AniListSyncService aniListSyncService;
    private final TagLinkService tagLinkService;
    private final com.videotagger.service.HighlightProjectService highlightProjectService;
    private final com.videotagger.service.RelatedMediaService relatedMediaService;

    // 外部同步（AniList）默认禁用（D9）；videotagger.sync.enabled=true 时启用，代码保留
    @org.springframework.beans.factory.annotation.Value("${videotagger.sync.enabled:false}")
    private boolean syncEnabled;

    public MediaController(MediaService mediaService, EpisodeService episodeService, CoverService coverService,
                           AniListSyncService aniListSyncService) {
        this(mediaService, episodeService, coverService, aniListSyncService, null, null, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public MediaController(MediaService mediaService, EpisodeService episodeService, CoverService coverService,
                           AniListSyncService aniListSyncService,
                           com.videotagger.service.HighlightProjectService highlightProjectService,
                                  com.videotagger.service.RelatedMediaService relatedMediaService,
                                  TagLinkService tagLinkService) {
        this.mediaService = mediaService;
        this.episodeService = episodeService;
        this.coverService = coverService;
        this.aniListSyncService = aniListSyncService;
        this.highlightProjectService = highlightProjectService;
        this.relatedMediaService = relatedMediaService;
        this.tagLinkService = tagLinkService;
    }

    /**
     * 清单导出（编辑器「📋 导出清单」）：候选走当前筛选、已选走 ids，返回带**集数与标签**的行。
     *
     * 与 `GET /api/media` 的区别：不分页、多两列（episodeCount/tags）、列少很多（封面/状态/评分不参与导出）。
     */
    @GetMapping("/list-export")
    public List<MediaExportRow> listExport(@RequestParam(required = false) List<String> status,
                                          @RequestParam(required = false) String format,
                                          @RequestParam(required = false) Long subcategoryId,
                                          @RequestParam(required = false) Integer confirmed,
                                          @RequestParam(required = false) List<Long> collectionId,
                                          @RequestParam(required = false) List<Integer> year,
                                          @RequestParam(required = false) String source,
                                          @RequestParam(required = false) List<Long> tagIds,
                                   @RequestParam(required = false) String tagMode,
                                   @RequestParam(required = false) String genreMode,
                                   @RequestParam(required = false) String collectionMode,
                                          @RequestParam(required = false) String q,
                                          @RequestParam(required = false) List<Long> ids,
                                          @RequestParam(required = false) List<String> genres,
                                          @RequestParam(required = false) List<String> season) {
        return mediaService.listExport(status, format, subcategoryId, confirmed, collectionId, year, source, tagIds, tagMode, genreMode, collectionMode, q, ids, genres, season);
    }

    @GetMapping
    public List<MediaSummary> list(@RequestParam(defaultValue = "50") int limit,
                                   @RequestParam(defaultValue = "0") int offset,
                                   @RequestParam(required = false) List<String> status,
                                   @RequestParam(required = false) String format,
                                   @RequestParam(required = false) Long subcategoryId,
                                   @RequestParam(required = false) Integer confirmed,
                                   @RequestParam(required = false) List<Long> collectionId,
                                   @RequestParam(required = false) String sort,
                                   @RequestParam(required = false) String order,
                                   @RequestParam(required = false) List<Integer> year,
                                   @RequestParam(required = false) String source,
                                   @RequestParam(required = false) List<Long> tagIds,
                                   @RequestParam(required = false) String tagMode,
                                   @RequestParam(required = false) String genreMode,
                                   @RequestParam(required = false) String collectionMode,
                                   @RequestParam(required = false) String q,
                                   @RequestParam(required = false) List<Long> ids,
                                   @RequestParam(required = false) List<String> genres,
                                   @RequestParam(required = false) List<String> season) {
        return mediaService.list(limit, offset, status, format, subcategoryId, confirmed, collectionId, sort, order, year, source, tagIds, tagMode, genreMode, collectionMode, q, ids, genres, season);
    }

    /**
     * 题材选项字典：白名单 ∩ 库内实际出现的题材，带各自媒体数（降序）。
     *
     * <p>选项列表数据驱动 —— 白名单只回答“哪些词算题材”，计数与存在性都来自库。
     */
    @GetMapping("/genres")
    public List<com.videotagger.mapper.MediaMapper.GenreCount> genres() {
        return mediaService.genreCounts();
    }

    /** 媒体标签选项字典：只列真正挂在媒体上的标签，带各自媒体数（降序）。 */
    @GetMapping("/tags")
    public List<com.videotagger.mapper.MediaMapper.TagCount> tags() {
        return mediaService.tagCounts();
    }

    /**
     * 同系列条目（跨媒体借片段的来源）：本地存在且有片段的视频类关联条目。
     *
     * 白名单见 ；0 片段的条目不返回（借不到）。
     */
    @GetMapping("/{id}/related")
    public List<com.videotagger.service.RelatedMedia> related(@PathVariable Long id) {
        return relatedMediaService.videoRelated(id);
    }

    @GetMapping("/recent")
    public List<MediaSummary> recent(@RequestParam(defaultValue = "20") int limit,
                                     @RequestParam(defaultValue = "0") int offset,
                                     @RequestParam(required = false) List<String> status,
                                     @RequestParam(required = false) String format,
                                     @RequestParam(required = false) Long subcategoryId,
                                     @RequestParam(required = false) Integer confirmed,
                                     @RequestParam(required = false) List<Long> collectionId,
                                     @RequestParam(required = false) List<Integer> year,
                                     @RequestParam(required = false) String source,
                                     @RequestParam(required = false) String q,
                                     @RequestParam(required = false) List<Long> tagIds,
                                   @RequestParam(required = false) String tagMode,
                                   @RequestParam(required = false) String genreMode,
                                   @RequestParam(required = false) String collectionMode,
                                     @RequestParam(required = false) List<String> genres,
                                     @RequestParam(required = false) List<String> season) {
        return mediaService.recent(limit, offset, status, format, subcategoryId, confirmed, collectionId, year, source, q, tagIds, tagMode, genreMode, collectionMode, genres, season);
    }

    /** 带筛选的媒体总数（分页页码导航用）；latest=true 时按「最近观看」口径只统计打过标记的媒体。 */
    @GetMapping("/count")
    public long count(@RequestParam(required = false) List<String> status,
                      @RequestParam(required = false) String format,
                      @RequestParam(required = false) Long subcategoryId,
                      @RequestParam(required = false) Integer confirmed,
                      @RequestParam(required = false) List<Long> collectionId,
                      @RequestParam(required = false) List<Integer> year,
                      @RequestParam(required = false) String source,
                      @RequestParam(required = false) List<Long> tagIds,
                                   @RequestParam(required = false) String tagMode,
                                   @RequestParam(required = false) String genreMode,
                                   @RequestParam(required = false) String collectionMode,
                      @RequestParam(defaultValue = "false") boolean latest,
                      @RequestParam(required = false) String q,
                      @RequestParam(required = false) List<String> genres,
                      @RequestParam(required = false) List<String> season) {
        return mediaService.count(status, format, subcategoryId, confirmed, collectionId, year, source, tagIds, tagMode, genreMode, collectionMode, latest, q, genres, season);
    }

    /** 库中已有的全部首播年份（年份筛选下拉选项）。 */
    @GetMapping("/years")
    public List<Integer> years() {
        return mediaService.years();
    }

    /** 补下缺失封面：遍历留存了 AniList 封面 URL 但尚无封面的媒体，重新触发异步下载。 */
    /** 打标签候选匹配：归一化 + 相似度（识别中英混写/词序差异），扩展候选区提示用。 */
    @GetMapping("/match")
    public List<MediaMatchCandidate> match(@RequestParam String title,
                                           @RequestParam(defaultValue = "5") int limit) {
        return mediaService.matchCandidates(title, limit);
    }

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
        mediaService.trashBatch(ids); // 移入回收站（软删除，可撤回）
        return ResponseEntity.noContent().build();
    }

    /** 旧 AniList 同步代码保留在 Service 中；当前不再开放 HTTP 入口。 */
    public AniListSyncService.SyncResult syncAnilist(@RequestBody SyncAnilistRequest req) {
        if (!syncEnabled) {
            throw new IllegalStateException("外部同步功能已禁用（桌面版暂不支持同步，请手动维护）");
        }
        List<Integer> years = req.years() == null ? List.of() : req.years();
        if (years.isEmpty()) {
            throw new IllegalArgumentException("请至少勾选一个年份");
        }
        return aniListSyncService.sync(years, req.formats());
    }

    /** 番剧同步请求：years 年份多选；formats 可选 AniList MediaFormat 列表（TV/MOVIE/OVA/ONA/SPECIAL/...，空=不过滤）。 */
    public record SyncAnilistRequest(List<Integer> years, List<String> formats) {
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        mediaService.trash(id); // 移入回收站（软删除，可撤回）
        return ResponseEntity.noContent().build();
    }

    /** 回收站列表（已删媒体，deleted_at 非空，按删除时间倒序，q 标题过滤）。 */
    @GetMapping("/trash")
    public List<com.videotagger.entity.Media> trash(@RequestParam(required = false) String q,
                                                    @RequestParam(defaultValue = "50") int limit,
                                                    @RequestParam(defaultValue = "0") int offset) {
        return mediaService.listTrash(q, limit, offset);
    }

    /** 回收站数量（可带标题过滤）。 */
    @GetMapping("/trash/count")
    public long trashCount(@RequestParam(required = false) String q) {
        return mediaService.countTrash(q);
    }

    /** 撤回：恢复回收站媒体（deleted_at 置空，集/片段/标签原样回来）。 */
    @PostMapping("/{id}/restore")
    public ResponseEntity<Void> restore(@PathVariable Long id) {
        mediaService.restore(id);
        return ResponseEntity.noContent().build();
    }

    /** 彻底删除（单/批量，级联清集/片段/标签/封面/向量）。 */
    @DeleteMapping("/purge")
    public ResponseEntity<Void> purge(@RequestParam List<Long> ids) {
        mediaService.purgeBatch(ids);
        return ResponseEntity.noContent().build();
    }

    /** 清空回收站：全部彻底删除。 */
    @DeleteMapping("/trash")
    public ResponseEntity<Void> clearTrash() {
        List<com.videotagger.entity.Media> all = mediaService.listTrash(null, 500, 0);
        if (!all.isEmpty()) {
            mediaService.purgeBatch(all.stream().map(com.videotagger.entity.Media::getId).toList());
        }
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

    @GetMapping("/{id}/highlight-project")
    public com.videotagger.service.HighlightProjectService.HighlightProjectView getHighlightProject(@PathVariable long id) {
        if (highlightProjectService == null) throw new IllegalStateException("高光制作服务不可用");
        return highlightProjectService.getByMediaId(id);
    }

    @PostMapping("/{id}/highlight-project")
    public com.videotagger.service.HighlightProjectService.HighlightProjectView highlightProject(@PathVariable long id) {
        if (highlightProjectService == null) throw new IllegalStateException("高光制作服务不可用");
        return highlightProjectService.getOrCreate(id);
    }

    /** 媒体打标（v0.31 受控：body = `{tagIds:[…]}`，只接受已存在词条 id）。 */
    @PostMapping("/{id}/tags")
    public void addTags(@PathVariable Long id, @RequestBody Map<String, List<Long>> body) {
        mediaService.addTags(id, body.get("tagIds"));
    }

    /**
     * 批量打标 / 移除（媒体页勾选模式）：body = `{mediaIds:[…], tagIds:[…], action:"add"|"remove"}`。
     * 一次事务 + 幂等；只处理显式传来的 id（不做「按筛选条件全库应用」）。
     * `changed` = **真实变更的关联数**（**0 表示什么都没变**，前端据此说真话）。
     */
    @PostMapping("/tags/batch")
    public Map<String, Object> batchTags(@RequestBody Map<String, Object> body) {
        List<Long> mediaIds = longList(body.get("mediaIds"));
        List<Long> tagIds = longList(body.get("tagIds"));
        Object action = body.get("action");
        int changed = tagLinkService.batchMediaTags(mediaIds, tagIds,
                action == null ? "add" : String.valueOf(action));
        return Map.of("changed", changed, "targets", mediaIds.size());
    }

    /** JSON 数字数组 → List<Long>。 */
    private static List<Long> longList(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        return list.stream().filter(Objects::nonNull)
                .map(v -> v instanceof Number n ? n.longValue() : Long.valueOf(String.valueOf(v)))
                .toList();
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
