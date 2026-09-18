package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

/**
 * 推荐编辑会话：一个 token 对应一个素材工作目录（`data/recommend-previews/<token>/`）。
 *
 * 与旧 `/preview`（每次请求新建 token）的区别：**编辑会话期内 token 固定不变**——
 * 素材路径稳定，片段/BGM 才能命中缓存、缩略图与预览才能复用同一套相对路径（设计规格 §8.2）。
 *
 * 责任边界：只管 token 生命周期与 BGM 落盘；片段素材由 {@link RecommendClipSourceService} 负责。
 */
@Service
public class RecommendSessionService {

    private static final Logger log = LoggerFactory.getLogger(RecommendSessionService.class);
    /** 遗留 token 目录的保留时长（启动/创建会话时惰性清理，不引入调度器）。 */
    private static final Duration MAX_AGE = Duration.ofDays(7);
    private static final String TOKEN_PATTERN = "[0-9a-fA-F-]{36}";

    /** 一个编辑会话：token + 工作目录。 */
    public record Session(String token, Path dir, long createdAt) {
    }

    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private final Path root;

    public RecommendSessionService(@Value("${videotagger.recommend-session-dir:data/recommend-previews}") String dir) {
        this.root = Path.of(dir).toAbsolutePath().normalize();
    }

    /** 创建会话（顺带惰性清理超期遗留目录）。 */
    public Session create() throws IOException {
        pruneStale();
        return open(UUID.randomUUID().toString(), true);
    }

    /**
     * 取已有会话；内存里没有（例如后端重启）→ 按同一 token 重新打开目录。
     *
     * 复用同一 token 是刻意的：重启后磁盘上的素材仍在，编辑器不必重建会话、缓存不失效。
     */
    public Session require(String token) throws IOException {
        Session existing = sessions.get(token);
        if (existing != null) return existing;
        if (token == null || !token.matches(TOKEN_PATTERN)) {
            throw new IllegalArgumentException("会话 token 非法");
        }
        return open(token, false);
    }

    private Session open(String token, boolean fresh) throws IOException {
        Path dir = root.resolve(token).normalize();
        if (!dir.startsWith(root)) {
            throw new IllegalArgumentException("会话目录越界");
        }
        if (fresh) {
            Files.createDirectories(dir.resolve("media"));
        } else if (!Files.isDirectory(dir)) {
            throw new IllegalArgumentException("会话不存在或已回收: " + token);
        } else {
            Files.createDirectories(dir.resolve("media"));
        }
        Session session = new Session(token, dir, System.currentTimeMillis());
        sessions.put(token, session);
        return session;
    }

    /** 回收会话（内存 + 磁盘）。 */
    public void delete(String token) {
        Session removed = sessions.remove(token);
        Path dir = removed != null ? removed.dir() : (token != null && token.matches(TOKEN_PATTERN) ? root.resolve(token) : null);
        if (dir != null) {
            deleteTree(dir);
        }
    }

    /**
     * BGM 落盘：曲目 base64 → 会话目录下的 `bgm-<i><ext>`，返回**与曲目等长**的相对路径列表
     * （无音频的曲目占位 null，保证与曲目下标一一对应——Remotion 侧按下标取用）。
     */
    public List<String> materializeBgm(Session session, List<RecommendService.BgmTrack> tracks,
                                       String legacyName, String legacyBase64) throws IOException {
        List<RecommendService.BgmTrack> list = namedTracks(tracks, legacyName, legacyBase64);
        List<String> rels = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            RecommendService.BgmTrack track = list.get(i);
            if (track == null || track.base64() == null || track.base64().isBlank()) {
                rels.add(null);
                continue;
            }
            String rel = "bgm-" + i + audioExtension(track.name());
            Files.write(session.dir().resolve(rel), Base64.getDecoder().decode(track.base64()));
            rels.add(rel);
        }
        return rels;
    }

    /** BGM 曲目视图：新格式取 `bgmTracks`，旧单曲字段（bgmName/bgmBase64）补一条。 */
    public static List<RecommendService.BgmTrack> namedTracks(List<RecommendService.BgmTrack> tracks,
                                                              String legacyName, String legacyBase64) {
        if (tracks != null && !tracks.isEmpty()) return tracks;
        if (legacyBase64 == null || legacyBase64.isBlank()) return List.of();
        return List.of(new RecommendService.BgmTrack(legacyName, legacyBase64));
    }

    /** 音频扩展名（按文件名推断，未知 → .mp3）；与 ffmpeg 可解码的容器保持一份真值。 */
    public static String audioExtension(String name) {
        if (name != null) {
            String lower = name.toLowerCase(Locale.ROOT);
            for (String ext : List.of(".m4a", ".wav", ".ogg", ".flac", ".aac", ".opus")) {
                if (lower.endsWith(ext)) return ext;
            }
        }
        return ".mp3";
    }

    private void pruneStale() {
        if (!Files.isDirectory(root)) return;
        Instant limit = Instant.now().minus(MAX_AGE);
        try (Stream<Path> children = Files.list(root)) {
            for (Path child : children.toList()) {
                try {
                    if (!Files.isDirectory(child)) continue;
                    FileTime modified = Files.getLastModifiedTime(child);
                    if (modified.toInstant().isBefore(limit)) {
                        deleteTree(child);
                        sessions.remove(child.getFileName().toString());
                        log.info("清理超期推荐会话目录: {}", child.getFileName());
                    }
                } catch (IOException e) {
                    log.warn("清理会话目录失败 {}: {}", child, e.getMessage());
                }
            }
        } catch (IOException e) {
            log.warn("扫描会话目录失败 {}: {}", root, e.getMessage());
        }
    }

    public static void deleteTree(Path dir) {
        if (dir == null || !Files.exists(dir)) return;
        try (Stream<Path> paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // 清理尽力而为
                }
            });
        } catch (IOException ignored) {
            // 同上
        }
    }
}
