package com.videotagger.service;

import com.videotagger.entity.Media;
import com.videotagger.mapper.MediaMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.Base64;
import java.util.Set;

/**
 * 封面下载与落盘。存储走本地目录 + Spring 静态映射（/covers/**），不上 minio。
 *
 * 目录规划：
 *   - 番剧：{coverDir}/{mediaId}.{ext}（og:image / 手动上传，覆盖写）
 *   - 集：  {coverDir}/ep/{epId}-{version}.jpg（自选高能画面/上传，版本戳防浏览器缓存旧图）
 *   - 片段：{coverDir}/clip/{clipId}.jpg（扩展截帧，一经创建不覆盖）
 *
 * 原则：封面纯展示，绝不进入向量化/搜索；任何一步失败降级为无封面，不阻塞保存主链路。
 */
@Service
public class CoverService {

    private static final Logger log = LoggerFactory.getLogger(CoverService.class);
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final Set<String> IMAGE_EXT = Set.of("jpg", "png", "webp");

    private final MediaMapper mediaMapper;
    private final Path coverDir;

    public CoverService(MediaMapper mediaMapper,
                        @Value("${videotagger.cover-dir:data/covers}") String coverDir) {
        this.mediaMapper = mediaMapper;
        this.coverDir = Paths.get(coverDir).toAbsolutePath();
        try {
            Files.createDirectories(this.coverDir);
        } catch (IOException e) {
            throw new IllegalStateException("无法创建封面目录: " + this.coverDir, e);
        }
    }

    public Path dir() {
        return coverDir;
    }

    // ---------- 番剧封面（既有：og:image / 手动上传） ----------

    /** 扩展打标后异步下载 og:image；失败静默（个人工具封面不是关键路径）。 */
    @Async("coverExecutor")
    public void downloadAsync(Long mediaId, String imageUrl) {
        try {
            saveFromUrl(mediaId, imageUrl);
        } catch (Exception e) {
            log.warn("番剧 {} 封面下载失败（降级为无封面）：{}", mediaId, e.getMessage());
        }
    }

    /** 从 URL 下载封面并落盘，返回 /covers/** 相对路径。 */
    public String saveFromUrl(Long mediaId, String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            throw new IllegalArgumentException("image url 为空");
        }
        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        HttpRequest req = HttpRequest.newBuilder(URI.create(imageUrl))
                .timeout(Duration.ofSeconds(20))
                .GET()
                .build();
        try {
            HttpResponse<byte[]> resp = client.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() != 200) {
                throw new IllegalStateException("HTTP " + resp.statusCode());
            }
            byte[] body = resp.body();
            if (body.length > MAX_BYTES) {
                throw new IllegalStateException("图片过大: " + body.length);
            }
            String contentType = resp.headers().firstValue("Content-Type").orElse("");
            return persist(mediaId, body, extFor(contentType));
        } catch (IOException e) {
            throw new IllegalStateException("下载失败: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("下载被中断", e);
        }
    }

    /** Web UI 手动上传的字节落盘（番剧封面）。 */
    public String saveFromBytes(Long mediaId, byte[] body, String originalName) {
        if (body.length > MAX_BYTES) {
            throw new IllegalArgumentException("图片过大: " + body.length);
        }
        return persist(mediaId, body, extFromName(originalName));
    }

    // ---------- 片段封面（扩展截帧） ----------

    /** 片段截帧封面：稳定文件名 clip/{clipId}.jpg（创建后不覆盖）。 */
    public String saveClipCover(long clipId, byte[] body) {
        Path dir = coverDir.resolve("clip");
        write(dir, clipId + ".jpg", body);
        return "/covers/clip/" + clipId + ".jpg";
    }

    /** 片段详情大图：稳定文件名 clip/{clipId}-xl.jpg（悬浮预览/详情页 hero 用）。 */
    public String saveClipDetailCover(long clipId, byte[] body) {
        Path dir = coverDir.resolve("clip");
        write(dir, clipId + "-xl.jpg", body);
        return "/covers/clip/" + clipId + "-xl.jpg";
    }

    // ---------- 集封面（自选/上传） ----------

    /** 集封面：带版本戳防浏览器缓存旧图，替换时先清旧文件再写新（nanoTime 保证同名毫秒不冲突）。 */
    public String saveEpisodeCover(long episodeId, byte[] body) {
        Path dir = coverDir.resolve("ep");
        String fileName = episodeId + "-" + System.nanoTime() + ".jpg";
        cleanup(dir, episodeId + "-", ".jpg");
        write(dir, fileName, body);
        return "/covers/ep/" + fileName;
    }

    /** 自选高能画面：把片段封面文件字节拷贝为集封面（片段无封面则报错）。 */
    public String saveEpisodeCoverFromClip(long episodeId, long clipId) {
        Path clipFile = coverDir.resolve("clip").resolve(clipId + ".jpg");
        if (!Files.exists(clipFile)) {
            throw new IllegalStateException("clip cover not found: " + clipId);
        }
        try {
            return saveEpisodeCover(episodeId, Files.readAllBytes(clipFile));
        } catch (IOException e) {
            throw new IllegalStateException("读取片段封面失败: " + e.getMessage(), e);
        }
    }

    // ---------- 删除 / base64 ----------

    /** 按 /covers/** 路径删除封面文件；空值静默；越界路径拒绝（防目录穿越）。 */
    public void deleteCover(String path) {
        if (path == null || path.isBlank()) {
            return;
        }
        try {
            String normalized = path.replace('\\', '/');
            if (!normalized.startsWith("/covers/")) {
                log.warn("拒绝删除越界封面路径: {}", path);
                return;
            }
            Path file = coverDir.resolve(normalized.substring("/covers/".length())).normalize();
            if (!file.startsWith(coverDir)) {
                log.warn("拒绝删除越界封面路径: {}", path);
                return;
            }
            Files.deleteIfExists(file);
        } catch (IOException e) {
            log.warn("删除封面失败 {}: {}", path, e.getMessage());
        }
    }

    /** 按 /covers/** 路径读取封面转 base64 data URL（推荐 HTML 内嵌用）。空/越界/文件不存在/读失败 → null（只读不改）。 */
    public String base64ForCoverPath(String coverPath) {
        if (coverPath == null || coverPath.isBlank()) {
            return null;
        }
        try {
            String normalized = coverPath.replace('\\', '/');
            if (!normalized.startsWith("/covers/")) {
                log.warn("拒绝读取越界封面路径: {}", coverPath);
                return null;
            }
            Path file = coverDir.resolve(normalized.substring("/covers/".length())).normalize();
            if (!file.startsWith(coverDir) || !Files.isRegularFile(file)) {
                return null;
            }
            byte[] bytes = Files.readAllBytes(file);
            String mime = mimeFor(file.getFileName().toString());
            return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (IOException e) {
            log.warn("读取封面转 base64 失败 {}: {}", coverPath, e.getMessage());
            return null;
        }
    }

    /** 解析 data URL（data:image/...;base64,...）或裸 base64 为字节；非法抛 IllegalArgumentException。 */
    public byte[] decodeDataUrl(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) {
            throw new IllegalArgumentException("cover data 为空");
        }
        String base64 = dataUrl.trim();
        if (base64.startsWith("data:")) {
            int comma = base64.indexOf(',');
            if (comma < 0) {
                throw new IllegalArgumentException("非法 data URL");
            }
            base64 = base64.substring(comma + 1);
        }
        try {
            return Base64.getDecoder().decode(base64);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("base64 解码失败", e);
        }
    }

    // ---------- 内部 ----------

    private String persist(Long mediaId, byte[] body, String ext) {
        Path target = coverDir.resolve(mediaId + "." + ext);
        write(coverDir, mediaId + "." + ext, body);
        // 清理旧扩展名封面，避免残留多个
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(coverDir, mediaId + ".*")) {
            for (Path p : ds) {
                if (!p.equals(target)) {
                    Files.deleteIfExists(p);
                }
            }
        } catch (IOException e) {
            log.warn("清理旧番剧封面失败: {}", e.getMessage());
        }
        String path = "/covers/" + target.getFileName();
        Media a = mediaMapper.selectById(mediaId);
        if (a != null) {
            a.setCoverPath(path);
            mediaMapper.updateById(a);
        }
        return path;
    }

    private void write(Path dir, String fileName, byte[] body) {
        if (body == null || body.length == 0) {
            throw new IllegalArgumentException("图片内容为空");
        }
        if (body.length > MAX_BYTES) {
            throw new IllegalArgumentException("图片过大: " + body.length);
        }
        try {
            Files.createDirectories(dir);
            Files.write(dir.resolve(fileName), body);
        } catch (IOException e) {
            throw new IllegalStateException("写入封面失败: " + e.getMessage(), e);
        }
    }

    /** 清理同前缀旧文件（集封面版本戳替换用）。 */
    private void cleanup(Path dir, String prefix, String ext) {
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir, prefix + "*" + ext)) {
            for (Path p : ds) {
                Files.deleteIfExists(p);
            }
        } catch (IOException ignored) {
        }
    }

    private static String extFor(String contentType) {        String ct = contentType == null ? "" : contentType.toLowerCase();
        if (ct.contains("png")) {
            return "png";
        }
        if (ct.contains("webp")) {
            return "webp";
        }
        return "jpg";
    }

    private static String extFromName(String name) {
        if (name == null) {
            return "jpg";
        }
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase() : "jpg";
        if (ext.equals("jpeg")) {
            ext = "jpg";
        }
        return IMAGE_EXT.contains(ext) ? ext : "jpg";
    }

    private static String mimeFor(String fileName) {
        String ext = extFromName(fileName);
        return switch (ext) {
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            default -> "image/jpeg";
        };
    }
}
