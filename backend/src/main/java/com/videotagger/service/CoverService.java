package com.videotagger.service;

import com.videotagger.entity.Media;
import com.videotagger.mapper.MediaMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
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
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import javax.imageio.ImageIO;

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
    /** 外部（Bangumi）封面缓存子目录：`covers/ext/{mediaId}.{ext}`，与用户自己的封面分开。 */
    private static final String EXT_DIR = "ext";

    private final MediaMapper mediaMapper;
    private final Path coverDir;

    /**
     * 主色缓存：`封面路径 → 主色`（`""` = 算过但取不出，避免反复解码）。
     *
     * **为什么必须有**（2026-09-26）：`accentColorForPath` 要把整张封面（≈848×1200 的 JPEG）
     * `ImageIO.read` 解码后再降采样算主色；以前**每次重建渲染输入都对每部重算一遍**，
     * 是无缓存版本下「全选后预览卡几十秒」的大头之一。封面文件视为不可变，所以按路径缓存即可
     * （覆盖上传会换文件名，不会读到陈旧值）。
     */
    private final java.util.Map<String, String> accentCache = new java.util.concurrent.ConcurrentHashMap<>();

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
        Downloaded image = download(imageUrl);
        return persist(mediaId, image.bytes(), image.ext());
    }

    /**
     * Bangumi（`external_work.cover_url`）封面**缓存**：落到 `covers/ext/{mediaId}.{ext}`，返回 `/covers/ext/...`。
     *
     * 与 {@link #saveFromUrl} 的区别：**不写 DB**（`media.cover_path` 不动）——
     * 用途只是“这部没本地封面时，推荐视频借一张外部封面显示”，不是替用户补封面（用户 2026-09-20 拍板）。
     * 已缓存直接复用（幂等，不会每次预览都联网）；无 URL / 下载失败 → null（调用方退到占位块）。
     */
    public String ensureExternalCover(Long mediaId, String imageUrl) {
        if (mediaId == null || imageUrl == null || imageUrl.isBlank()) {
            return null;
        }
        Path dir = coverDir.resolve(EXT_DIR);
        for (String ext : IMAGE_EXT) {
            Path cached = dir.resolve(mediaId + "." + ext);
            if (Files.isRegularFile(cached)) {
                return "/covers/" + EXT_DIR + "/" + cached.getFileName();
            }
        }
        try {
            Downloaded image = download(imageUrl);
            write(dir, mediaId + "." + image.ext(), image.bytes());
            return "/covers/" + EXT_DIR + "/" + mediaId + "." + image.ext();
        } catch (Exception e) {
            log.warn("媒体 {} 外部封面缓存失败（不影响渲染，退占位块）: {}", mediaId, e.getMessage());
            return null;
        }
    }

    /** 下载外部图片（带超时与大小上限）。 */
    private Downloaded download(String imageUrl) {
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
            return new Downloaded(body, extFor(resp.headers().firstValue("Content-Type").orElse("")));
        } catch (IOException e) {
            throw new IllegalStateException("下载失败: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("下载被中断", e);
        }
    }

    /** 下载结果（字节 + 由 Content-Type 判定的扩展名）。 */
    private record Downloaded(byte[] bytes, String ext) {
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
            if (!Files.deleteIfExists(file)) {
                // 文件本来就不在 —— **不能当正常**：cover-dir 跟随启动工作目录
                // （`${VT_DATA_DIR:data}/covers`），从 backend/ 启动会解析成 backend/data/covers，
                // 于是删除全部静默失败、孤儿封面越攒越多（2026-09-25 对账时踩过：DB 里 cover_path 已置空，
                // 磁盘上 5503 个文件一个没删，事后手工补删）。
                log.warn("封面文件不存在，没删到任何东西: {}（解析为 {}）—— 检查启动工作目录 / VT_DATA_DIR / COVER_DIR",
                        path, file.toAbsolutePath());
            }
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

    /**
     * 封面主色（推荐模板「每部一色」用）：降到 72×96 → 量化成小簇 → 取「占比 × 饱和」最高的一簇。
     *
     * 只要一簇颜色，不要调色板：多数封面会同时存在人像肤色与大块背景色，
     * 按饱和×占比取能稳定拿到「那张图看上去的颜色」。过暗/过亮的像素直接剔除。
     * 读不到、越界、或 ImageIO 解不了（如 webp）→ null，渲染侧退到确定性的兜底色。
     */
    public String accentColorForPath(String coverPath) {
        if (coverPath == null || coverPath.isBlank()) return null;
        String hit = accentCache.get(coverPath);
        if (hit != null) return hit.isEmpty() ? null : hit;
        String computed = computeAccentColor(coverPath);
        accentCache.put(coverPath, computed == null ? "" : computed);
        return computed;
    }

    /** 实际解码算主色（无缓存）；结果交给 {@link #accentColorForPath} 缓存。 */
    private String computeAccentColor(String coverPath) {
        try {
            Path file = coverFile(coverPath);
            if (file == null) return null;
            BufferedImage source = ImageIO.read(file.toFile());
            if (source == null) return null;
            BufferedImage small = new BufferedImage(72, 96, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = small.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(source, 0, 0, 72, 96, null);
            g.dispose();
            Map<Integer, long[]> buckets = new HashMap<>();
            for (int y = 0; y < 96; y++) {
                for (int x = 0; x < 72; x++) {
                    int rgb = small.getRGB(x, y);
                    int r = (rgb >> 16) & 0xff;
                    int gr = (rgb >> 8) & 0xff;
                    int b = rgb & 0xff;
                    double max = Math.max(r, Math.max(gr, b));
                    double min = Math.min(r, Math.min(gr, b));
                    double lum = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
                    double sat = max == 0 ? 0 : (max - min) / max;
                    if (lum < 40 || lum > 225 || sat < 0.18) continue;
                    int key = ((r >> 4) << 8) | ((gr >> 4) << 4) | (b >> 4);
                    long[] acc = buckets.computeIfAbsent(key, (k) -> new long[5]);
                    acc[0] += r;
                    acc[1] += gr;
                    acc[2] += b;
                    acc[3] += 1;
                    acc[4] += Math.round(sat * 1000);
                }
            }
            long[] best = null;
            double bestScore = 0;
            for (long[] acc : buckets.values()) {
                if (acc[3] == 0) continue;
                double score = acc[3] * (acc[4] / 1000.0 / acc[3]);
                if (score > bestScore) {
                    bestScore = score;
                    best = acc;
                }
            }
            if (best == null) return null;
            return String.format("#%02x%02x%02x", best[0] / best[3], best[1] / best[3], best[2] / best[3]);
        } catch (IOException e) {
            log.warn("提取封面主色失败 {}: {}", coverPath, e.getMessage());
            return null;
        }
    }

    /** `/covers/**` → 本地文件（越界/不存在 → null）。与 {@link #base64ForCoverPath} 同一套校验。 */
    private Path coverFile(String coverPath) {
        if (coverPath == null || coverPath.isBlank()) return null;
        String normalized = coverPath.replace('\\', '/');
        if (!normalized.startsWith("/covers/")) {
            log.warn("拒绝读取越界封面路径: {}", coverPath);
            return null;
        }
        Path file = coverDir.resolve(normalized.substring("/covers/".length())).normalize();
        return file.startsWith(coverDir) && Files.isRegularFile(file) ? file : null;
    }

    /** 解析 data URL（data:image/...;base64,...）或裸 base64 为字节；非法抛 IllegalArgumentException。 */    public byte[] decodeDataUrl(String dataUrl) {
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
