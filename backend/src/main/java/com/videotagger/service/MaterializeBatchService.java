package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalWork;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * v0.24 M2+：批量素材化（延迟物化编排）。
 * 给一批片段：逐个求值渠道 —— 本地文件在场（C1/C2 PRESENT）→ 立即裁剪出产物；
 * 无整文件 → 归入"待预取"清单（按 Bangumi subject/episode 去重），供 Animeko 显式缓存/fork CLI 批量缓存后重跑。
 * 支持打标零缓存、事后批量物化的流程。
 */
@Service
public class MaterializeBatchService {

    private static final Logger log = LoggerFactory.getLogger(MaterializeBatchService.class);
    private static final String PROVIDER_BANGUMI = "BANGUMI";

    private final ClipMapper clipMapper;
    private final ExternalEpisodeMapper externalEpisodeMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final MaterializationService channelService;
    private final ClipMaterializationService clipMaterializationService;

    public MaterializeBatchService(ClipMapper clipMapper,
                                   ExternalEpisodeMapper externalEpisodeMapper,
                                   ExternalWorkMapper externalWorkMapper,
                                   MaterializationService channelService,
                                   ClipMaterializationService clipMaterializationService) {
        this.clipMapper = clipMapper;
        this.externalEpisodeMapper = externalEpisodeMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.channelService = channelService;
        this.clipMaterializationService = clipMaterializationService;
    }

    /** 待预取条目（Bangumi subject/episode，去重用 key）。 */
    public record PrefetchItem(String subjectId, String episodeId) {
        public String key() {
            return subjectId + "/" + episodeId;
        }
    }

    /** 单片段结果。 */
    public record ItemResult(Long clipId, String title, String channel, String state, boolean ok,
                             String message, String assetUrl, PrefetchItem prefetch) {
    }

    public record BatchResult(List<ItemResult> results, List<PrefetchItem> prefetchNeeded, int okCount) {
    }

    /** 批量物化：逐个求值并尝试裁剪；文件不在场的片段汇总到 prefetchNeeded（按集去重）。 */
    public BatchResult materialize(List<Long> clipIds) {
        if (clipIds == null || clipIds.isEmpty()) {
            throw new IllegalArgumentException("clipIds 不能为空");
        }
        List<ItemResult> results = new ArrayList<>();
        Map<String, PrefetchItem> prefetchMap = new LinkedHashMap<>();
        int okCount = 0;
        for (Long clipId : clipIds) {
            ItemResult r = materializeOne(clipId);
            if (r.ok()) okCount++;
            if (r.prefetch() != null) prefetchMap.put(r.prefetch().key(), r.prefetch());
            results.add(r);
        }
        return new BatchResult(results, new ArrayList<>(prefetchMap.values()), okCount);
    }

    private ItemResult materializeOne(Long clipId) {
        Clip clip = clipMapper.selectById(clipId);
        if (clip == null) {
            return new ItemResult(clipId, null, null, null, false, "片段不存在", null, null);
        }
        String title = clip.getTitle() == null ? ("#" + clipId) : clip.getTitle();
        try {
            MaterializationService.Evaluation ev = channelService.evaluate(clipId, true);
            if ("PRESENT".equals(ev.state())) {
                if (ev.filePath() == null) {
                    return new ItemResult(clipId, title, ev.channel(), ev.state(), false,
                            "渠道在场但缺少可剪路径", null, prefetchOf(clip));
                }
                // 文件在场：优先按 clip 已绑本地资产裁剪；未绑定（按 episode 兜底命中的引用片段）走外部文件路径
                if (clip.getVideoAssetId() != null && "TRIM_LOCAL_ASSET".equals(ev.strategy())) {
                    ClipMaterializationService.Result res = clipMaterializationService.materialize(clipId);
                    return new ItemResult(clipId, title, ev.channel(), "READY", true,
                            "已剪出产物", res.storagePath(), null);
                }
                ClipMaterializationService.Result res =
                        clipMaterializationService.materializeFromFile(clipId, ev.filePath());
                return new ItemResult(clipId, title, ev.channel(), "READY", true,
                        "已剪出产物（外部文件）", res.storagePath(), null);
            }
            // 无文件 → 待预取（能反查到 Bangumi 集号则给出条目）
            PrefetchItem p = prefetchOf(clip);
            return new ItemResult(clipId, title, ev.channel(), ev.state(), false,
                    p == null ? "无本地文件且无法反查集号（可能未建档）" : "文件不在场，需先缓存该集", null, p);
        } catch (Exception e) {
            log.warn("[materialize-batch] clip {} 物化失败: {}", clipId, e.getMessage());
            return new ItemResult(clipId, title, null, "FAILED", false, e.getMessage(), null,
                    prefetchOf(clip));
        }
    }

    /** 本地集 → Bangumi subject/episode（供 Animeko 显式缓存 / fork CLI 预取）。 */
    private PrefetchItem prefetchOf(Clip clip) {
        if (clip.getEpisodeId() == null) return null;
        try {
            List<ExternalEpisode> bridges = externalEpisodeMapper.listByLocalEpisode(clip.getEpisodeId());
            for (ExternalEpisode b : bridges) {
                if (b.getExternalWorkId() == null || b.getProviderEpisodeId() == null) continue;
                ExternalWork work = externalWorkMapper.selectById(b.getExternalWorkId());
                if (work != null && PROVIDER_BANGUMI.equals(work.getProvider())) {
                    return new PrefetchItem(String.valueOf(work.getExternalId()), b.getProviderEpisodeId());
                }
            }
        } catch (Exception e) {
            log.warn("[materialize-batch] 反查 Bangumi 集失败 ep={}: {}", clip.getEpisodeId(), e.getMessage());
        }
        return null;
    }
}
