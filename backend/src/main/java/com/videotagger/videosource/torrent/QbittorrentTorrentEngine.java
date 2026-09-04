package com.videotagger.videosource.torrent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** qBittorrent WebUI RPC 引擎（v0.25 D5/D2）：提交磁力/.torrent、轮询进度、列文件清单（精判）、删除。
 *  依赖 qB WebUI 开启（工具→选项→Web UI）；本类仅当 videotagger.torrent.qbittorrent.enabled=true 时注册为 Bean。 */
@Component
@ConditionalOnProperty(prefix = "videotagger.torrent.qbittorrent", name = "enabled", havingValue = "true")
public class QbittorrentTorrentEngine implements TorrentClient {

    public record FileEntry(String name, long size, double progress) {
        boolean isSubtitle() {
            String lower = name.toLowerCase(Locale.ROOT);
            return lower.endsWith(".ass") || lower.endsWith(".ssa")
                    || lower.endsWith(".srt") || lower.endsWith(".vtt") || lower.endsWith(".sub");
        }
    }

    public record TorrentState(String hash, String name, String state, double progress, long size,
                               long dlspeed, List<FileEntry> files) {
    }

    private final String baseUrl;
    private final String username;
    private final String password;
    private final Duration timeout;
    private final HttpClient http;
    private final ObjectMapper json = new ObjectMapper();
    private volatile String sessionCookie;

    @Autowired
    public QbittorrentTorrentEngine(
            @Value("${videotagger.torrent.qbittorrent.base-url:http://127.0.0.1:8090}") String baseUrl,
            @Value("${videotagger.torrent.qbittorrent.username:admin}") String username,
            @Value("${videotagger.torrent.qbittorrent.password:adminadmin}") String password,
            @Value("${videotagger.torrent.qbittorrent.timeout-ms:8000}") int timeoutMs) {
        this(baseUrl, username, password, timeoutMs, true);
    }

    /** 测试/直连构造（跳过 Spring 注入），便于本地验证与后续 Fake 引擎。 */
    QbittorrentTorrentEngine(String baseUrl, String username, String password, int timeoutMs, boolean placeholder) {
        this.baseUrl = (baseUrl == null ? "" : baseUrl.trim().replaceAll("/+$", ""));
        this.username = username == null ? "" : username;
        this.password = password == null ? "" : password;
        this.timeout = Duration.ofMillis(timeoutMs);
        this.http = HttpClient.newBuilder().connectTimeout(timeout)
                .followRedirects(HttpClient.Redirect.NORMAL).build();
    }

    /** 引擎可用性探测（含一次匿名/已登录校验，不抛异常）。 */
    public boolean isOnline() {
        try {
            return version().isPresent();
        } catch (Exception e) {
            return false;
        }
    }

    /** 返回 qB 版本；未登录/不可达返回 empty（不抛）。 */
    public Optional<String> version() {
        try {
            HttpResponse<String> response = send("GET", "/api/v2/app/version", null);
            if (response.statusCode() == 200) {
                return Optional.of(response.body().trim());
            }
        } catch (Exception ignored) {
        }
        return Optional.empty();
    }

    /** 轮询任务状态与文件清单（进度 0..1）。 */
    public Optional<TorrentState> info(String hash) {
        HttpResponse<String> response = get("/api/v2/torrents/info?hashes=" + enc(hash));
        if (response == null || response.statusCode() != 200) {
            return Optional.empty();
        }
        try {
            JsonNode array = json.readTree(response.body());
            if (array.isArray() && array.size() > 0) {
                JsonNode node = array.get(0);
                String stateHash = node.path("hash").asText();
                String name = node.path("name").asText();
                String state = node.path("state").asText();
                double progress = node.path("progress").asDouble();
                long size = node.path("size").asLong();
                long dlspeed = node.path("dlspeed").asLong();
                return Optional.of(new TorrentState(stateHash, name, state, progress, size, dlspeed, files(stateHash)));
            }
        } catch (IOException ignored) {
        }
        return Optional.empty();
    }

    /** 种子文件清单（精判 D2 用）：不下载即可列出。 */
    public List<FileEntry> files(String hash) {
        HttpResponse<String> response = get("/api/v2/torrents/files?hash=" + enc(hash));
        if (response == null || response.statusCode() != 200) {
            return List.of();
        }
        List<FileEntry> result = new ArrayList<>();
        try {
            JsonNode array = json.readTree(response.body());
            for (JsonNode node : array) {
                result.add(new FileEntry(node.path("name").asText(),
                        node.path("size").asLong(), node.path("progress").asDouble()));
            }
        } catch (IOException ignored) {
        }
        return result;
    }

    /** 删除任务；deleteFiles=true 同时删除已下载文件。 */
    @Override
    public void remove(String hash, boolean deleteFiles) {
        HttpResponse<String> response = post("/api/v2/torrents/delete",
                form("hashes", hash, "deleteFiles", String.valueOf(deleteFiles)));
        if (response != null && response.statusCode() != 200) {
            throw new IllegalStateException("TORRENT_ENGINE_DELETE_FAILED");
        }
    }

    // ---- TorrentClient 实现（v0.25 D5：提交/等待/清理；Fake 引擎同契约） ----

    @Override
    public String add(String magnetOrTorrentUrl, String savePath) {
        return addInternal(magnetOrTorrentUrl, savePath, false);
    }

    /** 暂停添加（v2 选择性下载用）：先不下载任何文件，等元数据/文件清单就绪后挑文件再续传。 */
    public String addPaused(String magnetOrTorrentUrl, String savePath) {
        return addInternal(magnetOrTorrentUrl, savePath, true);
    }

    private String addInternal(String magnetOrTorrentUrl, String savePath, boolean paused) {
        String body = paused
                ? form("urls", magnetOrTorrentUrl, "savepath", savePath, "paused", "true")
                : form("urls", magnetOrTorrentUrl, "savepath", savePath);
        HttpResponse<String> response = post("/api/v2/torrents/add", body);
        if (response == null) {
            throw new IllegalStateException("TORRENT_ENGINE_ADD_FAILED: no response from qBittorrent");
        }
        if (response.statusCode() != 200 && response.statusCode() != 409) {
            String snippet = response.body() == null ? "" : response.body().trim();
            if (snippet.length() > 160) {
                snippet = snippet.substring(0, 160);
            }
            throw new IllegalStateException("TORRENT_ENGINE_ADD_FAILED: HTTP " + response.statusCode()
                    + (snippet.isEmpty() ? "" : " body=" + snippet));
        }
        // 409=该磁力已在 qB 中（先前提交/去重）；成功(200)或冲突(409)后都按 savePath 认领任务
        // 提交成功后 qB 异步登记；按 savePath 精确定位任务（兼容 qB 去重命中已存在同路径任务）
        long deadline = System.currentTimeMillis() + 15_000;
        String normalized = savePath == null ? null : savePath.replace('\\', '/').replaceAll("/+$", "");
        while (System.currentTimeMillis() < deadline) {
            String found = findHashBySavePath(normalized);
            if (found != null) {
                return found;
            }
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("INTERRUPTED");
            }
        }
        throw new IllegalStateException("TORRENT_ADD_TIMEOUT: torrent task did not appear at savePath=" + savePath);
    }

    /** v2 选择性下载：只下载 keep 索引的文件（其余优先级 0），随后续传。索引对齐 torrents/files 的数组序。
     *  注意：qB 的 filePrio 的 id 仅接受单个整数（不接受逗号列表）→ 逐文件调用；start 参数为 hashes。 */
    public void selectAndStart(String hash, java.util.Collection<Integer> keep) {
        List<FileEntry> entries = files(hash);
        java.util.Set<Integer> keepSet = keep == null ? java.util.Set.of() : new java.util.HashSet<>(keep);
        boolean anyFail = false;
        for (int i = 0; i < entries.size(); i++) {
            int priority = keepSet.contains(i) ? 1 : 0;
            HttpResponse<String> r = post("/api/v2/torrents/filePrio",
                    form("hash", hash, "id", String.valueOf(i), "priority", String.valueOf(priority)));
            if (r == null || r.statusCode() != 200) {
                anyFail = true;
            }
        }
        if (anyFail) {
            throw new IllegalStateException("TORRENT_SELECT_FAILED: qBittorrent 文件优先级设置失败");
        }
        post("/api/v2/torrents/start", form("hashes", hash));
    }

    private String findHashBySavePath(String normalizedSavePath) {
        if (normalizedSavePath == null) {
            return null;
        }
        HttpResponse<String> response = get("/api/v2/torrents/info?filter=all");
        if (response == null || response.statusCode() != 200) {
            return null;
        }
        try {
            JsonNode array = json.readTree(response.body());
            for (JsonNode node : array) {
                String path = node.path("save_path").asText("").replace('\\', '/').replaceAll("/+$", "");
                if (normalizedSavePath.equals(path)) {
                    return node.path("hash").asText();
                }
            }
        } catch (IOException ignored) {
        }
        return null;
    }

    @Override
    public List<DownloadedFile> awaitComplete(String token, Duration timeout) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeout.toMillis();
        String lastState = "";
        while (System.currentTimeMillis() < deadline) {
            TorrentState state = info(token).orElse(null);
            if (state == null) {
                lastState = "missing";
            } else {
                lastState = state.state();
                String lower = state.state() == null ? "" : state.state().toLowerCase();
                if (lower.contains("error") || lower.contains("faulty")
                        || lower.contains("missingfiles") || lower.equals("unknown")) {
                    throw new IllegalStateException("TORRENT_FAILED: qBittorrent state=" + state.state());
                }
                // 选择性下载：总进度按全包算可能永远 <100%；改判“存在任一文件已完成”即返回
                List<DownloadedFile> result = state.files().stream()
                        .map(f -> new DownloadedFile(f.name(), f.size(), f.progress() >= 0.999))
                        .toList();
                if (result.stream().anyMatch(DownloadedFile::complete)) {
                    return result;
                }
            }
            Thread.sleep(2000);
        }
        throw new IllegalStateException("DOWNLOAD_TIMEOUT: no progress to completion (state=" + lastState + ")");
    }

    @Override
    public List<DownloadedFile> fileListing(String token) {
        return files(token).stream()
                .map(f -> new DownloadedFile(f.name(), f.size(), f.progress() >= 0.999))
                .toList();
    }

    private HttpResponse<String> get(String path) {
        return send("GET", path, null);
    }

    private HttpResponse<String> post(String path, String body) {
        return send("POST", path, body);
    }

    private synchronized HttpResponse<String> send(String method, String path, String formBody) {
        // 除登录端点外，会话缺失时先登录一次
        if (sessionCookie == null && !path.contains("/auth/login")) {
            ensureLogin();
        }
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(timeout)
                .header("User-Agent", "video-tagger/0.25")
                .header("Referer", baseUrl + "/"); // qB WebUI CSRF 校验要求同源 Referer
        if (sessionCookie != null) {
            builder.header("Cookie", sessionCookie);
        }
        if ("POST".equals(method)) {
            builder.header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(formBody == null ? "" : formBody, StandardCharsets.UTF_8));
        } else {
            builder.GET();
        }
        try {
            HttpResponse<String> response = http.send(builder.build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 403 && sessionCookie != null) {
                sessionCookie = null;
                return send(method, path, formBody); // 会话失效重登一次
            }
            return response;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return null;
        }
    }

    private boolean ensureLogin() {
        if (sessionCookie != null) {
            return true;
        }
        HttpResponse<String> response = send("POST", "/api/v2/auth/login",
                form("username", username, "password", password));
        // qB 登录成功返回 204 No Content（2024+ 版本）；老版本 200。两者都视为成功。
        if (response == null || (response.statusCode() != 200 && response.statusCode() != 204)) {
            return false;
        }
        String setCookie = response.headers().firstValue("set-cookie").orElse("");
        int semi = setCookie.indexOf(';');
        sessionCookie = semi >= 0 ? setCookie.substring(0, semi) : setCookie;
        return !sessionCookie.isBlank();
    }

    private static String form(String... pairs) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            if (sb.length() > 0) {
                sb.append('&');
            }
            sb.append(enc(pairs[i])).append('=').append(enc(pairs[i + 1]));
        }
        return sb.toString();
    }

    private static String enc(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
