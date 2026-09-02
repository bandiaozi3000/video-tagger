package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * M2 片段封面抽帧：Animeko 现场打标成功后，若素材化渠道已定位到本地整集文件（C1 本地池 / C2 Animeko 缓存），
 * 从文件在片段起点时刻 ffmpeg 抽一帧作为片段封面（缩略图 + 详情大图），与 web 打标 canvas 截帧殊途同归。
 *
 * <p>失败静默（仅记日志）：文件被清理/ffmpeg 缺失/格式不支持都不影响打标主流程，稍后可在片段详情手动补封面。
 * 执行在独立守护线程，不阻塞 HTTP 保存响应。
 */
@Component
public class ClipFrameGrabber {

    private static final Logger log = LoggerFactory.getLogger(ClipFrameGrabber.class);

    private final ClipMapper clipMapper;
    private final CoverService coverService;
    private final String ffmpegPath;
    private final ExecutorService executor;

    public ClipFrameGrabber(ClipMapper clipMapper,
                            CoverService coverService,
                            @Value("${videotagger.render.ffmpeg-path:${user.home}/.local/ffmpeg/bin/ffmpeg.exe}") String ffmpegPath) {
        this.clipMapper = clipMapper;
        this.coverService = coverService;
        this.ffmpegPath = ffmpegPath == null || ffmpegPath.isBlank() ? "ffmpeg" : ffmpegPath.trim();
        this.executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "clip-frame-grab");
            t.setDaemon(true);
            return t;
        });
    }

    /**
     * 从本地整集文件在 timeMs 时刻抽帧存为片段封面。
     *
     * @param clipId     片段 id
     * @param sourceFile 本地整集文件绝对路径（渠道求值 PRESENT 的 filePath）
     * @param timeMs     抽取时刻（通常=片段起点/暂停位置）
     */
    public void grabFrameAsync(long clipId, String sourceFile, long timeMs) {
        executor.submit(() -> grabFrame(clipId, sourceFile, timeMs));
    }

    private void grabFrame(long clipId, String sourceFile, long timeMs) {
        Path input = Path.of(sourceFile);
        if (!Files.isRegularFile(input)) {
            log.info("[frame-grab] 源文件不在场，跳过封面 clip={} file={}", clipId, sourceFile);
            return;
        }
        Path out = null;
        Path temp = null;
        try {
            Path clipCoverDir = coverService.dir().resolve("clip");
            Files.createDirectories(clipCoverDir);
            out = clipCoverDir.resolve(clipId + "-grab.jpg");
            temp = clipCoverDir.resolve(clipId + "-grab.part.jpg");
            Files.deleteIfExists(out);
            Files.deleteIfExists(temp);
            String timeSec = String.format(java.util.Locale.ROOT, "%.3f", Math.max(0, timeMs) / 1000d);
            List<String> command = List.of(ffmpegPath, "-hide_banner", "-y", "-ss", timeSec,
                    "-i", input.toString(), "-frames:v", "1", "-q:v", "2",
                    "-f", "image2", temp.toString());
            Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
            if (!process.waitFor(90, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                String diag = new String(process.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                throw new IOException("ffmpeg 抽帧超时: " + (diag.length() > 300 ? diag.substring(diag.length() - 300) : diag));
            }
            String diagnostics = new String(process.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            if (process.exitValue() != 0 || !Files.isRegularFile(temp) || Files.size(temp) == 0) {
                String tail = diagnostics.length() > 400 ? diagnostics.substring(diagnostics.length() - 400) : diagnostics;
                throw new IOException("ffmpeg 抽帧失败 exit=" + process.exitValue()
                        + " size=" + (Files.exists(temp) ? Files.size(temp) : -1)
                        + " :: " + tail);
            }
            Files.move(temp, out, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            byte[] jpg = Files.readAllBytes(out);
            String cover = coverService.saveClipCover(clipId, jpg);
            String detail = coverService.saveClipDetailCover(clipId, jpg);
            Files.deleteIfExists(out);   // 标准路径由 saveClipCover 写入 {clipId}.jpg，此处抓帧临时产物清理
            Clip patch = new Clip();
            patch.setId(clipId);
            patch.setCoverPath(cover);
            patch.setDetailCoverPath(detail);
            clipMapper.updateById(patch);
            log.info("[frame-grab] 片段封面已生成 clip={} @{}ms from {}", clipId, timeMs, sourceFile);
        } catch (Exception e) {
            log.warn("[frame-grab] 封面抽帧失败 clip={}（跳过，可手动补）: {}", clipId, e.getMessage());
        } finally {
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException ignored) {
                    // 忽略清理失败
                }
            }
        }
    }
}
