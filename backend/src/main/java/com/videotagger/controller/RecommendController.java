package com.videotagger.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.service.RecommendMediaClips;
import com.videotagger.service.RecommendService;
import com.videotagger.service.RecommendClipSourceService;
import com.videotagger.service.RecommendSessionService;
import com.videotagger.service.RecommendVideoService;
import com.videotagger.service.VideoExportTaskService;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 推荐工作台后端：编辑会话（素材准备 + RenderInput）与导出任务。
 *
 * 链路（v0.28）：编辑器前端持有配置状态 → `POST /session/{token}/render-input` 换回同源的
 * Remotion RenderInput（与导出同源，仅封面走 url 模式供浏览器直连）→ 需要成片时
 * `POST /video` 创建异步导出任务。
 *
 * 已退役：旧 HTML 注入预览 `/preview`（含 `dist-player` 链路）、孤儿端点 `/prepare-clips`。
 */
@RestController
@RequestMapping("/api/recommend")
public class RecommendController {

    private final RecommendService recommendService;
    private final RecommendVideoService recommendVideoService;
    private final VideoExportTaskService exportTaskService;
    private final RecommendClipSourceService clipSourceService;
    private final RecommendSessionService sessionService;
    private final ObjectMapper objectMapper;

    public RecommendController(RecommendService recommendService, RecommendVideoService recommendVideoService,
                               VideoExportTaskService exportTaskService, RecommendClipSourceService clipSourceService,
                               RecommendSessionService sessionService, ObjectMapper objectMapper) {
        this.recommendService = recommendService;
        this.recommendVideoService = recommendVideoService;
        this.exportTaskService = exportTaskService;
        this.clipSourceService = clipSourceService;
        this.sessionService = sessionService;
        this.objectMapper = objectMapper;
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
                                         Map<String, Boolean> detailShow, String preset,
                                         Map<Long, RecommendMediaClips> mediaClips) {
    }

    /**
     * 创建编辑会话：新建 token 工作目录 → 准备片段与 BGM 素材 → 返回同源 RenderInput。
     *
     * 素材缺失**不再报错**（旧 `/preview` 行为），而是随 `missing` 返回，由编辑器做段级标黄（设计规格 §9）。
     */
    @PostMapping("/session")
    public Map<String, Object> createSession(@RequestBody RecommendExportRequest body) throws IOException {
        RecommendSessionService.Session session = sessionService.create();
        try {
            return sessionResponse(session, body);
        } catch (RuntimeException | IOException e) {
            sessionService.delete(session.token());
            throw e;
        }
    }

    /** 会话内重算 RenderInput（参数改动走这里；素材增量准备 + 会话缓存命中）。 */
    @PostMapping("/session/{token}/render-input")
    public Map<String, Object> renderInput(@PathVariable String token,
                                           @RequestBody RecommendExportRequest body) throws IOException {
        return sessionResponse(sessionService.require(token), body);
    }

    /** 回收会话（删内存记录 + 磁盘目录）。 */
    @DeleteMapping("/session/{token}")
    public ResponseEntity<Void> deleteSession(@PathVariable String token) {
        sessionService.delete(token);
        return ResponseEntity.noContent().build();
    }

    /**
     * 会话响应：`{token, input, missing}`。
     *
     * `input` 是**解析后的 JSON 对象**（不是被转义的字符串），供编辑器直接作为 `inputProps` 使用。
     */
    private Map<String, Object> sessionResponse(RecommendSessionService.Session session,
                                                RecommendExportRequest body) throws IOException {
        Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips = Map.of();
        List<RecommendClipSourceService.MissingClip> missing = List.of();
        if (body.mediaClips() != null && !body.mediaClips().isEmpty()) {
            RecommendClipSourceService.PreparedClips prepared = clipSourceService.prepare(body.mediaClips(), session.dir());
            preparedClips = prepared.byMedia();
            missing = prepared.missing() == null ? List.of() : prepared.missing();
        }
        List<String> bgmRels = sessionService.materializeBgm(session, body.bgmTracks(), body.bgmName(), body.bgmBase64());
        List<RecommendService.BgmTrack> tracks = RecommendSessionService.namedTracks(body.bgmTracks(), body.bgmName(), body.bgmBase64());
        RecommendService.Durations dur = recommendService.normalizeDurations(
                body.openingSec(), body.introSec(), body.groupSec(), body.detailSec(), body.endingSec());
        int[] wh = RecommendVideoService.pixelsOf(body.resolution());
        String inputJson = recommendService.buildRenderInput(body.ids(), body.title(), tracks,
                body.subtitle(), body.coverSize(), body.groupBy(), body.groupStyle(), body.openingIds(), body.intro(),
                dur, body.endingTitle(), body.endingText(), body.bgColor(), body.bgImages(), body.bgRotationSec(),
                body.bgOpacity(), body.bgBlur(), body.bgBrightness(), body.prologueTitle(), body.groupSort(),
                body.openingSpeed(), body.endingScrollSpeed(), body.bgmScale(), body.bgmX(), body.bgmY(),
                body.brandTitle(), body.perScreen(), body.detailShow(), body.preset(), preparedClips, "url", 30, wh[0], wh[1],
                bgmRels,
                rel -> recommendVideoService.probeDurationSeconds(session.dir().resolve(rel).toAbsolutePath().toString()));
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("token", session.token());
        resp.put("input", objectMapper.readValue(inputJson, Object.class));
        resp.put("missing", missing);
        return resp;
    }

    /** 导出视频：异步创建后台任务（RUNNING）立即返回 taskId；进度/产物由任务列表管理。 */
    @PostMapping(value = "/video")
    public ResponseEntity<Map<String, Object>> video(@RequestBody RecommendExportRequest body) throws IOException {
        String fmt = body.format() == null || body.format().isBlank() ? "MP4" : body.format().trim().toUpperCase(Locale.ROOT);
        List<RecommendService.BgmTrack> bgmTracks = RecommendSessionService.namedTracks(body.bgmTracks(), body.bgmName(), body.bgmBase64());
        List<String> bgmPaths = new ArrayList<>();
        if (body.bgmTracks() != null) {
            for (RecommendService.BgmTrack t : body.bgmTracks()) {
                if (t == null || t.base64() == null || t.base64().isBlank()) continue;
                Path f = Files.createTempFile("vt-bgm-", RecommendSessionService.audioExtension(t.name()));
                Files.write(f, Base64.getDecoder().decode(t.base64()));
                bgmPaths.add(f.toString());
            }
        } else if (body.bgmBase64() != null && !body.bgmBase64().isBlank()) {
            Path f = Files.createTempFile("vt-bgm-", RecommendSessionService.audioExtension(body.bgmName()));
            Files.write(f, Base64.getDecoder().decode(body.bgmBase64()));
            bgmPaths.add(f.toString());
        }
        RecommendService.Durations dur = recommendService.normalizeDurations(
                body.openingSec(), body.introSec(), body.groupSec(), body.detailSec(), body.endingSec());
        VideoExportTaskService.VideoExportTask t = exportTaskService.create(
                body.ids(), body.title(), fmt, body.resolution(), bgmPaths, bgmTracks,
                body.groupBy(), body.groupStyle(), body.subtitle(), body.coverSize(),
                body.openingIds(), body.intro(), dur, body.endingTitle(), body.endingText(),
                body.bgColor(), body.bgImages(), body.bgRotationSec(), body.bgOpacity(), body.bgBlur(), body.bgBrightness(),
                body.prologueTitle(), body.groupSort(), body.openingSpeed(), body.endingScrollSpeed(),
                body.bgmScale(), body.bgmX(), body.bgmY(), body.brandTitle(), body.perScreen(),
                body.detailShow(), body.preset(), body.mediaClips());
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
}
