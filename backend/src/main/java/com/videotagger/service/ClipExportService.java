package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class ClipExportService {
    private final ClipMapper clipMapper;
    private final ClipExportProperties properties;
    private final LocalVideoResolver videoResolver;
    private final ConcurrentHashMap<Long, ClipExportTask> tasks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> active = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Process> processes = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong(1);

    @Lazy
    @Autowired
    private ClipExportService self;

    public ClipExportService(ClipMapper clipMapper, ClipExportProperties properties,
                             LocalVideoResolver videoResolver) {
        this.clipMapper = clipMapper;
        this.properties = properties;
        this.videoResolver = videoResolver;
    }

    public ClipExportTask createVideo(long clipId) {
        Clip clip = requireClip(clipId);
        validateVideoRange(clip);
        return create(clip, "video");
    }

    public ClipExportTask createSingleFrame(long clipId, SingleFrameExportRequest request) {
        Clip clip = requireClip(clipId);
        double time = frameTime(clip, request);
        if (time < 0 || (clip.getVideoDuration() != null && time > clip.getVideoDuration())) {
            throw new IllegalArgumentException("截图时间超出视频范围");
        }
        return create(clip, "single-frame", request);
    }

    public ClipExportTask createSequence(long clipId, SequenceFrameExportRequest request) {
        Clip clip = requireClip(clipId);
        int interval = request == null ? 1 : request.interval();
        double duration = effectiveDuration(clip);
        if (duration <= 0) throw new IllegalArgumentException("没有结束时间，无法确定连续截图终点");
        int total = sequenceFrameCount(duration, interval);
        if (total > properties.getMaxSequenceFrames()) {
            throw new IllegalArgumentException("预计生成 " + total + " 张，超过最多 " + properties.getMaxSequenceFrames() + " 张限制，请增大间隔或缩短区间");
        }
        return create(clip, "sequence-frame", new SingleFrameExportRequest("middle", null), total, interval);
    }

    public ClipExportTask uploadBrowserVideo(long clipId, MultipartFile file, boolean manualStop) {
        Clip clip = requireClip(clipId);
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("上传视频不能为空");
        if (file.getSize() > properties.getBrowserMaxSizeBytes()) throw new IllegalArgumentException("上传视频超过大小限制");
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!name.endsWith(".webm") || !contentType.startsWith("video/webm")) {
            throw new IllegalArgumentException("浏览器回退只支持 video/webm");
        }
        try (var input = file.getInputStream()) {
            byte[] prefix = input.readNBytes(4);
            if (prefix.length < 4 || (prefix[0] & 0xff) != 0x1a || (prefix[1] & 0xff) != 0x45
                    || (prefix[2] & 0xff) != 0xdf || (prefix[3] & 0xff) != 0xa3) {
                throw new IllegalArgumentException("上传文件不是有效的 WebM");
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("读取上传视频失败");
        }
        String key = clipId + ":browser-video";
        synchronized (this) {
            Long old = active.get(key);
            if (old != null) return get(old);
            long taskId = sequence.getAndIncrement();
            ClipExportTask task = new ClipExportTask(taskId, clipId, "browser-video", "RUNNING", null,
                    null, System.currentTimeMillis(), 0, 0, 1, "上传中", manualStop ? "browser-manual-stop" : "browser");
            tasks.put(taskId, task);
            active.put(key, taskId);
            Path output = videoOutput(clipId, "webm");
            Path temp = output.resolveSibling(output.getFileName() + ".part-" + taskId);
            try {
                Files.createDirectories(output.getParent());
                file.transferTo(temp);
                replace(temp, output);
                try {
                    writeBrowserSource(clipId, manualStop ? "browser-manual-stop" : "browser");
                } catch (IOException ignored) {
                }
                finish(taskId, "SUCCEEDED", null, "/clip-videos/" + clipId + ".webm", 1, 1, "完成", manualStop ? "browser-manual-stop" : "browser");
            } catch (IOException e) {
                deleteQuietly(temp);
                finish(taskId, "FAILED", "上传视频失败", null, 0, 1, "失败", manualStop ? "browser-manual-stop" : "browser");
            } finally {
                active.remove(key, taskId);
            }
            return get(taskId);
        }
    }

    static int sequenceFrameCount(double duration, int interval) {
        return Math.max(1, (int) Math.ceil(duration / interval));
    }

    private ClipExportTask create(Clip clip, String type) {
        return create(clip, type, new SingleFrameExportRequest("middle", null));
    }

    private ClipExportTask create(Clip clip, String type, SingleFrameExportRequest frameRequest) {
        return create(clip, type, frameRequest, 0, 0);
    }

    private synchronized ClipExportTask create(Clip clip, String type, SingleFrameExportRequest frameRequest,
                                               int total, int interval) {
        String key = clip.getId() + ":" + type;
        long id = sequence.getAndIncrement();
        Long old = active.putIfAbsent(key, id);
        if (old != null) {
            return get(old);
        }
        ClipExportTask task = new ClipExportTask(id, clip.getId(), type, "PENDING", null,
                null, System.currentTimeMillis(), 0, 0, total, "排队中", "local");
        tasks.put(id, task);
        active.put(key, id);
        try {
            if ("video".equals(type)) {
                self.runVideoAsync(id, clip);
            } else if ("sequence-frame".equals(type)) {
                self.runSequenceAsync(id, clip, interval, total);
            } else {
                self.runFrameAsync(id, clip, frameRequest);
            }
        } catch (RuntimeException e) {
            active.remove(key, id);
            finish(id, "FAILED", e.getMessage(), null);
            throw e;
        }
        return task;
    }

    @Async("clipExportExecutor")
    public void runVideoAsync(long taskId, Clip clip) {
        if ("CANCELLED".equals(get(taskId).status())) {
            complete(clip.getId(), "video", taskId);
            return;
        }
        Path temp = null;
        try {
            Path input = videoResolver.resolve(clip.getVideoFp());
            Path output = videoOutput(clip.getId(), "mp4");
            Files.createDirectories(output.getParent());
            temp = output.resolveSibling(output.getFileName() + ".part");
            Files.deleteIfExists(temp);
            double start = clip.getTimestampSec();
            double duration = effectiveDuration(clip);
            List<String> command = new ArrayList<>(List.of(
                    properties.getFfmpegPath(), "-y", "-ss", format(start), "-i", input.toString(),
                    "-t", format(duration), "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                    "-c:a", "aac", "-movflags", "+faststart", "-f", "mp4", temp.toString()));
            runProcess(taskId, command);
            if ("CANCELLED".equals(get(taskId).status())) throw new IllegalStateException("已取消");
            requireNonEmpty(temp);
            replace(temp, output);
            finish(taskId, "SUCCEEDED", null, "/clip-videos/" + clip.getId() + ".mp4");
        } catch (Exception e) {
            deleteQuietly(temp);
            if (!"CANCELLED".equals(get(taskId).status())) {
                finish(taskId, "FAILED", message(e), null);
            }
        } finally {
            complete(clip.getId(), "video", taskId);
        }
    }

    @Async("clipExportExecutor")
    public void runFrameAsync(long taskId, Clip clip, SingleFrameExportRequest request) {
        if ("CANCELLED".equals(get(taskId).status())) {
            complete(clip.getId(), "single-frame", taskId);
            return;
        }
        Path temp = null;
        try {
            Path input = videoResolver.resolve(clip.getVideoFp());
            Path output = frameOutput(clip.getId());
            Files.createDirectories(output.getParent());
            temp = output.resolveSibling(output.getFileName() + ".part");
            Files.deleteIfExists(temp);
            double time = frameTime(clip, request);
            List<String> command = List.of(properties.getFfmpegPath(), "-y", "-ss", format(time),
                    "-i", input.toString(), "-frames:v", "1", "-q:v", "2", "-f", "image2", temp.toString());
            runProcess(taskId, command);
            if ("CANCELLED".equals(get(taskId).status())) throw new IllegalStateException("已取消");
            requireNonEmpty(temp);
            replace(temp, output);
            finish(taskId, "SUCCEEDED", null, "/clip-images/" + clip.getId() + "/single.jpg");
        } catch (Exception e) {
            deleteQuietly(temp);
            if (!"CANCELLED".equals(get(taskId).status())) {
                finish(taskId, "FAILED", message(e), null);
            }
        } finally {
            complete(clip.getId(), "single-frame", taskId);
        }
    }

    @Async("clipExportExecutor")
    public void runSequenceAsync(long taskId, Clip clip, int interval, int total) {
        if ("CANCELLED".equals(get(taskId).status())) {
            complete(clip.getId(), "sequence-frame", taskId);
            return;
        }
        Path tempDir = null;
        try {
            Path input = videoResolver.resolve(clip.getVideoFp());
            Path outputDir = sequenceOutputDir(clip.getId());
            tempDir = outputDir.resolveSibling(outputDir.getFileName() + ".part-" + taskId);
            deleteQuietly(tempDir);
            Files.createDirectories(tempDir);
            updateProgress(taskId, 0, total, "生成截图");
            double duration = effectiveDuration(clip);
            String framePattern = tempDir.resolve("frame-%04d.jpg").toString();
            List<String> command = List.of(properties.getFfmpegPath(), "-y", "-ss", format(clip.getTimestampSec()),
                    "-i", input.toString(), "-t", format(duration), "-vf", "fps=1/" + interval,
                    "-q:v", "2", "-start_number", "1", framePattern);
            Path renderDir = tempDir;
            runProcess(taskId, command, () -> updateProgress(taskId, safeFrameCount(renderDir), total, "生成截图"));
            if ("CANCELLED".equals(get(taskId).status())) throw new IllegalStateException("已取消");
            int count = countFrames(tempDir);
            if (count == 0) throw new IOException("ffmpeg 未生成有效截图");
            if (count > properties.getMaxSequenceFrames()) throw new IllegalStateException("截图数量超过限制");
            updateProgress(taskId, count, total, "替换产物");
            replaceDirectory(tempDir, outputDir, taskId);
            tempDir = null;
            finish(taskId, "SUCCEEDED", null, "/clip-images/" + clip.getId() + "/", count, total, "完成", "local");
        } catch (Exception e) {
            deleteQuietly(tempDir);
            if (!"CANCELLED".equals(get(taskId).status())) {
                finish(taskId, "FAILED", message(e), null, 0, total, "失败", "local");
            }
        } finally {
            complete(clip.getId(), "sequence-frame", taskId);
        }
    }

    public ClipExportTask get(long taskId) {
        ClipExportTask task = tasks.get(taskId);
        if (task == null) throw new NoSuchElementException("导出任务不存在: " + taskId);
        return task;
    }

    public ClipExportTask cancel(long taskId) {
        ClipExportTask task = get(taskId);
        if ("PENDING".equals(task.status()) || "RUNNING".equals(task.status())) {
            Process process = processes.get(taskId);
            if (process != null) process.destroyForcibly();
            finish(taskId, "CANCELLED", "已取消", null);
        }
        return get(taskId);
    }

    public List<ClipExportArtifact> artifacts(long clipId) {
        List<ClipExportArtifact> result = new ArrayList<>();
        addArtifact(result, videoOutput(clipId, "mp4"), "video", "local");
        addArtifact(result, videoOutput(clipId, "webm"), "browser-video", browserSource(clipId));
        addArtifact(result, frameOutput(clipId), "single-frame", "local");
        addSequenceArtifact(result, sequenceOutputDir(clipId));
        return result;
    }

    public void deleteArtifact(long clipId, String artifact) {
        Path path = switch (artifact) {
            case "video" -> videoOutput(clipId, "mp4");
            case "browser-video" -> videoOutput(clipId, "webm");
            case "single-frame" -> frameOutput(clipId);
            case "sequence-frame" -> sequenceOutputDir(clipId);
            default -> throw new IllegalArgumentException("不支持的导出产物类型");
        };
        deleteQuietly(path);
        if ("browser-video".equals(artifact)) deleteQuietly(browserSourceFile(clipId));
    }

    public void deleteArtifacts(long clipId) {
        active.entrySet().stream().filter(entry -> entry.getKey().startsWith(clipId + ":"))
                .map(Map.Entry::getValue).toList().forEach(this::cancel);
        deleteQuietly(videoOutput(clipId, "mp4"));
        deleteQuietly(videoOutput(clipId, "webm"));
        deleteQuietly(browserSourceFile(clipId));
        deleteQuietly(frameOutput(clipId));
        deleteQuietly(sequenceOutputDir(clipId));
        deleteQuietly(frameOutput(clipId).getParent());
    }

    private Clip requireClip(long clipId) {
        Clip clip = clipMapper.selectById(clipId);
        if (clip == null) throw new NoSuchElementException("clip not found: " + clipId);
        return clip;
    }

    private void validateVideoRange(Clip clip) {
        if (clip.getTimestampSec() == null) throw new IllegalArgumentException("片段没有开始时间");
        double duration = effectiveDuration(clip);
        if (duration <= 0) throw new IllegalArgumentException("没有结束时间，无法确定视频导出终点");
        if (duration > properties.getMaxDurationSec()) throw new IllegalArgumentException("导出时长超过 30 分钟上限");
    }

    private double effectiveDuration(Clip clip) {
        if (clip.getEndSec() != null) return clip.getEndSec() - clip.getTimestampSec();
        if (clip.getVideoDuration() != null) return clip.getVideoDuration() - clip.getTimestampSec();
        throw new IllegalArgumentException("没有结束时间，无法确定视频导出终点");
    }

    static double frameTime(Clip clip, SingleFrameExportRequest request) {
        String strategy = request == null || request.strategy() == null ? "middle" : request.strategy();
        return switch (strategy) {
            case "start" -> clip.getTimestampSec();
            case "end" -> clip.getEndSec() == null ? clip.getTimestampSec() : clip.getEndSec();
            case "custom" -> {
                if (request.timeSec() == null) throw new IllegalArgumentException("custom 截图必须提供时间");
                yield request.timeSec();
            }
            case "middle" -> clip.getEndSec() == null
                    ? clip.getTimestampSec()
                    : (clip.getTimestampSec() + clip.getEndSec()) / 2;
            default -> throw new IllegalArgumentException("不支持的截图时间策略");
        };
    }

    private void runProcess(long taskId, List<String> command) throws IOException, InterruptedException {
        runProcess(taskId, command, null);
    }

    private void runProcess(long taskId, List<String> command, Runnable progressUpdater) throws IOException, InterruptedException {
        updateStatus(taskId, "RUNNING", null);
        if ("CANCELLED".equals(get(taskId).status())) {
            throw new IllegalStateException("已取消");
        }
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        processes.put(taskId, process);
        Thread outputDrainer = new Thread(() -> {
            try { process.getInputStream().transferTo(java.io.OutputStream.nullOutputStream()); }
            catch (IOException ignored) { }
        }, "clip-export-output-" + taskId);
        outputDrainer.setDaemon(true);
        outputDrainer.start();
        try {
            long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(properties.getTaskTimeoutSec());
            while (!process.waitFor(500, java.util.concurrent.TimeUnit.MILLISECONDS)) {
                if (progressUpdater != null) progressUpdater.run();
                if (System.nanoTime() >= deadline) {
                    process.destroyForcibly();
                    throw new IllegalStateException("ffmpeg 执行超时");
                }
            }
            if (progressUpdater != null) progressUpdater.run();
            if (process.exitValue() != 0) throw new IllegalStateException("ffmpeg 导出失败，退出码 " + process.exitValue());
        } finally {
            processes.remove(taskId, process);
        }
    }

    private void updateStatus(long id, String status, String message) {
        ClipExportTask old = get(id);
        if ("CANCELLED".equals(old.status())) {
            return;
        }
        tasks.put(id, new ClipExportTask(id, old.clipId(), old.type(), status, message,
                old.artifactUrl(), old.createdAt(), old.finishedAt(), old.progress(), old.total(), old.phase(), old.source()));
    }

    private void updateProgress(long id, int progress, int total, String phase) {
        ClipExportTask old = get(id);
        if ("CANCELLED".equals(old.status())) return;
        tasks.put(id, new ClipExportTask(id, old.clipId(), old.type(), old.status(), old.message(),
                old.artifactUrl(), old.createdAt(), old.finishedAt(), progress, total, phase, old.source()));
    }

    private void finish(long id, String status, String message, String url) {
        ClipExportTask old = tasks.get(id);
        if (old == null) return;
        finish(id, status, message, url, old.progress(), old.total(),
                "SUCCEEDED".equals(status) ? "完成" : status, old.source());
    }

    private void finish(long id, String status, String message, String url, int progress, int total,
                        String phase, String source) {
        ClipExportTask old = tasks.get(id);
        if (old == null) return;
        tasks.put(id, new ClipExportTask(id, old.clipId(), old.type(), status, message, url,
                old.createdAt(), System.currentTimeMillis(), progress, total, phase, source));
    }

    private void complete(long clipId, String type, long taskId) {
        active.remove(clipId + ":" + type, taskId);
    }

    private Path videoOutput(long clipId, String extension) {
        return Path.of(properties.getVideoOutputDir()).toAbsolutePath().normalize().resolve(clipId + "." + extension);
    }

    private Path frameOutput(long clipId) {
        return Path.of(properties.getImageOutputDir()).toAbsolutePath().normalize()
                .resolve(Long.toString(clipId)).resolve("single.jpg");
    }

    private Path sequenceOutputDir(long clipId) {
        return Path.of(properties.getImageOutputDir()).toAbsolutePath().normalize()
                .resolve(Long.toString(clipId)).resolve("sequence");
    }

    private Path browserSourceFile(long clipId) {
        return Path.of(properties.getVideoOutputDir()).toAbsolutePath().normalize().resolve(clipId + ".webm.source");
    }

    private void writeBrowserSource(long clipId, String source) throws IOException {
        Files.writeString(browserSourceFile(clipId), source, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    private String browserSource(long clipId) {
        try {
            String source = Files.readString(browserSourceFile(clipId)).trim();
            return source.equals("browser-manual-stop") ? source : "browser";
        } catch (IOException ignored) {
            return "browser";
        }
    }

    private static int countFrames(Path directory) throws IOException {
        try (var stream = Files.list(directory)) {
            return (int) stream.filter(path -> path.getFileName().toString().matches("frame-\\d{4}\\.jpg"))
                    .filter(path -> {
                        try { return Files.size(path) > 0; } catch (IOException ignored) { return false; }
                    }).count();
        }
    }

    private static int safeFrameCount(Path directory) {
        try { return countFrames(directory); } catch (IOException ignored) { return 0; }
    }

    private void replaceDirectory(Path temp, Path output, long taskId) throws IOException {
        Path old = output.resolveSibling(output.getFileName() + ".old-" + taskId);
        deleteQuietly(old);
        if (Files.exists(output)) Files.move(output, old, StandardCopyOption.REPLACE_EXISTING);
        try {
            Files.move(temp, output, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            if (Files.exists(old) && !Files.exists(output)) Files.move(old, output, StandardCopyOption.REPLACE_EXISTING);
            throw e;
        }
        deleteQuietly(old);
    }

    private static void requireNonEmpty(Path path) throws IOException {
        if (path == null || !Files.isRegularFile(path) || Files.size(path) == 0) {
            throw new IOException("ffmpeg 未生成有效产物");
        }
    }

    private static void replace(Path temp, Path output) throws IOException {
        try {
            Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            if (Files.isDirectory(path)) {
                try (var stream = Files.list(path)) { stream.forEach(ClipExportService::deleteQuietly); }
            }
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }

    private void addArtifact(List<ClipExportArtifact> result, Path path, String type, String source) {
        try {
            if (Files.isRegularFile(path)) {
                String url = "browser-video".equals(type)
                        ? "/clip-videos/" + path.getFileName()
                        : "single-frame".equals(type)
                        ? "/clip-images/" + path.getParent().getFileName() + "/" + path.getFileName()
                        : "/clip-videos/" + path.getFileName();
                result.add(new ClipExportArtifact(type, url, path.getFileName().toString(),
                        Files.size(path), Files.getLastModifiedTime(path).toMillis(), 0, source));
            }
        } catch (IOException ignored) {
        }
    }

    private void addSequenceArtifact(List<ClipExportArtifact> result, Path directory) {
        try {
            int count = countFrames(directory);
            if (count == 0) return;
            long size;
            try (var stream = Files.list(directory)) {
                size = stream.filter(Files::isRegularFile).mapToLong(path -> {
                    try { return Files.size(path); } catch (IOException ignored) { return 0L; }
                }).sum();
            }
            result.add(new ClipExportArtifact("sequence-frame", "/clip-images/" + directory.getParent().getFileName() + "/sequence/frame-0001.jpg",
                    "连续截图", size, Files.getLastModifiedTime(directory).toMillis(), count, "local"));
        } catch (IOException ignored) {
        }
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 3_600_000)
    public void cleanupStaleTemporaries() {
        long threshold = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        cleanupTemporaryEntries(Path.of(properties.getVideoOutputDir()).toAbsolutePath().normalize(), threshold);
        cleanupTemporaryEntries(Path.of(properties.getImageOutputDir()).toAbsolutePath().normalize(), threshold);
    }

    private static void cleanupTemporaryEntries(Path directory, long threshold) {
        if (!Files.exists(directory)) return;
        try (var stream = Files.walk(directory, 2)) {
            stream.filter(path -> !path.equals(directory)).filter(path -> {
                String name = path.getFileName().toString();
                return name.contains(".part") || name.contains(".old-") || name.contains(".tmp-");
            }).filter(path -> {
                try { return Files.getLastModifiedTime(path).toMillis() < threshold; }
                catch (IOException ignored) { return false; }
            }).sorted(Comparator.reverseOrder()).forEach(ClipExportService::deleteQuietly);
        } catch (IOException ignored) {
        }
    }

    private static String format(double value) {
        return String.format(Locale.ROOT, "%.3f", value);
    }

    private static String message(Exception e) {
        return e.getMessage() == null || e.getMessage().isBlank() ? "导出失败" : e.getMessage();
    }
}
