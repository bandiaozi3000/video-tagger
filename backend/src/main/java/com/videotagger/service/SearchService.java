package com.videotagger.service;

import com.videotagger.entity.Media;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.util.UrlTimeParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 三层混合搜索：dim = media / episode / clip / mixed。
 * 各维度 = 关键词召回 + 向量 ANN + RRF；mixed 再跨层 RRF（RankKey = type+id）。
 * semanticEnabled 表示本次查询向量是否生成成功（embed 失败自动降级关键词）。
 */
@Service
public class SearchService {

    private static final Logger log = LoggerFactory.getLogger(SearchService.class);
    private static final int RRF_K = 60;

    private final ClipMapper clipMapper;
    private final MediaMapper mediaMapper;
    private final EpisodeMapper episodeMapper;
    private final EmbeddingClient embeddingClient;
    private final VectorStore vectorStore;

    public SearchService(ClipMapper clipMapper, MediaMapper mediaMapper, EpisodeMapper episodeMapper,
                         EmbeddingClient embeddingClient, VectorStore vectorStore) {
        this.clipMapper = clipMapper;
        this.mediaMapper = mediaMapper;
        this.episodeMapper = episodeMapper;
        this.embeddingClient = embeddingClient;
        this.vectorStore = vectorStore;
    }

    /**
     * dim 为空或 mixed 时跨层混合搜索（前端分栏展示）。format/subcategoryId 为结果后置过滤
     * （子分类按子树收敛：选中节点的全部后代媒体结果都保留）；from/to 为打标时间范围后置过滤，均可空。
     */
    public SearchResponse search(String query, int limit, String dim, String format, Long subcategoryId,
                                 Long from, Long to) {
        boolean filtered = (format != null && !format.isBlank())
                || subcategoryId != null
                || from != null || to != null;
        // 有过滤时内层多取一些，保证过滤后仍能凑够 limit
        int fetchLimit = filtered ? Math.min(limit * 4, 200) : limit;
        SearchResponse resp = doSearch(query, fetchLimit, dim);
        if (!filtered) {
            return resp;
        }
        Set<Long> subtree = subcategoryId == null ? null : new HashSet<>(mediaMapper.subtreeIds(subcategoryId));
        List<SearchResult> kept = resp.results().stream()
                .filter(r -> inTimeRange(r.createdAt(), from, to))
                .filter(r -> matchFormatSubcategory(r.mediaFormat(), r.subcategoryId(), format, subtree))
                .limit(limit).toList();
        return new SearchResponse(resp.semanticEnabled(), kept);
    }

    private static boolean inTimeRange(Long createdAt, Long from, Long to) {
        if (createdAt == null) {
            return from == null && to == null;
        }
        return (from == null || createdAt >= from) && (to == null || createdAt <= to);
    }

    /** 格式匹配 + 子树成员匹配（subtree=null 时不做子分类过滤）。 */
    private static boolean matchFormatSubcategory(String mediaFormat, Long resultSubId,
                                                  String format, Set<Long> subtree) {
        if (format != null && !format.isBlank() && !format.equalsIgnoreCase(mediaFormat)) {
            return false;
        }
        if (subtree != null && !subtree.contains(resultSubId)) {
            return false;
        }
        return true;
    }

    private SearchResponse doSearch(String query, int limit, String dim) {
        // 查询向量只生成一次，各维度复用；失败则本次搜索降级纯关键词
        float[] queryVector = null;
        boolean semantic = false;
        if (embeddingClient.isConfigured()) {
            try {
                queryVector = embeddingClient.embed(query);
                semantic = true;
            } catch (Exception e) {
                log.warn("查询向量生成失败，本次降级为关键词搜索：{}", e.getMessage());
            }
        }

        if (dim == null || dim.isBlank() || dim.equals("mixed")) {
            return searchMixed(query, queryVector, limit, semantic);
        }
        return switch (dim.toLowerCase()) {
            case "media" -> searchMedia(query, queryVector, limit, semantic);
            case "episode" -> searchEpisode(query, queryVector, limit, semantic);
            default -> searchClip(query, queryVector, limit, semantic);
        };
    }

    private SearchResponse searchClip(String query, float[] queryVector, int limit, boolean semantic) {
        List<Long> keywordIds = clipMapper.fullTextSearch(query, limit).stream()
                .map(Clip::getId).toList();
        List<Long> vectorIds = vectorSearch(EntityType.CLIP, queryVector, limit).stream()
                .map(VectorStore.VectorHit::entityId).toList();
        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(RRF_K, List.of(keywordIds, vectorIds));
        List<Long> topIds = fused.keySet().stream().limit(limit).toList();
        return new SearchResponse(semantic, enrich(toClipResults(topIds, fused)));
    }

    private SearchResponse searchMedia(String query, float[] queryVector, int limit, boolean semantic) {
        List<Long> keywordIds = mediaMapper.searchByKeyword(query, limit).stream()
                .map(Media::getId).toList();
        List<Long> vectorIds = vectorSearch(EntityType.MEDIA, queryVector, limit).stream()
                .map(VectorStore.VectorHit::entityId).toList();
        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(RRF_K, List.of(keywordIds, vectorIds));
        List<Long> topIds = fused.keySet().stream().limit(limit).toList();
        if (topIds.isEmpty()) {
            return new SearchResponse(semantic, List.of());
        }
        Map<Long, Media> byId = mediaMapper.selectBatchIds(topIds).stream()
                .collect(Collectors.toMap(Media::getId, Function.identity()));
        List<SearchResult> results = topIds.stream()
                .filter(byId::containsKey)
                .map(id -> toMediaResult(byId.get(id), fused.get(id)))
                .filter(r -> r != null)
                .toList();
        return new SearchResponse(semantic, enrich(results));
    }

    private SearchResponse searchEpisode(String query, float[] queryVector, int limit, boolean semantic) {
        List<Long> keywordIds = episodeMapper.searchByKeyword(query, limit).stream()
                .map(Episode::getId).toList();
        List<Long> vectorIds = vectorSearch(EntityType.EPISODE, queryVector, limit).stream()
                .map(VectorStore.VectorHit::entityId).toList();
        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(RRF_K, List.of(keywordIds, vectorIds));
        List<Long> topIds = fused.keySet().stream().limit(limit).toList();
        if (topIds.isEmpty()) {
            return new SearchResponse(semantic, List.of());
        }
        Map<Long, Episode> byId = episodeMapper.selectBatchIds(topIds).stream()
                .collect(Collectors.toMap(Episode::getId, Function.identity()));
        List<SearchResult> results = topIds.stream()
                .filter(byId::containsKey)
                .map(id -> toEpisodeResult(byId.get(id), fused.get(id)))
                .filter(r -> r != null)
                .toList();
        return new SearchResponse(semantic, enrich(results));
    }

    /** 混合搜索：三层各自"关键词+向量+RRF"得内排序，再跨层 RRF 融合。 */
    private SearchResponse searchMixed(String query, float[] queryVector, int limit, boolean semantic) {
        List<RrfFusion.RankKey> clipKeys = innerFuse(EntityType.CLIP, query, queryVector, limit);
        List<RrfFusion.RankKey> mediaKeys = innerFuse(EntityType.MEDIA, query, queryVector, limit);
        List<RrfFusion.RankKey> episodeKeys = innerFuse(EntityType.EPISODE, query, queryVector, limit);
        LinkedHashMap<RrfFusion.RankKey, Double> fused =
                RrfFusion.fuseKeys(RRF_K, List.of(clipKeys, mediaKeys, episodeKeys));
        List<RrfFusion.RankKey> top = fused.keySet().stream().limit(limit).toList();
        return new SearchResponse(semantic, enrich(toMixedResults(top, fused)));
    }

    private List<RrfFusion.RankKey> innerFuse(EntityType type, String query, float[] queryVector, int limit) {
        LinkedHashMap<Long, Double> inner = switch (type) {
            case MEDIA -> RrfFusion.fuse(RRF_K, List.of(
                    mediaMapper.searchByKeyword(query, limit * 2).stream().map(Media::getId).toList(),
                    vectorSearch(type, queryVector, limit * 2).stream().map(VectorStore.VectorHit::entityId).toList()));
            case EPISODE -> RrfFusion.fuse(RRF_K, List.of(
                    episodeMapper.searchByKeyword(query, limit * 2).stream().map(Episode::getId).toList(),
                    vectorSearch(type, queryVector, limit * 2).stream().map(VectorStore.VectorHit::entityId).toList()));
            default -> RrfFusion.fuse(RRF_K, List.of(
                    clipMapper.fullTextSearch(query, limit * 2).stream().map(Clip::getId).toList(),
                    vectorSearch(type, queryVector, limit * 2).stream().map(VectorStore.VectorHit::entityId).toList()));
        };
        return inner.keySet().stream().limit(limit).map(id -> new RrfFusion.RankKey(type, id)).toList();
    }

    /**
     * 相似片段推荐：同标签候选（按命中标签词数排序）优先，向量近邻补充；
     * RRF 融合后排除自身，返回前 limit 条。
     */
    public List<SearchResult> similar(Long id, int limit) {
        Clip target = clipMapper.selectById(id);
        if (target == null) {
            throw new NoSuchElementException("clip not found: " + id);
        }
        List<String> tokens = Arrays.stream(target.getTag().trim().split("\\s+"))
                .filter(t -> !t.isEmpty())
                .toList();
        List<Long> tagIds = tokens.isEmpty() ? List.of()
                : clipMapper.findSimilarByTag(id, tokens, Math.max(limit * 3, 30));

        List<Long> vectorIds = List.of();
        if (embeddingClient.isConfigured() && !target.getTag().isBlank()) {
            try {
                // 用目标片段的文本重新嵌入作为查询向量（同文本≈已存向量），ANN 后排除自身
                String text = target.getTag() + (target.getNote() == null || target.getNote().isBlank()
                        ? "" : " " + target.getNote());
                float[] q = embeddingClient.embed(text);
                vectorIds = vectorStore.search(EntityType.CLIP, q, Math.max(limit * 3, 30)).stream()
                        .map(VectorStore.VectorHit::entityId).toList();
            } catch (Exception e) {
                log.warn("相似推荐向量召回失败：{}", e.getMessage());
            }
        }

        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(RRF_K, List.of(tagIds, vectorIds));
        List<Long> topIds = fused.keySet().stream()
                .filter(cid -> !cid.equals(id))
                .limit(limit)
                .toList();
        return enrich(toClipResults(topIds, fused));
    }

    private List<VectorStore.VectorHit> vectorSearch(EntityType type, float[] queryVector, int limit) {
        if (queryVector == null) {
            return List.of();
        }
        try {
            return vectorStore.search(type, queryVector, limit);
        } catch (Exception e) {
            log.warn("向量召回失败（{}）：{}", type, e.getMessage());
            return List.of();
        }
    }

    // ---------- 结果组装 ----------

    private List<SearchResult> toMixedResults(List<RrfFusion.RankKey> keys, Map<RrfFusion.RankKey, Double> scores) {
        List<Long> clipIds = keys.stream().filter(k -> k.type() == EntityType.CLIP).map(RrfFusion.RankKey::id).toList();
        List<Long> mediaIds = keys.stream().filter(k -> k.type() == EntityType.MEDIA).map(RrfFusion.RankKey::id).toList();
        List<Long> episodeIds = keys.stream().filter(k -> k.type() == EntityType.EPISODE).map(RrfFusion.RankKey::id).toList();

        Map<Long, Clip> clips = clipIds.isEmpty() ? Map.of()
                : clipMapper.selectBatchIds(clipIds).stream().collect(Collectors.toMap(Clip::getId, Function.identity()));
        Map<Long, Media> medias = mediaIds.isEmpty() ? Map.of()
                : mediaMapper.selectBatchIds(mediaIds).stream().collect(Collectors.toMap(Media::getId, Function.identity()));
        Map<Long, Episode> episodes = episodeIds.isEmpty() ? Map.of()
                : episodeMapper.selectBatchIds(episodeIds).stream().collect(Collectors.toMap(Episode::getId, Function.identity()));

        return keys.stream()
                .map(k -> switch (k.type()) {
                    case CLIP -> toClipResult(clips.get(k.id()), scores.get(k));
                    case MEDIA -> toMediaResult(medias.get(k.id()), scores.get(k));
                    case EPISODE -> toEpisodeResult(episodes.get(k.id()), scores.get(k));
                })
                .filter(r -> r != null)
                .toList();
    }

    private SearchResult toClipResult(Clip c, Double score) {
        if (c == null) {
            return null;
        }
        return new SearchResult(c.getId(), c.getTitle(), c.getUrl(),
                UrlTimeParams.build(c.getUrl(), c.getTimestampSec()),
                c.getTimestampSec(), c.getTag(), c.getNote(), score,
                "CLIP", null, c.getEpisodeId(), null, c.getCoverPath(), c.getDetailCoverPath(),
                null, null, null, null, c.getCreatedAt());
    }

    private SearchResult toMediaResult(Media a, Double score) {
        if (a == null) {
            return null;
        }
        // 封面兜底：无显式封面时落到代表性片段帧
        String cover = a.getCoverPath() != null ? a.getCoverPath()
                : clipMapper.selectRepresentativeCoverByMedia(a.getId());
        return new SearchResult(a.getId(), a.getTitle(), null, null, null,
                null, a.getNote(), score, EntityType.MEDIA.name(), a.getId(), null, null, cover, null,
                null, null, null, a.getSubcategoryId(), a.getCreatedAt());
    }

    private SearchResult toEpisodeResult(Episode ep, Double score) {
        if (ep == null) {
            return null;
        }
        // 封面解析：显式集封面为空时落到代表性片段帧（智能默认）
        String cover = ep.getCoverPath() != null ? ep.getCoverPath()
                : clipMapper.selectRepresentativeCoverByEpisode(ep.getId());
        return new SearchResult(ep.getId(), ep.getTitle(), ep.getUrl(), null, null,
                null, ep.getNote(), score, "EPISODE", ep.getMediaId(), ep.getId(), ep.getVideoFp(), cover, null,
                null, null, null, null, ep.getCreatedAt());
    }

    /**
     * 为结果补齐「所属媒体」元信息（按媒体聚合/角标/时间展示用）：
     * CLIP 结果先经 episode 解析 mediaId，再批量查 media 补 mediaTitle/mediaFormat/subcategory。
     * note/createdAt 已在构建时填好，此处仅重建携带，不改值。
     */
    private List<SearchResult> enrich(List<SearchResult> results) {
        if (results.isEmpty()) {
            return results;
        }
        Set<Long> clipEpisodeIds = results.stream()
                .filter(r -> r.entityType().equals("CLIP") && r.episodeId() != null)
                .map(SearchResult::episodeId)
                .collect(Collectors.toSet());
        // 注意：用 Collections.emptyMap()（get(null) 返回 null），Map.of() 对 null key 抛 NPE
        Map<Long, Long> episodeToMedia = clipEpisodeIds.isEmpty() ? Collections.emptyMap()
                : episodeMapper.selectBatchIds(clipEpisodeIds).stream()
                        .collect(Collectors.toMap(Episode::getId, Episode::getMediaId));
        Set<Long> mediaIds = results.stream()
                .map(r -> switch (r.entityType()) {
                    case "MEDIA" -> r.id();
                    case "EPISODE" -> r.mediaId();
                    default -> episodeToMedia.get(r.episodeId());
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, Media> medias = mediaIds.isEmpty() ? Collections.emptyMap()
                : mediaMapper.selectBatchIds(mediaIds).stream()
                        .collect(Collectors.toMap(Media::getId, Function.identity()));
        return results.stream().map(r -> {
            Long mediaId = switch (r.entityType()) {
                case "MEDIA" -> r.id();
                case "EPISODE" -> r.mediaId();
                default -> episodeToMedia.get(r.episodeId());
            };
            Media m = mediaId == null ? null : medias.get(mediaId);
            return new SearchResult(r.id(), r.title(), r.url(), r.jumpUrl(), r.timestampSec(),
                    r.tag(), r.note(), r.score(), r.entityType(), mediaId, r.episodeId(),
                    r.videoFp(), r.coverPath(), r.detailCoverPath(),
                    r.entityType().equals("MEDIA") ? null : (m == null ? null : m.getTitle()),
                    m == null ? null : m.getMediaFormat(),
                    m == null ? null : m.getSubcategory(),
                    m == null ? null : m.getSubcategoryId(),
                    r.createdAt());
        }).toList();
    }

    private List<SearchResult> toClipResults(List<Long> topIds, Map<Long, Double> scores) {
        if (topIds.isEmpty()) {
            return List.of();
        }
        Map<Long, Clip> byId = clipMapper.selectBatchIds(topIds).stream()
                .collect(Collectors.toMap(Clip::getId, Function.identity()));
        return topIds.stream()
                .filter(byId::containsKey)
                .map(id -> toClipResult(byId.get(id), scores.get(id)))
                .filter(r -> r != null)
                .toList();
    }
}
