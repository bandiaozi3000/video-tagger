package com.videotagger.service;

import com.videotagger.entity.HighlightExport;
import com.videotagger.entity.HighlightProject;
import com.videotagger.entity.HighlightProjectItem;
import com.videotagger.mapper.HighlightExportMapper;
import com.videotagger.mapper.HighlightProjectItemMapper;
import com.videotagger.mapper.HighlightProjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
public class HighlightExportService {
    private static final Map<String, int[]> RESOLUTIONS = Map.of(
            "720P", new int[]{1280, 720},
            "1080P", new int[]{1920, 1080},
            "4K", new int[]{3840, 2160});
    private static final Map<String, Process> PROCESSES = new ConcurrentHashMap<>();
    private volatile Boolean xfadeSupported;

    private final HighlightExportMapper exportMapper;
    private final HighlightProjectMapper projectMapper;
    private final HighlightProjectItemMapper itemMapper;
    private final HighlightProperties properties;
    private final HighlightPaths paths;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final HighlightStyleCompiler styleCompiler;
    private final HighlightCardRenderer cardRenderer;

    @Lazy
    @Autowired
    private HighlightExportService self;

    public HighlightExportService(HighlightExportMapper exportMapper, HighlightProjectMapper projectMapper,
                                  HighlightProjectItemMapper itemMapper, HighlightProperties properties,
                                  com.fasterxml.jackson.databind.ObjectMapper objectMapper, HighlightStyleCompiler styleCompiler,
                                  HighlightCardRenderer cardRenderer) {
        this.exportMapper = exportMapper;
        this.projectMapper = projectMapper;
        this.itemMapper = itemMapper;
        this.properties = properties;
        this.paths = new HighlightPaths(properties);
        this.objectMapper = objectMapper;
        this.styleCompiler = styleCompiler;
        this.cardRenderer = cardRenderer;
    }

    public HighlightExportView create(long projectId, ExportRequest request) {
        HighlightProject project = requireProject(projectId);
        String mode = normalizeMode(request == null ? null : request.mode());
        String resolution = normalizeResolution(request == null ? null : request.resolution());
        List<HighlightProjectItem> selected = selectableItems(projectId, mode);
        validateReady(selected);
        validateDuration(selected);
        long now = System.currentTimeMillis();
        HighlightExport export = new HighlightExport();
        export.setProjectId(projectId);
        export.setMode(mode);
        styleCompiler.compile(project.getConfigJson());
        export.setSnapshotJson(snapshot(project, selected, mode, resolution, request));
        export.setStatus("PENDING");
        export.setCreatedAt(now);
        exportMapper.insert(export);
        self.runAsync(export.getId());
        return view(exportMapper.selectById(export.getId()));
    }

    @Async("highlightExportExecutor")
    public void runAsync(long exportId) {
        HighlightExport export = requireExport(exportId);
        ExportSnapshot snapshot = snapshotOf(export);
        styleCompiler.compile(snapshot.styleJson());
        Path temp = null;
        try {
            update(export, "RUNNING", "准备素材", null, "准备素材", null, 0);
            List<HighlightProjectItem> selected = snapshot.items();
            validateReady(selected);
            int[] size = RESOLUTIONS.get(snapshot.resolution());
            HighlightStyleCompiler.ScenePlan scenePlan = styleCompiler.plan(snapshot.styleJson(), export.getProjectId(), snapshot.items());
            update(export, "RUNNING", "准备素材", null, "准备素材", "场景数 " + scenePlan.scenes().size(), 0);
            List<Path> normalized = new ArrayList<>();
            Map<Long, Path> normalizedByItem = new LinkedHashMap<>();
            for (HighlightProjectItem item : selected) {
                ensureNotCancelled(exportId);
                Path source = paths.fromStoredPath(export.getProjectId(), item.getSourcePath());
                Path output = paths.normalized(export.getProjectId(), exportId, item.getId());
                update(export, "RUNNING", "标准化片段", null, "标准化片段", "片段 #" + item.getId(), 0);
                normalizeItem(exportId, source, output, size, item.getOriginalVolume());
                normalized.add(output);
                normalizedByItem.put(item.getId(), output);
            }
            ensureNotCancelled(exportId);
            Path output = paths.export(export.getProjectId(), exportId);
            paths.ensureParent(output);
            temp = output.resolveSibling(output.getFileName() + ".part.mp4");
            Files.deleteIfExists(temp);
            update(export, "RUNNING", "生成视觉场景", null, "视觉场景", null, 0);
            List<RenderedScene> scenes = renderScenes(export.getProjectId(), exportId, projectMediaId(snapshot), scenePlan, snapshot.items(), normalizedByItem, size);
            update(export, "RUNNING", "拼接与混音", null, "拼接与混音", "场景数 " + scenes.size(), 0);
            if ("none".equals(scenePlan.style().transitionRenderer()) || !supportsXfade()) {
                concatAndMix(exportId, export.getProjectId(), scenes, temp, snapshot.bgmPath(), snapshot.bgmVolume(), scenePlan);
            } else {
                transitionAndMix(exportId, export.getProjectId(), scenes, temp, snapshot.bgmPath(), snapshot.bgmVolume(), scenePlan);
            }
            requireNonEmpty(temp);
            replace(temp, output);
            update(export, "DONE", null, paths.store(export.getProjectId(), output), "完成", null, System.currentTimeMillis());
        } catch (Exception e) {
            deleteQuietly(temp);
            HighlightExport current = exportMapper.selectById(exportId);
            if (current != null && !"CANCELLED".equals(current.getStatus())) {
                update(current, "ERROR", message(e), null, "失败", current.getSceneMessage(), System.currentTimeMillis());
            }
        } finally {
            PROCESSES.remove(String.valueOf(exportId));
        }
    }

    public HighlightExportView get(long exportId) {
        return view(requireExport(exportId));
    }

    public List<HighlightExportView> list(long projectId) {
        return exportMapper.listByProjectId(projectId).stream().map(this::view).toList();
    }

    public HighlightExportView cancel(long exportId) {
        HighlightExport export = requireExport(exportId);
        if ("PENDING".equals(export.getStatus()) || "RUNNING".equals(export.getStatus())) {
            Process process = PROCESSES.get(String.valueOf(exportId));
            if (process != null) process.destroyForcibly();
            update(export, "CANCELLED", "已取消", null, "已取消", export.getSceneMessage(), System.currentTimeMillis());
        }
        return get(exportId);
    }

    public Path outputPath(long exportId) {
        HighlightExport export = requireExport(exportId);
        if (!"DONE".equals(export.getStatus()) || export.getOutputPath() == null) {
            throw new IllegalStateException("成片尚未生成");
        }
        Path path = paths.fromStoredPath(export.getProjectId(), export.getOutputPath());
        if (!Files.isRegularFile(path)) throw new IllegalStateException("成片文件不存在");
        return path;
    }

    public void delete(long exportId) {
        HighlightExport export = requireExport(exportId);
        if ("RUNNING".equals(export.getStatus()) || "PENDING".equals(export.getStatus())) cancel(exportId);
        if (export.getOutputPath() != null) deleteQuietly(paths.fromStoredPath(export.getProjectId(), export.getOutputPath()));
        exportMapper.deleteById(exportId);
    }

    private void normalizeItem(long exportId, Path source, Path output, int[] size, Integer originalVolume) throws IOException, InterruptedException {
        paths.ensureParent(output);
        Path temp = output.resolveSibling(output.getFileName() + ".part.mp4");
        Files.deleteIfExists(temp);
        String videoFilter = "[0:v]scale=" + size[0] + ":" + size[1] + ":force_original_aspect_ratio=increase,"
                + "crop=" + size[0] + ":" + size[1] + ",boxblur=20:5[bg];"
                + "[0:v]scale=" + size[0] + ":" + size[1] + ":force_original_aspect_ratio=decrease[fg];"
                + "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]";
        List<String> command = new ArrayList<>(List.of(properties.getFfmpegPath(), "-y", "-i", source.toString()));
        if (hasAudioStream(source)) {
            command.addAll(List.of("-filter_complex", videoFilter, "-map", "[v]", "-map", "0:a:0", "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                    "-c:a", "aac", "-ar", "48000", "-ac", "2", "-af", "volume=" + (Math.max(0, Math.min(100, originalVolume == null ? 100 : originalVolume)) / 100.0)));
        } else {
            command.addAll(List.of("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                    "-filter_complex", videoFilter, "-map", "[v]", "-map", "1:a:0", "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest"));
        }
        command.addAll(List.of("-movflags", "+faststart", "-f", "mp4", temp.toString()));
        runProcess(exportId, command);
        requireNonEmpty(temp);
        replace(temp, output);
    }

    private boolean hasAudioStream(Path source) {
        try {
            Process process = new ProcessBuilder(properties.getFfmpegPath(), "-i", source.toString())
                    .redirectErrorStream(true).start();
            String output;
            try (var input = process.getInputStream()) {
                output = new String(input.readAllBytes(), StandardCharsets.UTF_8);
            }
            if (!process.waitFor(30, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IllegalStateException("音轨探测超时");
            }
            return output.contains("Audio:");
        } catch (Exception e) {
            throw new IllegalStateException("无法检查素材音轨", e);
        }
    }

    private boolean supportsXfade() {
        if (xfadeSupported != null) return xfadeSupported;
        try {
            Process process = new ProcessBuilder(properties.getFfmpegPath(), "-hide_banner", "-filters")
                    .redirectErrorStream(true).start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            process.waitFor(30, TimeUnit.SECONDS);
            xfadeSupported = output.contains(" xfade ") && output.contains(" acrossfade ");
        } catch (Exception e) {
            xfadeSupported = false;
        }
        return xfadeSupported;
    }

    private long projectMediaId(ExportSnapshot snapshot) {
        return snapshot.mediaId();
    }

    private List<RenderedScene> renderScenes(long projectId, long exportId, long mediaId,
                                             HighlightStyleCompiler.ScenePlan plan, List<HighlightProjectItem> items,
                                             Map<Long, Path> normalizedByItem, int[] size) throws IOException, InterruptedException {
        List<RenderedScene> scenes = new ArrayList<>();
        int index = 0;
        for (HighlightStyleCompiler.Scene scene : plan.scenes()) {
            if ("transition".equals(scene.type()) && supportsXfade()) {
                index++;
                continue;
            }
            if ("clip".equals(scene.type())) {
                Path clip = normalizedByItem.get(scene.itemId());
                if (clip == null) throw new IllegalStateException("缺少片段场景素材：" + scene.itemId());
                scenes.add(new RenderedScene(clip, scene));
            } else {
                scenes.add(new RenderedScene(cardRenderer.render(projectId, exportId, mediaId, scene, index, items, size[0], size[1]), scene));
            }
            index++;
        }
        if (scenes.isEmpty()) throw new IllegalArgumentException("场景计划为空");
        return scenes;
    }

    private void transitionAndMix(long exportId, long projectId, List<RenderedScene> sources, Path output,
                                  String bgmPath, int bgmVolume, HighlightStyleCompiler.ScenePlan plan) throws IOException, InterruptedException {
        if (sources.size() == 1) {
            concatAndMix(exportId, projectId, sources, output, bgmPath, bgmVolume, plan);
            return;
        }
        List<String> command = new ArrayList<>(List.of(properties.getFfmpegPath(), "-y"));
        for (RenderedScene source : sources) command.addAll(List.of("-i", source.path().toString()));
        StringBuilder filters = new StringBuilder();
        String lastVideo = "[0:v]";
        String lastAudio = "[0:a]";
        double offset = sources.get(0).scene().durationMs() / 1000.0;
        double transition = plan.style().transitionDurationMs() / 1000.0;
        for (int i = 1; i < sources.size(); i++) {
            String videoOut = "v" + i;
            String audioOut = "a" + i;
            String transitionName = "crossfade".equals(plan.style().transitionRenderer()) ? "fade" : "fadeblack";
            filters.append(lastVideo).append("[").append(i).append(":v]xfade=transition=").append(transitionName)
                    .append(":duration=").append(String.format(Locale.ROOT, "%.3f", transition))
                    .append(":offset=").append(String.format(Locale.ROOT, "%.3f", Math.max(0, offset - transition)))
                    .append("[").append(videoOut).append("];" );
            filters.append(lastAudio).append("[").append(i).append(":a]acrossfade=d=")
                    .append(String.format(Locale.ROOT, "%.3f", transition)).append("[").append(audioOut).append("];" );
            lastVideo = "[" + videoOut + "]";
            lastAudio = "[" + audioOut + "]";
            offset += sources.get(i).scene().durationMs() - transition;
        }
        String mappedAudio = lastAudio;
        if (bgmPath != null && !bgmPath.isBlank()) {
            Path bgm = paths.fromStoredPath(projectId, bgmPath);
            if (!Files.isRegularFile(bgm)) throw new IllegalArgumentException("背景音乐文件不存在");
            command.addAll(List.of("-stream_loop", "-1", "-i", bgm.toString()));
            filters.append("[").append(sources.size()).append(":a]volume='").append(bgmExpression(plan, bgmVolume))
                    .append("'[bgm];").append(lastAudio).append("[bgm]amix=inputs=2:duration=first:dropout_transition=0[aout];");
            mappedAudio = "[aout]";
        }
        command.addAll(List.of("-filter_complex", filters.toString(), "-map", lastVideo, "-map", mappedAudio,
                "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", output.toString()));
        runProcess(exportId, command);
    }

    private record RenderedScene(Path path, HighlightStyleCompiler.Scene scene) { }

    private void concatAndMix(long exportId, long projectId, List<RenderedScene> sources, Path output,
                              String bgmPath, int bgmVolume, HighlightStyleCompiler.ScenePlan plan) throws IOException, InterruptedException {
        if (sources.isEmpty()) throw new IllegalArgumentException("没有可导出的片段");
        List<String> command = new ArrayList<>(List.of(properties.getFfmpegPath(), "-y"));
        for (RenderedScene source : sources) command.addAll(List.of("-i", source.path().toString()));
        StringBuilder filter = new StringBuilder();
        for (int i = 0; i < sources.size(); i++) {
            filter.append("[").append(i).append(":v][").append(i).append(":a]");
        }
        filter.append("concat=n=").append(sources.size()).append(":v=1:a=1[v][basea]");
        String mappedAudio = "[basea]";
        if (bgmPath != null && !bgmPath.isBlank()) {
            Path bgm = paths.fromStoredPath(projectId, bgmPath);
            if (!Files.isRegularFile(bgm)) throw new IllegalArgumentException("背景音乐文件不存在");
            command.addAll(List.of("-stream_loop", "-1", "-i", bgm.toString()));
            filter.append(";[").append(sources.size()).append(":a]volume='")
                    .append(bgmExpression(sources, bgmVolume)).append("'[bgm];[basea][bgm]amix=inputs=2:duration=first:dropout_transition=0[aout]");
            mappedAudio = "[aout]";
        }
        command.addAll(List.of("-filter_complex", filter.toString(), "-map", "[v]", "-map", mappedAudio,
                "-fflags", "+genpts", "-avoid_negative_ts", "make_zero", "-c:v", "libx264", "-preset", "fast",
                "-crf", "20", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", output.toString()));
        runProcess(exportId, command);
    }

    private static String concatPath(Path base, Path path) {
        Path normalizedBase = base.toAbsolutePath().normalize();
        Path normalizedPath = path.toAbsolutePath().normalize();
        String value = normalizedBase.relativize(normalizedPath).toString().replace('\\', '/');
        return value.replace("'", "'\\''");
    }

    private static String bgmExpression(List<RenderedScene> scenes, int bgmVolume) {
        double normal = Math.max(0, Math.min(100, bgmVolume)) / 100.0;
        double duck = normal * 0.2;
        String expression = String.format(Locale.ROOT, "%.4f", normal);
        long offset = 0;
        for (int i = scenes.size() - 1; i >= 0; i--) {
            RenderedScene scene = scenes.get(i);
            if ("clip".equals(scene.scene().type())) {
                String range = String.format(Locale.ROOT, "%.3f,%.3f", offset / 1000.0,
                        (offset + scene.scene().durationMs()) / 1000.0);
                expression = "if(between(t," + range + ")," + String.format(Locale.ROOT, "%.4f", duck) + "," + expression + ")";
            }
            offset += scene.scene().durationMs();
        }
        return expression;
    }

    private static String bgmExpression(HighlightStyleCompiler.ScenePlan plan, int bgmVolume) {
        return bgmExpression(plan.scenes().stream()
                .filter(scene -> !"transition".equals(scene.type()))
                .map(scene -> new RenderedScene(null, scene)).toList(), bgmVolume);
    }

    private record ProcessResult(int exitCode, String output) { }

    private ProcessResult runProcess(long exportId, List<String> command) throws IOException, InterruptedException {
        ensureNotCancelled(exportId);
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        PROCESSES.put(String.valueOf(exportId), process);
        StringBuilder output = new StringBuilder();
        Thread outputDrainer = new Thread(() -> {
            try (var reader = process.inputReader(StandardCharsets.UTF_8)) {
                reader.lines().forEach(line -> {
                    synchronized (output) {
                        if (output.length() > 16_000) output.delete(0, output.length() - 12_000);
                        output.append(line).append('\n');
                    }
                });
            } catch (IOException ignored) { }
        }, "highlight-export-output-" + exportId);
        outputDrainer.setDaemon(true);
        outputDrainer.start();
        try {
            if (!process.waitFor(properties.getTaskTimeoutSec(), TimeUnit.SECONDS)) {
                process.destroyForcibly();
                outputDrainer.join(1000);
                throw new IllegalStateException("高光导出超时：" + tail(output.toString()));
            }
            outputDrainer.join(1000);
            ensureNotCancelled(exportId);
            String logs = output.toString();
            if (process.exitValue() != 0) {
                throw new IllegalStateException("ffmpeg 导出失败，退出码 " + process.exitValue() + "：" + tail(logs));
            }
            return new ProcessResult(process.exitValue(), logs);
        } finally {
            PROCESSES.remove(String.valueOf(exportId), process);
        }
    }

    private static String tail(String text) {
        if (text == null || text.isBlank()) return "无 ffmpeg 输出";
        String normalized = text.strip();
        return normalized.length() <= 1200 ? normalized : normalized.substring(normalized.length() - 1200);
    }

    private List<HighlightProjectItem> selectableItems(long projectId, String mode) {
        return itemMapper.listByProjectId(projectId).stream()
                .filter(item -> "FULL".equals(mode) || "SAFE".equals(item.getSpoilerState()))
                .toList();
    }

    private void validateReady(List<HighlightProjectItem> items) {
        if (items.isEmpty()) throw new IllegalArgumentException("没有符合导出条件的片段");
        HighlightProjectItem unavailable = items.stream().filter(item -> !"READY".equals(item.getSourceState())).findFirst().orElse(null);
        if (unavailable != null) HighlightProjectRules.requireReady(unavailable);
    }

    private void validateDuration(List<HighlightProjectItem> items) {
        double total = items.stream().mapToDouble(item -> item.getOutSec() - item.getInSec()).sum();
        if (total > properties.getMaxDurationSec()) {
            throw new IllegalArgumentException("预计成片时长超过 " + Math.round(properties.getMaxDurationSec() / 60) + " 分钟安全上限");
        }
    }

    private String snapshot(HighlightProject project, List<HighlightProjectItem> items, String mode, String resolution,
                            ExportRequest request) {
        try {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("projectId", project.getId());
            snapshot.put("mediaId", project.getMediaId());
            snapshot.put("projectName", project.getName());
            snapshot.put("projectConfig", project.getConfigJson());
            snapshot.put("mode", mode);
            snapshot.put("resolution", resolution);
            snapshot.put("bgmPath", request == null ? null : request.bgmPath());
            snapshot.put("bgmVolume", request == null ? null : request.bgmVolume());
            snapshot.put("items", items);
            return objectMapper.writeValueAsString(snapshot);
        } catch (IOException e) {
            throw new IllegalStateException("保存导出快照失败", e);
        }
    }

    private ExportSnapshot snapshotOf(HighlightExport export) {
        try {
            var root = objectMapper.readTree(export.getSnapshotJson());
            String resolution = normalizeResolution(root.path("resolution").asText(null));
            String bgmPath = root.path("bgmPath").isTextual() ? root.path("bgmPath").asText() : null;
            int bgmVolume = root.path("bgmVolume").isInt() ? Math.max(0, Math.min(100, root.path("bgmVolume").asInt())) : 24;
            List<HighlightProjectItem> items = objectMapper.readerForListOf(HighlightProjectItem.class)
                    .readValue(root.path("items"));
            if (items.isEmpty()) throw new IllegalArgumentException("导出快照没有片段");
            return new ExportSnapshot(resolution, bgmPath, bgmVolume, root.path("projectConfig").asText("{}"),
                    root.path("mediaId").asLong(), items);
        } catch (IOException e) {
            throw new IllegalStateException("读取导出快照失败", e);
        }
    }

    private HighlightProject requireProject(long projectId) {
        HighlightProject project = projectMapper.selectById(projectId);
        if (project == null) throw new NoSuchElementException("高光制作项目不存在");
        return project;
    }

    private HighlightExport requireExport(long exportId) {
        HighlightExport export = exportMapper.selectById(exportId);
        if (export == null) throw new NoSuchElementException("高光导出任务不存在");
        return export;
    }

    private void ensureNotCancelled(long exportId) {
        HighlightExport current = requireExport(exportId);
        if ("CANCELLED".equals(current.getStatus())) throw new IllegalStateException("已取消");
    }

    private void update(HighlightExport export, String status, String message, String outputPath,
                        String stage, String sceneMessage, long finishedAt) {
        export.setStatus(status);
        export.setMessage(message);
        export.setStage(stage);
        export.setSceneMessage(sceneMessage);
        if (outputPath != null) export.setOutputPath(outputPath);
        if (finishedAt > 0) export.setFinishedAt(finishedAt);
        exportMapper.updateById(export);
    }

    private HighlightExportView view(HighlightExport export) {
        return new HighlightExportView(export.getId(), export.getProjectId(), export.getMode(), export.getStatus(),
                export.getMessage(), export.getStage(), export.getSceneMessage(), export.getOutputPath() == null ? null : "/api/highlight-projects/exports/" + export.getId() + "/file",
                export.getCreatedAt(), export.getFinishedAt());
    }

    private static String normalizeMode(String mode) {
        String normalized = mode == null || mode.isBlank() ? "FULL" : mode.trim().toUpperCase(Locale.ROOT);
        if (!"FULL".equals(normalized) && !"SAFE".equals(normalized)) throw new IllegalArgumentException("导出模式只能是 FULL 或 SAFE");
        return normalized;
    }

    private static String normalizeResolution(String resolution) {
        String normalized = resolution == null || resolution.isBlank() ? "1080P" : resolution.trim().toUpperCase(Locale.ROOT);
        if (!RESOLUTIONS.containsKey(normalized)) throw new IllegalArgumentException("清晰度只能是 720P、1080P 或 4K");
        return normalized;
    }

    private static void requireNonEmpty(Path path) throws IOException {
        if (!Files.isRegularFile(path) || Files.size(path) < 1024) throw new IOException("ffmpeg 未生成有效视频");
    }

    private static void replace(Path temp, Path output) throws IOException {
        try { Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
        catch (java.nio.file.AtomicMoveNotSupportedException e) { Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING); }
    }

    private static void deleteQuietly(Path path) {
        if (path == null) return;
        try { Files.deleteIfExists(path); } catch (IOException ignored) { }
    }

    private static String message(Exception e) {
        return e.getMessage() == null || e.getMessage().isBlank() ? "高光导出失败" : e.getMessage();
    }

    private record ExportSnapshot(String resolution, String bgmPath, int bgmVolume, String styleJson,
                                  long mediaId, List<HighlightProjectItem> items) { }

    public record ExportRequest(String mode, String resolution, String bgmPath, Integer bgmVolume) { }

    public record HighlightExportView(long id, long projectId, String mode, String status, String message,
                                      String stage, String sceneMessage, String outputUrl, long createdAt, Long finishedAt) { }
}
