package com.videotagger.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.mapper.VideoSourceItemMapper;
import com.videotagger.mapper.VideoSourcePackageMapper;
import com.videotagger.videosource.VideoSourceDiscoveryRequest;
import com.videotagger.videosource.VideoSourceDiscoveryQuery;
import com.videotagger.videosource.VideoSourceProvider;
import com.videotagger.videosource.VideoSourceProviderRegistry;
import com.videotagger.videosource.VideoSourceStatus;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VideoSourceDiscoveryService {
    private final VideoSourceProviderRegistry registry;
    private final VideoSourcePackageMapper packageMapper;
    private final VideoSourceItemMapper itemMapper;
    private final ObjectMapper objectMapper;
    private final com.videotagger.mapper.VideoSourceEpisodeMapMapper mappingMapper;

    public VideoSourceDiscoveryService(VideoSourceProviderRegistry registry, VideoSourcePackageMapper packageMapper, VideoSourceItemMapper itemMapper, ObjectMapper objectMapper, com.videotagger.mapper.VideoSourceEpisodeMapMapper mappingMapper) {
        this.registry = registry;
        this.packageMapper = packageMapper;
        this.itemMapper = itemMapper;
        this.objectMapper = objectMapper;
        this.mappingMapper = mappingMapper;
    }

    public List<com.videotagger.entity.VideoSourcePackage> cached(long mediaEntryId) { return packageMapper.listByMediaEntry(mediaEntryId); }

    public com.videotagger.entity.VideoSourcePackage cacheCandidate(long mediaEntryId,
                                                                     com.videotagger.videosource.VideoSourcePackage source) {
        saveCandidate(mediaEntryId, source);
        return packageMapper.selectStable(source.providerId(), source.providerPackageId(), source.revision());
    }

    public List<com.videotagger.entity.VideoSourcePackage> discover(long mediaEntryId, VideoSourceDiscoveryRequest request) {
        VideoSourceDiscoveryRequest safe = request == null ? new VideoSourceDiscoveryRequest(null, null, null, null, null, null, null, 0, 50) : request;
        VideoSourceDiscoveryQuery query = safe.query(mediaEntryId);
        List<VideoSourceProvider> providers = safe.providerId() == null || safe.providerId().isBlank() ? List.copyOf(registry.all()) : List.of(registry.require(safe.providerId()));
        List<com.videotagger.videosource.VideoSourcePackage> result = providers.stream().filter(p -> p.capabilities().supports(VideoSourceStatus.Capability.DISCOVER_PACKAGES)).flatMap(p -> p.discover(query).stream()).toList();
        result.forEach(source -> saveCandidate(mediaEntryId, source));
        return cached(mediaEntryId);
    }

    public com.videotagger.entity.VideoSourcePackage adopt(long packageId) {
        com.videotagger.entity.VideoSourcePackage value = requireCached(packageId);
        for (com.videotagger.entity.VideoSourceItem item : itemMapper.listByPackage(packageId)) {
            com.videotagger.entity.VideoSourceEpisodeMap mapping = mappingMapper.selectBySourceItem(item.getId());
            if (mapping == null || !("CONFIRMED".equals(mapping.getStatus()) || "IGNORED".equals(mapping.getStatus()))) {
                throw new IllegalStateException("All source items must be confirmed or ignored before adoption");
            }
        }
        value.setStatus("ADOPTED"); value.setAdoptedAt(System.currentTimeMillis()); value.setUpdatedAt(System.currentTimeMillis()); packageMapper.updateById(value); return value;
    }

    public com.videotagger.entity.VideoSourcePackage refresh(long packageId) {
        com.videotagger.entity.VideoSourcePackage current = requireCached(packageId);
        VideoSourceProvider provider = registry.require(current.getProvider());
        if (!provider.capabilities().supports(VideoSourceStatus.Capability.REFRESH_PACKAGE)
                && !provider.capabilities().supports(VideoSourceStatus.Capability.PACKAGE_DETAILS)) {
            throw new IllegalArgumentException("Provider does not support package refresh");
        }
        com.videotagger.videosource.VideoSourcePackage refreshed = provider.getPackage(current.getProviderPackageId(), current.getRevision());
        saveCandidate(current.getMediaEntryId(), refreshed);
        com.videotagger.entity.VideoSourcePackage latest = packageMapper.selectStable(refreshed.providerId(), refreshed.providerPackageId(), refreshed.revision());
        if (!java.util.Objects.equals(current.getId(), latest.getId()) && "ADOPTED".equals(current.getStatus())) {
            current.setStatus("STALE"); current.setUpdatedAt(System.currentTimeMillis()); packageMapper.updateById(current);
        }
        return latest;
    }
    public com.videotagger.entity.VideoSourcePackage requireCached(long id) {
        com.videotagger.entity.VideoSourcePackage value = packageMapper.selectById(id);
        if (value == null) throw new IllegalArgumentException("Source package not found");
        return value;
    }

    private void saveCandidate(long mediaEntryId, com.videotagger.videosource.VideoSourcePackage source) {
        com.videotagger.entity.VideoSourcePackage linked = packageMapper.selectLatestStable(source.providerId(), source.providerPackageId());
        if (linked != null && !java.util.Objects.equals(linked.getMediaEntryId(), mediaEntryId)) {
            throw new IllegalArgumentException("Provider package is already linked to another MediaEntry");
        }
        com.videotagger.entity.VideoSourcePackage existing = packageMapper.selectStable(source.providerId(), source.providerPackageId(), source.revision());
        long now = System.currentTimeMillis();
        if (existing == null) {
            existing = new com.videotagger.entity.VideoSourcePackage();
            existing.setMediaEntryId(mediaEntryId);
            existing.setProvider(source.providerId());
            existing.setProviderPackageId(source.providerPackageId());
            existing.setRevision(source.revision());
            existing.setCreatedAt(now);
        }
        existing.setStatus(existing.getStatus() == null ? "CANDIDATE" : existing.getStatus());
        existing.setTitle(source.title()); existing.setReleaseGroup(source.releaseGroup()); existing.setYear(source.year()); existing.setSeason(source.season()); existing.setMediaFormat(source.mediaFormat()); existing.setEpisodeCount(source.episodeCount());
        existing.setSubtitleLanguagesJson(json(source.subtitleLanguages())); existing.setAudioLanguagesJson(json(source.audioLanguages())); existing.setQuality(source.quality()); existing.setVideoCodec(source.videoCodec()); existing.setContainer(source.container()); existing.setCapabilitiesJson(json(source.capabilities())); existing.setSourcePageUrl(source.sourcePageUrl()); existing.setSanitizedSnapshotJson(json(source.sanitizedSnapshot())); existing.setLastRefreshedAt(now); existing.setUpdatedAt(now);
        if (existing.getId() == null) packageMapper.insert(existing); else packageMapper.updateById(existing);
        for (com.videotagger.videosource.VideoSourceItem item : source.items()) saveItem(existing.getId(), item);
    }

    private void saveItem(Long packageId, com.videotagger.videosource.VideoSourceItem source) {
        com.videotagger.entity.VideoSourceItem existing = itemMapper.selectList(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<com.videotagger.entity.VideoSourceItem>().eq("package_id", packageId).eq("provider_item_id", source.providerItemId()).eq("revision", source.revision())).stream().findFirst().orElse(null);
        long now = System.currentTimeMillis();
        if (existing == null) { existing = new com.videotagger.entity.VideoSourceItem(); existing.setPackageId(packageId); existing.setProviderItemId(source.providerItemId()); existing.setRevision(source.revision()); existing.setCreatedAt(now); }
        existing.setItemKind(source.kind().name()); existing.setEpisodeNo(source.episodeNumber()); existing.setEpisodeEndNo(source.episodeEndNumber()); existing.setTitle(source.title()); existing.setDurationMs(source.durationMs()); existing.setSubtitleLanguagesJson(json(source.subtitleLanguages())); existing.setAudioLanguagesJson(json(source.audioLanguages())); existing.setQuality(source.quality()); existing.setCapabilitiesJson(json(source.capabilities())); existing.setSourcePageUrl(source.sourcePageUrl()); existing.setSanitizedSnapshotJson(json(source.sanitizedSnapshot())); existing.setStatus(existing.getStatus() == null ? "PENDING" : existing.getStatus()); existing.setLastSeenAt(now); existing.setUpdatedAt(now);
        if (existing.getId() == null) itemMapper.insert(existing); else itemMapper.updateById(existing);
    }

    private String json(Object value) { try { return objectMapper.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalArgumentException("Cannot serialize source snapshot", e); } }
}
