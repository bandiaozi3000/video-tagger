package com.videotagger.controller;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Media;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.service.MaterializeBatchService;
import com.videotagger.service.TorrentEpisodeDownloadService;
import com.videotagger.service.VideoAssetService;
import com.videotagger.videosource.TorrentUiService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** v0.25 批量剪出 + 缺源自动最优下载：先为所选片段缺失本地源的集自动下载（档位内选做种最快），再统一 ffmpeg 剪出。 */
@RestController
@RequestMapping("/api/materialize-auto")
public class MaterializeAutoController {

    public record Req(List<Long> clipIds) {
    }

    public record NeedItem(Long episodeId, String episodeTitle, Integer episodeNo, Long mediaId, String mediaTitle,
                           String recommendTitle, String providerName, String tier, String group, String resolution,
                           Integer seeders, Boolean batch, String reason) {
    }

    public record PreviewResult(List<NeedItem> needs) {
    }

    public record RunItem(Long episodeId, Integer episodeNo, String mediaTitle, boolean ok, String reason) {
    }

    public record RunResult(List<RunItem> downloads, MaterializeBatchService.BatchResult materialize) {
    }

    private final ClipMapper clipMapper;
    private final EpisodeMapper episodeMapper;
    private final MediaMapper mediaMapper;
    private final VideoAssetMapper videoAssetMapper;
    private final VideoAssetService videoAssetService;
    private final TorrentUiService torrentUiService;
    private final TorrentEpisodeDownloadService torrentDownloadService;
    private final MaterializeBatchService materializeBatchService;
    private final java.nio.file.Path videoAssetsRoot;
    private static final java.util.regex.Pattern MAIN_BATCH = java.util.regex.Pattern.compile(
            ".*(?:\\d{1,2}\\s*[-~]\\s*\\d{1,2}|tv|season\\s?\\d|s0\\d|全集).*");

    public MaterializeAutoController(ClipMapper clipMapper, EpisodeMapper episodeMapper, MediaMapper mediaMapper,
                                     VideoAssetMapper videoAssetMapper, VideoAssetService videoAssetService,
                                     TorrentUiService torrentUiService, TorrentEpisodeDownloadService torrentDownloadService,
                                     MaterializeBatchService materializeBatchService,
                                     @org.springframework.beans.factory.annotation.Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String videoAssetsRoot) {
        this.clipMapper = clipMapper;
        this.episodeMapper = episodeMapper;
        this.mediaMapper = mediaMapper;
        this.videoAssetMapper = videoAssetMapper;
        this.videoAssetService = videoAssetService;
        this.torrentUiService = torrentUiService;
        this.torrentDownloadService = torrentDownloadService;
        this.materializeBatchService = materializeBatchService;
        this.videoAssetsRoot = videoAssetsRoot == null ? null : java.nio.file.Path.of(videoAssetsRoot).toAbsolutePath().normalize();
    }

    @PostMapping("/preview")
    public PreviewResult preview(@RequestBody Req req) {
        return new PreviewResult(computeNeeds(req == null ? null : req.clipIds()));
    }

    @PostMapping("/run")
    public RunResult run(@RequestBody Req req) throws Exception {
        List<Long> clipIds = req == null ? null : req.clipIds();
        List<NeedItem> needs = computeNeeds(clipIds);
        List<RunItem> downloads = new ArrayList<>();
        for (NeedItem need : needs) {
            boolean ok = false;
            String reason = need.reason();
            try {
                if (need.recommendTitle() == null) {
                    reason = reason == null ? "无可用候选" : reason;
                } else {
                    VideoAsset asset = new VideoAsset();
                    asset.setEpisodeId(need.episodeId());
                    asset.setAssetType("DOWNLOADED");
                    asset.setAssetRole("UNASSIGNED");
                    asset.setAvailabilityState("UNCHECKED");
                    asset.setDisplayName(need.recommendTitle());
                    asset.setStableLocator(null); // locator 由 torrents.download 用 plan 传入
                    VideoAsset created = videoAssetService.create(asset);
                    // 重新取候选以拿到 locator（preview 未暴露）；一次失败自动换下一候选
                    java.util.List<TorrentUiService.CandidateDto> tries = pickList(need.mediaTitle(), need.episodeNo(), 3);
                    Exception lastErr = null;
                    for (TorrentUiService.CandidateDto pick : tries) {
                        try {
                            torrentDownloadService.download(created.getId(), need.mediaId(), 0L, need.episodeId(),
                                    pick.locator(), 8L * 1024 * 1024 * 1024,
                                    Boolean.TRUE.equals(pick.batch()) ? need.episodeNo() : null);
                            ok = true;
                            break;
                        } catch (Exception e) {
                            lastErr = e;
                        }
                    }
                    if (!ok) {
                        reason = lastErr == null ? "无可用候选" : lastErr.getMessage();
                    }
                }
            } catch (Exception e) {
                reason = e.getMessage();
            }
            downloads.add(new RunItem(need.episodeId(), need.episodeNo(), need.mediaTitle(), ok, reason));
        }
        MaterializeBatchService.BatchResult materialized =
                materializeBatchService.materialize(clipIds == null ? List.of() : clipIds);
        return new RunResult(downloads, materialized);
    }

    private List<NeedItem> computeNeeds(List<Long> clipIds) {
        List<NeedItem> out = new ArrayList<>();
        if (clipIds == null || clipIds.isEmpty()) {
            return out;
        }
        Set<Long> epIds = new LinkedHashSet<>();
        for (Clip clip : clipMapper.selectBatchIds(clipIds)) {
            if (clip.getEpisodeId() != null) {
                epIds.add(clip.getEpisodeId());
            }
        }
        if (epIds.isEmpty()) {
            return out;
        }
        Set<Long> availableEps = new LinkedHashSet<>();
        for (VideoAsset a : videoAssetMapper.selectList(new QueryWrapper<VideoAsset>()
                .select("episode_id", "storage_path").in("episode_id", epIds).eq("availability_state", "AVAILABLE"))) {
            if (fileExists(a)) {
                availableEps.add(a.getEpisodeId());
            }
        }
        Map<Long, Episode> eps = new LinkedHashMap<>();
        for (Episode e : episodeMapper.selectBatchIds(epIds)) {
            eps.put(e.getId(), e);
        }
        for (Long epId : epIds) {
            if (availableEps.contains(epId)) {
                continue;
            }
            Episode ep = eps.get(epId);
            if (ep == null) {
                out.add(new NeedItem(epId, null, null, null, null, null, null, null, null, null, null, null, "集不存在"));
                continue;
            }
            Media media = ep.getMediaId() == null ? null : mediaMapper.selectById(ep.getMediaId());
            String mediaTitle = media == null ? null : media.getTitle();
            TorrentUiService.CandidateDto pick = pickOne(mediaTitle, ep.getEpisodeNo());
            if (pick == null) {
                out.add(new NeedItem(epId, ep.getTitle(), ep.getEpisodeNo(), ep.getMediaId(), mediaTitle,
                        null, null, null, null, null, null, null, "无可下载候选（换关键词或源无做种）"));
            } else {
                out.add(new NeedItem(epId, ep.getTitle(), ep.getEpisodeNo(), ep.getMediaId(), mediaTitle,
                        pick.title(), pick.providerName(), pick.tier(), pick.group(), pick.resolution(),
                        pick.seeders(), pick.batch(), null));
            }
        }
        return out;
    }

    private boolean fileExists(VideoAsset a) {
        if (a == null || a.getStoragePath() == null || a.getStoragePath().isBlank() || videoAssetsRoot == null) {
            return false;
        }
        return java.nio.file.Files.isRegularFile(videoAssetsRoot.resolve(a.getStoragePath()));
    }

    private TorrentUiService.CandidateDto pickOne(String mediaTitle, Integer episodeNo) {
        java.util.List<TorrentUiService.CandidateDto> one = pickList(mediaTitle, episodeNo, 1);
        return one.isEmpty() ? null : one.get(0);
    }
    private java.util.List<TorrentUiService.CandidateDto> pickList(String mediaTitle, Integer episodeNo, int cap) {
        if (mediaTitle == null || mediaTitle.isBlank()) {
            return java.util.List.of();
        }
        java.util.List<TorrentUiService.CandidateDto> all = torrentUiService.searchCandidates(mediaTitle, java.util.List.of(), 200);
        java.util.List<TorrentUiService.CandidateDto> pool = new ArrayList<>();
        for (TorrentUiService.CandidateDto c : all) {
            if (c.locator() == null) { continue; }
            if (Boolean.TRUE.equals(c.batch())) { if (episodeNo != null) { pool.add(c); } continue; }
            java.util.List<Integer> nums = (c.episodes() != null && !c.episodes().isEmpty()) ? c.episodes()
                    : (c.episodeNumber() != null ? java.util.List.of(c.episodeNumber()) : java.util.List.of());
            if (episodeNo != null && !nums.isEmpty() && !nums.contains(episodeNo)) { continue; }
            pool.add(c);
        }
        if (pool.isEmpty()) { return java.util.List.of(); }
        java.util.Map<String, Integer> rank = java.util.Map.of("RAW", 0, "SOFT", 1, "UNKNOWN", 2, "HARD", 3);
        // 同档内评分越低越优：主 TV 合集(1-12/TV/S01/全集) > 主TV编号单集 > 其他合集 > 特殊/无号
        return pool.stream().sorted((x, y) -> {
            int r = Integer.compare(rank.getOrDefault(x.tier(), 99), rank.getOrDefault(y.tier(), 99));
            if (r != 0) return r;
            int sc = Integer.compare(score(x, episodeNo), score(y, episodeNo));
            if (sc != 0) return sc;
            return Integer.compare(y.seeders() == null ? 0 : y.seeders(), x.seeders() == null ? 0 : x.seeders());
        }).limit(Math.max(1, cap)).toList();
    }

    private static int score(TorrentUiService.CandidateDto c, Integer episodeNo) {
        String lower = String.valueOf(c.title()).toLowerCase();
        boolean special = lower.contains("最终章") || lower.contains("最終章") || lower.contains("finale")
                || lower.contains("剧场") || lower.contains("劇場") || lower.contains("映画")
                || lower.contains("movie") || lower.contains("der film") || lower.contains("orchestra")
                || lower.contains("管弦") || lower.contains("mllsd") || lower.contains("ミニ");
        boolean mainBatch = Boolean.TRUE.equals(c.batch())
                && (lower.contains("1-12") || lower.contains("01-12") || MAIN_BATCH.matcher(lower).matches());
        boolean numbered = c.episodeNumber() != null || (c.episodes() != null && !c.episodes().isEmpty());
        if (mainBatch) {
            return 0;      // 主 TV 全家桶：选择性取该集文件
        }
        if (!Boolean.TRUE.equals(c.batch()) && numbered && !special) {
            return 1;      // 主 TV 编号单集
        }
        if (Boolean.TRUE.equals(c.batch())) {
            return 2;      // 其他合集
        }
        return 3;          // 特殊/无集号
    }
}
