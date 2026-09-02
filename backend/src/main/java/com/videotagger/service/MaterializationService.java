package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.material.AnimekoCacheLocator;
import com.videotagger.material.ChannelHint;
import com.videotagger.material.MaterializationChannel;
import com.videotagger.util.AnimekoPaths;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * v0.24 M3 素材化管线求值：给定 Clip，按 C1(本地文件池/指纹) → C2(Animeko episodeId→文件)
 * → C3(网页直链受控下载) → C4(录屏回退) 渠道优先级，判定"当前可用素材源"。
 *
 * <p>纯读求值，不改库（改库动作由调用方按需执行）。老库 Clip 无 channel_hints → 一律走推断；
 * 推断命中后调用方可用 {@link #persistHints(long, List)} 回写，供后续秒级决策。
 */
@Service
public class MaterializationService {

    private static final Logger log = LoggerFactory.getLogger(MaterializationService.class);
    private static final String PROVIDER_BANGUMI = "BANGUMI";

    private final ClipMapper clipMapper;
    private final VideoAssetMapper assetMapper;
    private final ExternalEpisodeMapper externalEpisodeMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final AnimekoCacheLocator c2Locator;
    private final Path assetRoot;

    public MaterializationService(ClipMapper clipMapper,
                                  VideoAssetMapper assetMapper,
                                  ExternalEpisodeMapper externalEpisodeMapper,
                                  ExternalWorkMapper externalWorkMapper,
                                  @Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String assetRoot,
                                  @Value("${videotagger.animeko.db-path:}") String animekoDbPath) {
        this.clipMapper = clipMapper;
        this.assetMapper = assetMapper;
        this.externalEpisodeMapper = externalEpisodeMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.assetRoot = Path.of(assetRoot).toAbsolutePath().normalize();
        this.c2Locator = new AnimekoCacheLocator(animekoDataRoot(AnimekoPaths.resolve(animekoDbPath)));
    }

    private static Path animekoDataRoot(String resolvedDbPath) {
        if (resolvedDbPath == null || resolvedDbPath.isBlank()) return null;
        File db = new File(resolvedDbPath);
        File parent = db.getParentFile();
        return parent == null ? null : parent.toPath().toAbsolutePath().normalize();
    }

    /** 求值结论：选中的渠道/状态与可用源；strategy 沿用 ClipMaterializationService 语义以复用裁剪路径。 */
    public record Evaluation(long clipId, String channel, String state, String strategy,
                             Long assetId, String filePath, String url, String message) {
    }

    /**
     * 求值一个 Clip 的当前可用素材源。
     *
     * @param refreshHints true 时把求值得到的渠道线索回写 clip（幂等，便于后续展示秒级可查）
     */
    public Evaluation evaluate(long clipId, boolean refreshHints) {
        Clip clip = require(clipId);
        // 0) 已物化（READY + 产物资产在场）→ 不再重新裁剪，产物即最终素材
        if ("READY".equals(clip.getMaterialState()) && clip.getVideoAssetId() != null) {
            VideoAsset done = assetMapper.selectById(clip.getVideoAssetId());
            String doneFile = done == null ? null : fileOf(done);
            if (doneFile != null) {
                return new Evaluation(clipId, "C1", "PRESENT", "ALREADY_READY",
                        done.getId(), doneFile, null, "已就绪：产物 " + doneFile);
            }
        }
        // 1) channel_hints 里已登记的 present 线索优先（历史已定位成功的源不再重新探）
        List<ChannelHint> hints = ChannelHint.Codec.decode(clip.getChannelHints());
        ChannelHint known = ChannelHint.Codec.firstActionable(hints);
        if (known != null && known.isPresent() && known.filePath() != null
                && Files.isRegularFile(Path.of(known.filePath()))) {
            String strategy = known.assetId() != null ? "TRIM_LOCAL_ASSET" : "TRIM_EXTERNAL_FILE";
            return new Evaluation(clipId, known.channel(), "PRESENT", strategy,
                    known.assetId(), known.filePath(), known.url(),
                    channelLabel(known.channel()) + " 线索命中: " + known.filePath());
        }
        // 2) C1 本地池：clip 已绑资产 或 videoFp 指纹命中
        VideoAsset local = resolveC1(clip);
        if (local != null) {
            String file = fileOf(local);
            if (file != null) {
                if (refreshHints) {
                    persistHints(clipId, ChannelHint.Codec.upsert(hints, new ChannelHint(
                            "C1", "PRESENT", "local-file", null, null, clip.getVideoFp(),
                            local.getId(), null, file, System.currentTimeMillis())));
                }
                return new Evaluation(clipId, "C1", "PRESENT", "TRIM_LOCAL_ASSET",
                        local.getId(), file, null, "C1 本地文件命中: " + file);
            }
        }
        // 3) C2 Animeko：本地 episode → Bangumi episodeId → Animeko 缓存文件
        String bangumiEpisodeId = resolveBangumiEpisodeId(clip.getEpisodeId());
        AnimekoCacheLocator.LocateResult r2 = bangumiEpisodeId == null ? null
                : c2Locator.locate(bangumiEpisodeId);
        if (r2 != null && "PRESENT".equals(r2.state())) {
            if (refreshHints) {
                persistHints(clipId, ChannelHint.Codec.upsert(hints, new ChannelHint(
                        "C2", "PRESENT", "animeko-cache", bangumiEpisodeId, null, null,
                        null, null, r2.filePath(), System.currentTimeMillis())));
            }
            return new Evaluation(clipId, "C2", "PRESENT", "TRIM_EXTERNAL_FILE",
                    null, r2.filePath(), null, "C2 Animeko 文件命中: " + r2.filePath());
        }
        if (r2 != null && "PENDING".equals(r2.state())) {
            if (refreshHints) {
                persistHints(clipId, ChannelHint.Codec.upsert(hints, new ChannelHint(
                        "C2", "PENDING", "animeko-cache", bangumiEpisodeId, null, null,
                        null, null, null, System.currentTimeMillis())));
            }
            return new Evaluation(clipId, "C2", "PENDING", "SOURCE_REQUIRED",
                    null, null, null, r2.message());
        }
        // 4) C3 网页直链：clip.url 为 http(s)（引用源），可经受控下载/中继
        String url = clip.getUrl();
        if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
            return new Evaluation(clipId, "C3", "PENDING", "DOWNLOAD_RANGE_OR_EPISODE",
                    clip.getVideoAssetId(), null, url,
                    "C3 网页直链：文件不在场，可经受控下载/受控中继（" + url + "）");
        }
        // 5) C2 渠道本身不可用也要如实上报（区别于纯 C4 兜底）
        if (r2 != null) {
            if (refreshHints) {
                persistHints(clipId, ChannelHint.Codec.upsert(hints, new ChannelHint(
                        "C2", r2.state(), "animeko-cache", bangumiEpisodeId, null, null,
                        null, null, null, System.currentTimeMillis())));
            }
            return new Evaluation(clipId, "C2", r2.state(), "SOURCE_REQUIRED", null, null, null, r2.message());
        }
        // 6) C4 录屏回退
        return new Evaluation(clipId, "C4", "PENDING", "SOURCE_REQUIRED",
                null, null, null,
                "C1-C3 均无可用素材源，可回退录屏（getDisplayMedia）或先预取该集整文件");
    }

    /** 便捷：只求值不写库。 */
    public Evaluation evaluate(long clipId) {
        return evaluate(clipId, false);
    }

    /** 回写求值所得的渠道线索（幂等 upsert）。 */
    public void persistHints(long clipId, List<ChannelHint> hints) {
        Clip patch = new Clip();
        patch.setId(clipId);
        patch.setChannelHints(ChannelHint.Codec.encode(hints));
        clipMapper.updateById(patch);
    }

    private VideoAsset resolveC1(Clip clip) {
        if (clip.getVideoAssetId() != null) {
            VideoAsset a = assetMapper.selectById(clip.getVideoAssetId());
            if (a != null && isLocalKind(a) && "AVAILABLE".equals(a.getAvailabilityState())) return a;
        }
        if (clip.getVideoFp() != null) {
            VideoAsset byFp = assetMapper.selectByFingerprint(clip.getVideoFp());
            if (byFp != null) return byFp;
        }
        // Animeko 现场打标 clip：无绑定资产/指纹匹配，但有 episodeId → 命中该集可用本地资产（C1）
        if (clip.getEpisodeId() != null) {
            VideoAsset byEp = assetMapper.selectAvailable(clip.getEpisodeId());
            if (byEp != null && isLocalKind(byEp)) return byEp;
        }
        return null;
    }

    private boolean isLocalKind(VideoAsset a) {
        String t = a.getAssetType();
        return "LOCAL_ORIGINAL".equals(t) || "DOWNLOADED".equals(t) || "UPLOADED".equals(t);
    }

    private String fileOf(VideoAsset a) {
        if (a.getStoragePath() == null) return null;
        Path p = assetRoot.resolve(a.getStoragePath()).normalize();
        if (!p.startsWith(assetRoot) || !Files.isRegularFile(p)) return null;
        return p.toString();
    }

    /** 本地 episode → 首个 BANGUMI 桥的 provider_episode_id。 */
    private String resolveBangumiEpisodeId(Long localEpisodeId) {
        if (localEpisodeId == null) return null;
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
        } catch (Exception e) {
            log.warn("[material] 反查 Bangumi episodeId 失败 ep={}: {}", localEpisodeId, e.getMessage());
        }
        return null;
    }

    private Clip require(long clipId) {
        Clip clip = clipMapper.selectById(clipId);
        if (clip == null) throw new NoSuchElementException("clip not found: " + clipId);
        return clip;
    }

    private String channelLabel(String code) {
        MaterializationChannel c = MaterializationChannel.parse(code);
        return c == null ? code : c.label();
    }
}
