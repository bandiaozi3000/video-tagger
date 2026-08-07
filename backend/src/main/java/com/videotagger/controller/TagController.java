package com.videotagger.controller;

import com.videotagger.service.ClipService;
import com.videotagger.service.PageResult;
import com.videotagger.service.TagAdminService;
import com.videotagger.service.TagSyncService;
import com.videotagger.service.TagSuggestion;
import com.videotagger.service.TagUsage;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tags")
public class TagController {

    private final ClipService clipService;
    private final TagAdminService tagAdminService;
    private final TagSyncService tagSyncService;

    public TagController(ClipService clipService, TagAdminService tagAdminService,
                         TagSyncService tagSyncService) {
        this.clipService = clipService;
        this.tagAdminService = tagAdminService;
        this.tagSyncService = tagSyncService;
    }

    /** 打标输入补全：mediaId 时该媒体已用标签优先 + 全局高频兜底；否则全局。 */
    @GetMapping
    public List<TagSuggestion> suggest(@RequestParam(value = "prefix", defaultValue = "") String prefix,
                                       @RequestParam(value = "limit", defaultValue = "10") int limit,
                                       @RequestParam(value = "mediaId", required = false) Long mediaId) {
        return clipService.suggestTags(prefix, limit, mediaId);
    }

    /** 标签池管理：q 过滤；mediaId 时按媒体维度返回该媒体标签；page/size 分页。 */
    @GetMapping("/manage")
    public PageResult<TagUsage> manage(@RequestParam(value = "q", defaultValue = "") String q,
                                       @RequestParam(value = "mediaId", required = false) Long mediaId,
                                       @RequestParam(value = "page", defaultValue = "1") int page,
                                       @RequestParam(value = "size", defaultValue = "50") int size) {
        return tagAdminService.list(q, mediaId, page, size);
    }

    /** 某集内标签聚合（集详情页标签池）：refCount=集本身+其下片段引用总数。 */
    @GetMapping("/episode-stats")
    public List<TagUsage> episodeStats(@RequestParam("episodeId") Long episodeId) {
        return tagAdminService.episodeStats(episodeId);
    }

    /** 新增词条：仅建词库条目，同名已存在返回 400。 */
    @PostMapping
    public TagUsage add(@RequestBody Map<String, String> body) {
        return tagAdminService.add(body.get("name"));
    }

    /** 历史数据同步：把全部片段/集标签并集落库到集/媒体（幂等，可重复跑）。返回新增媒体标签条数。 */
    @PostMapping("/sync-all")
    public Map<String, Object> syncAll() {
        int synced = tagSyncService.syncAll();
        return Map.of("synced", synced);
    }

    /** 批量删孤儿：ids 含被引用词条整体拒绝 400。 */
    @DeleteMapping
    public ResponseEntity<Void> deleteBatch(@RequestParam("ids") List<Long> ids) {
        tagAdminService.deleteBatch(ids);
        return ResponseEntity.noContent().build();
    }

    /** 改名：body {name}。新名撞既有词条返回 400 引导合并。 */
    @PutMapping("/{id}")
    public TagUsage rename(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return tagAdminService.rename(id, body.get("name"));
    }

    /** 合并：body {fromId, toId}——from 引用迁移到 to，删 from。 */
    @PostMapping("/merge")
    public void merge(@RequestBody Map<String, Long> body) {
        tagAdminService.merge(body.get("fromId"), body.get("toId"));
    }

    /** 删孤儿：仅无任何引用的词条可删，否则 400。 */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        tagAdminService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
