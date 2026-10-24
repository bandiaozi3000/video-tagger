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
import java.util.UUID;

/**
 * 校验并准备推荐所选 Clip 的本地视频素材（**混合策略**，设计规格 §8.1）。
 *
 * 优先级：
 * 1. **跨会话素材缓存**（`data/recommend-clip-cache/`）命中 → 直接链接/复制，零重编码（2026-09-29 用户：
 *    「每次都得重新素材太麻烦了」——以前只在会话内去重，每个新会话都从头准备一遍）；
 * 2. 会话缓存命中（同一会话内同一片段不重复准备）；
 * 3. 已物化的 `GENERATED_CLIP` 产物且区间一致 → **探测编解码**：浏览器可播（h264+aac 等）直接复制，
 *    否则从该产物重编码（比从整集源重编码快）；
 * 4. 回退：从 `data/videos` 的整集源裁剪重编码（旧行为）。
 *
 * 为什么必须探测：物化用 `-c copy`（`ClipMaterializationService.cut`），产物编解码继承源片；
 * HEVC/AV1 源直接给 Chromium 会预览黑屏。探测失败按"不可播"处理（保守重编码）。
 *
 * **帧率不再触发重编码**（2026-09-29 用户拍板）：能重编码出来的帧本来就不存在，顿挫消不掉
 * （2026-09-20 自己实测过：「24fps 内容重新封成 30fps 只能靠重复帧，顿挫一分不少」）；
 * 而"帧率对不上就重编码"这笔买卖的实际效果是——为了对齐 24 时间轴把产物写成了 **30fps**（下面 `export`
 * 曾经读错字段），既没对齐、又每个会话白转一遍。真解是让**时间轴跟着素材走**（银幕式 → 24），
 * 不一致的素材就让它按原帧率进时间轴，不再拿重编码去假装对齐。
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
    /** 跨会话片段素材缓存目录（同片段第二次起零重编码；可整个删掉，只影响下一次的准备耗时）。 */
    private final Path clipCacheDir;
    /** 本卷是否不支持硬链（首次失败后置位，之后一律走复制）。 */
    private volatile boolean hardLinkUnsupported;
    /** 同系列解析（借片段时校验「来源与本体有视频类关联」）；测试可传 null → 不校验。 */
    private final RelatedMediaService relatedMediaService;
    private final com.videotagger.mapper.MediaMapper mediaMapper;
    /** 悬空引用修复建议要查「片段归属哪个媒体」（episode → media）。 */
    private final com.videotagger.mapper.EpisodeMapper episodeMapper;

    public RecommendClipSourceService(ClipMapper clipMapper, LocalVideoResolver videoResolver,
                                      ClipExportProperties properties, VideoAssetMapper assetMapper,
                                      MediaProbe mediaProbe,
                                      @Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String assetRoot,
                                      @Value("${videotagger.render.fps:30}") double targetFps,
                                      @Value("${videotagger.recommend-clip-cache-dir:${VT_DATA_DIR:data}/recommend-clip-cache}") String clipCacheDir,
                                      RelatedMediaService relatedMediaService,
                                      com.videotagger.mapper.MediaMapper mediaMapper,
                                      com.videotagger.mapper.EpisodeMapper episodeMapper) {
        this.clipMapper = clipMapper;
        this.videoResolver = videoResolver;
        this.properties = properties;
        this.assetMapper = assetMapper;
        this.mediaProbe = mediaProbe;
        this.assetRoot = Path.of(assetRoot).toAbsolutePath().normalize();
        this.targetFps = targetFps > 0 ? targetFps : 30;
        this.clipCacheDir = clipCacheDir == null || clipCacheDir.isBlank()
                ? null : Path.of(clipCacheDir).toAbsolutePath().normalize();
        this.relatedMediaService = relatedMediaService;
        this.mediaMapper = mediaMapper;
        this.episodeMapper = episodeMapper;
    }

    public PreparedClips prepare(Map<Long, RecommendMediaClips> requested, Path workDir) {
        return prepare(requested, workDir, targetFps);
    }

    /**
     * 同 {@link #prepare(Map, Path)}，但按**模板形态**给时间轴帧率（用户 2026-09-20：银幕式走 24）。
     * 现由调用方传 `RecommendService.fpsOf(groupStyle)`；两参版本保留给测试与旧调用。
     */
    public PreparedClips prepare(Map<Long, RecommendMediaClips> requested, Path workDir, double timelineFps) {
        Map<Long, List<PreparedClip>> prepared = new LinkedHashMap<>();
        List<MissingClip> missing = new ArrayList<>();
        if (requested == null || requested.isEmpty()) return new PreparedClips(prepared, missing);
        LoadedClips loaded = loadClips(requested);
        Map<Long, Path> outputs = new HashMap<>();
        for (Map.Entry<Long, RecommendMediaClips> mediaEntry : requested.entrySet()) {
            Long mediaId = mediaEntry.getKey();
            RecommendMediaClips selection = mediaEntry.getValue();
            if (mediaId == null || selection == null || selection.order() == null) continue;
            List<PreparedClip> mediaPrepared = new ArrayList<>();
            for (Long clipId : selection.order()) {
                Clip clip = loaded.clips().get(clipId);
                Long sourceMediaId = selection.sourceOf(clipId);
                String label = clip == null ? "片段 #" + clipId : displayName(clip);
                try {
                    if (clip == null) throw new IllegalArgumentException(
                            loaded.reasons().getOrDefault(clipId, "片段不存在或不属于所选媒体"));
                    Path output = outputs.computeIfAbsent(clipId, id -> workDir.resolve("media").resolve("clip-" + id + ".mp4"));
                    if (!Files.isRegularFile(output)) {
                        prepareCached(clip, output, timelineFps);
                    } else if (!isFastStart(output)) {
                        // 旧会话文件可能是“moov 在尾”（产物直拷时代留下的）→ 就地升级，
                        // 否则浏览器 <video> 起播/跳转会先空一大截（2026-09-21 用户截图定位）。
                        // 升级失败不影响观看（旧文件照用），所以只告警：多标签页同时 prepare 时会撞临时文件。
                        try {
                            remuxFastStart(output, output);
                        } catch (Exception e) {
                            log.warn("片段文件 faststart 升级失败（旧文件继续用）: {} - {}", output.getFileName(), e.getMessage());
                        }
                    }
                    // 借来的片段带上来源标题（供视图与编辑器角标）；本体片段两个字段为 null
                    String sourceTitle = sourceMediaId == null ? null : relatedTitles(mediaId).get(sourceMediaId);
                    // 尺寸探测：渲染侧据此跳过"与画幅同比时完全看不见"的那层模糊背景视频（实测省 ~40% 片段帧耗时）
                    int[] size = mediaProbe == null ? null : mediaProbe.dimensions(output.toAbsolutePath().toString());
                    mediaPrepared.add(new PreparedClip(clip.getId(), clip.getTitle(), clip.getNote(),
                            clip.getTimestampSec(), clip.getEndSec(), relativePath(workDir, output),
                            selection.badge(), sourceMediaId, sourceTitle,
                            size == null ? 0 : size[0], size == null ? 0 : size[1]));
                } catch (RuntimeException | IOException | InterruptedException e) {
                    MissingClip hint = loaded.suggest().get(clipId);
                    missing.add(hint == null ? new MissingClip(mediaId, clipId, label, message(e)) : hint);
                }
            }
            if (!mediaPrepared.isEmpty()) prepared.put(mediaId, mediaPrepared);
        }
        return new PreparedClips(prepared, missing);
    }

    /**
     * 会话文件产出：**先看跨会话缓存**（命中 → 硬链/复制，零重编码），未命中才准备并回写缓存。
     *
     * <p>缓存文件永远是 faststart（三条写入路径都带 `+faststart`），所以从缓存来的文件不必再 remux。
     * 硬链优先：同卷上零拷贝、零额外磁盘，会话目录被回收时只删自己的那一份链接；
     * 卷不支持硬链（实测本机 D: 报 `ERROR_INVALID_FUNCTION`）或跨卷时自动退回复制（184MB 约 0.5s）。
     * 万一有代码**原地改写**这些文件，会连带污染缓存 —— 现有路径都是"写临时文件再原子改名"，是安全的；
     * 新增会写片段文件的逻辑时请保持这个约定。
     *
     * ponytail: 缓存不做 LRU/上限（`data/recommend-clip-cache/` 可随时整目录删）；容量真成问题时再加。
     */
    private void prepareCached(Clip clip, Path output, double timelineFps) throws IOException, InterruptedException {
        Path cached = clipCacheDir == null ? null : clipCacheDir.resolve(cacheKey(clip, timelineFps));
        if (cached == null) {
            prepareOne(clip, output, timelineFps);
            return;
        }
        if (!Files.isRegularFile(cached)) {
            Files.createDirectories(cached.getParent());
            // 唯一临时名：多标签页同时准备同一片段时不会互相踩（原子改名保证缓存里只可能是完整文件）
            Path temp = cached.resolveSibling(cached.getFileName() + ".tmp-" + UUID.randomUUID());
            try {
                prepareOne(clip, temp, timelineFps);
                try {
                    Files.move(temp, cached, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                } catch (java.nio.file.AtomicMoveNotSupportedException e) {
                    Files.move(temp, cached, StandardCopyOption.REPLACE_EXISTING);
                }
            } catch (RuntimeException | IOException | InterruptedException e) {
                deleteQuietly(temp);
                if (!Files.isRegularFile(cached)) throw e;   // 别人刚好写好了 → 用他的
            }
        }
        Files.createDirectories(output.getParent());
        if (linkFromCache(cached, output)) return;
        Files.copy(cached, output, StandardCopyOption.REPLACE_EXISTING);
    }

    /** 从缓存硬链到会话；本卷不支持硬链时记下来，以后不再白试（异常当控制流太慢也太吵）。 */
    private boolean linkFromCache(Path cached, Path output) {
        if (hardLinkUnsupported) return false;
        try {
            Files.deleteIfExists(output);
            Files.createLink(output, cached);
            return true;
        } catch (IOException | UnsupportedOperationException | SecurityException e) {
            hardLinkUnsupported = true;
            log.info("本卷不支持硬链，片段改走复制（仅首次提示）: {}", e.getMessage());
            deleteQuietly(output);
            return false;
        }
    }

    /**
     * 缓存键：凡影响产物字节的都要进键。
     *
     * - `clipId` + 区间：用户改过裁剪点就是另一段画面；
     * - `videoAssetId`：重新物化会**新建**资产行（id 变）→ 不会拿旧产物顶新产物；
     * - `videoFp`：产物丢失时回退到整集源，源指纹决定内容（`data/videos` 换文件也换键）；
     * - 时间轴帧率：走重编码分支时它就是 `-r` 的值。
     */
    private String cacheKey(Clip clip, double timelineFps) {
        String fingerprint = clip.getVideoFp() == null || clip.getVideoFp().isBlank() ? "nofp" : clip.getVideoFp();
        Long end = endMs(clip);
        return "clip-" + clip.getId() + "-" + startMs(clip) + "-" + (end == null ? "end" : String.valueOf(end))
                + "-a" + (clip.getVideoAssetId() == null ? 0L : clip.getVideoAssetId())
                + "-" + fingerprint + "-" + (int) Math.round(timelineFps) + "fps.mp4";
    }

    /** 单个片段：物化产物直用 / 产物重编码 / 源视频重编码。 */
    private void prepareOne(Clip clip, Path output, double timelineFps) throws IOException, InterruptedException {
        Artifact artifact = reusableArtifact(clip);
        if (artifact != null) {
            if (playable(artifact)) {
                Files.createDirectories(output.getParent());
                if (isFastStart(artifact.file())) {
                    Files.copy(artifact.file(), output, StandardCopyOption.REPLACE_EXISTING);
                    log.info("片段 {} 复用物化产物（零重编码）: {}", clip.getId(), artifact.file().getFileName());
                    return;
                }
                // 产物是 `-c copy` 剪出来的、moov 在文件尾：直拷进预览会话会让浏览器 <video> 迟迟解不出帧（只剩模糊底图）
                // → 先用一次 `-c copy` remux 把 moov 挪到文件头（不重编码）；失败退回直拷，行为不劣于从前
                try {
                    remuxFastStart(artifact.file(), output);
                    log.info("片段 {} 复用产物 + faststart remux: {}", clip.getId(), artifact.file().getFileName());
                } catch (IOException | InterruptedException | RuntimeException e) {
                    log.warn("片段 {} faststart remux 失败，退回直拷: {}", clip.getId(), e.getMessage());
                    Files.copy(artifact.file(), output, StandardCopyOption.REPLACE_EXISTING);
                }
                return;
            }
            log.info("片段 {} 物化产物编解码不可直用，改为重编码: {}", clip.getId(), artifact.file().getFileName());
            export(clip, artifact.file(), output, false, timelineFps);
            return;
        }
        validateRange(clip);
        Path source = videoResolver.resolve(clip.getVideoFp());
        export(clip, source, output, true, timelineFps);
    }

    /**
     * `-c copy` 重写容器：把 moov 挪到文件头（faststart），不重编码。
     *
     * <p>为什么必须：浏览器 `<video>` 拿到 moov 前解不出任何一帧 —— 预览（Remotion Player）里
     * 没帧的 <video> 是透明的，于是只剩背景那层模糊，用户看到的就是“糊成一片、字幕卡却正常”。
     * 实测 2026-09-21：`media/clip-182.mp4` moov@4,012,076 / size 4,033,274；clip-189 同理。
     */
    private void remuxFastStart(Path input, Path output) throws IOException, InterruptedException {
        Files.createDirectories(output.getParent());
        Path temp = output.resolveSibling(output.getFileName() + ".faststart.part.mp4");
        Files.deleteIfExists(temp);
        List<String> command = List.of(properties.getFfmpegPath(), "-y", "-i", input.toString(),
                "-c", "copy", "-movflags", "+faststart", "-f", "mp4", temp.toString());
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        Thread drainer = new Thread(() -> {
            try { process.getInputStream().transferTo(java.io.OutputStream.nullOutputStream()); }
            catch (IOException ignored) { }
        }, "recommend-clip-faststart");
        drainer.setDaemon(true);
        drainer.start();
        if (!process.waitFor(properties.getTaskTimeoutSec(), java.util.concurrent.TimeUnit.SECONDS)) {
            process.destroyForcibly();
            deleteQuietly(temp);
            throw new IllegalStateException("faststart remux 超时");
        }
        if (process.exitValue() != 0 || !Files.isRegularFile(temp) || Files.size(temp) < 1024) {
            deleteQuietly(temp);
            throw new IllegalStateException("faststart remux 失败，ffmpeg 退出码 " + process.exitValue());
        }
        try {
            Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (java.nio.file.AtomicMoveNotSupportedException e) {
            Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    /**
     * 文件头里 `moov` 是否在 `mdat` 之前（= faststart）。
     *
     * <p>只走顶层 box 头（seek 而不是读整个文件），碰到 moov/mdat 立即判定；
     * 读不了/结构异常一律当作“不是 faststart”（走一次 remux，宁可多花一点）。
     */
    static boolean isFastStart(Path file) {
        try (java.io.RandomAccessFile raf = new java.io.RandomAccessFile(file.toFile(), "r")) {
            long pos = 0;
            long len = raf.length();
            byte[] head = new byte[8];
            for (int guard = 0; guard < 64 && pos + 8 <= len; guard++) {
                raf.seek(pos);
                raf.readFully(head);
                long size = ((head[0] & 0xffL) << 24) | ((head[1] & 0xffL) << 16) | ((head[2] & 0xffL) << 8) | (head[3] & 0xffL);
                String type = new String(head, 4, 4, java.nio.charset.StandardCharsets.US_ASCII);
                if ("moov".equals(type)) return true;
                if ("mdat".equals(type)) return false;
                if (size == 1) {
                    byte[] ext = new byte[8];
                    raf.seek(pos + 8);
                    raf.readFully(ext);
                    size = java.nio.ByteBuffer.wrap(ext).getLong();
                } else if (size == 0) {
                    size = len - pos;
                }
                if (size < 8) return false;
                pos += size;
            }
        } catch (Exception e) {
            log.warn("读文件头判断 faststart 失败（按需要 remux 处理）: {} - {}", file, e.getMessage());
        }
        return false;
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
            Path file = VideoAssetPathService.trustedPath(assetRoot, asset.getStoragePath());
            if (file == null || !Files.isRegularFile(file)) return null;
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

    /**
     * 物化产物能否直重复用：**只看编解码**（浏览器能不能播）。
     *
     * <p>帧率那条已在 2026-09-29 删除（用户拍板）。历史：2026-09-19 加它，是因为 23.976 素材零重编码直进
     * 30fps 时间轴时观测到"片段一直在晃"；2026-09-20 又自己实测更正——把内容重新封成时间轴帧率**消不掉顿挫**
     * （靠重复帧，帧间差每 5 帧一个 ≈0），真解是让时间轴跟着素材走（银幕式 → 24）。
     * 既然转帧率买不到东西，就不该为它付整段重编码（实测 1080p 60s ≈ 13s，一个 10 分钟片段 ≈ 2.3 分钟/会话）。
     */
    private boolean playable(Artifact artifact) {
        return codecsPlayable(artifact);
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
     *
     * <p>`timelineFps` **必须**是调用方传下来的时间轴帧率（银幕式 24）：以前这里读的是字段 `targetFps`
     * （`videotagger.render.fps`，默认 30），于是银幕式的重编码产物是 30fps —— 既没对齐时间轴、又每个会话白转一遍
     * （2026-09-29 实测：同一会话里 23.98 片段直通、29.97 片段被写成 30fps）。
     */
    private void export(Clip clip, Path input, Path output, boolean fromSource, double timelineFps) throws IOException, InterruptedException {
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
                "-vsync", "cfr", "-r", String.valueOf((int) Math.round(timelineFps > 0 ? timelineFps : targetFps)),
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

    /**
     * 取片段（含**跨媒体借片段**）。
     *
     * 借片段的判定：本体 `listByMedia` 里没这个 clipId，但 `sources[clipId]` 指了另一个媒体。
     * 校验三段，**原因分开报**（设计规格 §5.2）：
     *   ① 库里压根没这个片段 → `片段不存在`
     *   ② 没给 sources 且不属本体 → `片段不存在或不属于所选媒体`（保留旧文案，旧草稿行为不变）
     *   ③ 给了 sources，但来源与本体**没有视频类关联** → `片段 #N 与《本体》没有视频类关联`
     */
    private LoadedClips loadClips(Map<Long, RecommendMediaClips> requested) {
        Map<Long, Clip> result = new HashMap<>();
        Map<Long, String> reasons = new HashMap<>();
        Map<Long, MissingClip> suggest = new HashMap<>();   // 悬空引用的修复建议
        Map<Long, Map<Long, String>> relatedCache = new HashMap<>();   // 本体媒体 → (来源媒体 → 标题)
        for (Map.Entry<Long, RecommendMediaClips> entry : requested.entrySet()) {
            Long mediaId = entry.getKey();
            if (mediaId == null || entry.getValue() == null || entry.getValue().order() == null) continue;
            Map<Long, Clip> owned = new HashMap<>();
            for (Clip clip : clipMapper.listByMedia(mediaId)) owned.put(clip.getId(), clip);
            for (Long clipId : entry.getValue().order()) {
                if (clipId == null) continue;
                Clip clip = owned.get(clipId);
                if (clip != null) {
                    result.put(clipId, clip);
                    continue;
                }
                Long sourceMediaId = entry.getValue().sourceOf(clipId);
                if (sourceMediaId == null) {
                    // 「资源视频」上传（`POST /api/clips/upload`）：无集片段，不在任何媒体的片段列表里
                    // （`listByMedia` 走 episode JOIN），只能按键直查；归属由草稿的 mediaClips 决定。
                    Clip uploaded = clipMapper.selectById(clipId);
                    if (uploaded != null && uploaded.getEpisodeId() == null) {
                        result.put(clipId, uploaded);
                        continue;
                    }
                    result.put(clipId, null);
                    reasons.put(clipId, "片段不存在或不属于所选媒体");
                    // 旧草稿的跨媒体悬空引用：片段其实在库里，只是属于**本部同系列**的条目（如 OVA）
                    // → 给出「该挂到哪」的建议，编辑器就能一键修好（2026-09-20 用户实测踩到）。
                    suggest.put(clipId, suggestionFor(mediaId, clipId));
                    continue;
                }
                Map<Long, String> related = relatedCache.computeIfAbsent(mediaId, this::relatedTitles);
                if (!related.containsKey(sourceMediaId)) {
                    result.put(clipId, null);
                    reasons.put(clipId, "片段 #" + clipId + " 与《" + titleOf(mediaId) + "》没有视频类关联");
                    continue;
                }
                Clip borrowed = clipMapper.listByMedia(sourceMediaId).stream()
                        .filter((candidate) -> clipId.equals(candidate.getId())).findFirst().orElse(null);
                result.put(clipId, borrowed);
                if (borrowed == null) reasons.put(clipId, "片段不存在");
            }
        }
        return new LoadedClips(result, reasons, suggest);
    }

    /**
     * 悬空引用的修复建议：片段存在，且其归属媒体在「本部的同系列」里 → 指出该挂到哪个条目。
     * 不是这种情况返回 null（例如片段真被删了、或属于毫不相干的另一部）。
     */
    private MissingClip suggestionFor(Long ownerMediaId, Long clipId) {
        try {
            Clip clip = clipMapper.selectById(clipId);
            if (clip == null || clip.getEpisodeId() == null || episodeMapper == null) return null;
            com.videotagger.entity.Episode episode = episodeMapper.selectById(clip.getEpisodeId());
            if (episode == null || episode.getMediaId() == null) return null;
            Long realOwner = episode.getMediaId();
            if (realOwner.equals(ownerMediaId)) return null;               // 属于本部 → 不是跨媒体问题
            Map<Long, String> related = relatedTitles(ownerMediaId);
            String title = related.get(realOwner);
            if (title == null) return null;                               // 不在同系列 → 不给建议
            return new MissingClip(ownerMediaId, clipId, clip.getTitle(), "片段属于同系列条目", realOwner, title);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 本体可借的来源（同系列、本地有片段的条目）→ mediaId 到标题（供来源角标）。 */
    private Map<Long, String> relatedTitles(Long mediaId) {
        Map<Long, String> map = new LinkedHashMap<>();
        if (relatedMediaService != null) {
            for (RelatedMedia related : relatedMediaService.videoRelated(mediaId)) {
                map.putIfAbsent(related.mediaId(), related.title());
            }
        }
        map.putIfAbsent(mediaId, titleOf(mediaId));   // 本体也算（防御：sources 指回本体）
        return map;
    }

    private String titleOf(Long mediaId) {
        try {
            if (mediaMapper != null) {
                com.videotagger.entity.Media media = mediaMapper.selectById(mediaId);
                if (media != null && media.getTitle() != null && !media.getTitle().isBlank()) return media.getTitle().trim();
            }
        } catch (RuntimeException ignored) {
            // 取不到标题不影响主流程
        }
        return "#" + mediaId;
    }

    /** 片段 + 失败原因（原因要分文案，所以不能只返回 null）+ 悬空引用的修复建议。 */
    private record LoadedClips(Map<Long, Clip> clips, Map<Long, String> reasons, Map<Long, MissingClip> suggest) {
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
                               String path, RecommendMediaClips.Badge badge,
                               /** 借来的片段才有：来源媒体 id / 标题（本体片段为 null）。 */
                               Long sourceMediaId, String sourceTitle,
                               /** 素材像素尺寸（探不到为 0）：渲染侧判断"片段与画幅同比 → 那层糊背景看不见"。 */
                               int assetWidth, int assetHeight) {

        /** 兼容旧构造（本体片段）。 */
        public PreparedClip(Long id, String title, String note, Double startSec, Double endSec,
                            String path, RecommendMediaClips.Badge badge) {
            this(id, title, note, startSec, endSec, path, badge, null, null, 0, 0);
        }

        /** 兼容旧构造（跨媒体借来的片段；尺寸未知 → 0，渲染侧会保守处理）。 */
        public PreparedClip(Long id, String title, String note, Double startSec, Double endSec,
                            String path, RecommendMediaClips.Badge badge, Long sourceMediaId, String sourceTitle) {
            this(id, title, note, startSec, endSec, path, badge, sourceMediaId, sourceTitle, 0, 0);
        }
    }

    /**
     * 缺素材的一条。
     *
     * 2026-09-20 加 `suggestedSourceMediaId/Title`：**旧草稿里的跨媒体悬空引用**
     * （片段属于同系列的 OVA，但草稿没写 sources）→ 后端能认出该挂到哪，编辑器就能给一键修复。
     */
    public record MissingClip(Long mediaId, Long clipId, String title, String reason,
                              Long suggestedSourceMediaId, String suggestedSourceTitle) {

        /** 兼容旧构造（没有修复建议）。 */
        public MissingClip(Long mediaId, Long clipId, String title, String reason) {
            this(mediaId, clipId, title, reason, null, null);
        }
    }
}
