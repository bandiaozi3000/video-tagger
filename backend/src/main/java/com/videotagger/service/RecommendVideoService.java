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
        return render(ids, null, null, resolution, null);
    }

    /** 渲染推荐媒体为视频（无 BGM）。 */
    public Path render(List<Long> ids, String title, String format, String resolution) {
        return render(ids, title, format, resolution, null);
    }

    /**
     * 渲染推荐媒体为视频（MP4/WebM），返回临时文件路径（调用方负责删除）。
     *
     * @param ids        媒体 id 列表
     * @param title      推荐页标题文案（主题），空 → 默认
     * @param format     视频格式 MP4/WEBM，空 → mp4
     * @param resolution 清晰度 720P/1080P/4K
     * @param bgmPath    背景音乐文件路径（循环混入音轨），null/空 → 无 BGM
     */
    public Path render(List<Long> ids, String title, String format, String resolution, String bgmPath) {
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
            String htmlContent = recommendService.buildHtml(ids, title);
            Path work = Files.createTempDirectory("vt-recommend-");
            html = work.resolve("recommend.html");
            Files.writeString(html, htmlContent, StandardCharsets.UTF_8);

            // 2. 时长 = 入场定场(AUTOPLAY_START 7s) + N×每部停留(6s) + 2s 收尾
            int durationSeconds = 7 + ids.size() * 6 + 2;

            // 3. 调 node render.js
            Path out = work.resolve("recommend-" + LocalDateTime.now().format(FILE_TS) + "." + fmt);
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
            cmd.add(String.valueOf(durationSeconds));
            cmd.add("--format");
            cmd.add(fmt);
            cmd.add("--chrome");
            cmd.add(chromePath);
            cmd.add("--ffmpeg");
            cmd.add(ffmpegPath);
            if (bgmPath != null && !bgmPath.isBlank()) {
                cmd.add("--bgm");
                cmd.add(bgmPath);
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
}
