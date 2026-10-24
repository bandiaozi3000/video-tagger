package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

/**
 * 「资源视频」上传（推荐编辑器里给某部媒体挂一段额外视频，用法同片段）。
 *
 * <p>数据姿势 = **无集片段 + 本地文件池**：
 * <ul>
 *   <li>文件落 `data/videos/{指纹}.{扩展名}` —— 与 `LocalVideoResolver` 的白名单/命名约定一致，
 *       所以推荐准备（`RecommendClipSourceService.prepareOne`）走的是既有那条兜底路径，**零改动**；</li>
 *   <li>登记一条 `episode_id = NULL` 的片段行 —— 推荐草稿契约 `mediaClips[mediaId].order` 只吃 clipId，
 *       渲染侧也只从 `media.clips[]` 取素材（`scene-plan.ts` / `cinema/plan.ts`），复用这一条通道即可。</li>
 * </ul>
 *
 * <p>归属（挂在哪部媒体下）**不存库**：由草稿的 `mediaClips[mediaId].order` 决定。
 *
 * <p>必须单独插行、**不能走 {@link ClipService#save}**：那条路会按网页标题 `ensureEpisode` 自动建集，
 * 正好把资源塞进正片集。
 */
@Service
public class ClipUploadService {

    private static final Logger log = LoggerFactory.getLogger(ClipUploadService.class);

    private final ClipMapper clipMapper;
    private final MediaProbe mediaProbe;
    private final Path videoDir;

    public ClipUploadService(ClipMapper clipMapper, MediaProbe mediaProbe, ClipExportProperties properties) {
        this.clipMapper = clipMapper;
        this.mediaProbe = mediaProbe;
        this.videoDir = Paths.get(properties.getVideoDir()).toAbsolutePath().normalize();
    }

    /**
     * 上传并登记。`startSec` / `endSec` 为空 = 整段（用户 2026-10-03：可勾选开头结尾，故允许只取一段）。
     *
     * <p>不设大小/格式上限（用户拍板），但**探测不出时长的一律拒绝并删掉落盘文件**，避免留垃圾。
     */
    public Clip upload(MultipartFile file, String title, Double startSec, Double endSec) throws IOException {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("上传文件不能为空");
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String extension = extensionOf(original);

        Files.createDirectories(videoDir);
        Path temp = Files.createTempFile(videoDir, "upload-", ".part");
        String fingerprint;
        try (InputStream in = file.getInputStream();
             DigestInputStream digesting = new DigestInputStream(in, sha256());
             OutputStream out = Files.newOutputStream(temp)) {
            digesting.transferTo(out);
            fingerprint = HexFormat.of().formatHex(digesting.getMessageDigest().digest());
        } catch (IOException | RuntimeException e) {
            Files.deleteIfExists(temp);
            throw e;
        }
        Path target = videoDir.resolve(fingerprint + "." + extension);
        try {
            Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            Files.deleteIfExists(temp);
            throw e;
        }

        double duration;
        try {
            duration = mediaProbe.durationSeconds(target.toString());
        } catch (RuntimeException e) {
            duration = 0;
        }
        if (duration <= 0) {
            Files.deleteIfExists(target);
            throw new IllegalArgumentException("探测不到视频时长，可能不是可解码的视频文件：" + original);
        }

        double start = startSec == null || startSec < 0 ? 0 : startSec;
        if (start >= duration) throw new IllegalArgumentException("开始时间超出视频时长（" + Math.round(duration) + " 秒）");
        double end = endSec == null || endSec <= 0 ? duration : Math.min(endSec, duration);
        if (end <= start) throw new IllegalArgumentException("结束时间必须晚于开始时间");

        long now = System.currentTimeMillis();
        Clip clip = new Clip();
        clip.setTitle(title == null || title.isBlank() ? baseName(original) : title.trim());
        clip.setUrl("upload://" + fingerprint);
        clip.setVideoFp(fingerprint);
        clip.setEpisodeId(null);            // 资源视频不属于任何一集（归属看草稿）
        clip.setTimestampSec(start);
        clip.setEndSec(end);
        clip.setVideoDuration(duration);
        clip.setStartMs(Math.round(start * 1000));
        clip.setEndMs(Math.round(end * 1000));
        clip.setMaterialState("REFERENCE_ONLY");
        clip.setNote("");
        clip.setCreatedAt(now);
        clipMapper.insert(clip);
        log.info("资源视频已登记：clip={} fp={} {}s-{}s / {}s ({})",
                clip.getId(), fingerprint, start, end, duration, target.getFileName());
        return clip;
    }

    /** 扩展名：只保留 `[a-z0-9]`，取不到就按 mp4（`LocalVideoResolver` 靠扩展名找文件）。 */
    private static String extensionOf(String filename) {
        int dot = filename.lastIndexOf('.');
        String raw = dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return raw.isEmpty() || raw.length() > 12 ? "mp4" : raw;
    }

    private static String baseName(String filename) {
        int slash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
        String name = slash < 0 ? filename : filename.substring(slash + 1);
        int dot = name.lastIndexOf('.');
        String base = dot <= 0 ? name : name.substring(0, dot);
        return base.isBlank() ? "资源视频" : base;
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
