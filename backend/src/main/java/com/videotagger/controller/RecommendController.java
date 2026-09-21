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
import org.springframework.web.bind.annotation.RequestParam;
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

import com.fasterxml.jackson.core.type.TypeReference;

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
                                         Map<Long, RecommendMediaClips> mediaClips,
                                         Integer seed,
                                         Integer clipVolume,
                                         String bgmRange,
                                         Integer titleSec,
                                         List<RecommendService.BgmTrack> stingTracks,
                                         Integer stingVolume) {
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
        // 时间轴帧率随模板形态：银幕式 24（片段素材原生帧率，不再补帧），其余 30
        int fps = RecommendService.fpsOf(body.groupStyle());
        Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips = Map.of();
        List<RecommendClipSourceService.MissingClip> missing = List.of();
        if (body.mediaClips() != null && !body.mediaClips().isEmpty()) {
            RecommendClipSourceService.PreparedClips prepared = clipSourceService.prepare(body.mediaClips(), session.dir(), fps);
            preparedClips = prepared.byMedia();
            missing = prepared.missing() == null ? List.of() : prepared.missing();
        }
        List<String> bgmRels = sessionService.materializeBgm(session, body.bgmTracks(), body.bgmName(), body.bgmBase64());
        List<RecommendService.BgmTrack> tracks = RecommendSessionService.namedTracks(body.bgmTracks(), body.bgmName(), body.bgmBase64());
        // 转场音乐：与 BGM 同一套落盘（就是个 0/1 元素的曲目列表），拿第 0 条的相对路径
        List<String> stingRels = body.stingTracks() == null || body.stingTracks().isEmpty()
                ? List.of()
                : sessionService.materializeBgm(session, body.stingTracks(), null, null);
        String stingRel = stingRels.isEmpty() ? null : stingRels.get(0);
        RecommendService.Durations dur = recommendService.normalizeDurations(
                body.openingSec(), body.introSec(), body.groupSec(), body.detailSec(), body.endingSec(), body.titleSec());
        int[] wh = RecommendVideoService.pixelsOf(body.resolution());
        String inputJson = recommendService.buildRenderInput(body.ids(), body.title(), tracks,
                body.subtitle(), body.coverSize(), body.groupBy(), body.groupStyle(), body.openingIds(), body.intro(),
                dur, body.endingTitle(), body.endingText(), body.bgColor(), body.bgImages(), body.bgRotationSec(),
                body.bgOpacity(), body.bgBlur(), body.bgBrightness(), body.prologueTitle(), body.groupSort(),
                body.openingSpeed(), body.endingScrollSpeed(), body.bgmScale(), body.bgmX(), body.bgmY(),
                body.brandTitle(), body.perScreen(), body.detailShow(), body.preset(), preparedClips, "url", fps, wh[0], wh[1],
                bgmRels,
                rel -> recommendVideoService.probeDurationSeconds(session.dir().resolve(rel).toAbsolutePath().toString()),
                body.seed(),
                body.clipVolume(),
                body.bgmRange(),
                stingRel,
                body.stingVolume());
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("token", session.token());
        Map<String, Object> input = objectMapper.readValue(inputJson, new TypeReference<Map<String, Object>>() { });
        // 浏览器预览必需：片段/BGM 的 assetPath 是**相对会话目录**的路径，没有基址就会被拼到
        // RecommendComposition 的开发缺省值 `http://127.0.0.1:18126/assets` 上（那个服务只在渲染进程里起）
        // → 表现为「背景音乐条在、但没有声音」。根相对路径让浏览器按应用同源解析。
        // 导出链路不受影响：`render-recommend.ts` 自己起本地素材服务并覆盖 assetBaseUrl。
        input.put("assetBaseUrl", "/recommend-previews/" + session.token());
        resp.put("input", input);
        resp.put("missing", missing);
        return resp;
    }

    /**
     * 素材信息指纹（A+B 的 B）：编辑器切回窗口时调一次，与会话里的指纹比对，变了就重建会话。
     *
     * 只读三张表、不读封面不解视频 → 可以放心在 focus 里频繁调。
     */
    @GetMapping("/meta-fingerprint")
    public Map<String, Object> metaFingerprint(@RequestParam(name = "ids", required = false) List<Long> ids) {
        return Map.of("fingerprint", recommendService.metaFingerprint(ids == null ? List.of() : ids));
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
        // 转场音乐：导出端与 BGM 一样写临时文件，再由渲染侧拷进工作目录
        String stingPath = null;
        if (body.stingTracks() != null && !body.stingTracks().isEmpty()) {
            RecommendService.BgmTrack sting = body.stingTracks().get(0);
            if (sting != null && sting.base64() != null && !sting.base64().isBlank()) {
                Path f = Files.createTempFile("vt-sting-", RecommendSessionService.audioExtension(sting.name()));
                Files.write(f, Base64.getDecoder().decode(sting.base64()));
                stingPath = f.toString();
            }
        }
        RecommendService.Durations dur = recommendService.normalizeDurations(
                body.openingSec(), body.introSec(), body.groupSec(), body.detailSec(), body.endingSec(), body.titleSec());
        VideoExportTaskService.VideoExportTask t = exportTaskService.create(
                body.ids(), body.title(), fmt, body.resolution(), bgmPaths, bgmTracks,
                body.groupBy(), body.groupStyle(), body.subtitle(), body.coverSize(),
                body.openingIds(), body.intro(), dur, body.endingTitle(), body.endingText(),
                body.bgColor(), body.bgImages(), body.bgRotationSec(), body.bgOpacity(), body.bgBlur(), body.bgBrightness(),
                body.prologueTitle(), body.groupSort(), body.openingSpeed(), body.endingScrollSpeed(),
                body.bgmScale(), body.bgmX(), body.bgmY(), body.brandTitle(), body.perScreen(),
                body.detailShow(), body.preset(), body.mediaClips(), body.seed(), body.clipVolume(), body.bgmRange(),
                stingPath, body.stingVolume());
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

    /**
     * 删除任务记录：**只删任务行 + 工作目录，不碰 data/exports 里的成品**（2026-09-21 用户拍板）。
     * 运行中/排队中先取消再删。
     */
    @DeleteMapping("/video/tasks/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable long id) {
        exportTaskService.delete(id);
        return ResponseEntity.noContent().build();
    }



    /**
     * 局部重渲某一块（用户 2026-09-21 拍板）：删该块产物 → 只重渲这一块 → 重新拼接 → **覆盖原成品**。
     *
     * 编辑器必须先做安全校验（当前草稿的段边界与任务快照一致）；不一致要整片重渲。
     */
    @PostMapping("/video/tasks/{id}/rerender")
    public Map<String, Object> rerenderChunk(@PathVariable long id, @RequestParam int chunk) {
        return Map.of("started", exportTaskService.rerenderChunk(id, chunk));
    }

    /** 暂停任务（块边界停；已完成块保留，可继续）。 */
    @PostMapping("/video/tasks/{id}/pause")
    public Map<String, Object> pauseTask(@PathVariable long id) {
        return Map.of("paused", exportTaskService.pause(id));
    }

    /** 继续任务（PAUSED / INTERRUPTED）——从工作目录里已有的块之后接着渲。 */
    @PostMapping("/video/tasks/{id}/resume")
    public Map<String, Object> resumeTask(@PathVariable long id) {
        return Map.of("resumed", exportTaskService.resume(id));
    }

    /**
     * 取消任务（2026-09-21）：杀渲染子进程 + 状态写成 CANCELLED，**工作目录保留**（下期续渲入口）。
     *
     * @return true = 确实取消了；false = 任务已结束
     */
    @PostMapping("/video/tasks/{id}/cancel")
    public Map<String, Object> cancelTask(@PathVariable long id) {
        return Map.of("cancelled", exportTaskService.cancel(id));
    }

    /** 打开产物文件（folder=true → 打开所在文件夹并选中）。 */
    @PostMapping("/video/tasks/{id}/open")
    public ResponseEntity<Void> openTask(@PathVariable long id,
                                         @RequestParam(defaultValue = "false") boolean folder) {
        exportTaskService.open(id, folder);
        return ResponseEntity.ok().build();
    }
}
