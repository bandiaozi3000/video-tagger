package com.videotagger.service;

import com.videotagger.entity.Anime;
import com.videotagger.mapper.AnimeMapper;
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
import java.util.Set;

/**
 * 封面下载与落盘。存储走本地目录 + Spring 静态映射（/covers/**），不上 minio。
 * 扩展打标携带 og:image 时异步下载（失败降级为无封面，不阻塞保存链路）；
 * Web UI 支持手动上传 / 粘贴图片 URL 兜底。
 */
@Service
public class CoverService {

    private static final Logger log = LoggerFactory.getLogger(CoverService.class);
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final Set<String> IMAGE_EXT = Set.of("jpg", "png", "webp");

    private final AnimeMapper animeMapper;
    private final Path coverDir;

    public CoverService(AnimeMapper animeMapper,
                        @Value("${videotagger.cover-dir:data/covers}") String coverDir) {
        this.animeMapper = animeMapper;
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

    /** 扩展打标后异步下载 og:image；失败静默（个人工具封面不是关键路径）。 */
    @Async("coverExecutor")
    public void downloadAsync(Long animeId, String imageUrl) {
        try {
            saveFromUrl(animeId, imageUrl);
        } catch (Exception e) {
            log.warn("番剧 {} 封面下载失败（降级为无封面）：{}", animeId, e.getMessage());
        }
    }

    /** 从 URL 下载封面并落盘，返回 /covers/** 相对路径。 */
    public String saveFromUrl(Long animeId, String imageUrl) {
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
            return persist(animeId, body, extFor(contentType));
        } catch (IOException e) {
            throw new IllegalStateException("下载失败: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("下载被中断", e);
        }
    }

    /** Web UI 手动上传的字节落盘。 */
    public String saveFromBytes(Long animeId, byte[] body, String originalName) {
        if (body.length > MAX_BYTES) {
            throw new IllegalArgumentException("图片过大: " + body.length);
        }
        return persist(animeId, body, extFromName(originalName));
    }

    private String persist(Long animeId, byte[] body, String ext) {
        Path target = coverDir.resolve(animeId + "." + ext);
        try {
            Files.write(target, body);
            // 清理旧扩展名封面，避免残留多个
            try (DirectoryStream<Path> ds = Files.newDirectoryStream(coverDir, animeId + ".*")) {
                for (Path p : ds) {
                    if (!p.equals(target)) {
                        Files.deleteIfExists(p);
                    }
                }
            }
        } catch (IOException e) {
            throw new IllegalStateException("写入封面失败: " + e.getMessage(), e);
        }
        String path = "/covers/" + target.getFileName();
        Anime a = animeMapper.selectById(animeId);
        if (a != null) {
            a.setCoverPath(path);
            animeMapper.updateById(a);
        }
        return path;
    }

    private static String extFor(String contentType) {
        String ct = contentType == null ? "" : contentType.toLowerCase();
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
}
