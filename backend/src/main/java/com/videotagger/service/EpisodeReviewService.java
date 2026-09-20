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
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

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
    private final VideoAssetService videoAssetService;

    public EpisodeReviewService(EpisodeMapper episodeMapper, VideoAssetMapper assetMapper,
                                ExternalEpisodeMapper externalEpisodeMapper, ExternalWorkMapper externalWorkMapper,
                                @Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String assetRoot,
                                @Value("${videotagger.animeko.db-path:}") String animekoDbPath,
                                VideoAssetService videoAssetService) {
        this.episodeMapper = episodeMapper;
        this.assetMapper = assetMapper;
        this.externalEpisodeMapper = externalEpisodeMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.assetRoot = Path.of(assetRoot).toAbsolutePath().normalize();
        String resolvedDb = AnimekoPaths.resolve(animekoDbPath);
        this.animekoLocator = resolvedDb == null || resolvedDb.isBlank()
                ? new AnimekoCacheLocator(null)
                : new AnimekoCacheLocator(Path.of(new File(resolvedDb).getParentFile().toURI()).toAbsolutePath().normalize());
        this.videoAssetService = videoAssetService;
    }

    /** assetId：C1 命中的本地资产（可据此建片段）；refUrl：C2 的稳定引用（animeko://，可据此建片段）；均无 → 只能播不能存。 */
    public record ReviewSource(String channel, String state, String filePath, String message,
                               Long assetId, String refUrl) {
    }

    /** Bangumi 绑定：subject（作品）+ provider episode（集）。 */
    private record BangumiRef(String subjectId, String providerEpisodeId) {
    }

    /** 删除结果（state=删除后该集预计的求值状态）。 */
    public record SourceDeleteResult(String channel, String state, String message) {
    }

    /** 删除集当前的本地源文件：C1 本地资产 → 删资产行+文件（被片段/映射/任务引用时拒绝）；C2 → 删 Animeko 缓存整集文件。 */
    public SourceDeleteResult deleteSource(long episodeId) {
        Episode ep = episodeMapper.selectById(episodeId);
        if (ep == null) throw new NoSuchElementException("episode not found: " + episodeId);
        ReviewSource src = resolve(episodeId);
        if (!"PRESENT".equals(src.state()) || src.filePath() == null) {
            throw new IllegalStateException("该集当前没有可删除的本地源（无本地资产、无 Animeko 整集缓存）");
        }
        if ("C1".equals(src.channel())) {
            for (VideoAsset asset : assetMapper.listByEpisode(episodeId)) {
                if (asset.getStoragePath() == null || asset.getStoragePath().isBlank()) continue;
                Path p = assetRoot.resolve(asset.getStoragePath().replace('\\', '/')).normalize();
                if (p.toAbsolutePath().normalize().toString().equals(src.filePath())) {
                    videoAssetService.deleteLocal(asset.getId());
                    return new SourceDeleteResult("C1", "UNAVAILABLE", "已删除本地资产（记录与文件）；如仍需观看该集请重新下载或缓存");
                }
            }
            throw new IllegalStateException("本地源未登记为资产记录，拒绝删除文件: " + src.filePath());
        }
        if (animekoLocator.deleteManagedFile(src.filePath())) {
            return new SourceDeleteResult("C2", "PENDING", "已删除 Animeko 缓存整集文件；Animeko 内再次播放该集会重新缓存");
        }
        throw new IllegalStateException("删除失败：文件不在 Animeko 受管目录或已被占用");
    }

    /** 定位集的可播放本地文件；无可用源返回 state=UNAVAILABLE（不抛错）。 */
    public ReviewSource resolve(long episodeId) {
        Episode ep = episodeMapper.selectById(episodeId);
        if (ep == null) throw new NoSuchElementException("episode not found: " + episodeId);
        // 1) C1：该集绑定的本地 asset（LOCAL_ORIGINAL 优先，文件在场）
        VideoAsset c1 = localAsset(episodeId);
        if (c1 != null) {
            String file = assetFilePath(c1);
            if (file != null) {
                return new ReviewSource("C1", "PRESENT", file, "本地集资产: " + file, c1.getId(), null);
            }
        }
        // 2) C2：Animeko 整集缓存
        BangumiRef ref = resolveBangumiRef(episodeId);
        if (ref != null) {
            AnimekoCacheLocator.LocateResult r = animekoLocator.locate(ref.providerEpisodeId());
            if ("PRESENT".equals(r.state()) && r.filePath() != null) {
                return new ReviewSource("C2", "PRESENT", r.filePath(), r.message(), null, refUrl(ref));
            }
        }
        return new ReviewSource(null, "UNAVAILABLE", null,
                "该集无本地源（无本地资产、无 Animeko 整集缓存）；可先在 Animeko 显式缓存该集", null, null);
    }

    /**
     * 灯状态用（批量）：这些集里哪些的 **C2 Animeko 整集缓存**在场。C1 由调用方按资产批量判定。
     * registry 只有 ~10KB，逐集 locate 足够；若将来变大，升级路径 = 一次性解析后匹配。
     */
    public Set<Long> cachedEpisodes(Collection<Long> localEpisodeIds) {
        Set<Long> out = new LinkedHashSet<>();
        if (localEpisodeIds == null || localEpisodeIds.isEmpty()) return out;
        for (Long id : localEpisodeIds) {
            if (id == null) continue;
            BangumiRef ref = resolveBangumiRef(id);
            if (ref == null || ref.providerEpisodeId() == null) continue;
            AnimekoCacheLocator.LocateResult r = animekoLocator.locate(ref.providerEpisodeId());
            if ("PRESENT".equals(r.state()) && r.filePath() != null) out.add(id);
        }
        return out;
    }

    /** 该集可用的本地原始源资产（跳过 GENERATED_CLIP 片段产物，且文件必须真的在场）。 */
    private VideoAsset localAsset(long episodeId) {
        try {
            List<VideoAsset> assets = assetMapper.listByEpisode(episodeId);
            for (VideoAsset a : assets) {
                if ("GENERATED_CLIP".equals(a.getAssetType())) continue;
                if (a.getAvailabilityState() == null || !"AVAILABLE".equals(a.getAvailabilityState())) continue;
                if (a.getStoragePath() == null) continue;
                if (assetFilePath(a) != null) return a;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    /** 资产存储路径 → 绝对路径；越界或文件不在返回 null。 */
    private String assetFilePath(VideoAsset a) {
        Path p = assetRoot.resolve(a.getStoragePath()).normalize();
        if (!p.startsWith(assetRoot) || !Files.isRegularFile(p)) return null;
        return p.toString();
    }

    /** C2 片段的稳定引用（与 AnimekoTagService 现场打标同形）；无 subject 绑定时为 null。 */
    private String refUrl(BangumiRef ref) {
        return ref.subjectId() == null ? null
                : "animeko://bangumi/" + ref.subjectId() + "/ep/" + ref.providerEpisodeId();
    }

    private BangumiRef resolveBangumiRef(long localEpisodeId) {
        try {
            List<ExternalEpisode> bridges = externalEpisodeMapper.listByLocalEpisode(localEpisodeId);
            for (ExternalEpisode bridge : bridges) {
                if (bridge.getExternalWorkId() == null || bridge.getProviderEpisodeId() == null) continue;
                ExternalWork work = externalWorkMapper.selectById(bridge.getExternalWorkId());
                if (work != null && PROVIDER_BANGUMI.equals(work.getProvider())) {
                    return new BangumiRef(work.getExternalId(), bridge.getProviderEpisodeId());
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }
}
