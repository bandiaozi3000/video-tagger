package com.videotagger.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.service.EpisodeReviewService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 集/片段“灯”状态聚合（v0.25）：\n *  集行：available=有本地源（AVAILABLE 资产 **或** Animeko 整集缓存，与集详情「本地回顾」同口径）；failed=最近失败(failureReason)；missing=无本地源。\n *  片段：productExists=剪出产物文件在 data/clip-videos/{id}.* 。运行中(黄)由前端任务观察者即时点亮。 */
@RestController
@RequestMapping("/api/assets")
public class AssetLightsController {

    private final VideoAssetMapper assetMapper;
    private final EpisodeReviewService reviewService;
    private final String clipVideosDir;
    private final java.nio.file.Path videoAssetsRoot;

    @Autowired
    public AssetLightsController(VideoAssetMapper assetMapper,
                                 EpisodeReviewService reviewService,
                                 @Value("${videotagger.clip-export.video-output-dir:${VT_DATA_DIR:data}/clip-videos}") String clipVideosDir,
                                 @Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String videoAssetsRoot) {
        this.assetMapper = assetMapper;
        this.reviewService = reviewService;
        this.clipVideosDir = clipVideosDir;
        this.videoAssetsRoot = videoAssetsRoot == null ? null : java.nio.file.Path.of(videoAssetsRoot).toAbsolutePath().normalize();
    }

    @GetMapping("/clip-products")
    public List<Long> clipProducts() {
        List<Long> ids = new ArrayList<>(scanProductIds());
        ids.sort(Long::compareTo);
        return ids;
    }

    @GetMapping("/lights")
    public Map<String, Object> lights(@RequestParam(required = false) List<Long> episodeIds,
                                      @RequestParam(required = false) List<Long> clipIds) {
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> episodes = new LinkedHashMap<>();
        if (episodeIds != null && !episodeIds.isEmpty()) {
            Map<Long, List<VideoAsset>> byEpisode = new LinkedHashMap<>();
            assetMapper.selectList(new QueryWrapper<VideoAsset>()
                            .select("id", "episode_id", "availability_state", "failure_reason", "storage_path")
                            .in("episode_id", episodeIds))
                    .forEach(a -> byEpisode.computeIfAbsent(a.getEpisodeId(), k -> new ArrayList<>()).add(a));
            Map<Long, Boolean> hasAsset = new LinkedHashMap<>();
            for (Long epId : episodeIds) {
                List<VideoAsset> list = byEpisode.getOrDefault(epId, List.of());
                // 校验磁盘：库里 AVAILABLE 但文件已删 → 纠正为 MISSING（灯/回顾都如实）
                for (VideoAsset a : list) {
                    if ("AVAILABLE".equals(a.getAvailabilityState()) && !fileExists(a)) {
                        a.setAvailabilityState("MISSING");
                        a.setFailureReason("本地文件已被删除/缺失（灯校验）");
                        a.setUpdatedAt(System.currentTimeMillis());
                        assetMapper.updateById(a);
                    }
                }
                hasAsset.put(epId, list.stream().anyMatch(a -> "AVAILABLE".equals(a.getAvailabilityState()) && fileExists(a)));
            }
            // 无本地资产的那些集，再看 Animeko 整集缓存（C2）——集详情「本地源/本地回顾」用的就是它，灯不能比它严
            List<Long> needCache = new ArrayList<>();
            for (Long epId : episodeIds) {
                if (!Boolean.TRUE.equals(hasAsset.get(epId))) needCache.add(epId);
            }
            Set<Long> cached = Set.of();
            if (!needCache.isEmpty()) {
                try {
                    cached = reviewService.cachedEpisodes(needCache);
                } catch (Exception ignored) {
                    // 缓存探测失败不该把整排灯打黑（按无缓存处理）
                }
            }
            for (Long epId : episodeIds) {
                List<VideoAsset> list = byEpisode.getOrDefault(epId, List.of());
                boolean viaAsset = Boolean.TRUE.equals(hasAsset.get(epId));
                boolean viaCache = !viaAsset && cached.contains(epId);
                VideoAsset failed = list.stream().filter(a -> "FAILED".equals(a.getAvailabilityState())).findFirst().orElse(null);
                Map<String, Object> m = new LinkedHashMap<>();
                if (viaAsset || viaCache) {
                    m.put("state", "available");
                    m.put("via", viaCache ? "animeko-cache" : "asset");
                } else if (failed != null) {
                    m.put("state", "failed");
                    m.put("failReason", failed.getFailureReason() == null ? "" : failed.getFailureReason());
                } else {
                    m.put("state", "missing");
                }
                episodes.put(String.valueOf(epId), m);
            }
        }
        Map<String, Object> clips = new LinkedHashMap<>();
        if (clipIds != null && !clipIds.isEmpty()) {
            Set<Long> existing = scanProductIds();
            for (Long id : clipIds) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("exists", existing.contains(id));
                clips.put(String.valueOf(id), m);
            }
        }
        result.put("episodes", episodes);
        result.put("clips", clips);
        return result;
    }

    private boolean fileExists(VideoAsset a) {
        if (a == null || a.getStoragePath() == null || a.getStoragePath().isBlank() || videoAssetsRoot == null) {
            return false;
        }
        return java.nio.file.Files.isRegularFile(videoAssetsRoot.resolve(a.getStoragePath()));
    }

    private Set<Long> scanProductIds() {
        Set<Long> ids = new HashSet<>();
        Path dir = Path.of(clipVideosDir);
        if (!Files.isDirectory(dir)) {
            return ids;
        }
        Set<String> exts = Set.of("mp4", "webm", "mov", "avi", "mkv");
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
            for (Path p : stream) {
                String name = p.getFileName().toString();
                int dot = name.lastIndexOf('.');
                if (dot <= 0) {
                    continue;
                }
                String ext = name.substring(dot + 1).toLowerCase();
                if (!exts.contains(ext)) {
                    continue;
                }
                try {
                    ids.add(Long.parseLong(name.substring(0, dot)));
                } catch (NumberFormatException ignored) {
                }
            }
        } catch (IOException ignored) {
        }
        return ids;
    }
}
