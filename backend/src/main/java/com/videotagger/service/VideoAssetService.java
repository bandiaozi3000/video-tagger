package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.VideoAsset;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.VideoAssetMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

@Service
public class VideoAssetService {
    private static final Logger log = LoggerFactory.getLogger(VideoAssetService.class);

    private final VideoAssetMapper assetMapper;
    private final ClipMapper clipMapper;
    private final com.videotagger.mapper.VideoTimeMappingMapper mappingMapper;
    private final com.videotagger.mapper.VideoSourceTaskMapper taskMapper;
    private final Path assetRoot;

    public VideoAssetService(VideoAssetMapper assetMapper, ClipMapper clipMapper,
                             com.videotagger.mapper.VideoTimeMappingMapper mappingMapper,
                             com.videotagger.mapper.VideoSourceTaskMapper taskMapper,
                             @Value("${videotagger.video-assets.root-dir:${VT_DATA_DIR:data}/video-assets}") String assetRoot) {
        this.assetMapper = assetMapper;
        this.clipMapper = clipMapper;
        this.mappingMapper = mappingMapper;
        this.taskMapper = taskMapper;
        this.assetRoot = assetRoot == null || assetRoot.isBlank()
                ? null : Path.of(assetRoot).toAbsolutePath().normalize();
    }

    public List<VideoAsset> list(long episodeId) {
        return assetMapper.listByEpisode(episodeId);
    }

    public VideoAsset create(VideoAsset asset) {
        if (asset == null || asset.getEpisodeId() == null) throw new IllegalArgumentException("Episode is required");
        if (asset.getAssetRole() == null) asset.setAssetRole("UNASSIGNED");
        if (asset.getAvailabilityState() == null) asset.setAvailabilityState("UNCHECKED");
        long now = System.currentTimeMillis();
        if (asset.getCreatedAt() == null) asset.setCreatedAt(now);
        asset.setUpdatedAt(now);
        assetMapper.insert(asset);
        return asset;
    }

    public VideoAsset select(long episodeId) {
        return assetMapper.selectAvailable(episodeId);
    }

    public VideoAsset setRole(long assetId, String role) {
        if (!List.of("PRIMARY", "FALLBACK", "UNASSIGNED").contains(role)) throw new IllegalArgumentException("Invalid asset role");
        VideoAsset asset = assetMapper.selectById(assetId);
        if (asset == null) throw new IllegalArgumentException("Asset not found");
        if ("PRIMARY".equals(role)) {
            long now = System.currentTimeMillis();
            assetMapper.demoteOtherPrimary(asset.getEpisodeId(), assetId, now);
        }
        asset.setAssetRole(role);
        asset.setUpdatedAt(System.currentTimeMillis());
        assetMapper.updateById(asset);
        return asset;
    }

    /** 仅删资产记录（不删本地文件）。被 Clip / 时间映射 / 进行中任务引用时拒绝（CONFLICT）。 */
    @Transactional
    public void delete(long assetId) {
        assertDeletable(assetId);
        if (assetMapper.deleteById(assetId) == 0) throw new IllegalArgumentException("Asset not found");
    }

    /**
     * 删除本地资产：自动解除引用它的片段（片段保留、失去本地素材，回退为 REFERENCE_ONLY / PENDING），
     * 再删除本地文件与资产记录。被换源校准映射引用或仍有进行中任务时拒绝。
     */
    @Transactional
    public void deleteLocal(long assetId) {
        VideoAsset asset = assetMapper.selectById(assetId);
        if (asset == null) throw new IllegalArgumentException("Asset not found");
        boolean product = "GENERATED_CLIP".equals(asset.getAssetType());
        for (Clip clip : clipMapper.listByVideoAsset(assetId)) {
            clip.setVideoAssetId(null);
            clip.setMaterialState(product ? "PENDING" : "REFERENCE_ONLY");
            clipMapper.updateById(clip);
        }
        if (mappingMapper.countByAsset(assetId) > 0) {
            throw new IllegalStateException("该资产被换源校准引用，请先删除相关校准");
        }
        if (taskMapper.countActiveByAsset(assetId) > 0) {
            throw new IllegalStateException("该资产有进行中的任务，请先取消或等待完成");
        }
        Path file = resolveStorageFile(asset);
        if (file != null) {
            try {
                Files.deleteIfExists(file);
            } catch (IOException e) {
                log.warn("删除资产文件失败 asset={} {}: {}", assetId, file, e.getMessage());
            }
        }
        assetMapper.deleteById(assetId);
    }

    /** 删除某集全部本地资产（删行+文件）。供删集/删媒体级联调用；被引用或文件越界时跳过并记日志。 */
    @Transactional
    public void deleteLocalForEpisode(long episodeId) {
        for (VideoAsset asset : assetMapper.listByEpisode(episodeId)) {
            try {
                deleteLocal(asset.getId());
            } catch (IllegalStateException e) {
                log.warn("跳过删除被引用的资产 asset={}: {}", asset.getId(), e.getMessage());
            } catch (RuntimeException e) {
                log.warn("删除资产失败 asset={}: {}", asset.getId(), e.getMessage());
            }
        }
    }

    private void assertDeletable(long assetId) {
        if (!clipMapper.listByVideoAsset(assetId).isEmpty()) {
            throw new IllegalStateException("该资产被片段引用，请先删除相关片段");
        }
        if (mappingMapper.countByAsset(assetId) > 0) {
            throw new IllegalStateException("该资产被换源校准引用，请先处理相关映射");
        }
        if (taskMapper.countActiveByAsset(assetId) > 0) {
            throw new IllegalStateException("该资产有进行中的任务，请先取消或等待完成");
        }
    }

    /** storagePath 解析到受管绝对路径；相对根 / 绝对路径均可，越界返回 null。 */
    private Path resolveStorageFile(VideoAsset asset) {
        if (assetRoot == null || asset.getStoragePath() == null || asset.getStoragePath().isBlank()) return null;
        try {
            Path raw = Path.of(asset.getStoragePath().replace('\\', '/'));
            Path resolved = raw.isAbsolute() ? raw : assetRoot.resolve(raw);
            Path normalized = resolved.toAbsolutePath().normalize();
            return normalized.startsWith(assetRoot) ? normalized : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
