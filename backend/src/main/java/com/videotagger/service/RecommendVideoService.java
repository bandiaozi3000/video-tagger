package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 推荐视频渲染编排（Remotion 单路径）。
 *
 * 链路：Java 组装 RenderInput JSON → {@code node remotion/scripts/render-recommend.ts}
 * （bundle → selectComposition → renderMedia）→ 产物落 {@code data/exports}。
 *
 * 责任边界（设计规格 §7）：
 * - 素材准备（片段裁剪、封面、BGM）：Java；
 * - 音频混合（原声 + BGM + ducking）：**Remotion 内建**，Java 不再有 FFmpeg concat / amix 混流；
 * - 时长：`buildScenePlan()`（Remotion 侧）是唯一权威，Java 只提供参数。
 *
 * 依赖本机工具链（node / ffmpeg / Remotion 自带 Chrome Headless Shell），Docker 容器内未装 → 配置缺失时给出清晰错误。
 */
@Service
public class RecommendVideoService {

    private static final Logger log = LoggerFactory.getLogger(RecommendVideoService.class);
    private static final DateTimeFormatter FILE_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final long RENDER_TIMEOUT_SECONDS = 40 * 60;   // 多部一屏 + 1080P 以下导出够用；4K 编码慢，放宽到 40 分钟

    /** 分辨率 → 像素。 */
    private static final Map<String, int[]> RESOLUTIONS = Map.of(
            "720P", new int[]{1280, 720},
            "1080P", new int[]{1920, 1080},
            "4K", new int[]{3840, 2160});

    /** 视频格式 → 输出扩展名。 */
    private static final Map<String, String> FORMATS = Map.of(
            "MP4", "mp4",
            "WEBM", "webm");

    private final RecommendService recommendService;
    private final RecommendClipSourceService clipSourceService;

    private final String nodePath;
    private final String ffmpegPath;
    private final String remotionDir;
    private final String ffprobePath;

    @Autowired
    public RecommendVideoService(RecommendService recommendService,
                                 RecommendClipSourceService clipSourceService,
                                 @Value("${videotagger.render.node-path}") String nodePath,
                                 @Value("${videotagger.render.ffmpeg-path}") String ffmpegPath,
                                 @Value("${videotagger.render.remotion-dir:backend/remotion}") String remotionDir,
                                 @Value("${videotagger.render.ffprobe-path:}") String ffprobePath) {
        this.recommendService = recommendService;
        this.clipSourceService = clipSourceService;
        this.nodePath = nodePath;
        this.ffmpegPath = ffmpegPath;
        this.remotionDir = remotionDir;
        this.ffprobePath = ffprobePath;
    }

    /** 测试/无片段场景用的简化构造（clipSourceService 为空 → 不支持片段）。 */
    public RecommendVideoService(RecommendService recommendService, String nodePath, String ffmpegPath) {
        this(recommendService, null, nodePath, ffmpegPath, "backend/remotion", "");
    }

    public Path render(List<Long> ids, String resolution) {
        return render(ids, null, null, resolution, null, null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1, null);
    }

    /** 渲染推荐媒体为视频（无 BGM）。 */
    public Path render(List<Long> ids, String title, String format, String resolution) {
        return render(ids, title, format, resolution, null, null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1, null);
    }

    /** 渲染推荐媒体为视频（单曲 BGM，兼容旧签名）。 */
    public Path render(List<Long> ids, String title, String format, String resolution, String bgmPath) {
        return render(ids, title, format, resolution,
                bgmPath == null || bgmPath.isBlank() ? null : List.of(bgmPath), null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1, null);
    }

    /**
     * 渲染推荐媒体为视频（MP4/WebM），返回成品路径（已落在导出目录）。
     *
     * @param ids         媒体 id 列表
     * @param title       推荐页标题文案（主题），空 → 默认
     * @param format      视频格式 MP4/WEBM，空 → mp4
     * @param resolution  清晰度 720P/1080P/4K
     * @param bgmPaths    背景音乐文件列表（顺序播放；音频由 Remotion 内建混入），null/空 → 无 BGM
     * @param bgmTracks   背景音乐曲目（BGM 条显示 + 曲长），null/空 → 无 BGM 信息
     * @param groupBy     分组维度（none/year/subcategory/collection），空 → 不分组
     * @param groupStyle  模板形态（chapter 章节叙事 / clip 片段优先）
     * @param subtitle    副标题（可空）
     * @param coverSize   开场封面大小 0-100
     * @param openingIds  开场代表秀子集（空 → 开场全显）
     * @param intro       主题简介（空 → 不显示序言页）
     * @param durations   显示时长（开局/序言/章节页/资料卡/结尾，秒）
     */
    public Path render(List<Long> ids, String title, String format, String resolution, List<String> bgmPaths,
                       List<RecommendService.BgmTrack> bgmTracks, String groupBy, String groupStyle,
                       String subtitle, String coverSize, List<Long> openingIds, String intro,
                       RecommendService.Durations durations, String endingTitle, String endingText,
                       String bgColor, List<String> bgImages, Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                       String prologueTitle,
                       String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                       Integer bgmScale,
                       Integer bgmX, Integer bgmY, String brandTitle, Integer perScreen,
                       Map<String, Boolean> detailShow) {
        return render(ids, title, format, resolution, bgmPaths, bgmTracks, groupBy, groupStyle,
                subtitle, coverSize, openingIds, intro, durations, endingTitle, endingText, bgColor,
                bgImages, bgRotationSec, bgOpacity, bgBlur, bgBrightness, prologueTitle, groupSort,
                openingSpeed, endingScrollSpeed, bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow, null);
    }

    public Path render(List<Long> ids, String title, String format, String resolution, List<String> bgmPaths,
                       List<RecommendService.BgmTrack> bgmTracks, String groupBy, String groupStyle,
                       String subtitle, String coverSize, List<Long> openingIds, String intro,
                       RecommendService.Durations durations, String endingTitle, String endingText,
                       String bgColor, List<String> bgImages, Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                       String prologueTitle,
                       String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                       Integer bgmScale,
                       Integer bgmX, Integer bgmY, String brandTitle, Integer perScreen,
                       Map<String, Boolean> detailShow,
                       Map<Long, RecommendMediaClips> requestedClips) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("ids 不能为空");
        }
        int[] wh = RESOLUTIONS.get(normalize(resolution));
        if (wh == null) {
            throw new IllegalArgumentException("未知清晰度: " + resolution + "（可选 720P/1080P/4K）");
        }
        String fmt = FORMATS.get(normalize(format));
        if (fmt == null) {
            throw new IllegalArgumentException("未知格式: " + format + "（可选 MP4/WEBM）");
        }

        Path work = null;
        try {
            work = Files.createTempDirectory("vt-recommend-");
            // 片段素材：按选中范围裁剪进工作目录（Remotion 只读已准备素材）
            Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips = Map.of();
            if (requestedClips != null && !requestedClips.isEmpty()) {
                if (clipSourceService == null) {
                    throw new IllegalStateException("未启用片段素材准备（clipSourceService 缺失）");
                }
                RecommendClipSourceService.PreparedClips result = clipSourceService.prepare(requestedClips, work);
                if (result.hasMissing()) {
                    throw new IllegalArgumentException("片段素材不可用: " + result.missing().stream()
                            .map(m -> "#" + m.clipId() + "(" + m.reason() + ")").toList());
                }
                preparedClips = result.byMedia();
            }
            return renderWithRemotion(work, ids, title, fmt, wh, bgmPaths, bgmTracks, groupBy, groupStyle,
                    openingIds, intro, durations, endingTitle, endingText, bgColor, bgImages, bgRotationSec,
                    bgOpacity, bgBlur, bgBrightness, prologueTitle, groupSort, openingSpeed,
                    endingScrollSpeed, bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow, preparedClips,
                    subtitle, coverSize);
        } catch (IOException e) {
            throw new IllegalStateException("渲染准备失败: " + e.getMessage(), e);
        } finally {
            deleteTree(work);
        }
    }

    /**
     * Remotion 逐帧渲染：写 RenderInput → 起 node → 收产物。
     *
     * 音频（素材原声 + BGM + ducking）在当前渲染内完成，因此这里**不再有** FFmpeg 混流与无音轨回退。
     */
    private Path renderWithRemotion(Path work, List<Long> ids, String title, String fmt, int[] wh,
                                    List<String> bgmPaths, List<RecommendService.BgmTrack> bgmTracks,
                                    String groupBy, String groupStyle, List<Long> openingIds, String intro,
                                    RecommendService.Durations durations, String endingTitle, String endingText,
                                    String bgColor, List<String> bgImages, Integer bgRotationSec, Integer bgOpacity,
                                    Integer bgBlur, Integer bgBrightness, String prologueTitle, String groupSort,
                                    Integer openingSpeed, Integer endingScrollSpeed, Integer bgmScale, Integer bgmX,
                                    Integer bgmY, String brandTitle, Integer perScreen, Map<String, Boolean> detailShow,
                                    Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips,
                                    String subtitle, String coverSize) throws IOException {
        Path remotion = resolveRemotionDir();
        if (remotion == null) {
            throw new IllegalStateException("未找到 Remotion 工程（期望 <remotion-dir>/scripts/render-recommend.ts，"
                    + "当前配置 " + remotionDir + "）");
        }

        // BGM：把上传的临时文件复制进工作目录，并给出与曲目一一对应的相对路径（素材服务按相对路径取用）
        List<String> bgmRelPaths = new ArrayList<>();
        List<RecommendService.BgmTrack> audioTracks = new ArrayList<>();
        if (bgmPaths != null) {
            int index = 0;
            for (String source : bgmPaths) {
                if (source == null || source.isBlank()) continue;
                Path from = Paths.get(source);
                String rel = "bgm-" + (++index) + audioExtension(source);
                Files.copy(from, work.resolve(rel), StandardCopyOption.REPLACE_EXISTING);
                bgmRelPaths.add(rel);
                String name = "BGM " + index;
                if (bgmTracks != null && bgmTracks.size() >= index) {
                    RecommendService.BgmTrack named = bgmTracks.get(index - 1);
                    if (named != null && named.name() != null && !named.name().isBlank()) {
                        name = named.name();
                    }
                }
                audioTracks.add(new RecommendService.BgmTrack(name, null));
            }
        }

        String inputJson = recommendService.buildRenderInput(ids, title, audioTracks, subtitle, coverSize, groupBy,
                groupStyle, openingIds, intro, durations, endingTitle, endingText, bgColor, bgImages, bgRotationSec,
                bgOpacity, bgBlur, bgBrightness, prologueTitle, groupSort, openingSpeed, endingScrollSpeed, bgmScale,
                bgmX, bgmY, brandTitle, perScreen, detailShow, preparedClips, "embed", 30, wh[0], wh[1],
                bgmRelPaths,
                rel -> probeMediaDuration(work.resolve(rel).toAbsolutePath().toString()));
        Path inputFile = work.resolve("render-input.json");
        Files.writeString(inputFile, inputJson, StandardCharsets.UTF_8);
        Path rendered = work.resolve("rendered." + fmt);
        Path out = uniqueExportName(title, fmt);

        var cmd = new ArrayList<String>();
        cmd.add(nodePath);
        cmd.add(remotion.resolve("node_modules/tsx/dist/cli.mjs").toAbsolutePath().toString());
        cmd.add(remotion.resolve("scripts/render-recommend.ts").toAbsolutePath().toString());
        cmd.add("--input"); cmd.add(inputFile.toAbsolutePath().toString());
        cmd.add("--output"); cmd.add(rendered.toAbsolutePath().toString());
        cmd.add("--asset-root"); cmd.add(work.toAbsolutePath().toString());
        cmd.add("--format"); cmd.add(fmt);
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(remotion.toFile());
        pb.redirectErrorStream(true);
        log.info("Remotion 渲染推荐视频: {} 部, {}x{}, BGM {} 曲, node={}, remotion={}",
                ids.size(), wh[0], wh[1], bgmRelPaths.size(), nodePath, remotion);
        long t0 = System.currentTimeMillis();
        Process p = pb.start();
        String output = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        boolean finished;
        try {
            finished = p.waitFor(RENDER_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            p.destroyForcibly();
            throw new IllegalStateException("Remotion 渲染被中断", e);
        }
        if (!finished) {
            p.destroyForcibly();
            throw new IllegalStateException("Remotion 渲染超时（>" + RENDER_TIMEOUT_SECONDS + "s）");
        }
        if (p.exitValue() != 0) {
            log.error("Remotion 渲染失败 {}:\n{}", p.exitValue(), output);
            throw new IllegalStateException("Remotion 渲染失败（node 退出 " + p.exitValue() + "）: " + lastLines(output));
        }
        if (!Files.exists(rendered) || Files.size(rendered) < 1024) {
            log.error("Remotion 产物为空:\n{}", output);
            throw new IllegalStateException("Remotion 渲染失败（产物为空）");
        }
        log.info("Remotion 渲染完成 {}（{}s，{}KB）", rendered.getFileName(),
                (System.currentTimeMillis() - t0) / 1000.0, Files.size(rendered) / 1024);

        Files.move(rendered, out, StandardCopyOption.REPLACE_EXISTING);
        if (!Files.exists(out) || Files.size(out) < 1024) {
            throw new IllegalStateException("Remotion 渲染失败（最终产物为空）");
        }
        log.info("Remotion 导出完成 {}（{}KB）", out.getFileName(), Files.size(out) / 1024);
        return out;
    }

    /** 产物文件名：标题清洗非法字符，空/纯非法 → recommend；同名追加 -N 防覆盖。 */
    private Path uniqueExportName(String title, String fmt) {
        String base = title == null ? "" : title.trim().replaceAll("[\\\\/:*?\"<>|\\r\\n]", "").trim();
        if (base.isEmpty()) base = "recommend";
        Path dir = Paths.get("data", "exports").toAbsolutePath();
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new IllegalStateException("创建导出目录失败: " + e.getMessage(), e);
        }
        Path candidate = dir.resolve(base + "." + fmt);
        int suffix = 1;
        while (Files.exists(candidate)) {
            candidate = dir.resolve(base + "-" + (++suffix) + "." + fmt);
        }
        return candidate;
    }

    /** 定位 Remotion 工程目录（IDE 从项目根、mvn 从 backend 启动，两者 cwd 不同）。 */
    private Path resolveRemotionDir() {
        List<Path> candidates = List.of(
                Paths.get(remotionDir),
                Paths.get(remotionDir).toAbsolutePath(),
                Paths.get("backend/remotion").toAbsolutePath(),
                Paths.get("../backend/remotion").toAbsolutePath(),
                Paths.get("remotion").toAbsolutePath());
        for (Path candidate : candidates) {
            if (Files.isRegularFile(candidate.resolve("scripts/render-recommend.ts"))) {
                return candidate.toAbsolutePath().normalize();
            }
        }
        return null;
    }

    /** 分辨率 → 像素（供预览等外部使用；未知/空 → 720P）。 */
    public static int[] pixelsOf(String resolution) {
        int[] wh = RESOLUTIONS.get(normalize(resolution == null || resolution.isBlank() ? "720P" : resolution));
        return wh == null ? RESOLUTIONS.get("720P") : wh;
    }

    /** 素材时长探测（秒）；探测不可用/失败返回 0。供预览组装 RenderInput 计算片段时长。 */
    public double probeDurationSeconds(String file) {
        return probeMediaDuration(file);
    }

    /** Remotion Player 预览页是否已构建（未构建时预览报错提示执行 `npm run build:player`）。 */
    public boolean hasPlayerBundle() {
        return playerPagePath() != null;
    }

    /** Player 预览页 HTML（已构建的 dist-player/player.html）。 */
    public Path playerPagePath() {
        Path remotion = resolveRemotionDir();
        if (remotion == null) return null;
        Path page = remotion.resolve("dist-player/player.html");
        return Files.isRegularFile(page) ? page : null;
    }

    private static void deleteTree(Path root) {
        if (root == null) return;
        try (var paths = Files.walk(root)) {
            paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                try { Files.deleteIfExists(path); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }

    private static String normalize(String resolution) {
        return resolution == null ? null : resolution.trim().toUpperCase(Locale.ROOT);
    }

    /** BGM 临时文件扩展名（按源文件名推断，未知 → .mp3）。 */
    private static String audioExtension(String file) {
        String lower = file.toLowerCase(Locale.ROOT);
        for (String ext : List.of(".m4a", ".wav", ".ogg", ".flac", ".aac")) {
            if (lower.endsWith(ext)) return ext;
        }
        return ".mp3";
    }

    private static String lastLines(String output) {
        if (output == null || output.isBlank()) {
            return "无输出";
        }
        String[] lines = output.split("\\R");
        int from = Math.max(0, lines.length - 8);
        return String.join(" | ", java.util.Arrays.copyOfRange(lines, from, lines.length));
    }

    /** 探测音频/视频文件时长（秒）：优先 ffprobe（与 ffmpeg 同目录），回退 ffmpeg -i 解析。失败 → 0。 */
    private double probeMediaDuration(String file) {
        try {
            Path ffprobe = ffprobePath();
            if (ffprobe != null) {
                ProcessBuilder pb = new ProcessBuilder(ffprobe.toString(), "-v", "error",
                        "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file);
                pb.redirectErrorStream(true);
                Process p = pb.start();
                String out = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
                p.waitFor();
                if (!out.isEmpty()) {
                    return Double.parseDouble(out.trim().split("\\s+")[0]);
                }
            }
            // 回退：ffmpeg -i 解析 stderr 的 Duration: HH:MM:SS.cc
            ProcessBuilder pb = new ProcessBuilder(ffmpegPath, "-i", file);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            String err = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            p.waitFor();
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("Duration: (\\d{2}):(\\d{2}):(\\d{2}\\.?\\d*)").matcher(err);
            if (m.find()) {
                return Integer.parseInt(m.group(1)) * 3600 + Integer.parseInt(m.group(2)) * 60
                        + Double.parseDouble(m.group(3));
            }
        } catch (Exception e) {
            log.warn("探测素材时长失败 {}: {}", file, e.getMessage());
        }
        return 0;
    }

    /**
     * ffprobe 定位：优先配置的 ffprobe-path，否则取 ffmpeg-path 同目录同名文件。
     * 取不到 → 片段开放时长与 BGM 曲长按 0 处理（Remotion 侧按均分兜底）。
     */
    private Path ffprobePath() {
        try {
            if (ffprobePath != null && !ffprobePath.isBlank()) {
                Path configured = Path.of(ffprobePath).toAbsolutePath();
                if (Files.isRegularFile(configured)) return configured;
                log.warn("配置的 ffprobe 不存在: {}（时长探测回退 ffmpeg -i）", ffprobePath);
            }
            Path ff = Path.of(ffmpegPath).toAbsolutePath();
            String name = ff.getFileName() == null ? "ffmpeg" : ff.getFileName().toString();
            String probeName = name.endsWith(".exe") ? "ffprobe.exe" : "ffprobe";
            Path probe = ff.getParent().resolve(probeName);
            return Files.isRegularFile(probe) ? probe : null;
        } catch (Exception e) {
            return null;
        }
    }
}
