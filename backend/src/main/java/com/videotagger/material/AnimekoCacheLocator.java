package com.videotagger.material;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * C2 素材化渠道定位器：把 Bangumi episodeId 解析成 Animeko 本地缓存/整集文件。
 *
 * <p>Animeko 的"缓存 registry"不在其 SQLite 内，而在 {@code data/datastore/mediaCacheMetadataV2}
 * （JSON 数组，元素含 {@code subjectId}/{@code episodeId} 与引擎侧文件字段）与各引擎目录
 * （BT → {@code media-downloads/}）。本定位器宽松读取该 JSON：
 * 命中 episodeId 且能在磁盘找到文件 → PRESENT；有条目但文件已按留存清理 → PENDING（提示可预取）；
 * 空/无条目 → UNAVAILABLE。绝不因猜引擎布局失败而抛错。
 */
public class AnimekoCacheLocator {

    private static final Logger log = LoggerFactory.getLogger(AnimekoCacheLocator.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** datastore 相对 Animeko data 根目录的 JSON registry 路径。 */
    private static final String CACHE_REGISTRY_REL = "datastore/mediaCacheMetadataV2";
    /** BT/整文件下载根（相对 data 根）。 */
    private static final String DOWNLOADS_REL = "media-downloads";

    private final Path dataRoot;       // Animeko data/ 目录（db 文件的父目录），可空 = 未配置
    private final Path cacheRegistry;  // registry JSON 路径
    private final Path downloadsRoot;  // 下载根

    public AnimekoCacheLocator(Path dataRoot) {
        this.dataRoot = dataRoot == null ? null : dataRoot.toAbsolutePath().normalize();
        this.cacheRegistry = this.dataRoot == null ? null : this.dataRoot.resolve(CACHE_REGISTRY_REL);
        this.downloadsRoot = this.dataRoot == null ? null : this.dataRoot.resolve(DOWNLOADS_REL);
    }

    public boolean configured() {
        return dataRoot != null;
    }

    /** 该绝对路径是否位于 Animeko data 根（受管，允许安全删除）。 */
    public boolean isManagedFile(String absolutePath) {
        if (dataRoot == null || absolutePath == null || absolutePath.isBlank()) return false;
        try {
            return Path.of(absolutePath).toAbsolutePath().normalize().startsWith(dataRoot);
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** 删除 Animeko data 根内的缓存/整集文件（越界拒绝，文件不存在视为成功）。 */
    public boolean deleteManagedFile(String absolutePath) {
        if (!isManagedFile(absolutePath)) {
            log.warn("拒绝删除非 Animeko 受管文件: {}", absolutePath);
            return false;
        }
        try {
            return Files.deleteIfExists(Path.of(absolutePath));
        } catch (IOException e) {
            log.warn("删除 Animeko 缓存文件失败 {}: {}", absolutePath, e.getMessage());
            return false;
        }
    }

    public String describeRoot() {
        return dataRoot == null ? "未配置 Animeko 数据库" : dataRoot.toString();
    }

    /** 定位结果。filePath 非空 = 文件在场；state 语义见 ChannelHint。 */
    public record LocateResult(String state, String filePath, String message) {
    }

    /**
     * 定位 Bangumi episodeId 对应的 Animeko 整集文件。
     *
     * @param bangumiEpisodeId Bangumi episode id（经 external_episode 桥接后的 provider_episode_id）
     */
    public LocateResult locate(String bangumiEpisodeId) {
        if (!configured() || bangumiEpisodeId == null || bangumiEpisodeId.isBlank()) {
            return new LocateResult("UNAVAILABLE", null, "未配置 Animeko 数据目录或缺少 episodeId");
        }
        if (cacheRegistry == null || !Files.isRegularFile(cacheRegistry)) {
            return new LocateResult("UNAVAILABLE", null,
                    "Animeko 缓存 registry 不存在（该版本无整文件缓存记录）：" + cacheRegistry);
        }
        try {
            JsonNode root = MAPPER.readTree(cacheRegistry.toFile());
            if (root == null || !root.isArray() || root.isEmpty()) {
                return new LocateResult("PENDING", null,
                        "Animeko 缓存 registry 为空（无整文件缓存）；看片时可用「显式缓存」或 fork CLI 预取该集");
            }
            // 匹配 episodeId 的缓存条目
            List<JsonNode> matched = new ArrayList<>();
            for (JsonNode entry : root) {
                if (matchesEpisode(entry, bangumiEpisodeId)) matched.add(entry);
            }
            if (matched.isEmpty()) {
                return new LocateResult("PENDING", null,
                        "Animeko 有缓存记录但该集 (episodeId=" + bangumiEpisodeId + ") 无条目或文件已按留存清理；可显式缓存后重试");
            }
            // 候选：1) 由 engine 目录 + origin.mediaId 推导（真实 Animeko 布局 media-downloads/{engine}/{mediaId}.{ext}）
            //       2) 条目内显式 file/path 字段（兼容其它引擎布局）
            List<String> candidatePaths = new ArrayList<>();
            for (JsonNode entry : matched) {
                candidatePaths.addAll(engineFileCandidates(entry));
                collectPathCandidates(entry, candidatePaths);
            }
            String hit = firstExistingPath(candidatePaths);
            if (hit != null) {
                return new LocateResult("PRESENT", hit, "Animeko 缓存命中: " + hit);
            }
            return new LocateResult("PENDING", null,
                    "Animeko 有条目 (episodeId=" + bangumiEpisodeId + ") 但文件不在场；可重新显式缓存/预取");
        } catch (Exception e) {
            log.warn("[animeko-c2] registry 解析失败（按无缓存处理）: {}", e.getMessage());
            return new LocateResult("UNAVAILABLE", null, "Animeko registry 解析失败: " + e.getMessage());
        }
    }

    /** 真实 Animeko 布局：文件在 media-downloads/{engine}/{origin.mediaId}.{ext}。engine=web-m3u/anitorrent 等。 */
    private List<String> engineFileCandidates(JsonNode entry) {
        List<String> out = new ArrayList<>();
        String engine = textOf(entry, "engine");
        if (engine == null || engine.isBlank() || downloadsRoot == null) return out;
        String mediaId = firstValueByKey(entry, "mediaId");
        if (mediaId == null || mediaId.isBlank()) return out;
        for (String ext : List.of("mp4", "mkv", "webm", "mov", "flv", "ts", "m4v")) {
            out.add(downloadsRoot.resolve(engine).resolve(mediaId + "." + ext).toString());
        }
        return out;
    }

    private String textOf(JsonNode node, String key) {
        JsonNode v = node.get(key);
        return v == null || v.isNull() || !v.isValueNode() ? null : v.asText();
    }

    /** 递归找给定 key 的第一个叶子字符串值（origin.mediaId 嵌套在 origin 对象内）。 */
    private String firstValueByKey(JsonNode node, String key) {
        if (node == null) return null;
        if (node.isObject()) {
            JsonNode direct = node.get(key);
            if (direct != null && direct.isValueNode()) return direct.asText();
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                String found = firstValueByKey(fields.next().getValue(), key);
                if (found != null) return found;
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                String found = firstValueByKey(child, key);
                if (found != null) return found;
            }
        }
        return null;
    }

    private boolean matchesEpisode(JsonNode entry, String episodeId) {
        if (entry == null) return false;
        if (entry.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = entry.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> f = fields.next();
                String name = f.getKey().toLowerCase();
                JsonNode v = f.getValue();
                if ((name.contains("episodeid") || name.equals("episode_id")) && v.isValueNode()) {
                    String text = v.asText();
                    if (text.equals(episodeId) || text.equals(String.valueOf(episodeId))) return true;
                }
                if (v.isObject() || v.isArray()) {
                    if (matchesEpisode(v, episodeId)) return true;
                }
            }
        } else if (entry.isArray()) {
            for (JsonNode child : entry) {
                if (matchesEpisode(child, episodeId)) return true;
            }
        }
        return false;
    }

    /** 递归收集候选文件字段值（键含 file/path/dir 的叶子字符串）。 */
    private void collectPathCandidates(JsonNode node, List<String> out) {
        if (node == null) return;
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> f = fields.next();
                String name = f.getKey().toLowerCase();
                if (f.getValue().isValueNode()) {
                    if (name.contains("file") || name.contains("path") || name.contains("dir")) {
                        String text = f.getValue().asText();
                        if (text != null && !text.isBlank() && !"null".equals(text)) out.add(text);
                    }
                } else {
                    collectPathCandidates(f.getValue(), out);
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) collectPathCandidates(child, out);
        }
    }

    /** 候选路径可能是绝对路径，也可能相对 Animeko data 根或 downloads 根；逐一探活。 */
    private String firstExistingPath(List<String> candidates) {
        for (String raw : candidates) {
            String p = raw.replace('\\', File.separatorChar).replace('/', File.separatorChar);
            Path absolute = Path.of(p).isAbsolute() ? Path.of(p)
                    : resolveUnderRoots(p);
            if (absolute != null && Files.isRegularFile(absolute)) return absolute.toString();
        }
        return null;
    }

    private Path resolveUnderRoots(String relative) {
        List<Path> roots = new ArrayList<>();
        if (dataRoot != null) roots.add(dataRoot);
        if (downloadsRoot != null) roots.add(downloadsRoot);
        for (Path root : roots) {
            Path candidate = root.resolve(relative).normalize();
            if (candidate.startsWith(root) && Files.isRegularFile(candidate)) return candidate;
        }
        return null;
    }
}
