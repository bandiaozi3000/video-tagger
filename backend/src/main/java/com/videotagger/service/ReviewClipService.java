package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.util.VideoFingerprint;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.Objects;

/**
 * 本地回顾弹窗「保存片段」：把弹窗里标的区间落成一条新片段。
 *
 * <p>来源 = 该集当前解析到的本地源（C1 本地资产 → 复用 {@link VideoAssetClipService}；C2 Animeko 缓存 → animeko:// 引用）。
 *
 * <p>两种写法：
 * <ul>
 *   <li>集详情弹窗 → {@link #create}：弹窗在放整集源，区间直接就是源坐标，落成新片段。</li>
 *   <li>片段详情弹窗 → {@link #updateRange}：弹窗可能在放该片段**自己的产物**（ALREADY_READY），
 *       区间按弹窗内文件坐标传，本类平移回源坐标后更新原片段（区间变了则作废旧产物，避免
 *       ALREADY_READY 恒短路 → 导出/播放还是旧区间）。</li>
 * </ul>
 */
@Service
public class ReviewClipService {

    /** startMs/endMs = 弹窗内文件坐标。 */
    public record CreateRequest(Long startMs, Long endMs, String tag, String note, String title) {
    }

    /** 片段详情弹窗：更新原片段（区间同样按弹窗内文件坐标传）。 */
    public record RangeRequest(Long startMs, Long endMs, String tag, String note) {
    }

    private final EpisodeReviewService reviewService;
    private final EpisodeMapper episodeMapper;
    private final ClipMapper clipMapper;
    private final VideoAssetClipService assetClipService;
    private final MaterializationService channelService;
    private final ClipService clipService;
    private final EmbeddingTaskService embeddingTaskService;

    public ReviewClipService(EpisodeReviewService reviewService, EpisodeMapper episodeMapper, ClipMapper clipMapper,
                             VideoAssetClipService assetClipService, MaterializationService channelService,
                             ClipService clipService, EmbeddingTaskService embeddingTaskService) {
        this.reviewService = reviewService;
        this.episodeMapper = episodeMapper;
        this.clipMapper = clipMapper;
        this.assetClipService = assetClipService;
        this.channelService = channelService;
        this.clipService = clipService;
        this.embeddingTaskService = embeddingTaskService;
    }

    @Transactional
    public Clip create(long episodeId, CreateRequest req) {
        Episode ep = episodeMapper.selectById(episodeId);
        if (ep == null) throw new NoSuchElementException("episode not found: " + episodeId);
        if (req == null || req.startMs() == null || req.startMs() < 0) {
            throw new IllegalArgumentException("起点必填且不能为负数");
        }
        if (req.tag() == null || req.tag().isBlank()) {
            throw new IllegalArgumentException("标签必填");
        }
        long startMs = req.startMs();
        Long endMs = req.endMs();
        if (endMs != null && endMs <= startMs) throw new IllegalArgumentException("终点必须大于起点");

        EpisodeReviewService.ReviewSource src = reviewService.resolve(episodeId);
        if (!"PRESENT".equals(src.state())) throw new IllegalStateException(src.message());

        String title = req.title() == null || req.title().isBlank() ? ep.getTitle() : req.title().trim();
        Clip clip;
        if (src.assetId() != null) {
            clip = assetClipService.create(episodeId, src.assetId(),
                    new VideoAssetClipService.CreateReferenceClipRequest(title, startMs, endMs, req.tag(), req.note(), null));
        } else {
            if (src.refUrl() == null) {
                throw new IllegalStateException("该集本地源无法生成片段引用（缺 Bangumi 绑定）：只能播，存不了");
            }
            clip = referenceClip(ep.getId(), src.refUrl(), title, startMs, endMs, req.tag(), req.note());
        }
        clipService.linkClipTags(clip.getId(), req.tag(), System.currentTimeMillis());
        embeddingTaskService.enqueue(EntityType.CLIP, clip.getId());
        return clip;
    }

    /**
     * 片段详情弹窗保存：更新**本片段**的区间/标签/备注。区间按弹窗内文件坐标给，
     * 产物在播时平移回源坐标；区间真的变了就把旧产物作废（否则 ALREADY_READY 恒短路）。
     */
    @Transactional
    public Clip updateRange(long clipId, RangeRequest req) {
        Clip clip = clipMapper.selectById(clipId);
        if (clip == null) throw new NoSuchElementException("clip not found: " + clipId);
        if (req == null || req.startMs() == null || req.startMs() < 0) {
            throw new IllegalArgumentException("起点必填且不能为负数");
        }
        if (req.tag() == null || req.tag().isBlank()) throw new IllegalArgumentException("标签必填");

        long offset = artifactOffset(clip.getEpisodeId(), clipId);
        long startMs = req.startMs() + offset;
        Long endMs = req.endMs() == null ? null : req.endMs() + offset;
        if (endMs != null && endMs <= startMs) throw new IllegalArgumentException("终点必须大于起点");

        boolean rangeChanged = !Objects.equals(clip.getStartMs(), startMs) || !Objects.equals(clip.getEndMs(), endMs);
        if (rangeChanged) dropStaleProduct(clipId);
        // 作废后再读一次：videoAssetId/materialState 已被置空/PENDING
        Clip fresh = rangeChanged ? clipMapper.selectById(clipId) : clip;
        if (fresh.getUrl() == null || fresh.getUrl().isBlank()) {
            throw new IllegalStateException("该片段没有可用来源地址，无法更新区间");
        }
        SaveClipRequest full = new SaveClipRequest(fresh.getTitle(), fresh.getUrl(), startMs / 1000d,
                endMs == null ? null : endMs / 1000d, req.tag(), req.note(), fresh.getVideoDuration(),
                null, null, null, null, null, null, null, startMs, endMs);
        return clipService.update(clipId, full, false);
    }

    /** 区间变了 → 旧产物按旧区间，留不得：删产物资产与文件（deleteSource 会把引用置空）。 */
    private void dropStaleProduct(long clipId) {
        try {
            MaterializationService.Evaluation ev = channelService.evaluate(clipId, false);
            if (ev != null && "ALREADY_READY".equals(ev.strategy())) channelService.deleteSource(clipId);
        } catch (Exception ignored) {
            // 产物本就不在场/删不掉：不阻断区间更新（clip 仍是未剪出态）
        }
    }

    /** 弹窗内容是否为来源片段自己的产物；是则返回产物的源坐标偏移（产物 t=0 对应的源毫秒），否则 0。 */
    private long artifactOffset(Long episodeId, Long baseClipId) {
        if (baseClipId == null || episodeId == null) return 0L;
        Clip base = clipMapper.selectById(baseClipId);
        if (base == null || !episodeId.equals(base.getEpisodeId())) return 0L;
        String strategy;
        try {
            MaterializationService.Evaluation ev = channelService.evaluate(baseClipId, false);
            strategy = ev == null ? null : ev.strategy();
        } catch (Exception e) {
            return 0L;
        }
        if (!"ALREADY_READY".equals(strategy)) return 0L;
        if (base.getStartMs() != null) return base.getStartMs();
        return base.getTimestampSec() == null ? 0L : Math.round(base.getTimestampSec() * 1000);
    }

    /** C2（无本地资产行）：与 AnimekoTagService 现场打标同形的引用片段。 */
    private Clip referenceClip(long episodeId, String refUrl, String title, long startMs, Long endMs,
                               String tag, String note) {
        Clip clip = new Clip();
        clip.setTitle(title);
        clip.setUrl(refUrl);
        clip.setVideoFp(VideoFingerprint.fingerprint(refUrl));
        clip.setEpisodeId(episodeId);
        clip.setTimestampSec(startMs / 1000d);
        clip.setEndSec(endMs == null ? null : endMs / 1000d);
        clip.setStartMs(startMs);
        clip.setEndMs(endMs);
        clip.setMaterialState("REFERENCE_ONLY");
        clip.setTag(tag.trim());
        clip.setNote(note == null ? "" : note);
        clip.setCreatedAt(System.currentTimeMillis());
        clipMapper.insert(clip);
        return clip;
    }
}
