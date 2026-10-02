package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.util.VideoFingerprint;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 从既有视频资产（本地源）剪出一条引用片段。标签走受控词表 {@code tagIds}（v0.31）。 */
@Service
public class VideoAssetClipService {

    public record CreateReferenceClipRequest(String title, long startMs, Long endMs, List<Long> tagIds,
                                             String note, String sourceUrl) {
    }

    private final VideoAssetMapper assets;
    private final ClipMapper clips;
    private final TagLinkService tagLinkService;

    public VideoAssetClipService(VideoAssetMapper assets, ClipMapper clips, TagLinkService tagLinkService) {
        this.assets = assets;
        this.clips = clips;
        this.tagLinkService = tagLinkService;
    }

    @Transactional
    public Clip create(long episodeId, long assetId, CreateReferenceClipRequest request) {
        VideoAsset asset = assets.selectById(assetId);
        if (asset == null || !asset.getEpisodeId().equals(episodeId)) {
            throw new IllegalArgumentException("Asset does not belong to Episode");
        }
        if (request == null || request.startMs() < 0 || request.endMs() != null && request.endMs() <= request.startMs()) {
            throw new IllegalArgumentException("Invalid Clip range");
        }
        if (request.tagIds() == null || request.tagIds().isEmpty()) {
            throw new IllegalArgumentException("Clip tag is required");
        }
        String url = request.sourceUrl() == null || request.sourceUrl().isBlank()
                ? asset.getStableLocator() : request.sourceUrl();
        if (url == null || url.isBlank()) {
            url = "video-asset:" + assetId;
        }
        Clip clip = new Clip();
        clip.setEpisodeId(episodeId);
        clip.setVideoAssetId(assetId);
        clip.setSourceRevision(asset.getSourceRevision());
        clip.setTitle(request.title() == null || request.title().isBlank() ? asset.getDisplayName() : request.title());
        clip.setUrl(url);
        clip.setVideoFp(VideoFingerprint.fingerprint(url));
        clip.setStartMs(request.startMs());
        clip.setEndMs(request.endMs());
        clip.setTimestampSec(request.startMs() / 1000d);
        clip.setEndSec(request.endMs() == null ? null : request.endMs() / 1000d);
        clip.setVideoDuration(asset.getDurationMs() == null ? null : asset.getDurationMs() / 1000d);
        clip.setNote(request.note() == null ? "" : request.note());
        clip.setMaterialState("AVAILABLE".equals(asset.getAvailabilityState()) && asset.getStoragePath() != null
                ? "READY" : "REFERENCE_ONLY");
        clip.setCreatedAt(System.currentTimeMillis());
        clips.insert(clip);
        tagLinkService.setClipTags(clip.getId(), request.tagIds());
        tagLinkService.decorate(clip);
        return clip;
    }
}
