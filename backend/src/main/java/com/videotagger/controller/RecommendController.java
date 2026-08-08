package com.videotagger.controller;

import com.videotagger.service.RecommendService;
import com.videotagger.service.RecommendVideoService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** 推荐番剧导出：勾选媒体 → 自包含渐变环流 HTML / 渲染导出 MP4 视频。 */
@RestController
@RequestMapping("/api/recommend")
public class RecommendController {

    private static final DateTimeFormatter FILE_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm");

    private final RecommendService recommendService;
    private final RecommendVideoService recommendVideoService;

    public RecommendController(RecommendService recommendService, RecommendVideoService recommendVideoService) {
        this.recommendService = recommendService;
        this.recommendVideoService = recommendVideoService;
    }

    /** 推荐导出请求体：勾选媒体 id + 标题文案（主题）+ 视频格式/清晰度（视频导出用，HTML 忽略格式）+ BGM（名称/base64，可空）。 */
    public record RecommendExportRequest(List<Long> ids, String title, String format, String resolution,
                                         String bgmName, String bgmBase64) {
    }

    /** 生成自包含推荐 HTML（附件下载）。标题（主题）自定义，空 → 默认。BGM 可选（base64 内嵌）。 */
    @PostMapping(value = "/html", produces = "text/html;charset=UTF-8")
    public ResponseEntity<byte[]> html(@RequestBody RecommendExportRequest body) {
        byte[] html = recommendService.buildHtml(body.ids(), body.title(), body.bgmName(), body.bgmBase64())
                .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"video-tagger-recommend.html\"")
                .body(html);
    }

    /** 渲染推荐 HTML 为视频（MP4/WebM，清晰度 720P/1080P/4K，附件下载）。BGM 可选（循环混入音轨）。 */
    @PostMapping(value = "/video")
    public ResponseEntity<byte[]> video(@RequestBody RecommendExportRequest body) throws IOException {
        String fmt = body.format() == null || body.format().isBlank() ? "MP4" : body.format().trim().toUpperCase();
        Path bgmFile = null;
        if (body.bgmBase64() != null && !body.bgmBase64().isBlank()) {
            byte[] audio = java.util.Base64.getDecoder().decode(body.bgmBase64());
            bgmFile = Files.createTempFile("vt-bgm-", bgmExt(body.bgmName()));
            Files.write(bgmFile, audio);
        }
        Path out = null;
        try {
            out = recommendVideoService.render(body.ids(), body.title(), fmt, body.resolution(),
                    bgmFile == null ? null : bgmFile.toString());
            byte[] data = Files.readAllBytes(out);
            String ext = "WEBM".equals(fmt) ? "webm" : "mp4";
            String mime = "WEBM".equals(fmt) ? "video/webm" : "video/mp4";
            String fileName = "video-tagger-recommend-" + LocalDateTime.now().format(FILE_TS) + "." + ext;
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + fileName + "\"")
                    .contentType(MediaType.parseMediaType(mime))
                    .body(data);
        } finally {
            if (out != null) {
                Files.deleteIfExists(out);
            }
            if (bgmFile != null) {
                Files.deleteIfExists(bgmFile);
            }
        }
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
