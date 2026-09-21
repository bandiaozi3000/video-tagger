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
    /**
     * 渲染过程回调（2026-09-21）：导出任务用它拿子进程 pid（启动接管时杀遗留）与进度。
     * 同步调用方传 null 即可。
     */
    public interface RenderCallbacks {
        default void onPid(long pid) {
        }

        default void onProgress(int percent) {
        }

        /** 已完成块数 / 总块数（分块渲染时上报）。 */
        default void onChunks(int done, int total) {
        }

        /** 实时状态文案（准备素材 3/11 / 渲染第 3/16 块 / 拼接收尾）。 */
        default void onStage(String text) {
        }

        /** 段边界帧（探帧时上报一次）：导出任务存下来，供"只重渲某块"的安全校验。 */
        default void onBoundaries(java.util.List<Integer> frames) {
        }

        /** 每块渲完后问一次：false = 用户暂停/取消了 → 停下并保留已完成块。 */
        default boolean shouldContinue() {
            return true;
        }
    }

    /**
     * 渲染子进程的**看活阀值**（分钟）：多久没有任何 stdout 输出就判死。
     *
     * 渲染脚本每 ~4s 打一行进度，正常情况下永远碰不到；真卡住时也能比“等总时长到点”早得多地报错。
     */
    @Value("${videotagger.render.stale-minutes:30}")
    private long renderStaleMinutes = 30;

    /**
     * 渲染子进程的**总时长上上限**（分钟）。
     *
     * 2026-09-20 第二轮：用户要“继续调大”——实测本机草稿（46528 帧/32 分钟成片）
     * 1080P 约 2.3~4.8 小时、4K 约 7~15 小时 → 默认抬到 24 小时（相当于不拦），
     * 真正的保险交给上面的“无进度即判死”。
     */
    @Value("${videotagger.render.timeout-minutes:1440}")
    private long renderTimeoutMinutes = 1440;

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
    private final MediaProbe mediaProbe;

    @Autowired
    public RecommendVideoService(RecommendService recommendService,
                                 RecommendClipSourceService clipSourceService,
                                 MediaProbe mediaProbe,
                                 @Value("${videotagger.render.node-path}") String nodePath,
                                 @Value("${videotagger.render.ffmpeg-path}") String ffmpegPath,
                                 @Value("${videotagger.render.remotion-dir:backend/remotion}") String remotionDir,
                                 @Value("${videotagger.render.timeout-minutes:1440}") long timeoutMinutes,
                                 @Value("${videotagger.render.stale-minutes:30}") long staleMinutes) {
        this.recommendService = recommendService;
        this.clipSourceService = clipSourceService;
        this.mediaProbe = mediaProbe;
        this.nodePath = nodePath;
        this.ffmpegPath = ffmpegPath;
        this.remotionDir = remotionDir;
        this.renderTimeoutMinutes = timeoutMinutes > 0 ? timeoutMinutes : 1440;
        this.renderStaleMinutes = staleMinutes > 0 ? staleMinutes : 30;
    }

    /** 测试/无片段场景用的简化构造（clipSourceService 为空 → 不支持片段）。 */
    public RecommendVideoService(RecommendService recommendService, String nodePath, String ffmpegPath) {
        this(recommendService, null, new MediaProbe(ffmpegPath, ""), nodePath, ffmpegPath, "backend/remotion", 1440, 30);
    }

    public Path render(List<Long> ids, String resolution) {
        return render(ids, null, null, resolution, null, null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1, null, null, null, null, null, null, null, null, null, null);
    }

    /** 渲染推荐媒体为视频（无 BGM）。 */
    public Path render(List<Long> ids, String title, String format, String resolution) {
        return render(ids, title, format, resolution, null, null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1, null, null, null, null, null, null, null, null, null, null);
    }

    /** 渲染推荐媒体为视频（单曲 BGM，兼容旧签名）。 */
    public Path render(List<Long> ids, String title, String format, String resolution, String bgmPath) {
        return render(ids, title, format, resolution,
                bgmPath == null || bgmPath.isBlank() ? null : List.of(bgmPath), null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1, null, null, null, null, null, null, null, null, null, null);
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
                       Map<String, Boolean> detailShow, Integer seed, Integer clipVolume, String bgmRange,
                       String stingPath, Integer stingVolume, java.nio.file.Path workDir,
                       RenderCallbacks callbacks) {
        return render(ids, title, format, resolution, bgmPaths, bgmTracks, groupBy, groupStyle,
                subtitle, coverSize, openingIds, intro, durations, endingTitle, endingText, bgColor,
                bgImages, bgRotationSec, bgOpacity, bgBlur, bgBrightness, prologueTitle, groupSort,
                openingSpeed, endingScrollSpeed, bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow, null, null, seed, clipVolume, bgmRange,
                stingPath, stingVolume, workDir, callbacks);
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
                       Map<String, Boolean> detailShow, String preset,
                       Map<Long, RecommendMediaClips> requestedClips, Integer seed, Integer clipVolume, String bgmRange,
                       String stingPath, Integer stingVolume, java.nio.file.Path workDir,
                       RenderCallbacks callbacks) {
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

        boolean ownsWorkDir = workDir == null;   // 外部给目录 = 持久工作目录（由导出任务管理生命周期）
        Path work = null;
        try {
            work = ownsWorkDir ? Files.createTempDirectory("vt-recommend-") : workDir;
            if (!ownsWorkDir) Files.createDirectories(work);
            // 片段素材：按选中范围裁剪进工作目录（Remotion 只读已准备素材）
            Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips = Map.of();
            if (requestedClips != null && !requestedClips.isEmpty()) {
                if (clipSourceService == null) {
                    throw new IllegalStateException("未启用片段素材准备（clipSourceService 缺失）");
                }
                RecommendClipSourceService.PreparedClips result = clipSourceService.prepare(requestedClips, work,
                        RecommendService.fpsOf(groupStyle));
                if (result.hasMissing()) {
                    throw new IllegalArgumentException("片段素材不可用: " + result.missing().stream()
                            .map(m -> "#" + m.clipId() + "(" + m.reason() + ")").toList());
                }
                preparedClips = result.byMedia();
            }
            return renderWithRemotion(work, ids, title, fmt, wh, bgmPaths, bgmTracks, groupBy, groupStyle,
                    openingIds, intro, durations, endingTitle, endingText, bgColor, bgImages, bgRotationSec,
                    bgOpacity, bgBlur, bgBrightness, prologueTitle, groupSort, openingSpeed,
                    endingScrollSpeed, bgmScale, bgmX, bgmY, brandTitle, perScreen, detailShow, preset, preparedClips,
                    subtitle, coverSize, seed, clipVolume, bgmRange, stingPath, stingVolume, callbacks);
        } catch (IOException e) {
            throw new IllegalStateException("渲染准备失败: " + e.getMessage(), e);
        } finally {
            // 只有自建临时目录才自动清；持久工作目录交给调用方（成功才清 / 中断保留）
            if (ownsWorkDir) deleteTree(work);
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
                                    Integer bgmY, String brandTitle, Integer perScreen, Map<String, Boolean> detailShow, String preset,
                                    Map<Long, List<RecommendClipSourceService.PreparedClip>> preparedClips,
                                    String subtitle, String coverSize, Integer seed, Integer clipVolume, String bgmRange,
                                    String stingSource, Integer stingVolume,
                                    RenderCallbacks callbacks) throws IOException {
        Path remotion = resolveRemotionDir();
        if (remotion == null) {
            throw new IllegalStateException("未找到 Remotion 工程（期望 <remotion-dir>/scripts/render-recommend.ts，"
                    + "当前配置 " + remotionDir + "）");
        }

        // 转场音乐（片名卡专用）：与 BGM 同型——拷进工作目录，传给渲染侧一个相对路径
        String stingRel = null;
        if (stingSource != null && !stingSource.isBlank()) {
            stingRel = "sting-0" + audioExtension(stingSource);
            Files.copy(Paths.get(stingSource), work.resolve(stingRel), StandardCopyOption.REPLACE_EXISTING);
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
                bgmX, bgmY, brandTitle, perScreen, detailShow, preset, preparedClips, "embed",
                RecommendService.fpsOf(groupStyle), wh[0], wh[1],
                bgmRelPaths,
                rel -> mediaProbe.durationSeconds(work.resolve(rel).toAbsolutePath().toString()),
                seed, clipVolume, bgmRange, stingRel, stingVolume);
        Path inputFile = work.resolve("render-input.json");
        Files.writeString(inputFile, inputJson, StandardCharsets.UTF_8);
        Path out = uniqueExportName(title, fmt);
        log.info("Remotion 渲染推荐视频: {} 部, {}x{}, BGM {} 曲, node={}, remotion={}",
                ids.size(), wh[0], wh[1], bgmRelPaths.size(), nodePath, remotion);

        return renderChunksAndConcat(remotion, work, inputFile, out, fmt.toLowerCase(), RecommendService.fpsOf(groupStyle), callbacks);
    }

    /** 块内进度 → 总进度（第 i 块占 1/N，(i + 块内百分比)/N）。 */
    private static RenderCallbacks mapChunkProgress(RenderCallbacks base, int chunkIndex, int chunkCount) {
        if (base == null) {
            return null;
        }
        return new RenderCallbacks() {
            @Override
            public void onPid(long pid) {
                base.onPid(pid);
            }

            @Override
            public void onProgress(int localPercent) {
                int total = (int) Math.round((chunkIndex + Math.max(0, Math.min(100, localPercent)) / 100.0) / chunkCount * 100);
                base.onProgress(Math.max(0, Math.min(100, total)));
            }

            @Override
            public void onChunks(int done, int count) {
                base.onChunks(done, count);
            }

            @Override
            public void onStage(String text) {
                base.onStage(text);
            }
        };
    }

    /** ffmpeg 拼接（-c copy 不重编码；清单里的 duration 是 spike 实测必须写的）。 */
    private void concatChunks(Path listFile, Path rendered, Path work) {
        List<String> cmd = new ArrayList<>();
        cmd.add(ffmpegPath);
        cmd.add("-hide_banner");
        cmd.add("-v"); cmd.add("error");
        cmd.add("-y");
        cmd.add("-f"); cmd.add("concat");
        cmd.add("-safe"); cmd.add("0");
        cmd.add("-i"); cmd.add(listFile.toAbsolutePath().toString());
        cmd.add("-c"); cmd.add("copy");
        cmd.add(rendered.toAbsolutePath().toString());
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(work.toFile());
            pb.redirectErrorStream(true);
            Process p = pb.start();
            String output;
            try (var in = p.getInputStream()) {
                output = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
            if (!p.waitFor(30, TimeUnit.MINUTES)) {
                p.destroyForcibly();
                throw new IllegalStateException("拼接超时（ffmpeg >30 分钟）");
            }
            if (p.exitValue() != 0) {
                throw new IllegalStateException("拼接失败（ffmpeg 退出 " + p.exitValue() + "）: " + lastLines(output));
            }
        } catch (IOException e) {
            throw new IllegalStateException("拼接失败: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("拼接被中断", e);
        }
    }

    /**
     * 续渲：**跳过素材准备**，直接用工作目录里已有的 `render-input.json` 接着分块渲（设计规格 §11）。
     *
     * 为什么不用重建请求：工作目录里已经躺着裁剪好的片段、BGM、转场音与渲染输入 JSON ——
     * 素材准备是分钟级且不可续的，续渲的价值就在跳过它。
     */
    public Path resumeFromWorkDir(Path work, String fmt, RenderCallbacks callbacks) {
        return resumeFromWorkDir(work, fmt, callbacks, null);
    }

    /**
     * 续渲 / 局部重渲的入口。
     *
     * @param overwrite 非空 = 写到这个路径（局部重渲直接覆盖原成品）；空 = 另存一个不重名的文件
     */
    public Path resumeFromWorkDir(Path work, String fmt, RenderCallbacks callbacks, Path overwrite) {
        Path remotion = resolveRemotionDir();
        if (remotion == null) {
            throw new IllegalStateException("未找到 Remotion 工程（期望 <remotion-dir>/scripts/render-recommend.ts）");
        }
        Path inputFile = work.resolve("render-input.json");
        if (!Files.exists(inputFile)) {
            throw new IllegalStateException("工作目录缺少 render-input.json，无法续渲: " + work);
        }
        String format = fmt == null || fmt.isBlank() ? "MP4" : fmt;
        String lower = format.toLowerCase();
        Path out = overwrite != null ? overwrite : uniqueExportName(null, lower);
        try {
            return renderChunksAndConcat(remotion, work, inputFile, out, lower, RecommendService.fpsOf(null), callbacks);
        } catch (IOException e) {
            throw new IllegalStateException("续渲失败: " + e.getMessage(), e);
        }
    }

    /** 分块 + 拼接的共用尾巴（首次导出与续渲都走这里）。 */
    private Path renderChunksAndConcat(Path remotion, Path work, Path inputFile, Path out, String lower, int fallbackFps,
                                       RenderCallbacks callbacks) throws IOException {
        String probeOutput = runRenderNode(remotion, work, inputFile, work.resolve("probe.bin"), lower, null, true, callbacks);
        int totalFrames = parseJsonInt(probeOutput, "durationInFrames", -1);
        int fps = parseJsonInt(probeOutput, "fps", fallbackFps);
        // 优先按**时间轴段边界**切（切点落在转场处）；拿不到边界就回退固定 2 分钟切法
        List<Integer> boundaryFrames = RenderChunks.parseBoundaryFrames(probeOutput);
        if (callbacks != null && !boundaryFrames.isEmpty()) {
            callbacks.onBoundaries(boundaryFrames);
        }
        List<RenderChunks.Chunk> chunks = boundaryFrames.isEmpty()
                ? RenderChunks.plan(totalFrames, fps)
                : RenderChunks.planByBoundaries(boundaryFrames, totalFrames, RenderChunks.chunkFrames(fps));
        if (chunks.isEmpty()) {
            throw new IllegalStateException("续渲失败（合成总帧数为 " + totalFrames + "）");
        }
        int done = 0;
        for (RenderChunks.Chunk chunk : chunks) {
            Path chunkFile = work.resolve(RenderChunks.chunkFileName(chunk.index()));
            if (Files.exists(chunkFile) && Files.size(chunkFile) > 1024) {
                done++;
                continue;
            }
            if (callbacks != null) {
                callbacks.onChunks(done, chunks.size());
                callbacks.onStage("渲染第 " + (chunk.index() + 1) + "/" + chunks.size() + " 块");
            }
            RuntimeException last = null;
            for (int attempt = 0; attempt < 2; attempt++) {
                try {
                    runRenderNode(remotion, work, inputFile, chunkFile, lower,
                            new int[]{chunk.fromFrame(), chunk.toFrame()}, false,
                            mapChunkProgress(callbacks, chunk.index(), chunks.size()));
                    last = null;
                    break;
                } catch (RuntimeException e) {
                    last = e;
                    log.warn("第 {} 块渲染失败（第 {} 次）: {}", chunk.index() + 1, attempt + 1, e.getMessage());
                }
            }
            if (last != null) {
                throw last;
            }
            done++;
            if (callbacks != null) {
                callbacks.onChunks(done, chunks.size());
                if (!callbacks.shouldContinue()) {
                    throw new RenderPausedException("已暂停（已完成 " + done + "/" + chunks.size() + " 块，工作目录保留）");
                }
            }
        }
        Path rendered = work.resolve("rendered." + lower);
        if (chunks.size() == 1) {
            Files.move(work.resolve(RenderChunks.chunkFileName(0)), rendered, StandardCopyOption.REPLACE_EXISTING);
        } else {
            if (callbacks != null) {
                callbacks.onStage("拼接收尾");
                callbacks.onProgress(100);
            }
            Path listFile = work.resolve("concat-list.txt");
            Files.writeString(listFile, RenderChunks.concatList(chunks, fps), StandardCharsets.UTF_8);
            concatChunks(listFile, rendered, work);
        }
        if (!Files.exists(rendered) || Files.size(rendered) < 1024) {
            throw new IllegalStateException("拼接产物为空");
        }
        Files.move(rendered, out, StandardCopyOption.REPLACE_EXISTING);
        return out;
    }

    /**
     * 解析渲染子进程的进度行（`{"progress":0.42,"frames":1234,"encoded":900,"ms":45678}`）→ 百分比。
     *
     * 用正则而不是 JSON：只为拿一个 0-100 的数，不值得给渲染链引入 JSON 依赖（2026-09-20 的取舍）。
     * 不能要求整行就是 JSON：Java 把 stderr 也并进了 stdout，Remotion 自己的进度条用回车刷新、
     * 会和上报行挤在同一行里 → 所以全行搜、取**最后一个**匹配（最新的那一条）。
     * 不是进度行 → 空（普通日志、错误栈都会被忽略）。
     */
    static java.util.OptionalInt parseProgressPercent(String line) {
        if (line == null || !line.contains("\"progress\"")) return java.util.OptionalInt.empty();
        var matcher = java.util.regex.Pattern.compile("\"progress\"\\s*:\\s*([0-9]*\\.?[0-9]+)").matcher(line);
        String raw = null;
        while (matcher.find()) raw = matcher.group(1);
        if (raw == null) return java.util.OptionalInt.empty();
        try {
            double ratio = Double.parseDouble(raw);
            return java.util.OptionalInt.of((int) Math.round(Math.max(0, Math.min(1, ratio)) * 100));
        } catch (NumberFormatException e) {
            return java.util.OptionalInt.empty();
        }
    }

    /** 从脚本输出里取一个整数（`{"durationInFrames":1803,...}`）；没有就返回默认值。 */
    static int parseJsonInt(String output, String key, int fallback) {
        if (output == null || output.isBlank()) {
            return fallback;
        }
        var matcher = java.util.regex.Pattern.compile("\"" + key + "\"\\s*:\\s*([0-9]+)").matcher(output);
        int value = fallback;
        while (matcher.find()) {
            value = Integer.parseInt(matcher.group(1));
        }
        return value;
    }

    /** 暂停/取消时抛出：任务服务据此**保留**工作目录且不标 ERROR。 */
    public static class RenderPausedException extends RuntimeException {
        public RenderPausedException(String message) {
            super(message);
        }
    }

    /**
     * 跑一次渲染子进程（探帧 / 单块 / 整段共用）：起 node → 收 stdout（解析进度）→ 看门狗 → 校验产物。
     *
     * @param frames null = 整段；否则 [起始帧, 结束帧]（含两端）
     * @param probe  true = 只探合成信息（不渲染，不产出文件）
     */
    private String runRenderNode(Path remotion, Path work, Path inputFile, Path output, String fmt,
                                 int[] frames, boolean probe, RenderCallbacks callbacks) {
        var cmd = new ArrayList<String>();
        cmd.add(nodePath);
        cmd.add(remotion.resolve("node_modules/tsx/dist/cli.mjs").toAbsolutePath().toString());
        cmd.add(remotion.resolve("scripts/render-recommend.ts").toAbsolutePath().toString());
        cmd.add("--input"); cmd.add(inputFile.toAbsolutePath().toString());
        cmd.add("--output"); cmd.add(output.toAbsolutePath().toString());
        cmd.add("--asset-root"); cmd.add(work.toAbsolutePath().toString());
        cmd.add("--format"); cmd.add(fmt);
        if (frames != null) {
            cmd.add("--frames"); cmd.add(frames[0] + "-" + frames[1]);
        }
        if (probe) {
            cmd.add("--probe");
        }
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(remotion.toFile());
        pb.redirectErrorStream(true);
        long t0 = System.currentTimeMillis();
        Process p;
        try {
            p = pb.start();
        } catch (IOException e) {
            throw new IllegalStateException("启动渲染进程失败: " + e.getMessage(), e);
        }
        if (callbacks != null) {
            try {
                callbacks.onPid(p.pid());
            } catch (RuntimeException ignored) {
                // 回调失败不能影响渲染
            }
        }
        // 先起排空线程再 waitFor：readAllBytes() 会阻塞在管道上，子进程卡死时超时永远不触发（v0.28 修复）
        // 同时它也是**看活信号**：每收到一行就记时间，长时间没有任何输出 → 判死（见下面的看门狗）
        java.util.concurrent.atomic.AtomicLong lastOutputAt = new java.util.concurrent.atomic.AtomicLong(System.currentTimeMillis());
        java.io.ByteArrayOutputStream sink = new java.io.ByteArrayOutputStream();
        Thread drainer = new Thread(() -> {
            // 按行读：进度行（{"progress":0.61,...}）解析后回调给任务，其余照样进 sink（报错用）。
            // BufferedReader.readLine 把 \n、\r、\r\n 都当换行，即使 stderr 被并进来（Remotion 进度条用回车刷新）也能逐行吐出来。
            try (var reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sink.write((line + "\n").getBytes(StandardCharsets.UTF_8));
                    lastOutputAt.set(System.currentTimeMillis());
                    if (callbacks == null) continue;
                    parseProgressPercent(line).ifPresent(pct -> {
                        try {
                            callbacks.onProgress(pct);
                        } catch (RuntimeException ignored) {
                            // 进度上报失败不能影响渲染
                        }
                    });
                }
            } catch (IOException ignored) {
                // 进程被杀时读取中断属正常
            }
        }, "recommend-render-output");
        drainer.setDaemon(true);
        drainer.start();
        // 看门狗（2026-09-20）：不再“一个总时长到点就杀”，而是两层 -
        //   · 卡死：`staleMinutes` 分钟没有任何输出 → 杀（渲染脚本每 ~4s 打一行进度，正常永远不会触发）
        //   · 总上限：`renderTimeoutMinutes`（很大，默 24h）→ 兜底用
        boolean finished = false;
        String killReason = null;
        try {
            while (true) {
                if (p.waitFor(30, TimeUnit.SECONDS)) {
                    finished = true;
                    break;
                }
                long idleMs = System.currentTimeMillis() - lastOutputAt.get();
                if (idleMs > renderStaleMinutes * 60_000L) {
                    killReason = "Remotion 渲染卡死（" + (idleMs / 60_000L) + " 分钟无任何输出）";
                    break;
                }
                if (System.currentTimeMillis() - t0 > renderTimeoutMinutes * 60_000L) {
                    killReason = "Remotion 渲染超时（>" + renderTimeoutMinutes + " 分钟）";
                    break;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            p.destroyForcibly();
            throw new IllegalStateException("Remotion 渲染被中断", e);
        }
        if (!finished) {
            p.destroyForcibly();
            throw new IllegalStateException(killReason + "。看活阀值/总上限可在 application.yml 调"
                    + " videotagger.render.stale-minutes / timeout-minutes");
        }
        try {
            drainer.join(TimeUnit.SECONDS.toMillis(5));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        String output2 = sink.toString(StandardCharsets.UTF_8);
        if (p.exitValue() != 0) {
            log.error("Remotion 渲染失败 {}:\n{}", p.exitValue(), output2);
            throw new IllegalStateException("Remotion 渲染失败（node 退出 " + p.exitValue() + "）: " + lastLines(output2));
        }
        if (!probe) {
            boolean ok;
            try {
                ok = Files.exists(output) && Files.size(output) >= 1024;
            } catch (IOException e) {
                ok = false;
            }
            if (!ok) {
                log.error("Remotion 产物为空:\n{}", output2);
                throw new IllegalStateException("Remotion 渲染失败（产物为空）");
            }
        }
        return output2;
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

    /** 素材时长探测（秒）；探测不可用/失败返回 0。供组装 RenderInput 计算片段与 BGM 时长。 */
    public double probeDurationSeconds(String file) {
        return mediaProbe.durationSeconds(file);
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

    /** BGM 临时文件扩展名（与 {@link RecommendSessionService#audioExtension} 同一份真值）。 */
    private static String audioExtension(String file) {
        return RecommendSessionService.audioExtension(file);
    }

    private static String lastLines(String output) {
        if (output == null || output.isBlank()) {
            return "无输出";
        }
        String[] lines = output.split("\\R");
        int from = Math.max(0, lines.length - 8);
        return String.join(" | ", java.util.Arrays.copyOfRange(lines, from, lines.length));
    }
}
