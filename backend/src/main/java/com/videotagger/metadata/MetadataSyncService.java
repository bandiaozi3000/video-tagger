package com.videotagger.metadata;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Episode;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalRelation;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.Media;
import com.videotagger.entity.MediaEntry;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalRelationMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaEntryMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.VideoSourceEpisodeMapMapper;
import com.videotagger.service.CoverService;
import com.videotagger.service.EpisodeService;
import com.videotagger.service.ExternalMetadataDetail;
import com.videotagger.util.TitleParser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
public class MetadataSyncService {
    public static final String PROVIDER_BANGUMI = "BANGUMI";

    private final MetadataProvider provider;
    private final MediaMapper mediaMapper;
    private final MediaEntryMapper mediaEntryMapper;
    private final ExternalWorkMapper externalWorkMapper;
    private final ExternalEpisodeMapper externalEpisodeMapper;
    private final ExternalRelationMapper externalRelationMapper;
    private final EpisodeMapper episodeMapper;
    private final ClipMapper clipMapper;
    private final EpisodeTagMapper episodeTagMapper;
    private final EpisodeService episodeService;
    private final CoverService coverService;
    private final VideoSourceEpisodeMapMapper videoSourceEpisodeMapMapper;
    private final ObjectMapper objectMapper;

    public MetadataSyncService(MetadataProvider provider, MediaMapper mediaMapper,
                               MediaEntryMapper mediaEntryMapper, ExternalWorkMapper externalWorkMapper,
                               ExternalEpisodeMapper externalEpisodeMapper, ExternalRelationMapper externalRelationMapper,
                               EpisodeMapper episodeMapper, ClipMapper clipMapper,
                               EpisodeTagMapper episodeTagMapper, EpisodeService episodeService,
                               CoverService coverService, VideoSourceEpisodeMapMapper videoSourceEpisodeMapMapper,
                               ObjectMapper objectMapper) {
        this.provider = provider;
        this.mediaMapper = mediaMapper;
        this.mediaEntryMapper = mediaEntryMapper;
        this.externalWorkMapper = externalWorkMapper;
        this.externalEpisodeMapper = externalEpisodeMapper;
        this.externalRelationMapper = externalRelationMapper;
        this.episodeMapper = episodeMapper;
        this.clipMapper = clipMapper;
        this.episodeTagMapper = episodeTagMapper;
        this.episodeService = episodeService;
        this.coverService = coverService;
        this.videoSourceEpisodeMapMapper = videoSourceEpisodeMapMapper;
        this.objectMapper = objectMapper;
    }

    public ProviderCapabilities capabilities() {
        return provider.capabilities();
    }

    /** 纯查询：只访问 Provider，不写外部缓存、本地媒体或封面文件。 */
    public List<MetadataCandidate> preview(MetadataSyncRequest request) {
        List<MetadataRecord> records = query(request.toQuery());
        Map<String, MetadataRecord> unique = new LinkedHashMap<>();
        for (MetadataRecord record : records) {
            unique.putIfAbsent(record.provider() + ":" + record.externalId(), record);
        }
        return unique.values().stream().map(this::candidateOf).toList();
    }

    /** 直接全量同步或导入预览后选中的外部 ID。导入详情时重新请求 Provider，避免信任前端资料字段。 */
    @Transactional
    public MetadataSyncResult sync(MetadataSyncRequest request) {
        List<MetadataSyncRequest.Decision> decisions = request.decisions() == null ? List.of() : request.decisions();
        List<MetadataRecord> records;
        if ("SELECTED".equalsIgnoreCase(request.importMode())) {
            records = selectedRecords(decisions);
        } else {
            records = query(request.toQuery());
        }

        Map<String, MetadataSyncRequest.Decision> decisionById = new LinkedHashMap<>();
        for (MetadataSyncRequest.Decision decision : decisions) {
            if (decision != null && decision.externalId() != null) {
                decisionById.put(decision.externalId(), decision);
            }
        }

        int added = 0;
        int updated = 0;
        int failed = 0;
        List<String> failedIds = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (MetadataRecord record : records) {
            if (record.externalId() == null || !seen.add(record.provider() + ":" + record.externalId())) continue;
            MetadataSyncRequest.Decision decision = decisionById.get(record.externalId());
            if ("SELECTED".equalsIgnoreCase(request.importMode())
                    && (decision == null || "SKIP".equalsIgnoreCase(decision.action()))) continue;
            if (decision == null) decision = defaultDecision(record);
            if ("SKIP".equalsIgnoreCase(decision.action())) continue;
            try {
                MetadataRecord detail = "SELECTED".equalsIgnoreCase(request.importMode())
                        ? record : provider.get(record.externalId());
                ImportCount count = importRecord(detail, decision);
                added += count.added();
                updated += count.updated();
            } catch (RuntimeException e) {
                failed++;
                failedIds.add(record.externalId());
            }
        }
        return new MetadataSyncResult(records.size(), added, updated, failed, failedIds);
    }

    /** 后台任务逐项调用；每一项独立事务，失败不会回滚其他项目。 */
    @Transactional
    public MetadataSyncResult syncOne(String externalId, String action, Long mediaId) {
        if (externalId == null || externalId.isBlank()) throw new IllegalArgumentException("externalId 不能为空");
        String normalizedAction = action == null ? "" : action.trim().toUpperCase(java.util.Locale.ROOT);
        if (!Set.of("CREATE", "UPDATE", "LINK").contains(normalizedAction)) {
            throw new IllegalArgumentException("不支持的同步动作: " + action);
        }
        MetadataRecord record = provider.get(externalId.trim());
        ImportCount count = importRecord(record,
                new MetadataSyncRequest.Decision(record.externalId(), normalizedAction, mediaId));
        return new MetadataSyncResult(1, count.added(), count.updated(), 0, List.of());
    }

    /** 已关联媒体刷新：按 external ID 拉取，不产生任务记录；未关联时要求先走候选预览。 */
    @Transactional
    public MetadataSyncResult refreshMedia(long mediaId) {
        requireMedia(mediaId);
        List<ExternalWork> works = externalWorkMapper.listByMedia(mediaId);
        if (works.isEmpty()) {
            throw new IllegalArgumentException("该媒体尚未关联 Bangumi 条目，请先通过同步预览选择作品");
        }
        ExternalWork work = works.get(0);
        MetadataRecord record = provider.get(work.getExternalId());
        ImportCount count = importRecord(record, new MetadataSyncRequest.Decision(record.externalId(), "LINK", mediaId));
        return new MetadataSyncResult(1, count.added(), count.updated(), 0, List.of());
    }

    public ExternalMetadataDetail metadata(long mediaId) {
        requireMedia(mediaId);
        List<ExternalWork> works = externalWorkMapper.listByMedia(mediaId);
        if (works.isEmpty()) return new ExternalMetadataDetail(null, List.of(), List.of(), List.of());
        ExternalWork work = works.get(0);
        return new ExternalMetadataDetail(work, works, externalEpisodeMapper.listByWork(work.getId()),
                externalRelationMapper.listByWork(work.getId()));
    }

    public List<MetadataCandidate> searchForMedia(long mediaId, String keyword) {
        requireMedia(mediaId);
        String query = keyword == null ? "" : keyword.trim();
        if (query.isEmpty()) throw new IllegalArgumentException("请输入 Bangumi 作品关键词");
        Map<String, MetadataRecord> unique = new LinkedHashMap<>();
        for (MetadataRecord record : provider.search(query, 20)) {
            unique.putIfAbsent(record.provider() + ":" + record.externalId(), record);
        }
        return unique.values().stream().limit(20).map(this::candidateOf).toList();
    }

    @Transactional
    public MetadataSyncResult linkMedia(long mediaId, MediaMetadataLinkRequest request) {
        requireMedia(mediaId);
        String externalId = requiredExternalId(request);
        String mode = request.mode() == null ? "PRIMARY" : request.mode().trim().toUpperCase(java.util.Locale.ROOT);
        MetadataRecord record = provider.get(externalId);
        ensureCanAttach(mediaId, record);
        if ("REPLACE".equals(mode)) {
            replacePrimary(mediaId, request, record);
        } else if (!"PRIMARY".equals(mode)) {
            throw new IllegalArgumentException("不支持的关联模式: " + mode);
        }
        ImportCount count = importRecord(record, new MetadataSyncRequest.Decision(externalId, "LINK", mediaId));
        if ("REPLACE".equals(mode)) {
            recalibrateMedia(mediaId, record);
        }
        return new MetadataSyncResult(1, count.added(), count.updated(), 0, List.of());
    }

    public MediaMetadataReplacePreview replacePreview(long mediaId, MediaMetadataLinkRequest request) {
        requireMedia(mediaId);
        String externalId = requiredExternalId(request);
        List<ExternalWork> works = externalWorkMapper.listByMedia(mediaId);
        if (works.isEmpty()) throw new IllegalArgumentException("该媒体尚未关联主条目");
        ExternalWork current = works.get(0);
        if (externalId.equals(current.getExternalId())) throw new IllegalArgumentException("新候选与当前主条目相同");
        MetadataRecord record = provider.get(externalId);
        ensureCanAttach(mediaId, record);
        List<MediaMetadataReplacePreview.EpisodeProtection> episodes = primaryLinkedEpisodes(current).stream()
                .map(this::episodeProtection).toList();
        return new MediaMetadataReplacePreview(current, candidateOf(record), episodes);
    }

    @Transactional
    public MetadataSyncResult addMediaEntry(long mediaId, MediaMetadataLinkRequest request) {
        requireMedia(mediaId);
        String externalId = requiredExternalId(request);
        MetadataRecord record = provider.get(externalId);
        ensureCanAttach(mediaId, record);
        long now = System.currentTimeMillis();
        MediaEntry entry = new MediaEntry();
        entry.setMediaId(mediaId);
        entry.setEntryType(record.format() == null || record.format().isBlank() ? "SPECIAL" : record.format());
        entry.setSortOrder(mediaEntryMapper.maxSortOrder(mediaId) + 1);
        entry.setTitle(record.nativeTitle());
        entry.setTitleCn(record.canonicalTitle());
        entry.setCreatedAt(now);
        entry.setUpdatedAt(now);
        mediaEntryMapper.insert(entry);
        ExternalWork work = upsertExternalWork(record, now, mediaId, entry.getId(), "FRESH");
        work.setLastSuccessAt(now);
        work.setLastError(null);
        externalWorkMapper.updateById(work);
        syncEpisodes(work, entry, record);
        syncRelations(work, record);
        return new MetadataSyncResult(1, 0, 1, 0, List.of());
    }

    private String requiredExternalId(MediaMetadataLinkRequest request) {
        if (request == null || request.externalId() == null || request.externalId().isBlank()) {
            throw new IllegalArgumentException("请选择 Bangumi 候选");
        }
        return request.externalId().trim();
    }

    private void ensureCanAttach(long mediaId, MetadataRecord record) {
        ExternalWork linked = externalWorkMapper.selectByProviderAndExternalId(record.provider(), record.externalId());
        if (linked != null && linked.getMediaId() != null && linked.getMediaId() != mediaId) {
            throw new IllegalArgumentException("该 Bangumi 条目已关联其他媒体");
        }
    }

    /**
     * 换绑（REPLACE）＝推倒重建旧主条目链路：
     * 删除旧主条目同步产生的本地集及其片段/标签/封面/片源映射等全部关联数据；
     * 任何旧集含用户数据（片段/手工标签/备注/本地视频/片源映射/观看记录/封面）时，
     * 必须先带 confirmProtected=true 二次确认，否则拒绝执行，避免误删心血。
     */
    private void replacePrimary(long mediaId, MediaMetadataLinkRequest request, MetadataRecord record) {
        List<ExternalWork> works = externalWorkMapper.listByMedia(mediaId);
        if (works.isEmpty()) throw new IllegalArgumentException("该媒体尚未关联主条目");
        ExternalWork old = works.get(0);
        if (record.externalId().equals(old.getExternalId())) throw new IllegalArgumentException("新候选与当前主条目相同");
        long now = System.currentTimeMillis();

        List<Episode> doomed = primaryLinkedEpisodes(old);
        long assetEpisodes = doomed.stream().filter(this::episodeHasUserAssets).count();
        if (assetEpisodes > 0 && !Boolean.TRUE.equals(request.confirmProtected())) {
            throw new IllegalArgumentException("换绑将删除旧条目同步的 " + doomed.size() + " 个集，其中 " + assetEpisodes
                    + " 个含片段/标签/本地视频/片源绑定/观看记录等用户数据，永久删除需二次确认（confirmProtected=true）");
        }
        // 1) 解除所有 work（含仍保留的附加条目）对这些本地集的桥接，避免删集后悬空引用
        if (!doomed.isEmpty()) {
            List<Long> ids = doomed.stream().map(Episode::getId).toList();
            externalEpisodeMapper.unbindByEpisodeIds(ids, now);
        }
        // 2) 删除旧主条目的外部集索引与关联作品（同步产物）
        externalEpisodeMapper.deleteByWorkId(old.getId());
        externalRelationMapper.deleteByWork(old.getId());
        // 3) 逐个删除本地集：走完整级联（片源映射/片段封面/物化产物/高光标记/向量/标签，由 EpisodeService.delete 统一处理）
        for (Episode episode : doomed) {
            episodeService.delete(episode.getId());
        }
        // 4) 解绑旧主条目 work（updateById 默认跳过 null 字段，必须原生 SQL 显式置 NULL）
        externalWorkMapper.detachFromMedia(old.getId(), now);
    }

    /** 换绑/预览共用的旧主条目本地集清单：以 external_episode 桥接反查，无桥接时回退其 entry 下全部集。 */
    private List<Episode> primaryLinkedEpisodes(ExternalWork work) {
        List<Long> ids = externalEpisodeMapper.listByWork(work.getId()).stream()
                .map(ExternalEpisode::getEpisodeId).filter(Objects::nonNull).distinct().toList();
        if (!ids.isEmpty()) {
            List<Episode> selected = episodeMapper.selectBatchIds(ids);
            return selected == null ? List.of() : selected;
        }
        return work.getMediaEntryId() == null ? List.of()
                : episodeMapper.listByMediaEntry(work.getMediaEntryId());
    }

    /** 该集是否存在用户数据（含 watched_at / 片源映射），存在则换绑删除需二次确认。 */
    private boolean episodeHasUserAssets(Episode episode) {
        return episodeProtection(episode).protectedItem();
    }

    /** 换绑成功后按新主条目校准本地档案字段，并清掉旧条目封面（展示改走新条目远程封面）。 */
    private void recalibrateMedia(long mediaId, MetadataRecord record) {
        Media media = mediaMapper.selectById(mediaId);
        if (media == null) return;
        String title = hasText(record.canonicalTitle()) ? record.canonicalTitle().trim()
                : (record.nativeTitle() == null ? null : record.nativeTitle().trim());
        if (hasText(title)) media.setTitle(title);
        if (record.year() != null) media.setYear(record.year());
        Integer season = resolveSeason(record);
        if (season != null) media.setSeason(season);
        if (record.aliases() != null && !record.aliases().isEmpty()) {
            media.setAliases(String.join("\n", record.aliases()));
        }
        mediaMapper.updateById(media);
        if (hasText(media.getCoverPath())) {
            coverService.deleteCover(media.getCoverPath());
            mediaMapper.clearCover(mediaId);
        }
    }

    private MediaMetadataReplacePreview.EpisodeProtection episodeProtection(Episode episode) {
        int clipCount = clipMapper.listByEpisode(episode.getId()).size();
        int tagCount = episodeTagMapper.selectTags(episode.getId()).size();
        boolean localVideo = hasText(episode.getUrl()) || hasText(episode.getVideoFp());
        boolean userTitle = Integer.valueOf(1).equals(episode.getTitleOverride());
        boolean note = hasText(episode.getNote());
        boolean cover = hasText(episode.getCoverPath());
        boolean protectedItem = clipCount > 0 || localVideo || userTitle || note || tagCount > 0 || cover
                || episode.getWatchedAt() != null
                || !videoSourceEpisodeMapMapper.listByEpisode(episode.getId()).isEmpty();
        return new MediaMetadataReplacePreview.EpisodeProtection(episode.getId(), episode.getEpisodeNo(),
                episode.getTitle(), clipCount, localVideo, userTitle, note, tagCount, cover, protectedItem);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    /** episode.title 列 NOT NULL 无默认值：Bangumi 某些集 name/name_cn 均为空，建本地集前必须兜底非空标题。 */
    private static String episodeLocalTitle(MetadataEpisodeRecord remote) {
        String title = hasText(remote.titleCn()) ? remote.titleCn() : remote.title();
        if (title != null) return title;
        return remote.episodeNo() == null ? "未命名集" : "第 " + remote.episodeNo() + " 集";
    }

    private List<MetadataRecord> query(ProviderQuery query) {
        List<String> errors = query.validate();
        if (!errors.isEmpty()) throw new IllegalArgumentException(String.join("; ", errors));
        return switch (query.mode()) {
            case "WORK" -> provider.search(query.keyword(), query.limit());
            case "YEAR", "YEAR_SEASON" -> provider.discover(query.year(), query.season(), query.limit());
            case "EXTERNAL_ID" -> List.of(provider.get(query.externalId()));
            default -> throw new IllegalArgumentException("不支持的同步范围: " + query.mode());
        };
    }

    private List<MetadataRecord> selectedRecords(List<MetadataSyncRequest.Decision> decisions) {
        List<MetadataRecord> records = new ArrayList<>();
        for (MetadataSyncRequest.Decision decision : decisions) {
            if (decision == null || decision.externalId() == null || "SKIP".equalsIgnoreCase(decision.action())) continue;
            records.add(provider.get(decision.externalId()));
        }
        return records;
    }

    private MetadataSyncRequest.Decision defaultDecision(MetadataRecord record) {
        ExternalWork work = externalWorkMapper.selectByProviderAndExternalId(record.provider(), record.externalId());
        if (work != null && work.getMediaId() != null) {
            return new MetadataSyncRequest.Decision(record.externalId(), "UPDATE", work.getMediaId());
        }
        Media candidate = findLinkedOrCandidate(record);
        return candidate == null
                ? new MetadataSyncRequest.Decision(record.externalId(), "CREATE", null)
                : new MetadataSyncRequest.Decision(record.externalId(), "SKIP", candidate.getId());
    }

    private MetadataCandidate candidateOf(MetadataRecord record) {
        ExternalWork work = externalWorkMapper.selectByProviderAndExternalId(record.provider(), record.externalId());
        List<Media> matches;
        String matchType;
        String recommendedAction;
        String matchReason;
        Long targetMediaId = null;
        if (work != null && work.getMediaId() != null) {
            Media linked = mediaMapper.selectById(work.getMediaId());
            matches = linked == null ? List.of() : List.of(linked);
            targetMediaId = work.getMediaId();
            matchType = "EXTERNAL_ID";
            recommendedAction = "UPDATE";
            matchReason = "稳定 Bangumi ID 已关联本地媒体";
        } else {
            List<Media> localMatches = record.displayTitle() == null
                    ? List.of() : mediaMapper.listByTitleOrAlias(record.displayTitle());
            matches = localMatches == null ? List.of() : localMatches;
            if (matches.isEmpty()) {
                matchType = "NONE";
                recommendedAction = "CREATE";
                matchReason = "未找到本地媒体，将创建新作品";
            } else if (matches.size() == 1) {
                targetMediaId = matches.get(0).getId();
                matchType = "TITLE";
                recommendedAction = "LINK";
                matchReason = "标题或别名命中一个本地媒体，请人工确认";
            } else {
                matchType = "CONFLICT";
                recommendedAction = "REVIEW";
                matchReason = "标题命中多个本地媒体，必须先指定唯一目标";
            }
        }
        List<MetadataCandidate.LocalMatch> localMatches = matches.stream()
                .map(media -> new MetadataCandidate.LocalMatch(media.getId(), media.getTitle(), media.getYear()))
                .toList();
        return new MetadataCandidate(record.provider(), record.externalId(), record.nativeTitle(), record.canonicalTitle(),
                record.nativeTitle(), record.romajiTitle(), record.englishTitle(), record.aliases(), record.description(),
                record.genres(), record.year(), record.season(), record.format(), record.airDate(), record.endDate(),
                record.episodeCount(), record.coverUrl(), targetMediaId, matchType, localMatches, recommendedAction, matchReason);
    }
    private ImportCount importRecord(MetadataRecord record, MetadataSyncRequest.Decision decision) {
        ExternalWork linked = externalWorkMapper.selectByProviderAndExternalId(record.provider(), record.externalId());
        String action = decision.action() == null ? "" : decision.action().trim().toUpperCase(java.util.Locale.ROOT);
        Long mediaId = linked == null ? null : linked.getMediaId();
        boolean created = false;
        if ("LINK".equals(action)) {
            mediaId = decision.mediaId();
        } else if ("UPDATE".equals(action)) {
            if (mediaId == null) mediaId = decision.mediaId();
            if (mediaId == null) throw new IllegalArgumentException("UPDATE 动作缺少稳定关联媒体");
        } else if (!"CREATE".equals(action)) {
            throw new IllegalArgumentException("不支持的同步动作: " + decision.action());
        }
        if (mediaId == null) {
            Media media = createMedia(record);
            mediaMapper.insert(media);
            mediaId = media.getId();
            created = true;
        } else if (mediaMapper.selectById(mediaId) == null) {
            throw new IllegalArgumentException("目标媒体不存在: " + mediaId);
        }

        MediaEntry entry = ensureEntry(mediaId, record);
        ExternalWork work = upsertExternalWork(record, System.currentTimeMillis(), mediaId, entry.getId(), "FRESH");
        work.setLastSuccessAt(System.currentTimeMillis());
        work.setLastError(null);
        externalWorkMapper.updateById(work);
        syncEpisodes(work, entry, record);
        syncRelations(work, record);
        return new ImportCount(created ? 1 : 0, created ? 0 : 1);
    }

    private void syncEpisodes(ExternalWork work, MediaEntry entry, MetadataRecord record) {
        long now = System.currentTimeMillis();
        Set<String> seen = new HashSet<>();
        for (MetadataEpisodeRecord remote : record.episodes()) {
            seen.add(remote.externalId());
            ExternalEpisode external = externalEpisodeMapper.selectByProviderEpisode(work.getId(), remote.externalId());
            Episode local = external == null || external.getEpisodeId() == null ? null : episodeMapper.selectById(external.getEpisodeId());
            if (local == null && remote.episodeNo() != null) {
                local = episodeMapper.selectByMediaEntryAndEpisodeNo(entry.getId(), remote.episodeNo());
            }
            if (local == null) {
                local = new Episode();
                local.setMediaId(entry.getMediaId());
                local.setMediaEntryId(entry.getId());
                local.setEpisodeNo(remote.episodeNo());
                local.setTitle(episodeLocalTitle(remote));
                local.setTitleOverride(0);
                local.setCreatedAt(now);
                episodeMapper.insert(local);
            }
            if (external == null) {
                external = new ExternalEpisode();
                external.setExternalWorkId(work.getId());
                external.setProviderEpisodeId(remote.externalId());
                external.setCreatedAt(now);
            } else if (external.getEpisodeId() != null && remote.episodeNo() != null
                    && !remote.episodeNo().equals(external.getEpisodeNo())) {
                external.setSyncState("RENUMBERED");
            }
            external.setEpisodeId(local.getId());
            external.setEpisodeNo(remote.episodeNo());
            external.setTitle(remote.title());
            external.setTitleCn(remote.titleCn());
            external.setDescription(remote.description());
            external.setAirDate(remote.airDate());
            external.setDurationSec(remote.durationSec());
            external.setLastSeenAt(now);
            if (!"RENUMBERED".equals(external.getSyncState())) external.setSyncState("ACTIVE");
            external.setUpdatedAt(now);
            if (external.getId() == null) externalEpisodeMapper.insert(external); else externalEpisodeMapper.updateById(external);
        }
        for (ExternalEpisode previous : externalEpisodeMapper.listByWork(work.getId())) {
            if (!seen.contains(previous.getProviderEpisodeId()) && previous.getEpisodeId() != null) {
                previous.setSyncState("MISSING");
                previous.setUpdatedAt(now);
                externalEpisodeMapper.updateById(previous);
            }
        }
    }

    private void syncRelations(ExternalWork work, MetadataRecord record) {
        externalRelationMapper.deleteByWork(work.getId());
        long now = System.currentTimeMillis();
        for (MetadataRelationRecord relation : record.relations()) {
            ExternalRelation item = new ExternalRelation();
            item.setExternalWorkId(work.getId());
            item.setProvider(record.provider());
            item.setRelatedExternalId(relation.externalId());
            item.setRelationType(relation.relationType());
            item.setTitle(relation.title());
            item.setCreatedAt(now);
            externalRelationMapper.insert(item);
        }
    }

    private Media createMedia(MetadataRecord record) {
        Media media = new Media();
        media.setTitle(record.displayTitle());
        media.setYear(record.year());
        media.setSeason(resolveSeason(record));
        media.setAliases(record.aliases() == null || record.aliases().isEmpty()
                ? null : String.join("\n", record.aliases()));
        media.setMediaFormat("VIDEO");
        media.setStatus("WANT");
        media.setConfirmed(1);
        media.setCreatedAt(System.currentTimeMillis());
        return media;
    }

    /** 从标题/别名正则识别季序号，识别不到默认 1。 */
    private int resolveSeason(MetadataRecord record) {
        Integer season = TitleParser.parseSeason(record.displayTitle());
        if (season == null) {
            season = TitleParser.parseSeason(record.nativeTitle());
        }
        if (season == null && record.aliases() != null) {
            for (String alias : record.aliases()) {
                season = TitleParser.parseSeason(alias);
                if (season != null) break;
            }
        }
        return season == null ? 1 : season;
    }

    private MediaEntry ensureEntry(long mediaId, MetadataRecord record) {
        String type = record.format() == null || record.format().isBlank() ? "TV" : record.format();
        MediaEntry entry = mediaEntryMapper.selectLegacy(mediaId, type, 0);
        if (entry == null) entry = mediaEntryMapper.selectLegacy(mediaId, "LEGACY", 0);
        if (entry == null) entry = mediaEntryMapper.selectPrimary(mediaId);
        if (entry == null) {
            entry = new MediaEntry();
            entry.setMediaId(mediaId);
            entry.setSortOrder(0);
            entry.setCreatedAt(System.currentTimeMillis());
        }
        entry.setEntryType(type);
        entry.setTitle(record.nativeTitle());
        entry.setTitleCn(record.canonicalTitle());
        entry.setUpdatedAt(System.currentTimeMillis());
        if (entry.getId() == null) mediaEntryMapper.insert(entry); else mediaEntryMapper.updateById(entry);
        return entry;
    }

    private ExternalWork upsertExternalWork(MetadataRecord record, long now, Long mediaId, Long entryId, String state) {
        ExternalWork work = externalWorkMapper.selectByProviderAndExternalId(record.provider(), record.externalId());
        if (work == null) {
            work = new ExternalWork();
            work.setProvider(record.provider());
            work.setExternalId(record.externalId());
            work.setCreatedAt(now);
        }
        if (mediaId != null) work.setMediaId(mediaId);
        if (entryId != null) work.setMediaEntryId(entryId);
        work.setCanonicalTitle(record.canonicalTitle());
        work.setNativeTitle(record.nativeTitle());
        work.setRomajiTitle(record.romajiTitle());
        work.setEnglishTitle(record.englishTitle());
        work.setAliasesJson(writeJson(record.aliases()));
        work.setDescription(record.description());
        work.setCoverUrl(record.coverUrl());
        work.setGenresJson(writeJson(record.genres()));
        work.setFormat(record.format());
        work.setYear(record.year());
        work.setSeason(record.season());
        work.setAirDate(record.airDate());
        work.setEndDate(record.endDate());
        work.setEpisodeCount(record.episodeCount());
        work.setRelationsJson(writeJson(record.relations()));
        work.setRawJson(record.rawJson());
        work.setPayloadHash(hash(record.rawJson()));
        work.setSyncState(state);
        work.setLastFetchedAt(now);
        work.setUpdatedAt(now);
        if (work.getId() == null) externalWorkMapper.insert(work); else externalWorkMapper.updateById(work);
        return work;
    }

    private Media findLinkedOrCandidate(MetadataRecord record) {
        ExternalWork work = externalWorkMapper.selectByProviderAndExternalId(record.provider(), record.externalId());
        if (work != null && work.getMediaId() != null) return mediaMapper.selectById(work.getMediaId());
        if (record.displayTitle() == null) return null;
        return mediaMapper.selectByTitleOrOriginal(record.displayTitle());
    }

    private Media requireMedia(long mediaId) {
        Media media = mediaMapper.selectById(mediaId);
        if (media == null) throw new java.util.NoSuchElementException("媒体不存在: " + mediaId);
        return media;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static String hash(String value) {
        if (value == null) return null;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return null;
        }
    }

    private record ImportCount(int added, int updated) { }
}
