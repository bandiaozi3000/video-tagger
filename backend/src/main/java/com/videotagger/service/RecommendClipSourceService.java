package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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

/**
 * 校验并准备推荐所选 Clip 的本地视频素材（**混合策略**，设计规格 §8.1）。
 *
 * 优先级：
 * 1. 会话缓存命中（同一会话内同一片段不重复准备）；
 * 2. 已物化的 `GENERATED_CLIP` 产物且区间一致 → **探测编解码**：浏览器可播（h264+aac 等）直接复制，
 *    否则从该产物重编码（比从整集源重编码快）；
 * 3. 回退：从 `data/videos` 的整集源裁剪重编码（旧行为）。
 *
 * 为什么必须探测：物化用 `-c copy`（`ClipMaterializationService.cut`），产物编解码继承源片；
 * HEVC/AV1 源直接给 Chromium 会预览黑屏。探测失败按"不可播"处理（保守重编码）。
 */
@Service
public class RecommendClipSourceService {

    private static final Logger log = LoggerFactory.getLogger(RecommendClipSourceService.class);
    /** 物化产物时长与 clip 区间允许的偏差（毫秒）：超过即视为区间已变（如用户改过裁剪点）。 */
    private static final long DURATION_TOLERANCE_MS = 400;

    private final ClipMapper clipMapper;
    private final LocalVideoResolver videoResolver;
    private final ClipExportProperties properties;
    private final VideoAssetMapper assetMapper;
    private final MediaProbe mediaProbe;
    private final Path assetRoot;
    /** 推荐时间轴帧率：片段素材的帧率与它不一致时不能直通（否则播放时帧节奏不匀 = "晃"）。 */
    private final double targetFps;

    public RecommendClipSourceService(ClipMapper clipMapper, LocalVideoResolver videoResolver,
                                      ClipExportProperties properties, VideoAssetMapper assetMapper,
                                      MediaProbe mediaProbe,
                                      @Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String assetRoot,
                                      @Value("${videotagger.render.fps:30}") double targetFps) {
        this.clipMapper = clipMapper;
        this.videoResolver = videoResolver;
        this.properties = properties;
        this.assetMapper = assetMapper;
        this.mediaProbe = mediaProbe;
        this.assetRoot = Path.of(assetRoot).toAbsolutePath().normalize();
        this.targetFps = targetFps > 0 ? targetFps : 30;
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
                    Path output = outputs.computeIfAbsent(clipId, id -> workDir.resolve("media").resolve("clip-" + id + ".mp4"));
                    if (!Files.isRegularFile(output)) {
                        prepareOne(clip, output);
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

    /** 单个片段：物化产物直用 / 产物重编码 / 源视频重编码。 */
    private void prepareOne(Clip clip, Path output) throws IOException, InterruptedException {
        Artifact artifact = reusableArtifact(clip);
        if (artifact != null) {
            if (playable(artifact)) {
                Files.createDirectories(output.getParent());
                Files.copy(artifact.file(), output, StandardCopyOption.REPLACE_EXISTING);
                log.info("片段 {} 复用物化产物（零重编码）: {}", clip.getId(), artifact.file().getFileName());
                return;
            }
            log.info("片段 {} 物化产物编解码不可直用，改为重编码: {}", clip.getId(), artifact.file().getFileName());
            export(clip, artifact.file(), output, false);
            return;
        }
        validateRange(clip);
        Path source = videoResolver.resolve(clip.getVideoFp());
        export(clip, source, output, true);
    }

    /** 物化产物（文件 + 库里记的编解码）。 */
    private record Artifact(Path file, String videoCodec, String audioCodec) {
    }

    /** 可复用的物化产物：READY + 文件在场 + 区间与 clip 一致；否则 null。 */
    private Artifact reusableArtifact(Clip clip) {
        Long assetId = clip.getVideoAssetId();
        if (assetId == null || assetId == 0L || assetMapper == null) return null;
        try {
            VideoAsset asset = assetMapper.selectById(assetId);
            if (asset == null || !"AVAILABLE".equals(asset.getAvailabilityState()) || asset.getStoragePath() == null) {
                return null;
            }
            Path file = assetRoot.resolve(asset.getStoragePath()).normalize();
            if (!file.startsWith(assetRoot) || !Files.isRegularFile(file)) return null;
            long startMs = startMs(clip);
            Long endMs = endMs(clip);
            if (endMs == null || endMs <= startMs) return null;
            long expected = endMs - startMs;
            if (asset.getDurationMs() != null && Math.abs(asset.getDurationMs() - expected) > DURATION_TOLERANCE_MS) {
                return null;   // 区间已变（用户改过裁剪点），产物不再对应
            }
            return new Artifact(file, asset.getVideoCodec(), asset.getAudioCodec());
        } catch (RuntimeException e) {
            log.warn("读取物化产物失败 clip={}: {}", clip.getId(), e.getMessage());
            return null;
        }
    }

    /** 产物是否可被浏览器直接播放：存库编解码优先，字段缺失才探测（探测不出 → 不可直用）。 */
    /**
     * 物化产物能否直重复用：编解码可播 **且帧率与推荐时间轴一致**。
     *
     * 帧率那条是 2026-09-19 补的：以前只看编解码，于是 23.976fps 的素材被零重编码直通，
     * 进 30fps 时间轴后帧节奏不匀（源帧重复/跳过混排），观感就是“片段一直在晃”。
     * 探测不到帧率（探针不可用）时按可复用来处理，避免在探测失败时把全部片段都转一遍。
     */
    private boolean playable(Artifact artifact) {
        if (!codecsPlayable(artifact)) return false;
        double fps = mediaProbe.fps(artifact.file().toString());
        if (fps <= 0) {
            log.warn("片段物化产物帧率探测失败，按可复用处理: {}", artifact.file().getFileName());
            return true;
        }
        if (Math.abs(fps - targetFps) > 0.05) {
            log.info("片段物化产物帧率 {} ≠ 时间轴 {}，改为重编码（CFR）: {}", fps, targetFps, artifact.file().getFileName());
            return false;
        }
        return true;
    }

    private boolean codecsPlayable(Artifact artifact) {
        if (artifact.videoCodec() != null && !artifact.videoCodec().isBlank()) {
            return new MediaProbe.Codecs(artifact.videoCodec().toLowerCase(Locale.ROOT),
                    artifact.audioCodec() == null ? null : artifact.audioCodec().toLowerCase(Locale.ROOT), true).webPlayable();
        }
        return mediaProbe.codecs(artifact.file().toString()).webPlayable();
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

    /**
     * 裁剪编码：`fromSource=true` 时按 clip 区间取源片；false 表示输入已是裁剪好的产物（只重编码）。
     */
    private void export(Clip clip, Path input, Path output, boolean fromSource) throws IOException, InterruptedException {
        Files.createDirectories(output.getParent());
        Path temp = output.resolveSibling(output.getFileName() + ".part");
        Files.deleteIfExists(temp);
        List<String> command = new ArrayList<>();
        command.add(properties.getFfmpegPath());
        command.add("-y");
        if (fromSource) {
            command.addAll(List.of("-ss", format(startMs(clip) / 1000d)));
        }
        command.addAll(List.of("-i", input.toString()));
        if (fromSource) {
            Long endMs = endMs(clip);
            if (endMs != null) {
                command.addAll(List.of("-t", format((endMs - startMs(clip)) / 1000d)));
            }
        }
        command.addAll(List.of("-c:v", "libx264", "-preset", "fast", "-crf", "20",
                // 常帧率 + 对齐推荐时间轴帧率：帧率不匹配的素材直接进时间轴会帧节奏不匀（“抖”）
                "-vsync", "cfr", "-r", String.valueOf((int) Math.round(targetFps)),
                // 保留素材原声（Remotion 路径需要原声）
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart", "-f", "mp4", temp.toString()));
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

    private static long startMs(Clip clip) {
        if (clip.getStartMs() != null) return clip.getStartMs();
        return clip.getTimestampSec() == null ? 0L : Math.round(clip.getTimestampSec() * 1000);
    }

    private static Long endMs(Clip clip) {
        if (clip.getEndMs() != null) return clip.getEndMs();
        return clip.getEndSec() == null ? null : Math.round(clip.getEndSec() * 1000);
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
