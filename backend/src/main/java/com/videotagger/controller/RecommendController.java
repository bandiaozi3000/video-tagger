package com.videotagger.controller;

import com.videotagger.service.RecommendMediaClips;
import com.videotagger.service.RecommendService;
import com.videotagger.service.RecommendClipSourceService;
import com.videotagger.service.RecommendVideoService;
import com.videotagger.service.VideoExportTaskService;
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
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 推荐番剧导出：勾选媒体 → 预览（Remotion Player）/ 渲染导出 MP4 视频。
 *
 * 注意：HTML 分享包（`/html`）已随旧模板链路退役（设计规格 §11/§14-2）。
 */
@RestController
@RequestMapping("/api/recommend")
public class RecommendController {

    private final RecommendService recommendService;
    private final RecommendVideoService recommendVideoService;
    private final VideoExportTaskService exportTaskService;
    private final RecommendClipSourceService clipSourceService;

    public RecommendController(RecommendService recommendService, RecommendVideoService recommendVideoService,
                               VideoExportTaskService exportTaskService, RecommendClipSourceService clipSourceService) {
        this.recommendService = recommendService;
        this.recommendVideoService = recommendVideoService;
        this.exportTaskService = exportTaskService;
        this.clipSourceService = clipSourceService;
    }

    /** 推荐导出请求体：勾选媒体 id + 标题文案（主题）+ 视频格式/清晰度 + BGM（名称/base64，可空）。 */
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
                                         String brandTitle, Integer perScreen, String coverMode,
                                         Map<String, Boolean> detailShow,
                                         Map<Long, RecommendMediaClips> mediaClips) {
    }

    @PostMapping(value = "/prepare-clips")
    public RecommendClipSourceService.PreparedClips prepareClips(@RequestBody Map<Long, RecommendMediaClips> mediaClips) throws IOException {
        Path work = Files.createTempDirectory("vt-recommend-preview-");
        return clipSourceService.prepare(mediaClips, work);
    }

    /**
     * 预览：返回 Remotion Player 页（注入 RenderInput JSON 与素材基址）。
     *
     * 与导出**同源**：同一 Composition、同一份视觉令牌；差别只有素材基址与画幅帧率占位。
     * 片段与 BGM 素材落在 `data/recommend-previews/{token}/`（不删，供浏览器按帧/按轨取用）。
     */
    @PostMapping(value = "/preview", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> preview(@RequestBody RecommendExportRequest body) throws IOException {
        Path page = recommendVideoService.playerPagePath();
        if (page == null) {
            throw new IllegalStateException("Remotion Player 预览页未构建：请先执行 `cd backend/remotion && npm run build:player`");
        }
        RecommendService.Durations dur = recommendService.normalizeDurations(
                body.openingSec(), body.introSec(), body.groupSec(), body.detailSec(), body.endingSec());
        String token = UUID.randomUUID().toString();
        Path work = Path.of("data", "recommend-previews", token).toAbsolutePath();
        Files.createDirectories(work);
        try {
            Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips = Map.of();
            if (body.mediaClips() != null && !body.mediaClips().isEmpty()) {
                RecommendClipSourceService.PreparedClips prepared = clipSourceService.prepare(body.mediaClips(), work);
                if (prepared.hasMissing()) {
                    throw new IllegalArgumentException("片段素材不可用: " + prepared.missing().stream()
                            .map(m -> "#" + m.clipId() + "(" + m.reason() + ")").toList());
                }
                preparedClips = prepared.byMedia();
            }
            List<String> bgmRels = materializeBgm(body.bgmTracks(), body.bgmName(), body.bgmBase64(), work);
            List<RecommendService.BgmTrack> tracks = namedBgm(body.bgmTracks(), body.bgmName(), body.bgmBase64());
            int[] wh = RecommendVideoService.pixelsOf(body.resolution());
            String inputJson = recommendService.buildRenderInput(body.ids(), body.title(), tracks,
                    body.subtitle(), body.coverSize(), body.groupBy(), body.groupStyle(), body.openingIds(), body.intro(),
                    dur, body.endingTitle(), body.endingText(), body.bgColor(), body.bgImages(), body.bgRotationSec(),
                    body.bgOpacity(), body.bgBlur(), body.bgBrightness(), body.prologueTitle(), body.groupSort(),
                    body.openingSpeed(), body.endingScrollSpeed(), body.bgmScale(), body.bgmX(), body.bgmY(),
                    body.brandTitle(), body.perScreen(), body.detailShow(), preparedClips, "url", 30, wh[0], wh[1],
                    bgmRels,
                    rel -> recommendVideoService.probeDurationSeconds(work.resolve(rel).toAbsolutePath().toString()));
            String inject = "<script>window.__VT_INPUT__=" + inputJson
                    + ";window.__VT_ASSET_BASE__=\"/recommend-previews/" + token + "\";</script>";
            String html = Files.readString(page, StandardCharsets.UTF_8).replace("<!--VT_PREVIEW_INJECT-->", inject);
            return ResponseEntity.ok().contentType(MediaType.valueOf("text/html;charset=UTF-8")).body(html);
        } catch (RuntimeException e) {
            deleteTree(work);
            throw e;
        }
    }

    /** 导出视频：异步创建后台任务（RUNNING）立即返回 taskId；进度/产物由任务列表管理。 */
    @PostMapping(value = "/video")
    public ResponseEntity<Map<String, Object>> video(@RequestBody RecommendExportRequest body) throws IOException {
        String fmt = body.format() == null || body.format().isBlank() ? "MP4" : body.format().trim().toUpperCase(Locale.ROOT);
        List<RecommendService.BgmTrack> bgmTracks = namedBgm(body.bgmTracks(), body.bgmName(), body.bgmBase64());
        List<String> bgmPaths = new ArrayList<>();
        if (body.bgmTracks() != null) {
            for (RecommendService.BgmTrack t : body.bgmTracks()) {
                if (t == null || t.base64() == null || t.base64().isBlank()) continue;
                Path f = Files.createTempFile("vt-bgm-", bgmExt(t.name()));
                Files.write(f, Base64.getDecoder().decode(t.base64()));
                bgmPaths.add(f.toString());
            }
        } else if (body.bgmBase64() != null && !body.bgmBase64().isBlank()) {
            Path f = Files.createTempFile("vt-bgm-", bgmExt(body.bgmName()));
            Files.write(f, Base64.getDecoder().decode(body.bgmBase64()));
            bgmPaths.add(f.toString());
        }
        RecommendService.Durations dur = recommendService.normalizeDurations(
                body.openingSec(), body.introSec(), body.groupSec(), body.detailSec(), body.endingSec());
        VideoExportTaskService.VideoExportTask t;
        if (body.mediaClips() == null || body.mediaClips().isEmpty()) {
            t = exportTaskService.create(
                    body.ids(), body.title(), fmt, body.resolution(), bgmPaths, bgmTracks,
                    body.groupBy(), body.groupStyle(), body.subtitle(), body.coverSize(),
                    body.openingIds(), body.intro(), dur, body.endingTitle(), body.endingText(),
                    body.bgColor(), body.bgImages(), body.bgRotationSec(), body.bgOpacity(), body.bgBlur(), body.bgBrightness(),
                    body.prologueTitle(), body.groupSort(), body.openingSpeed(), body.endingScrollSpeed(),
                    body.bgmScale(), body.bgmX(), body.bgmY(), body.brandTitle(), body.perScreen(),
                    body.detailShow());
        } else {
            t = exportTaskService.create(
                    body.ids(), body.title(), fmt, body.resolution(), bgmPaths, bgmTracks,
                    body.groupBy(), body.groupStyle(), body.subtitle(), body.coverSize(),
                    body.openingIds(), body.intro(), dur, body.endingTitle(), body.endingText(),
                    body.bgColor(), body.bgImages(), body.bgRotationSec(), body.bgOpacity(), body.bgBlur(), body.bgBrightness(),
                    body.prologueTitle(), body.groupSort(), body.openingSpeed(), body.endingScrollSpeed(),
                    body.bgmScale(), body.bgmX(), body.bgmY(), body.brandTitle(), body.perScreen(),
                    body.detailShow(), body.mediaClips());
        }
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

    /** BGM 曲目视图：新格式取 `bgmTracks`，旧单曲字段（bgmName/bgmBase64）补一条。 */
    private static List<RecommendService.BgmTrack> namedBgm(List<RecommendService.BgmTrack> tracks,
                                                             String legacyName, String legacyBase64) {
        if (tracks != null && !tracks.isEmpty()) return tracks;
        if (legacyBase64 == null || legacyBase64.isBlank()) return List.of();
        return List.of(new RecommendService.BgmTrack(legacyName, legacyBase64));
    }

    /**
     * 把请求里的 BGM（base64）落成工作目录下的素材文件，返回与曲目**等长**的相对路径列表
     * （无音频的曲目占位 null，保证与曲目下标一一对应——Remotion 侧按下标取用）。
     */
    private static List<String> materializeBgm(List<RecommendService.BgmTrack> tracks, String legacyName,
                                               String legacyBase64, Path work) throws IOException {
        List<RecommendService.BgmTrack> list = namedBgm(tracks, legacyName, legacyBase64);
        List<String> rels = new ArrayList<>();
        int index = 0;
        for (RecommendService.BgmTrack track : list) {
            if (track == null || track.base64() == null || track.base64().isBlank()) {
                rels.add(null);
                index++;
                continue;
            }
            String rel = "bgm-" + index + bgmExt(track.name());
            Files.write(work.resolve(rel), Base64.getDecoder().decode(track.base64()));
            rels.add(rel);
            index++;
        }
        return rels;
    }

    private static void deleteTree(Path root) {
        if (root == null) return;
        try (var paths = Files.walk(root)) {
            paths.sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                try { Files.deleteIfExists(p); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }

    /** BGM 临时文件扩展名（按文件名推断，未知 → .mp3）。 */
    private static String bgmExt(String name) {
        if (name != null) {
            String lower = name.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".m4a")) return ".m4a";
            if (lower.endsWith(".wav")) return ".wav";
            if (lower.endsWith(".ogg")) return ".ogg";
        }
        return ".mp3";
    }
}
