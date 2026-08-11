package com.videotagger.controller;

import com.videotagger.service.RecommendService;
import com.videotagger.service.RecommendVideoService;
import com.videotagger.service.VideoExportTaskService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 推荐番剧导出：勾选媒体 → 自包含渐变环流 HTML / 渲染导出 MP4 视频。 */
@RestController
@RequestMapping("/api/recommend")
public class RecommendController {

    private static final DateTimeFormatter FILE_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm");

    private final RecommendService recommendService;
    private final RecommendVideoService recommendVideoService;
    private final VideoExportTaskService exportTaskService;

    public RecommendController(RecommendService recommendService, RecommendVideoService recommendVideoService,
                               VideoExportTaskService exportTaskService) {
        this.recommendService = recommendService;
        this.recommendVideoService = recommendVideoService;
        this.exportTaskService = exportTaskService;
    }

    /** 推荐导出请求体：勾选媒体 id + 标题文案（主题）+ 视频格式/清晰度（视频导出用，HTML 忽略格式）+ BGM（名称/base64，可空）。 */
    public record RecommendExportRequest(List<Long> ids, String title, String format, String resolution,
                                         String bgmName, String bgmBase64, String groupBy, String groupStyle,
                                         String subtitle, String coverSize,
                                         List<RecommendService.BgmTrack> bgmTracks,
                                         List<Long> openingIds, String intro,
                                         Integer openingSec, Integer introSec, Integer groupSec,
                                         Integer detailSec, Integer endingSec,
                                         String endingTitle, String endingText,
                                         String bgColor, List<String> bgImages,
                                         Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                                         String prologueTitle,
                                         String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                                         Integer bgmScale,
                                         Integer bgmX, Integer bgmY,
                                         String brandTitle, Integer perScreen) {
    }

    /** 生成自包含推荐 HTML（附件下载）。标题（主题）自定义，空 → 默认。BGM 可选（base64 内嵌）。 */
    @PostMapping(value = "/html", produces = "text/html;charset=UTF-8")
    public ResponseEntity<byte[]> html(@RequestBody RecommendExportRequest body) {
        RecommendService.Durations dur = recommendService.normalizeDurations(
                body.openingSec(), body.introSec(), body.groupSec(), body.detailSec(), body.endingSec());
        byte[] html = recommendService.buildHtml(body.ids(), body.title(), body.bgmTracks(),
                body.subtitle(), body.coverSize(), body.groupBy(), body.groupStyle(),
                body.openingIds(), body.intro(), dur, body.endingTitle(), body.endingText(),
                body.bgColor(), body.bgImages(), body.bgRotationSec(), body.bgOpacity(), body.bgBlur(), body.bgBrightness(),
                body.prologueTitle(),
                body.groupSort(), body.openingSpeed(), body.endingScrollSpeed(),
                body.bgmScale(), body.bgmX(), body.bgmY(), body.brandTitle(), body.perScreen())
                .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"video-tagger-recommend.html\"")
                .body(html);
    }

    /** 渲染推荐 HTML 为视频（MP4/WebM，清晰度 720P/1080P/4K，附件下载）。BGM 可选（循环混入音轨）。 */
    /** 导出视频：异步创建后台任务（RUNNING）立即返回 taskId；进度/产物由任务列表管理。 */
    @PostMapping(value = "/video")
    public ResponseEntity<Map<String, Object>> video(@RequestBody RecommendExportRequest body) throws IOException {
        String fmt = body.format() == null || body.format().isBlank() ? "MP4" : body.format().trim().toUpperCase();
        List<String> bgmPaths = new ArrayList<>();
        if (body.bgmTracks() != null) {
            for (RecommendService.BgmTrack t : body.bgmTracks()) {
                if (t == null || t.base64() == null || t.base64().isBlank()) continue;
                Path f = Files.createTempFile("vt-bgm-", bgmExt(t.name()));
                Files.write(f, java.util.Base64.getDecoder().decode(t.base64()));
                bgmPaths.add(f.toString());
            }
        } else if (body.bgmBase64() != null && !body.bgmBase64().isBlank()) {
            Path f = Files.createTempFile("vt-bgm-", bgmExt(body.bgmName()));
            Files.write(f, java.util.Base64.getDecoder().decode(body.bgmBase64()));
            bgmPaths.add(f.toString());
        }
        List<RecommendService.BgmTrack> bgmTracks = body.bgmTracks();
        if ((bgmTracks == null || bgmTracks.isEmpty())
                && body.bgmBase64() != null && !body.bgmBase64().isBlank()) {
            bgmTracks = List.of(new RecommendService.BgmTrack(body.bgmName(), body.bgmBase64()));
        }
        RecommendService.Durations dur = recommendService.normalizeDurations(
                body.openingSec(), body.introSec(), body.groupSec(), body.detailSec(), body.endingSec());
        VideoExportTaskService.VideoExportTask t = exportTaskService.create(
                body.ids(), body.title(), fmt, body.resolution(), bgmPaths, bgmTracks,
                body.groupBy(), body.groupStyle(), body.subtitle(), body.coverSize(),
                body.openingIds(), body.intro(), dur, body.endingTitle(), body.endingText(),
                body.bgColor(), body.bgImages(), body.bgRotationSec(), body.bgOpacity(), body.bgBlur(), body.bgBrightness(),
                body.prologueTitle(),
                body.groupSort(), body.openingSpeed(), body.endingScrollSpeed(),
                body.bgmScale(), body.bgmX(), body.bgmY(), body.brandTitle(), body.perScreen());
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("taskId", t.id());
        resp.put("status", t.status());
        return ResponseEntity.ok(resp);
    }

    /** 全部导出任务记录（按创建时间倒序）。 */
    @GetMapping("/video/tasks")
    public List<VideoExportTaskService.VideoExportTask> tasks() {
        return exportTaskService.list();
    }

    /** 单任务状态。 */
    @GetMapping("/video/tasks/{id}")
    public VideoExportTaskService.VideoExportTask task(@PathVariable long id) {
        return exportTaskService.get(id);
    }

    /** 删除任务记录（同步删除产物文件）。 */
    @DeleteMapping("/video/tasks/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable long id) {
        exportTaskService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** 打开产物文件（folder=true → 打开所在文件夹并选中）。 */
    @PostMapping("/video/tasks/{id}/open")
    public ResponseEntity<Void> openTask(@PathVariable long id,
                                         @RequestParam(defaultValue = "false") boolean folder) {
        exportTaskService.open(id, folder);
        return ResponseEntity.ok().build();
    }

    /** BGM 临时文件扩展名（按文件名推断，未知 → .mp3）。 */
    private static String bgmExt(String name) {
        if (name != null) {
            String lower = name.toLowerCase();
            if (lower.endsWith(".m4a")) return ".m4a";
            if (lower.endsWith(".wav")) return ".wav";
            if (lower.endsWith(".ogg")) return ".ogg";
        }
        return ".mp3";
    }
}
