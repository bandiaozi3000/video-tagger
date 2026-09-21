package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 素材探测（时长 / 编解码）：ffprobe 优先，回退 `ffmpeg -i` 解析。
 *
 * 独立成组件的理由：片段素材策略（{@link RecommendClipSourceService}）与渲染编排
 * （{@link RecommendVideoService}）都要用；此前两份实现（探测 + 扩展名）已经出现漂移。
 *
 * 进程约定：**先起排空线程再 waitFor**——否则 `readAllBytes()` 会阻塞在管道上，
 * 子进程卡死时超时形同虚设（v0.28 修复的既有缺陷 ②）。
 */
@Component
public class MediaProbe {

    private static final Logger log = LoggerFactory.getLogger(MediaProbe.class);
    private static final long TIMEOUT_SECONDS = 30;
    private static final Pattern DURATION = Pattern.compile("Duration: (\\d{2}):(\\d{2}):(\\d{2}\\.?\\d*)");
    private static final Pattern VIDEO_CODEC = Pattern.compile("Video:\\s*([A-Za-z0-9_]+)");
    private static final Pattern AUDIO_CODEC = Pattern.compile("Audio:\\s*([A-Za-z0-9_]+)");
    private static final Pattern FPS = Pattern.compile("([0-9]+(?:\\.[0-9]+)?)\\s*fps");
    /** 从 ffmpeg 输出里抓 `1920x1080` 这类尺寸。 */
    private static final Pattern SIZE = Pattern.compile("\\b(\\d{2,5})x(\\d{2,5})\\b");

    /** 编解码判定结果：`decided=false` 表示探测不出来（调用方应按"保守"处理）。 */
    public record Codecs(String video, String audio, boolean decided) {

        /** 浏览器/Chromium（Player 预览与 OffthreadVideo）能直接解的组合。 */
        public boolean webPlayable() {
            if (!decided) return false;
            boolean videoOk = video != null && (video.contains("h264") || video.contains("avc") || video.equals("vp8")
                    || video.equals("vp9") || video.equals("av1"));
            boolean audioOk = audio == null || audio.contains("aac") || audio.contains("mp4a") || audio.contains("opus")
                    || audio.contains("vorbis");
            return videoOk && audioOk;
        }
    }

    private final String ffmpegPath;
    private final String ffprobePath;

    public MediaProbe(@Value("${videotagger.render.ffmpeg-path:ffmpeg}") String ffmpegPath,
                      @Value("${videotagger.render.ffprobe-path:}") String ffprobePath) {
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
    }

    /** 素材时长（秒）；探测失败/不可用 → 0。 */
    public double durationSeconds(String file) {
        try {
            Path probe = ffprobe();
            if (probe != null) {
                String out = run(List.of(probe.toString(), "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", file));
                if (out != null && !out.isBlank()) {
                    return Double.parseDouble(out.trim().split("\\s+")[0]);
                }
            }
            String info = run(List.of(ffmpegPath, "-i", file));
            Matcher m = info == null ? null : DURATION.matcher(info);
            if (m != null && m.find()) {
                return Integer.parseInt(m.group(1)) * 3600 + Integer.parseInt(m.group(2)) * 60
                        + Double.parseDouble(m.group(3));
            }
        } catch (RuntimeException e) {
            log.warn("探测素材时长失败 {}: {}", file, e.getMessage());
        }
        return 0;
    }

    /** 视频流帧率（fps）；探测失败/不可用 → 0。ffprobe 优先，回退 `ffmpeg -i` 里的 `xx fps`。
     *
     * 为什么需要它：推荐时间轴固定 30fps，而片段素材常是 23.976 / 25 / 29.97。
     * 帧率不匹配的素材直接进时间轴，播放时帧节奏就会不匀（有的源帧重复、有的跳过）——
     * 看起来就是“片段一直在晃”。所以直通复用前必须先比帧率。
     */
    public double fps(String file) {
        try {
            Path probe = ffprobe();
            if (probe != null) {
                String out = run(List.of(probe.toString(), "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=r_frame_rate", "-of", "default=noprint_wrappers=1:nokey=1", file));
                String value = out == null ? "" : out.trim().split("\\s+")[0];
                String[] parts = value.split("/");
                if (parts.length >= 1 && !parts[0].isBlank()) {
                    double numerator = Double.parseDouble(parts[0]);
                    double denominator = parts.length > 1 ? Double.parseDouble(parts[1]) : 1;
                    if (numerator > 0 && denominator > 0) return numerator / denominator;
                }
            }
            String info = run(List.of(ffmpegPath, "-i", file));
            Matcher m = info == null ? null : FPS.matcher(info);
            if (m != null && m.find()) return Double.parseDouble(m.group(1));
        } catch (RuntimeException e) {
            log.warn("探测素材帧率失败 {}: {}", file, e.getMessage());
        }
        return 0;
    }

    /** 视频/音频编解码；探测失败 → `decided=false`。 */
    /**
     * 视频尺寸 [宽, 高]；探不出来返回 null。
     *
     * 2026-09-21 用途：片段与画幅同比（都是 16:9）时，片段幕那层模糊背景视频**完全看不见**，
     * 却占约 40% 的片段帧耗时（实测 121 → 70 ms/帧）→ 渲染侧据此跳过它。
     */
    public int[] dimensions(String file) {
        String output = run(List.of(ffmpegPath, "-hide_banner", "-i", file));
        var matcher = SIZE.matcher(output);
        while (matcher.find()) {
            int w = Integer.parseInt(matcher.group(1));
            int h = Integer.parseInt(matcher.group(2));
            if (w >= 160 && h >= 90) {
                return new int[]{w, h};
            }
        }
        return null;
    }

    public Codecs codecs(String file) {
        Path probe = ffprobe();
        if (probe != null) {
            String video = streamCodec(probe, file, "v:0");
            String audio = streamCodec(probe, file, "a:0");
            if (video != null) {
                return new Codecs(video, audio, true);
            }
        }
        String info = run(List.of(ffmpegPath, "-i", file));
        if (info == null) return new Codecs(null, null, false);
        Matcher v = VIDEO_CODEC.matcher(info);
        Matcher a = AUDIO_CODEC.matcher(info);
        String video = v.find() ? v.group(1).toLowerCase(Locale.ROOT) : null;
        String audio = a.find() ? a.group(1).toLowerCase(Locale.ROOT) : null;
        return new Codecs(video, audio, video != null);
    }

    /** 单个流的编解码名（`v:0` / `a:0`）；流不存在或探测失败 → null。 */
    private String streamCodec(Path probe, String file, String selector) {
        String out = run(List.of(probe.toString(), "-v", "error", "-select_streams", selector,
                "-show_entries", "stream=codec_name", "-of", "default=noprint_wrappers=1:nokey=1", file));
        if (out == null) return null;
        String value = out.trim().split("\\s+")[0].toLowerCase(Locale.ROOT);
        return value.isEmpty() ? null : value;
    }

    /** ffprobe 定位：优先配置，否则取 ffmpeg 同目录同名文件；都没有 → null（回退 ffmpeg -i）。 */
    public Path ffprobe() {
        try {
            if (ffprobePath != null && !ffprobePath.isBlank()) {
                Path configured = Path.of(ffprobePath).toAbsolutePath();
                if (Files.isRegularFile(configured)) return configured;
            }
            Path ff = Path.of(ffmpegPath).toAbsolutePath();
            String name = ff.getFileName() == null ? "ffmpeg" : ff.getFileName().toString();
            Path probe = ff.getParent().resolve(name.endsWith(".exe") ? "ffprobe.exe" : "ffprobe");
            return Files.isRegularFile(probe) ? probe : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 跑一条命令并返回合并输出（stdout+stderr）；超时 → 杀进程 + null。
     *
     * 排空线程必须在 `waitFor` 之前启动（见类注释）。
     */
    public String run(List<String> command) {
        Process process = null;
        try {
            process = new ProcessBuilder(command).redirectErrorStream(true).start();
            Process running = process;
            java.io.ByteArrayOutputStream sink = new java.io.ByteArrayOutputStream();
            Thread drainer = new Thread(() -> {
                try (var in = running.getInputStream()) {
                    in.transferTo(sink);
                } catch (IOException ignored) {
                    // 进程被杀时读取中断属正常
                }
            }, "media-probe-drain");
            drainer.setDaemon(true);
            drainer.start();
            if (!process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                log.warn("探测命令超时（{}s）: {}", TIMEOUT_SECONDS, String.join(" ", command));
                return null;
            }
            drainer.join(TimeUnit.SECONDS.toMillis(5));
            return sink.toString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.warn("探测命令执行失败 {}: {}", String.join(" ", command), e.getMessage());
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            if (process != null) process.destroyForcibly();
            return null;
        }
    }

}
