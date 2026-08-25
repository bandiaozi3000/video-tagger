package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.HighlightProject;
import com.videotagger.entity.HighlightProjectItem;
import com.videotagger.mapper.ClipMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.List;
import java.util.Locale;

@Service
public class HighlightSourceService {
    private static final List<String> ALLOWED_MIME_PREFIXES = List.of("video/mp4", "video/webm", "video/x-matroska", "video/quicktime", "video/x-msvideo");
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final HighlightProjectService projectService;
    private final ClipMapper clipMapper;
    private final ClipExportProperties clipProperties;
    private final LocalVideoResolver videoResolver;
    private final HighlightProperties properties;
    private final HighlightPaths paths;

    @Lazy
    @Autowired
    private HighlightSourceService self;

    public HighlightSourceService(HighlightProjectService projectService, ClipMapper clipMapper,
                                  ClipExportProperties clipProperties, LocalVideoResolver videoResolver,
                                  HighlightProperties properties) {
        this.projectService = projectService;
        this.clipMapper = clipMapper;
        this.clipProperties = clipProperties;
        this.videoResolver = videoResolver;
        this.properties = properties;
        this.paths = new HighlightPaths(properties);
    }

    public Path previewPath(long projectId, long itemId) {
        HighlightProjectItem item = projectService.requireItem(projectId, itemId);
        if (!"READY".equals(item.getSourceState()) || item.getSourcePath() == null) {
            throw new IllegalStateException("素材尚未就绪");
        }
        Path path = paths.fromStoredPath(projectId, item.getSourcePath());
        if (!Files.isRegularFile(path)) throw new IllegalStateException("素材文件不存在，请重新准备或上传");
        return path;
    }

    public StreamProbe probePublicStream(long projectId, long itemId, String rawUrl) {
        projectService.requireItem(projectId, itemId);
        URI uri = validatePublicHttpUri(rawUrl);
        String path = uri.getPath() == null ? "" : uri.getPath().toLowerCase(Locale.ROOT);
        boolean manifest = path.endsWith(".m3u8") || path.endsWith(".mpd");
        return manifest
                ? new StreamProbe("STREAM", "UNAVAILABLE", "公开 HLS/DASH 已识别，但当前版本不执行分段下载；请下载后上传", true)
                : new StreamProbe("DIRECT_URL", "PENDING", "公开直链可继续准备", false);
    }

    public record StreamProbe(String sourceType, String sourceState, String message, boolean manifest) { }

    public HighlightProjectItem prepare(long projectId, long itemId) {
        HighlightProjectItem item = projectService.requireItem(projectId, itemId);
        if (item.getClipId() == null) throw new IllegalArgumentException("该素材没有关联原始片段，请上传视频文件");
        projectService.updateSource(projectId, itemId, "LOCAL_LIBRARY", "PREPARING", null, null, "正在准备本地素材");
        self.prepareLocalAsync(projectId, itemId);
        return projectService.requireItem(projectId, itemId);
    }

    @Async("highlightSourceExecutor")
    public void prepareLocalAsync(long projectId, long itemId) {
        try {
            HighlightProjectItem item = projectService.requireItem(projectId, itemId);
            Clip clip = clipMapper.selectById(item.getClipId());
            if (clip == null) throw new IllegalArgumentException("原始片段已删除");
            validateRange(item);
            Path output = paths.source(projectId, itemId);
            paths.ensureParent(output);
            Path temp = output.resolveSibling(output.getFileName() + ".part.mp4");
            Files.deleteIfExists(temp);
            Path existing = Path.of(clipProperties.getVideoOutputDir()).toAbsolutePath().normalize().resolve(clip.getId() + ".mp4");
            if (Files.isRegularFile(existing) && sameRange(item, clip)) {
                Files.copy(existing, temp, StandardCopyOption.REPLACE_EXISTING);
            } else {
                Path input = videoResolver.resolve(clip.getVideoFp());
                runFfmpeg(List.of(properties.getFfmpegPath(), "-y", "-ss", format(item.getInSec()), "-i", input.toString(),
                        "-t", format(item.getOutSec() - item.getInSec()), "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                        "-c:a", "aac", "-movflags", "+faststart", temp.toString()));
            }
            requireVideo(temp);
            replace(temp, output);
            projectService.updateSource(projectId, itemId, "LOCAL_LIBRARY", "READY", paths.store(projectId, output), null, null);
        } catch (Exception e) {
            fail(projectId, itemId, e);
        }
    }

    public HighlightProjectItem prepareDirectUrl(long projectId, long itemId, String rawUrl) {
        URI uri = validatePublicHttpUri(rawUrl);
        HighlightProjectItem item = projectService.requireItem(projectId, itemId);
        projectService.updateSource(projectId, itemId, "DIRECT_URL", "PREPARING", null, uri.toString(), "正在安全下载直链素材");
        self.downloadDirectAsync(projectId, itemId, uri.toString());
        return projectService.requireItem(projectId, itemId);
    }

    @Async("highlightSourceExecutor")
    public void downloadDirectAsync(long projectId, long itemId, String rawUrl) {
        Path temp = null;
        try {
            URI uri = validatePublicHttpUri(rawUrl);
            for (int redirects = 0; redirects <= 3; redirects++) {
                HttpResponse<InputStream> response = HTTP.send(HttpRequest.newBuilder(uri)
                                .GET().timeout(Duration.ofMinutes(3)).header("Accept", "video/*")
                                .build(), HttpResponse.BodyHandlers.ofInputStream());
                int status = response.statusCode();
                if (status >= 300 && status < 400) {
                    String location = response.headers().firstValue("location").orElseThrow(() -> new IllegalArgumentException("下载地址重定向缺少目标"));
                    response.body().close();
                    uri = validatePublicHttpUri(uri.resolve(location).toString());
                    continue;
                }
                if (status != 200) {
                    response.body().close();
                    throw new IllegalArgumentException("下载媒体失败，HTTP " + status);
                }
                String type = response.headers().firstValue("content-type").orElse("").toLowerCase(Locale.ROOT);
                if (type.contains("application/vnd.apple.mpegurl") || type.contains("application/dash+xml") || uri.getPath().endsWith(".m3u8") || uri.getPath().endsWith(".mpd")) {
                    response.body().close();
                    throw new IllegalArgumentException("公开 HLS/DASH 流已识别，但首期不会把分段流交给未受控下载器；请下载原文件后上传素材");
                }
                if (!type.isBlank() && ALLOWED_MIME_PREFIXES.stream().noneMatch(type::startsWith)) {
                    response.body().close();
                    throw new IllegalArgumentException("直链响应不是支持的视频类型");
                }
                long contentLength = response.headers().firstValueAsLong("content-length").orElse(-1L);
                if (contentLength > properties.getMaxDownloadBytes()) {
                    response.body().close();
                    throw new IllegalArgumentException("直链视频超过下载大小限制");
                }
                Path output = paths.source(projectId, itemId);
                paths.ensureParent(output);
                temp = output.resolveSibling(output.getFileName() + ".part");
                try (InputStream input = response.body(); var stream = Files.newOutputStream(temp)) {
                    byte[] buffer = new byte[8192];
                    long total = 0;
                    for (int n; (n = input.read(buffer)) >= 0;) {
                        total += n;
                        if (total > properties.getMaxDownloadBytes()) throw new IllegalArgumentException("直链视频超过下载大小限制");
                        stream.write(buffer, 0, n);
                    }
                }
                requireVideo(temp);
                replace(temp, output);
                projectService.updateSource(projectId, itemId, "DIRECT_URL", "READY", paths.store(projectId, output), uri.toString(), null);
                return;
            }
            throw new IllegalArgumentException("媒体重定向次数超过限制");
        } catch (Exception e) {
            deleteQuietly(temp);
            fail(projectId, itemId, e);
        }
    }

    public HighlightProjectItem upload(long projectId, long itemId, MultipartFile file) {
        projectService.requireItem(projectId, itemId);
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("上传素材不能为空");
        if (file.getSize() > properties.getMaxUploadBytes()) throw new IllegalArgumentException("上传素材超过大小限制");
        String extension = extension(file.getOriginalFilename());
        if (!properties.getAllowedVideoExtensions().contains(extension)) throw new IllegalArgumentException("上传素材格式不受支持");
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!contentType.isBlank() && ALLOWED_MIME_PREFIXES.stream().noneMatch(contentType::startsWith)) {
            throw new IllegalArgumentException("上传素材 MIME 类型不受支持");
        }
        Path output = paths.upload(projectId, itemId, extension);
        Path temp = output.resolveSibling(output.getFileName() + ".part");
        try {
            paths.ensureParent(output);
            file.transferTo(temp);
            requireDecodableVideo(temp);
            replace(temp, output);
            projectService.updateSource(projectId, itemId, "UPLOAD", "READY", paths.store(projectId, output), null, null);
        } catch (IOException e) {
            deleteQuietly(temp);
            throw new IllegalArgumentException("保存上传素材失败");
        }
        return projectService.requireItem(projectId, itemId);
    }

    public String uploadBgm(long projectId, MultipartFile file) {
        projectService.requireProject(projectId);
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("背景音乐不能为空");
        if (file.getSize() > properties.getMaxUploadBytes()) throw new IllegalArgumentException("背景音乐超过大小限制");
        String extension = extension(file.getOriginalFilename());
        if (!properties.getAllowedAudioExtensions().contains(extension)) throw new IllegalArgumentException("背景音乐格式不受支持");
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!contentType.isBlank() && !contentType.startsWith("audio/")) throw new IllegalArgumentException("背景音乐 MIME 类型不受支持");
        Path output = paths.bgm(projectId, extension);
        Path temp = output.resolveSibling(output.getFileName() + ".part");
        try {
            paths.ensureParent(output);
            file.transferTo(temp);
            if (!Files.isRegularFile(temp) || Files.size(temp) < 1024) throw new IOException("背景音乐文件无效");
            replace(temp, output);
            return paths.store(projectId, output);
        } catch (IOException e) {
            deleteQuietly(temp);
            throw new IllegalArgumentException("保存背景音乐失败");
        }
    }

    public String bgmPath(long projectId) {
        for (String extension : properties.getAllowedAudioExtensions()) {
            Path path = paths.bgm(projectId, extension);
            if (Files.isRegularFile(path)) return paths.store(projectId, path);
        }
        return null;
    }

    private static URI validatePublicHttpUri(String rawUrl) {
        try {
            URI uri = URI.create(rawUrl == null ? "" : rawUrl.trim());
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalArgumentException("只允许 HTTP(S) 媒体直链");
            }
            if (uri.getUserInfo() != null || uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("媒体直链格式非法");
            }
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (isPrivate(address)) throw new IllegalArgumentException("媒体直链不能指向本机或私有网络地址");
            }
            return uri;
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("无法解析媒体直链域名");
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("媒体直链格式非法");
        }
    }

    private static boolean isPrivate(InetAddress address) {
        return address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress();
    }

    private static boolean sameRange(HighlightProjectItem item, Clip clip) {
        if (clip.getTimestampSec() == null || item.getInSec() == null || item.getOutSec() == null) return false;
        Double end = clip.getEndSec() != null ? clip.getEndSec() : clip.getVideoDuration();
        return end != null && Math.abs(item.getInSec() - clip.getTimestampSec()) < 0.001
                && Math.abs(item.getOutSec() - end) < 0.001;
    }

    private void validateRange(HighlightProjectItem item) {
        if (item.getInSec() == null || item.getOutSec() == null || item.getInSec() < 0 || item.getOutSec() <= item.getInSec()) {
            throw new IllegalArgumentException("制作稿片段没有合法的开始/结束时间");
        }
    }

    private void runFfmpeg(List<String> command) throws IOException, InterruptedException {
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        Thread outputDrainer = new Thread(() -> {
            try { process.getInputStream().transferTo(java.io.OutputStream.nullOutputStream()); }
            catch (IOException ignored) { }
        }, "highlight-source-output");
        outputDrainer.setDaemon(true);
        outputDrainer.start();
        if (!process.waitFor(properties.getTaskTimeoutSec(), java.util.concurrent.TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IllegalStateException("准备素材超时");
        }
        if (process.exitValue() != 0) throw new IllegalStateException("准备素材失败，ffmpeg 退出码 " + process.exitValue());
    }

    private void requireDecodableVideo(Path path) throws IOException {
        requireVideo(path);
        try {
            Process process = new ProcessBuilder(properties.getFfmpegPath(), "-v", "error", "-i", path.toString(), "-f", "null", "-")
                    .redirectErrorStream(true).start();
            try (var input = process.getInputStream()) {
                input.transferTo(java.io.OutputStream.nullOutputStream());
            }
            if (!process.waitFor(60, java.util.concurrent.TimeUnit.SECONDS) || process.exitValue() != 0) {
                throw new IOException("上传文件不是可解码的视频");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("校验上传视频时被中断", e);
        }
    }

    private static void requireVideo(Path path) throws IOException {
        if (!Files.isRegularFile(path) || Files.size(path) < 1024) throw new IOException("未获得有效视频素材");
    }

    private static void replace(Path temp, Path output) throws IOException {
        try { Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
        catch (java.nio.file.AtomicMoveNotSupportedException e) { Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING); }
    }

    private void fail(long projectId, long itemId, Exception e) {
        try {
            HighlightProjectItem item = projectService.requireItem(projectId, itemId);
            projectService.updateSource(projectId, itemId, item.getSourceType(), "FAILED", null, item.getSourceUrl(), message(e));
        }
        catch (RuntimeException ignored) { }
    }

    private static String extension(String name) {
        String lower = name == null ? "" : name.toLowerCase(Locale.ROOT);
        int dot = lower.lastIndexOf('.');
        return dot < 0 ? "" : lower.substring(dot + 1);
    }

    private static void deleteQuietly(Path path) {
        if (path == null) return;
        try { Files.deleteIfExists(path); } catch (IOException ignored) { }
    }

    private static String format(double value) {
        return String.format(Locale.ROOT, "%.3f", value);
    }

    private static String message(Exception e) {
        return e.getMessage() == null || e.getMessage().isBlank() ? "准备素材失败" : e.getMessage();
    }
}
