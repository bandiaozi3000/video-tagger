package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** 校验并准备推荐导出所选 Clip 的本地视频素材。 */
@Service
public class RecommendClipSourceService {
    private final ClipMapper clipMapper;
    private final LocalVideoResolver videoResolver;
    private final ClipExportProperties properties;

    public RecommendClipSourceService(ClipMapper clipMapper, LocalVideoResolver videoResolver,
                                      ClipExportProperties properties) {
        this.clipMapper = clipMapper;
        this.videoResolver = videoResolver;
        this.properties = properties;
    }

    public PreparedClips prepare(Map<Long, RecommendMediaClips> requested, Path workDir) {
        Map<Long, List<PreparedClip>> prepared = new LinkedHashMap<>();
        List<MissingClip> missing = new ArrayList<>();
        if (requested == null || requested.isEmpty()) return new PreparedClips(prepared, missing);
        Map<Long, Clip> clips = loadClips(requested);
        Map<Long, Path> outputs = new HashMap<>();
        for (Map.Entry<Long, RecommendMediaClips> mediaEntry : requested.entrySet()) {
            Long mediaId = mediaEntry.getKey();
            RecommendMediaClips selection = mediaEntry.getValue();
            if (mediaId == null || selection == null || selection.order() == null) continue;
            List<PreparedClip> mediaPrepared = new ArrayList<>();
            for (Long clipId : selection.order()) {
                Clip clip = clips.get(clipId);
                String label = clip == null ? "片段 #" + clipId : displayName(clip);
                try {
                    if (clip == null) throw new IllegalArgumentException("片段不存在或不属于所选媒体");
                    validateRange(clip);
                    Path source = videoResolver.resolve(clip.getVideoFp());
                    Path output = outputs.computeIfAbsent(clipId, id -> workDir.resolve("media").resolve("clip-" + id + ".mp4"));
                    if (!Files.isRegularFile(output)) {
                        export(clip, source, output);
                    }
                    mediaPrepared.add(new PreparedClip(clip.getId(), clip.getTitle(), clip.getNote(),
                            clip.getTimestampSec(), clip.getEndSec(), relativePath(workDir, output),
                            selection.badge()));
                } catch (RuntimeException | IOException | InterruptedException e) {
                    missing.add(new MissingClip(mediaId, clipId, label, message(e)));
                }
            }
            if (!mediaPrepared.isEmpty()) prepared.put(mediaId, mediaPrepared);
        }
        return new PreparedClips(prepared, missing);
    }

    private Map<Long, Clip> loadClips(Map<Long, RecommendMediaClips> requested) {
        Map<Long, Clip> result = new HashMap<>();
        for (Map.Entry<Long, RecommendMediaClips> entry : requested.entrySet()) {
            Long mediaId = entry.getKey();
            if (mediaId == null || entry.getValue() == null || entry.getValue().order() == null) continue;
            Map<Long, Clip> owned = new HashMap<>();
            for (Clip clip : clipMapper.listByMedia(mediaId)) owned.put(clip.getId(), clip);
            for (Long clipId : entry.getValue().order()) {
                if (clipId != null) result.put(clipId, owned.get(clipId));
            }
        }
        return result;
    }

    private void validateRange(Clip clip) {
        if (clip.getTimestampSec() == null || clip.getTimestampSec() < 0) {
            throw new IllegalArgumentException("片段没有合法的开始时间");
        }
        if (clip.getEndSec() != null && clip.getEndSec() <= clip.getTimestampSec()) {
            throw new IllegalArgumentException("片段结束时间必须晚于开始时间");
        }
        if (clip.getVideoDuration() != null && clip.getTimestampSec() >= clip.getVideoDuration()) {
            throw new IllegalArgumentException("片段开始时间超出视频总时长");
        }
        if (clip.getEndSec() != null && clip.getVideoDuration() != null && clip.getEndSec() > clip.getVideoDuration()) {
            throw new IllegalArgumentException("片段结束时间超出视频总时长");
        }
    }

    private void export(Clip clip, Path source, Path output) throws IOException, InterruptedException {
        Files.createDirectories(output.getParent());
        Path temp = output.resolveSibling(output.getFileName() + ".part");
        Files.deleteIfExists(temp);
        List<String> command = new ArrayList<>(List.of(properties.getFfmpegPath(), "-y", "-ss",
                format(clip.getTimestampSec()), "-i", source.toString()));
        Double duration = clip.getEndSec() != null
                ? clip.getEndSec() - clip.getTimestampSec()
                : clip.getVideoDuration() == null ? null : clip.getVideoDuration() - clip.getTimestampSec();
        if (duration != null) command.addAll(List.of("-t", format(duration)));
        command.addAll(List.of("-c:v", "libx264", "-preset", "fast", "-crf", "20",
                "-an", "-movflags", "+faststart", "-f", "mp4", temp.toString()));
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        Thread drainer = new Thread(() -> {
            try { process.getInputStream().transferTo(java.io.OutputStream.nullOutputStream()); }
            catch (IOException ignored) { }
        }, "recommend-clip-output");
        drainer.setDaemon(true);
        drainer.start();
        if (!process.waitFor(properties.getTaskTimeoutSec(), java.util.concurrent.TimeUnit.SECONDS)) {
            process.destroyForcibly();
            deleteQuietly(temp);
            throw new IllegalStateException("片段素材准备超时");
        }
        if (process.exitValue() != 0 || !Files.isRegularFile(temp) || Files.size(temp) < 1024) {
            deleteQuietly(temp);
            throw new IllegalStateException("片段素材准备失败，ffmpeg 退出码 " + process.exitValue());
        }
        try {
            Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (java.nio.file.AtomicMoveNotSupportedException e) {
            Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static String relativePath(Path root, Path path) {
        return root.relativize(path).toString().replace('\\', '/');
    }

    private static String displayName(Clip clip) {
        return clip.getTitle() == null || clip.getTitle().isBlank() ? "片段 #" + clip.getId() : clip.getTitle();
    }

    private static String format(double value) { return String.format(Locale.ROOT, "%.3f", value); }

    private static String message(Exception e) {
        return e.getMessage() == null || e.getMessage().isBlank() ? "片段素材不可用" : e.getMessage();
    }

    private static void deleteQuietly(Path path) {
        try { if (path != null) Files.deleteIfExists(path); } catch (IOException ignored) { }
    }

    public record PreparedClips(Map<Long, List<PreparedClip>> byMedia, List<MissingClip> missing) {
        public boolean hasMissing() { return missing != null && !missing.isEmpty(); }
    }

    public record PreparedClip(Long id, String title, String note, Double startSec, Double endSec,
                               String path, RecommendMediaClips.Badge badge) { }

    public record MissingClip(Long mediaId, Long clipId, String title, String reason) { }
}
