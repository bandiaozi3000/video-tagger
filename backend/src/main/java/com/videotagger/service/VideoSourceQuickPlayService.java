package com.videotagger.service;

import com.videotagger.entity.Episode;
import com.videotagger.entity.Media;
import com.videotagger.entity.MediaEntry;
import com.videotagger.entity.VideoAsset;
import com.videotagger.entity.VideoSourceEpisodeMap;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaEntryMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.mapper.VideoSourceEpisodeMapMapper;
import com.videotagger.mapper.VideoSourceItemMapper;
import com.videotagger.videosource.VideoSourceDiscoveryQuery;
import com.videotagger.videosource.VideoSourceProbeRequest;
import com.videotagger.videosource.VideoSourceProvider;
import com.videotagger.videosource.VideoSourceProviderRegistry;
import com.videotagger.videosource.VideoSourceResolveRequest;
import com.videotagger.videosource.VideoSourceStatus;
import com.videotagger.videosource.VideoSourceTitleMatcher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class VideoSourceQuickPlayService {
    public record StartRequest(String preferredProviderId) {}
    public record Candidate(String id, String providerId, String providerName, String packageTitle,
                            String releaseGroup, String itemTitle, Integer episodeNo, String quality,
                            String sourcePageUrl, boolean playable, String state, String message,
                            String playMode, int score, String locator, Long expiresAt, String mimeType,
                            String matchLevel, String matchReason) {
        public boolean actionable() {
            return "DIRECT".equals(playMode) || "EXTERNAL".equals(playMode);
        }
    }
    public record Attempt(String providerId, String providerName, String status, String message, int candidateCount) {}
    public record SessionView(String sessionId, long episodeId, String status, int completed, int total,
                              Candidate selected, List<Candidate> candidates, List<Attempt> attempts,
                              long createdAt, long expiresAt) {}
    public record RelayTarget(String locator, String referer, String mimeType) {}

    private final EpisodeMapper episodeMapper;
    private final MediaEntryMapper entryMapper;
    private final MediaMapper mediaMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final ExternalEpisodeMapper externalEpisodeMapper;
    private final VideoSourceProviderRegistry registry;
    private final VideoSourceSubscriptionService subscriptionService;
    private final VideoSourceDiscoveryService discoveryService;
    private final VideoSourceItemMapper sourceItemMapper;
    private final VideoSourceEpisodeMapMapper episodeMapMapper;
    private final VideoAssetMapper assetMapper;
    private final Executor executor;
    private final Map<String, Job> jobs = new ConcurrentHashMap<>();

    @Autowired
    public VideoSourceQuickPlayService(EpisodeMapper episodeMapper, MediaEntryMapper entryMapper,
                                       MediaMapper mediaMapper, VideoSourceProviderRegistry registry,
                                       VideoSourceSubscriptionService subscriptionService,
                                       VideoSourceDiscoveryService discoveryService,
                                       VideoSourceItemMapper sourceItemMapper,
                                       VideoSourceEpisodeMapMapper episodeMapMapper,
                                       VideoAssetMapper assetMapper,
                                       ExternalWorkMapper externalWorkMapper,
                                       ExternalEpisodeMapper externalEpisodeMapper,
                                       @Qualifier("videoSourceExecutor") Executor executor) {
        this.episodeMapper = episodeMapper;
        this.entryMapper = entryMapper;
        this.mediaMapper = mediaMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.externalEpisodeMapper = externalEpisodeMapper;
        this.registry = registry;
        this.subscriptionService = subscriptionService;
        this.discoveryService = discoveryService;
        this.sourceItemMapper = sourceItemMapper;
        this.episodeMapMapper = episodeMapMapper;
        this.assetMapper = assetMapper;
        this.executor = executor;
    }

    VideoSourceQuickPlayService(EpisodeMapper episodeMapper, MediaEntryMapper entryMapper,
                                MediaMapper mediaMapper, VideoSourceProviderRegistry registry,
                                VideoSourceSubscriptionService subscriptionService,
                                VideoSourceDiscoveryService discoveryService,
                                VideoSourceItemMapper sourceItemMapper,
                                VideoSourceEpisodeMapMapper episodeMapMapper,
                                VideoAssetMapper assetMapper, Executor executor) {
        this(episodeMapper, entryMapper, mediaMapper, registry, subscriptionService, discoveryService,
                sourceItemMapper, episodeMapMapper, assetMapper, null, null, executor);
    }

    public SessionView start(long episodeId, StartRequest request) {
        Episode episode = episodeMapper.selectById(episodeId);
        if (episode == null) throw new IllegalArgumentException("Episode 不存在");
        List<Source> sources = sources();
        VideoSourceDiscoveryQuery query = queryFor(episode);
        Job job = new Job(UUID.randomUUID().toString(), episode, query, sources.size(),
                request == null ? null : request.preferredProviderId());
        jobs.put(job.id, job);
        if (sources.isEmpty()) {
            job.status = "NO_SOURCES";
            return job.view();
        }
        for (Source source : sources) {
            job.attempts.put(source.provider.id(), new Attempt(source.provider.id(), source.name,
                    "SEARCHING", "正在查询", 0));
            CompletableFuture.runAsync(() -> query(job, source), executor)
                    .orTimeout(20, TimeUnit.SECONDS)
                    .whenComplete((ignored, error) -> completeAttempt(job, source, error));
        }
        return job.view();
    }

    public SessionView get(String sessionId) {
        Job job = jobs.get(sessionId);
        if (job == null || job.expiresAt < System.currentTimeMillis()) throw new IllegalArgumentException("快捷播放会话不存在或已过期");
        return job.view();
    }

    public SessionView select(String sessionId, String candidateId) {
        Job job = requireJob(sessionId);
        Candidate candidate = job.candidates.stream().filter(value -> value.id().equals(candidateId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("候选不存在"));
        if (!candidate.actionable()) throw new IllegalArgumentException("该候选当前不可播放或跳转");
        job.selected = candidate;
        job.status = "READY";
        return job.view();
    }

    public VideoAsset materialize(String sessionId, String candidateId) {
        Job job = requireJob(sessionId);
        CandidateContext context = job.contexts.get(candidateId);
        if (context == null || !context.candidate.playable()) throw new IllegalArgumentException("候选不可固定为资产");
        if (job.episode.getMediaEntryId() == null) throw new IllegalStateException("Episode 尚未绑定 MediaEntry");
        var storedPackage = discoveryService.cacheCandidate(job.episode.getMediaEntryId(), context.sourcePackage);
        var storedItem = sourceItemMapper.listByPackage(storedPackage.getId()).stream()
                .filter(item -> item.getProviderItemId().equals(context.item.providerItemId())
                        && item.getRevision().equals(context.item.revision()))
                .findFirst().orElseThrow(() -> new IllegalStateException("候选源项保存失败"));
        VideoSourceEpisodeMap mapping = episodeMapMapper.selectBySourceItem(storedItem.getId());
        long now = System.currentTimeMillis();
        if (mapping == null) {
            mapping = new VideoSourceEpisodeMap();
            mapping.setSourceItemId(storedItem.getId());
            mapping.setEpisodeId(job.episode.getId());
            mapping.setMappingReason("MANUAL");
            mapping.setConfidence(1.0);
            mapping.setStatus("CONFIRMED");
            mapping.setManualConfirmed(true);
            mapping.setCreatedAt(now);
            mapping.setUpdatedAt(now);
            episodeMapMapper.insert(mapping);
        }
        VideoAsset existing = assetMapper.selectByEpisodeSource(job.episode.getId(), storedItem.getId());
        if (existing != null) return existing;
        VideoAsset asset = new VideoAsset();
        asset.setEpisodeId(job.episode.getId());
        asset.setSourceItemId(storedItem.getId());
        asset.setAssetType("REMOTE_STREAM");
        asset.setAssetRole("UNASSIGNED");
        asset.setPriority(0);
        asset.setAvailabilityState("AVAILABLE");
        asset.setSourceRevision(context.item.revision());
        asset.setDisplayName(context.candidate.providerName() + " · " + context.candidate.itemTitle());
        asset.setSourcePageUrl(context.candidate.sourcePageUrl());
        asset.setMimeType(context.candidate.mimeType());
        asset.setLastVerifiedAt(now);
        asset.setCreatedAt(now);
        asset.setUpdatedAt(now);
        assetMapper.insert(asset);
        return asset;
    }

    public RelayTarget relayTarget(String sessionId, String candidateId) {
        Job job = requireJob(sessionId);
        CandidateContext context = job.contexts.get(candidateId);
        if (context == null || !context.candidate.playable() || context.candidate.locator() == null) {
            throw new IllegalArgumentException("候选不可中继播放");
        }
        if (context.candidate.expiresAt() != null && context.candidate.expiresAt() < System.currentTimeMillis()) {
            throw new IllegalArgumentException("播放地址已过期，请重新查询来源");
        }
        return new RelayTarget(context.candidate.locator(), context.candidate.sourcePageUrl(), context.candidate.mimeType());
    }

    private void query(Job job, Source source) {
        VideoSourceProvider provider = source.provider;
        if (!provider.capabilities().supports(VideoSourceStatus.Capability.DISCOVER_PACKAGES)) return;
        VideoSourceDiscoveryQuery query = job.query;
        int found = 0;
        for (var sourcePackage : provider.discover(query)) {
            var matchingItems = sourcePackage.items().stream()
                    .map(item -> Map.entry(item, VideoSourceTitleMatcher.match(query, sourcePackage, item)))
                    .filter(entry -> entry.getValue().accepted())
                    .toList();
            for (var matching : matchingItems) {
                var item = matching.getKey();
                var match = matching.getValue();
                boolean resolvable = item.capabilities().contains(VideoSourceStatus.Capability.RESOLVE_PLAYBACK)
                        && provider.capabilities().supports(VideoSourceStatus.Capability.RESOLVE_PLAYBACK);
                String state = resolvable ? "RESOLVING" : "DISCOVERY_ONLY";
                String message = resolvable ? "正在解析播放地址" : "已发现资源，但当前来源不支持直接播放";
                String locator = null;
                Long expiresAt = null;
                String mimeType = null;
                boolean playable = false;
                String playMode = item.sourcePageUrl() == null || item.sourcePageUrl().isBlank() ? "UNAVAILABLE" : "EXTERNAL";
                if (resolvable) {
                    try {
                        var resolution = provider.resolve(new VideoSourceResolveRequest(
                                sourcePackage.providerPackageId(), item.providerItemId(), item.revision(),
                                VideoSourceStatus.ResolutionPurpose.PLAYBACK, null, null, null));
                        var probe = provider.probe(new VideoSourceProbeRequest(sourcePackage.providerPackageId(),
                                item.providerItemId(), item.revision(), resolution));
                        state = probe.state().name();
                        message = probe.message();
                        playable = probe.state() == VideoSourceStatus.ProbeState.PLAYABLE;
                        if (playable) {
                            playMode = "DIRECT";
                            locator = resolution.resolvedLocator();
                            expiresAt = resolution.expiresAt() == null
                                    ? System.currentTimeMillis() + 300_000
                                    : Math.min(resolution.expiresAt().toEpochMilli(), System.currentTimeMillis() + 300_000);
                            mimeType = resolution.mimeType();
                        }
                    } catch (RuntimeException e) {
                        state = "EXTERNAL";
                        message = safeMessage(e) + "；可打开源站继续播放";
                    }
                }
                int channelTier = item.sanitizedSnapshot().get("channelTier") instanceof Number value
                        ? value.intValue() : 2;
                int score = score(job, source, playable, item.quality(), match.score(), channelTier);
                Candidate candidate = new Candidate(UUID.randomUUID().toString(), provider.id(), source.name,
                        sourcePackage.title(), sourcePackage.releaseGroup(), item.title(), item.episodeNumber(),
                        item.quality(), item.sourcePageUrl(), playable, state, message, playMode,
                        score, locator, expiresAt, mimeType, match.level(), match.reason());
                job.candidates.add(candidate);
                job.contexts.put(candidate.id(), new CandidateContext(candidate, sourcePackage, item));
                found++;
                choose(job, candidate);
            }
        }
        job.attempts.put(provider.id(), new Attempt(provider.id(), source.name, "DONE",
                found == 0 ? "没有找到匹配剧集" : "找到 " + found + " 个候选", found));
    }

    private void completeAttempt(Job job, Source source, Throwable error) {
        if (error != null) {
            String message = error instanceof java.util.concurrent.TimeoutException ? "查询超时" : safeMessage(error);
            job.attempts.put(source.provider.id(), new Attempt(source.provider.id(), source.name,
                    "FAILED", message, 0));
        }
        int completed = job.completed.incrementAndGet();
        if (completed >= job.total) {
            if (job.selected == null) {
                job.candidates.stream().filter(Candidate::actionable)
                        .min(Comparator.comparingInt(Candidate::score)).ifPresent(value -> job.selected = value);
            }
            if (job.selected != null) job.status = "READY";
            else if (job.candidates.isEmpty()) job.status = "NOT_FOUND";
            else job.status = "NO_PLAYABLE_SOURCE";
        }
    }

    private synchronized void choose(Job job, Candidate candidate) {
        if (!candidate.actionable()) return;
        if (job.selected == null
                || (candidate.playable() && !job.selected.playable())
                || (candidate.playable() == job.selected.playable() && candidate.score() < job.selected.score())) {
            job.selected = candidate;
            job.status = "READY";
        }
    }

    private VideoSourceDiscoveryQuery queryFor(Episode episode) {
        Media media = mediaMapper.selectById(episode.getMediaId());
        MediaEntry entry = episode.getMediaEntryId() == null ? null : entryMapper.selectById(episode.getMediaEntryId());
        List<String> titles = new ArrayList<>();
        if (entry != null) {
            if (entry.getTitleCn() != null && !entry.getTitleCn().isBlank()) titles.add(entry.getTitleCn());
            if (entry.getTitle() != null && !entry.getTitle().isBlank()) titles.add(entry.getTitle());
        }
        if (media != null && media.getTitle() != null && !media.getTitle().isBlank()) titles.add(media.getTitle());
        if (media != null && media.getAliases() != null) {
            for (String alias : media.getAliases().split("[\\r\\n,，;/|]+")) {
                if (!alias.isBlank() && titles.size() < 16) titles.add(alias.trim());
            }
        }
        if (titles.isEmpty()) titles.add(episode.getTitle());
        List<String> episodeTitles = new ArrayList<>();
        if (episode.getTitle() != null && !episode.getTitle().isBlank()) episodeTitles.add(episode.getTitle());
        Map<String, String> externalIds = new LinkedHashMap<>();
        Map<String, String> episodeExternalIds = new LinkedHashMap<>();
        if (episode.getMediaEntryId() != null && externalWorkMapper != null && externalEpisodeMapper != null) {
            for (var work : externalWorkMapper.listByEntry(episode.getMediaEntryId())) {
                if (work.getProvider() != null && work.getExternalId() != null) {
                    externalIds.putIfAbsent(work.getProvider(), work.getExternalId());
                }
                for (var externalEpisode : externalEpisodeMapper.listByWork(work.getId())) {
                    if (episode.getId().equals(externalEpisode.getEpisodeId())) {
                        if (work.getProvider() != null && externalEpisode.getProviderEpisodeId() != null) {
                            episodeExternalIds.putIfAbsent(work.getProvider(), externalEpisode.getProviderEpisodeId());
                        }
                        if (externalEpisode.getTitle() != null && !externalEpisode.getTitle().isBlank()) {
                            episodeTitles.add(externalEpisode.getTitle());
                        }
                        if (externalEpisode.getTitleCn() != null && !externalEpisode.getTitleCn().isBlank()) {
                            episodeTitles.add(externalEpisode.getTitleCn());
                        }
                    }
                }
            }
        }
        long mediaEntryId = episode.getMediaEntryId() == null ? 0 : episode.getMediaEntryId();
        return new VideoSourceDiscoveryQuery(mediaEntryId, externalIds, episodeExternalIds, titles, episodeTitles,
                media == null ? null : media.getYear(), episode.getSeason() == null ? null : String.valueOf(episode.getSeason()),
                "VIDEO", null, episode.getEpisodeNo(), episode.getEpisodeNo(), 0, 50);
    }

    private List<Source> sources() {
        LinkedHashMap<String, Source> values = new LinkedHashMap<>();
        int order = 500;
        for (VideoSourceProvider provider : registry.all()) {
            if (provider.capabilities().supports(VideoSourceStatus.Capability.DISCOVER_PACKAGES)) {
                values.put(provider.id(), new Source(provider, provider.capabilities().displayName(), order++, 2));
            }
        }
        for (var binding : subscriptionService.enabledProviders()) {
            values.put(binding.provider().id(), new Source(binding.provider(), binding.definition().getName(),
                    binding.instance().getSortOrder(), binding.definition().getTier()));
        }
        return values.values().stream().sorted(Comparator.comparingInt(Source::order)).toList();
    }

    private static int score(Job job, Source source, boolean playable, String quality, int matchScore,
                             int channelTier) {
        int score = source.order * 100 + source.tier * 10 + (playable ? 0 : 50_000);
        score += Math.max(0, 130 - matchScore) * 100;
        score += Math.max(0, channelTier) * 1_000;
        if (job.preferredProviderId != null && job.preferredProviderId.equals(source.provider.id())) score -= 100_000;
        if (quality != null && quality.toLowerCase().contains("1080")) score -= 2;
        return score;
    }

    private Job requireJob(String id) {
        Job job = jobs.get(id);
        if (job == null || job.expiresAt < System.currentTimeMillis()) throw new IllegalArgumentException("快捷播放会话不存在或已过期");
        return job;
    }

    @Scheduled(fixedDelay = 60_000)
    public void cleanup() {
        long now = System.currentTimeMillis();
        jobs.entrySet().removeIf(entry -> entry.getValue().expiresAt < now);
    }

    private static String safeMessage(Throwable error) {
        Throwable value = error instanceof java.util.concurrent.CompletionException && error.getCause() != null ? error.getCause() : error;
        String message = value.getMessage();
        return message == null || message.isBlank() ? value.getClass().getSimpleName() : message;
    }

    private record Source(VideoSourceProvider provider, String name, int order, int tier) {}

    private static final class Job {
        private final String id;
        private final Episode episode;
        private final VideoSourceDiscoveryQuery query;
        private final int total;
        private final String preferredProviderId;
        private final long createdAt = System.currentTimeMillis();
        private final long expiresAt = createdAt + 10 * 60_000;
        private final AtomicInteger completed = new AtomicInteger();
        private final CopyOnWriteArrayList<Candidate> candidates = new CopyOnWriteArrayList<>();
        private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();
        private final Map<String, CandidateContext> contexts = new ConcurrentHashMap<>();
        private volatile Candidate selected;
        private volatile String status = "SEARCHING";

        private Job(String id, Episode episode, VideoSourceDiscoveryQuery query, int total, String preferredProviderId) {
            this.id = id;
            this.episode = episode;
            this.query = query;
            this.total = total;
            this.preferredProviderId = preferredProviderId;
        }

        private SessionView view() {
            List<Candidate> sortedCandidates = candidates.stream().sorted(Comparator.comparingInt(Candidate::score)).toList();
            List<Attempt> sortedAttempts = attempts.values().stream().sorted(Comparator.comparing(Attempt::providerName)).toList();
            return new SessionView(id, episode.getId(), status, completed.get(), total, selected,
                    sortedCandidates, sortedAttempts, createdAt, expiresAt);
        }
    }

    private record CandidateContext(Candidate candidate,
                                    com.videotagger.videosource.VideoSourcePackage sourcePackage,
                                    com.videotagger.videosource.VideoSourceItem item) {}
}
