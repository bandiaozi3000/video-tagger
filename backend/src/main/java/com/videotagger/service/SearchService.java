package com.videotagger.service;

import com.videotagger.entity.Anime;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.mapper.AnimeMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.util.UrlTimeParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 三层混合搜索：dim = anime / episode / clip / mixed。
 * 各维度 = 关键词召回 + 向量 ANN + RRF；mixed 再跨层 RRF（RankKey = type+id）。
 * semanticEnabled 表示本次查询向量是否生成成功（embed 失败自动降级关键词）。
 */
@Service
public class SearchService {

    private static final Logger log = LoggerFactory.getLogger(SearchService.class);
    private static final int RRF_K = 60;

    private final ClipMapper clipMapper;
    private final AnimeMapper animeMapper;
    private final EpisodeMapper episodeMapper;
    private final EmbeddingClient embeddingClient;
    private final VectorStore vectorStore;

    public SearchService(ClipMapper clipMapper, AnimeMapper animeMapper, EpisodeMapper episodeMapper,
                         EmbeddingClient embeddingClient, VectorStore vectorStore) {
        this.clipMapper = clipMapper;
        this.animeMapper = animeMapper;
        this.episodeMapper = episodeMapper;
        this.embeddingClient = embeddingClient;
        this.vectorStore = vectorStore;
    }

    /** dim 为空或 mixed 时跨层混合搜索（前端分栏展示）。 */
    public SearchResponse search(String query, int limit, String dim) {
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
            case "anime" -> searchAnime(query, queryVector, limit, semantic);
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
        return new SearchResponse(semantic, toClipResults(topIds, fused));
    }

    private SearchResponse searchAnime(String query, float[] queryVector, int limit, boolean semantic) {
        List<Long> keywordIds = animeMapper.searchByKeyword(query, limit).stream()
                .map(Anime::getId).toList();
        List<Long> vectorIds = vectorSearch(EntityType.ANIME, queryVector, limit).stream()
                .map(VectorStore.VectorHit::entityId).toList();
        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(RRF_K, List.of(keywordIds, vectorIds));
        List<Long> topIds = fused.keySet().stream().limit(limit).toList();
        if (topIds.isEmpty()) {
            return new SearchResponse(semantic, List.of());
        }
        Map<Long, Anime> byId = animeMapper.selectBatchIds(topIds).stream()
                .collect(Collectors.toMap(Anime::getId, Function.identity()));
        List<SearchResult> results = topIds.stream()
                .filter(byId::containsKey)
                .map(id -> toAnimeResult(byId.get(id), fused.get(id)))
                .filter(r -> r != null)
                .toList();
        return new SearchResponse(semantic, results);
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
        return new SearchResponse(semantic, results);
    }

    /** 混合搜索：三层各自"关键词+向量+RRF"得内排序，再跨层 RRF 融合。 */
    private SearchResponse searchMixed(String query, float[] queryVector, int limit, boolean semantic) {
        List<RrfFusion.RankKey> clipKeys = innerFuse(EntityType.CLIP, query, queryVector, limit);
        List<RrfFusion.RankKey> animeKeys = innerFuse(EntityType.ANIME, query, queryVector, limit);
        List<RrfFusion.RankKey> episodeKeys = innerFuse(EntityType.EPISODE, query, queryVector, limit);
        LinkedHashMap<RrfFusion.RankKey, Double> fused =
                RrfFusion.fuseKeys(RRF_K, List.of(clipKeys, animeKeys, episodeKeys));
        List<RrfFusion.RankKey> top = fused.keySet().stream().limit(limit).toList();
        return new SearchResponse(semantic, toMixedResults(top, fused));
    }

    private List<RrfFusion.RankKey> innerFuse(EntityType type, String query, float[] queryVector, int limit) {
        LinkedHashMap<Long, Double> inner = switch (type) {
            case ANIME -> RrfFusion.fuse(RRF_K, List.of(
                    animeMapper.searchByKeyword(query, limit * 2).stream().map(Anime::getId).toList(),
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
        return toClipResults(topIds, fused);
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
        List<Long> animeIds = keys.stream().filter(k -> k.type() == EntityType.ANIME).map(RrfFusion.RankKey::id).toList();
        List<Long> episodeIds = keys.stream().filter(k -> k.type() == EntityType.EPISODE).map(RrfFusion.RankKey::id).toList();

        Map<Long, Clip> clips = clipIds.isEmpty() ? Map.of()
                : clipMapper.selectBatchIds(clipIds).stream().collect(Collectors.toMap(Clip::getId, Function.identity()));
        Map<Long, Anime> animes = animeIds.isEmpty() ? Map.of()
                : animeMapper.selectBatchIds(animeIds).stream().collect(Collectors.toMap(Anime::getId, Function.identity()));
        Map<Long, Episode> episodes = episodeIds.isEmpty() ? Map.of()
                : episodeMapper.selectBatchIds(episodeIds).stream().collect(Collectors.toMap(Episode::getId, Function.identity()));

        return keys.stream()
                .map(k -> switch (k.type()) {
                    case CLIP -> toClipResult(clips.get(k.id()), scores.get(k));
                    case ANIME -> toAnimeResult(animes.get(k.id()), scores.get(k));
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
                "CLIP", null, c.getEpisodeId(), null, c.getCoverPath(), c.getDetailCoverPath());
    }

    private SearchResult toAnimeResult(Anime a, Double score) {
        if (a == null) {
            return null;
        }
        // 封面兜底：无显式封面时落到代表性片段帧
        String cover = a.getCoverPath() != null ? a.getCoverPath()
                : clipMapper.selectRepresentativeCoverByAnime(a.getId());
        return new SearchResult(a.getId(), a.getTitle(), null, null, null,
                null, null, score, "ANIME", a.getId(), null, null, cover, null);
    }

    private SearchResult toEpisodeResult(Episode ep, Double score) {
        if (ep == null) {
            return null;
        }
        // 封面解析：显式集封面为空时落到代表性片段帧（智能默认）
        String cover = ep.getCoverPath() != null ? ep.getCoverPath()
                : clipMapper.selectRepresentativeCoverByEpisode(ep.getId());
        return new SearchResult(ep.getId(), ep.getTitle(), ep.getUrl(), null, null,
                null, null, score, "EPISODE", ep.getAnimeId(), ep.getId(), ep.getVideoFp(), cover, null);
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
