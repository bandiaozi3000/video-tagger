package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 推荐 HTML → MP4 视频渲染编排。
 *
 * 链路：RecommendService.buildHtml 生成自包含 HTML → 写临时文件 → ProcessBuilder 调
 * {@code node render.js}（puppeteer-core 连系统 Chrome 按 screencast 抓帧 + ffmpeg 合成）→
 * 返回 mp4 路径。同步阻塞直至渲染完成。
 *
 * 依赖本机工具链（node / Chrome / ffmpeg），Docker 容器内未装 → 配置缺失时给出清晰错误。
 */
@Service
public class RecommendVideoService {

    private static final Logger log = LoggerFactory.getLogger(RecommendVideoService.class);
    private static final DateTimeFormatter FILE_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final int MAX_MEDIA_COUNT = 30; // 防超长导览渲染
    private static final long RENDER_TIMEOUT_SECONDS = 20 * 60;

    /** 分辨率 → 像素。 */
    private static final Map<String, int[]> RESOLUTIONS = Map.of(
            "720P", new int[]{1280, 720},
            "1080P", new int[]{1920, 1080},
            "4K", new int[]{3840, 2160});

    /** 视频格式 → 输出扩展名（render.js 按此选 ffmpeg 编码器）。 */
    private static final Map<String, String> FORMATS = Map.of(
            "MP4", "mp4",
            "WEBM", "webm");

    private final RecommendService recommendService;

    private final String scriptsDir;
    private final String nodePath;
    private final String chromePath;
    private final String ffmpegPath;

    public RecommendVideoService(RecommendService recommendService,
                                 @Value("${videotagger.render.scripts-dir}") String scriptsDir,
                                 @Value("${videotagger.render.node-path}") String nodePath,
                                 @Value("${videotagger.render.chrome-path}") String chromePath,
                                 @Value("${videotagger.render.ffmpeg-path}") String ffmpegPath) {
        this.recommendService = recommendService;
        this.scriptsDir = scriptsDir;
        this.nodePath = nodePath;
        this.chromePath = chromePath;
        this.ffmpegPath = ffmpegPath;
    }

    /** 渲染推荐媒体为视频（MP4/WebM），返回临时文件路径（调用方负责删除）。 */
    public Path render(List<Long> ids, String resolution) {
        return render(ids, null, null, resolution, null, null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1);
    }

    /** 渲染推荐媒体为视频（无 BGM）。 */
    public Path render(List<Long> ids, String title, String format, String resolution) {
        return render(ids, title, format, resolution, null, null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1);
    }

    /** 渲染推荐媒体为视频（单曲 BGM，兼容旧签名）。 */
    public Path render(List<Long> ids, String title, String format, String resolution, String bgmPath) {
        return render(ids, title, format, resolution,
                bgmPath == null || bgmPath.isBlank() ? null : List.of(bgmPath), null, null, null, null, null, null, null, null, null, null, null, null, 8, 100, 0, 50, null, null, 50, 50, 100, 1, 8, null, 1);
    }

    /**
     * 渲染推荐媒体为视频（MP4/WebM），返回临时文件路径（调用方负责删除）。
     *
     * @param ids         媒体 id 列表
     * @param title       推荐页标题文案（主题），空 → 默认
     * @param format      视频格式 MP4/WEBM，空 → mp4
     * @param resolution  清晰度 720P/1080P/4K
     * @param bgmPaths    背景音乐文件列表（多曲按序 ffmpeg concat 拼接后混入音轨），null/空 → 无 BGM
     * @param bgmTracks   背景音乐曲目（注入模板 BGM 条显示名称/进度/下一首提示；与 bgmPaths 同步），null/空 → 模板无 BGM 信息
     * @param groupBy     分组维度（none/year/subcategory/collection），空 → 不分组
     * @param groupStyle  分组呈现样式（stream/chapter/overview），空 → stream
     * @param subtitle    副标题（可空，模板主标题下方显示）
     * @param coverSize   开场封面大小 sm/md/lg（空 → md）
     * @param openingIds  开场代表秀子集（空 → 开场全显）
     * @param intro       主题简介（可空，模板开局后序言页显示；空 → 不显示序言页）
     * @param durations   显示时长（开局定格/序言/详情/结尾，秒）
     */
    public Path render(List<Long> ids, String title, String format, String resolution, List<String> bgmPaths,
                       List<RecommendService.BgmTrack> bgmTracks, String groupBy, String groupStyle,
                       String subtitle, String coverSize, List<Long> openingIds, String intro,
                       RecommendService.Durations durations, String endingTitle, String endingText,
                       String bgColor, List<String> bgImages, Integer bgRotationSec, Integer bgOpacity, Integer bgBlur, Integer bgBrightness,
                       String prologueTitle,
                       String groupSort, Integer openingSpeed, Integer endingScrollSpeed,
                       Integer bgmScale,
                       Integer bgmX, Integer bgmY, String brandTitle, Integer perScreen) {
        if (ids == null || ids.isEmpty()) {
            throw new IllegalArgumentException("ids 不能为空");
        }
        if (ids.size() > MAX_MEDIA_COUNT) {
            throw new IllegalArgumentException("单次最多导出 " + MAX_MEDIA_COUNT + " 部媒体");
        }
        int[] wh = RESOLUTIONS.get(normalize(resolution));
        if (wh == null) {
            throw new IllegalArgumentException("未知清晰度: " + resolution + "（可选 720P/1080P/4K）");
        }
        String fmt = FORMATS.get(normalize(format));
        if (fmt == null) {
            throw new IllegalArgumentException("未知格式: " + format + "（可选 MP4/WEBM）");
        }

        Path html = null;
        try {
            // 1. 生成自包含 HTML → 临时文件
            String htmlContent = recommendService.buildHtml(ids, title, bgmTracks, subtitle, coverSize, groupBy, groupStyle, openingIds, intro, durations, endingTitle, endingText, bgColor, bgImages, bgRotationSec, bgOpacity, bgBlur, bgBrightness, prologueTitle, groupSort, openingSpeed, endingScrollSpeed, bgmScale, bgmX, bgmY, brandTitle, perScreen);
            // 探测 BGM 时长并注入模板：模板 __bgmRemainSec 用它算「当前曲目剩余」，headless 下 audio.duration 不可靠
            List<Double> bgmDurs = new ArrayList<>();
            if (bgmPaths != null) {
                for (String p : bgmPaths) {
                    bgmDurs.add(probeMediaDuration(p));
                }
            }
            if (!bgmDurs.isEmpty()) {
                htmlContent = htmlContent.replace("const BGM_TRACK_DURS = [];",
                        "const BGM_TRACK_DURS = " + bgmDursJson(bgmDurs) + ";");
            }
            Path work = Files.createTempDirectory("vt-recommend-");
            html = work.resolve("recommend.html");
            Files.writeString(html, htmlContent, StandardCharsets.UTF_8);

            // 2. 背景音乐：多曲 → ffmpeg concat 拼接成单文件（统一 44100 stereo 顺序连接）；单曲直接用
            String bgmFile = null;
            if (bgmPaths != null && !bgmPaths.isEmpty()) {
                if (bgmPaths.size() == 1) {
                    bgmFile = bgmPaths.get(0);
                } else {
                    Path concat = work.resolve("bgm-concat.m4a");
                    List<String> cc = new ArrayList<>();
                    cc.add(ffmpegPath); cc.add("-y");
                    for (String p : bgmPaths) {
                        cc.add("-i"); cc.add(p);
                    }
                    StringBuilder fc = new StringBuilder();
                    for (int i = 0; i < bgmPaths.size(); i++) {
                        fc.append("[").append(i).append(":a]aresample=44100,aformat=channel_layouts=stereo[a")
                                .append(i).append("];");
                    }
                    fc.append("[a0]");
                    for (int i = 1; i < bgmPaths.size(); i++) {
                        fc.append("[a").append(i).append("]");
                    }
                    fc.append("concat=n=").append(bgmPaths.size()).append(":v=0:a=1[aout]");
                    cc.add("-filter_complex"); cc.add(fc.toString());
                    cc.add("-map"); cc.add("[aout]");
                    cc.add("-acodec"); cc.add("aac"); cc.add("-b:a"); cc.add("192k");
                    cc.add(concat.toAbsolutePath().toString());
                    ProcessBuilder pbc = new ProcessBuilder(cc);
                    pbc.redirectErrorStream(true);
                    Process pc = pbc.start();
                    String out2 = new String(pc.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                    int rc = pc.waitFor();
                    if (rc != 0) {
                        log.error("BGM concat 失败 {}:\n{}", rc, out2);
                        throw new IllegalStateException("BGM 拼接失败（ffmpeg 退出 " + rc + "）");
                    }
                    bgmFile = concat.toAbsolutePath().toString();
                }
            }

            // 3. 时长 = 开局定格 + 序言(如有) + 章节×真实组数(如有分组) + 详情×N + 结尾（精确对齐显示时长配置，无缓冲）
            int introDur = (intro != null && !intro.isBlank()) ? durations.intro() : 0;
            int groupDur = (groupBy != null && !groupBy.isBlank() && !"none".equals(groupBy))
                    ? durations.group() * recommendService.computeGroupCount(ids, groupBy) : 0;
            int durationSeconds = durations.opening() + introDur + groupDur
                    + durations.detail() * ids.size() + durations.ending();
            // 录制延长：结尾等当前 BGM 放完（模板 finishAuto 多等）→ render.js 兜底上限须覆盖「最长单曲余量」。
            // BGM 音轨 -stream_loop 无限循环，实际结束点由模板 data-tour-ended 驱动，这里只放宽兜底上限。
            int renderDurationSeconds = durationSeconds;
            if (!bgmDurs.isEmpty()) {
                double maxTrack = 0;
                for (double d : bgmDurs) {
                    maxTrack = Math.max(maxTrack, d);
                }
                if (maxTrack > 0) {
                    renderDurationSeconds = durationSeconds + (int) Math.ceil(maxTrack) + 5;
                }
            }

            // 3. 调 node render.js
            Path out = exportDir().resolve("recommend-" + LocalDateTime.now().format(FILE_TS) + "." + fmt);
            var cmd = new java.util.ArrayList<String>();
            cmd.add(nodePath);
            cmd.add("render.js");
            cmd.add("--html");
            cmd.add(html.toAbsolutePath().toString());
            cmd.add("--out");
            cmd.add(out.toAbsolutePath().toString());
            cmd.add("--width");
            cmd.add(String.valueOf(wh[0]));
            cmd.add("--height");
            cmd.add(String.valueOf(wh[1]));
            cmd.add("--duration");
            cmd.add(String.valueOf(renderDurationSeconds));
            cmd.add("--format");
            cmd.add(fmt);
            cmd.add("--chrome");
            cmd.add(chromePath);
            cmd.add("--ffmpeg");
            cmd.add(ffmpegPath);
            if (bgmFile != null) {
                cmd.add("--bgm");
                cmd.add(bgmFile);
            }
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(resolveScriptsDir().toFile());
            pb.redirectErrorStream(true);

            log.info("渲染推荐视频: {} 部, {} ({}x{}), 预计 {}s",
                    ids.size(), resolution, wh[0], wh[1], durationSeconds);
            long t0 = System.currentTimeMillis();
            Process p = pb.start();
            String output = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            boolean finished = p.waitFor(RENDER_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            long elapsed = System.currentTimeMillis() - t0;

            if (!finished) {
                p.destroyForcibly();
                throw new IllegalStateException("视频渲染超时（>" + RENDER_TIMEOUT_SECONDS + "s）");
            }
            if (p.exitValue() != 0) {
                log.error("render.js 失败退出 {}:\n{}", p.exitValue(), output);
                throw new IllegalStateException("视频渲染失败（node 退出 " + p.exitValue() + "）: "
                        + lastLines(output));
            }
            if (!Files.exists(out) || Files.size(out) < 1024) {
                log.error("渲染产物为空:\n{}", output);
                throw new IllegalStateException("视频渲染失败（产物为空）");
            }
            log.info("渲染完成 {}（{}s，{}KB）", out.getFileName(), elapsed / 1000.0,
                    Files.size(out) / 1024);
            return out;
        } catch (IOException e) {
            throw new IllegalStateException("视频渲染启动失败（工具链/IO）: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("视频渲染被中断", e);
        } finally {
            if (html != null) {
                try {
                    Files.deleteIfExists(html.getParent());
                } catch (IOException ignored) {
                }
            }
        }
    }

    /** 导出产物持久目录：data/exports（相对应用工作目录，自动创建）。产物存这里可被异步任务记录/打开/删除。 */
    private Path exportDir() throws IOException {
        Path d = Paths.get("data", "exports").toAbsolutePath();
        Files.createDirectories(d);
        return d;
    }

    /**
     * 定位 render.js 所在目录。配置值相对应用工作目录（IDE 从项目根、mvn 从 backend 启动，
     * 两者 cwd 不同），先按配置解析，找不到则按常见候选兜底，避免一种启动方式配置失效。
     */
    private Path resolveScriptsDir() {
        Path configured = Paths.get(scriptsDir);
        if (isRenderScript(configured)) {
            return configured;
        }
        List<Path> candidates = List.of(
                Paths.get(scriptsDir).toAbsolutePath(),
                Paths.get("backend/scripts").toAbsolutePath(),
                Paths.get("../backend/scripts").toAbsolutePath(),
                Paths.get("../scripts").toAbsolutePath(),
                Paths.get("scripts").toAbsolutePath());
        for (Path p : candidates) {
            if (isRenderScript(p)) {
                log.warn("scripts-dir {} 下无 render.js，改用 {}", scriptsDir, p);
                return p;
            }
        }
        return configured;
    }

    private static boolean isRenderScript(Path dir) {
        return dir != null && Files.isRegularFile(dir.resolve("render.js"));
    }

    private static String normalize(String resolution) {
        return resolution == null ? null : resolution.trim().toUpperCase(Locale.ROOT);
    }

    private static String lastLines(String output) {
        if (output == null || output.isBlank()) {
            return "无输出";
        }
        String[] lines = output.split("\\R");
        int from = Math.max(0, lines.length - 8);
        return String.join(" | ", java.util.Arrays.copyOfRange(lines, from, lines.length));
    }

    /** BGM 时长数组 → JS 数组字面量（点小数，规避 Locale 逗号）。 */
    private static String bgmDursJson(List<Double> durs) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < durs.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(String.format(Locale.ROOT, "%.2f", durs.get(i)));
        }
        return sb.append(']').toString();
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
            log.warn("探测 BGM 时长失败 {}: {}", file, e.getMessage());
        }
        return 0;
    }

    /** ffprobe 路径推导：与 ffmpeg 同目录、ffmpeg 换 ffprobe（存在才返回，否则 null 走 ffmpeg -i 回退）。 */
    private Path ffprobePath() {
        try {
            Path ff = Path.of(ffmpegPath).toAbsolutePath();
            String name = ff.getFileName() == null ? "ffmpeg" : ff.getFileName().toString();
            String probeName = name.endsWith(".exe")
                    ? "ffprobe.exe" : "ffprobe";
            Path probe = ff.getParent().resolve(probeName);
            return Files.isRegularFile(probe) ? probe : null;
        } catch (Exception e) {
            return null;
        }
    }
}
