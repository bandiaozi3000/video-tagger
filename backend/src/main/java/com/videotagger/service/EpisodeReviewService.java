package com.videotagger.service;

import com.videotagger.entity.Episode;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.material.AnimekoCacheLocator;
import com.videotagger.util.AnimekoPaths;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * v0.24 集级本地回顾源解析：给定集，返回一个可流式播放的本地文件（不裁剪）。
 * 源顺序：1) 该集绑定的本地 asset（C1，LOCAL_ORIGINAL AVAILABLE 在场）
 *        2) Animeko 整集缓存（C2：桥 → Bangumi episodeId → 缓存文件）。
 * 均无 → UNAVAILABLE。与片段级「本地回顾」互补：片段回顾播区间，集回顾播整集。
 */
@Service
public class EpisodeReviewService {

    private static final String PROVIDER_BANGUMI = "BANGUMI";

    private final EpisodeMapper episodeMapper;
    private final VideoAssetMapper assetMapper;
    private final ExternalEpisodeMapper externalEpisodeMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final Path assetRoot;
    private final AnimekoCacheLocator animekoLocator;

    public EpisodeReviewService(EpisodeMapper episodeMapper, VideoAssetMapper assetMapper,
                                ExternalEpisodeMapper externalEpisodeMapper, ExternalWorkMapper externalWorkMapper,
                                @Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String assetRoot,
                                @Value("${videotagger.animeko.db-path:}") String animekoDbPath) {
        this.episodeMapper = episodeMapper;
        this.assetMapper = assetMapper;
        this.externalEpisodeMapper = externalEpisodeMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.assetRoot = Path.of(assetRoot).toAbsolutePath().normalize();
        String resolvedDb = AnimekoPaths.resolve(animekoDbPath);
        this.animekoLocator = resolvedDb == null || resolvedDb.isBlank()
                ? new AnimekoCacheLocator(null)
                : new AnimekoCacheLocator(Path.of(new File(resolvedDb).getParentFile().toURI()).toAbsolutePath().normalize());
    }

    public record ReviewSource(String state, String filePath, String message) {
    }

    /** 定位集的可播放本地文件；无可用源返回 state=UNAVAILABLE（不抛错）。 */
    public ReviewSource resolve(long episodeId) {
        Episode ep = episodeMapper.selectById(episodeId);
        if (ep == null) throw new NoSuchElementException("episode not found: " + episodeId);
        // 1) C1：该集绑定的本地 asset（LOCAL_ORIGINAL 优先，文件在场）
        String c1 = localAssetFile(episodeId);
        if (c1 != null) {
            return new ReviewSource("PRESENT", c1, "本地集资产: " + c1);
        }
        // 2) C2：Animeko 整集缓存
        String bangumiEp = resolveBangumiEpisodeId(episodeId);
        if (bangumiEp != null) {
            AnimekoCacheLocator.LocateResult r = animekoLocator.locate(bangumiEp);
            if ("PRESENT".equals(r.state()) && r.filePath() != null) {
                return new ReviewSource("PRESENT", r.filePath(), r.message());
            }
        }
        return new ReviewSource("UNAVAILABLE", null,
                "该集无本地源（无本地资产、无 Animeko 整集缓存）；可先在 Animeko 显式缓存该集");
    }

    private String localAssetFile(long episodeId) {
        try {
            List<VideoAsset> assets = assetMapper.listByEpisode(episodeId);
            // 只认本地原始源资产（整集）；GENERATED_CLIP 是该集片段产物，不是整集源
            for (VideoAsset a : assets) {
                if ("GENERATED_CLIP".equals(a.getAssetType())) continue;
                if (a.getAvailabilityState() == null || !"AVAILABLE".equals(a.getAvailabilityState())) continue;
                if (a.getStoragePath() == null) continue;
                Path p = assetRoot.resolve(a.getStoragePath()).normalize();
                if (!p.startsWith(assetRoot) || !Files.isRegularFile(p)) continue;
                return p.toString();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private String resolveBangumiEpisodeId(long localEpisodeId) {
        try {
            List<ExternalEpisode> bridges = externalEpisodeMapper.listByLocalEpisode(localEpisodeId);
            for (ExternalEpisode bridge : bridges) {
                if (bridge.getExternalWorkId() == null) continue;
                ExternalWork work = externalWorkMapper.selectById(bridge.getExternalWorkId());
                if (work != null && PROVIDER_BANGUMI.equals(work.getProvider())
                        && bridge.getProviderEpisodeId() != null) {
                    return bridge.getProviderEpisodeId();
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }
}
