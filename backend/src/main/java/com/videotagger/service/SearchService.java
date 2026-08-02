package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
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

@Service
public class SearchService {

    private static final Logger log = LoggerFactory.getLogger(SearchService.class);
    private static final int RRF_K = 60;

    private final ClipMapper clipMapper;
    private final EmbeddingClient embeddingClient;
    private final VectorStore vectorStore;

    public SearchService(ClipMapper clipMapper, EmbeddingClient embeddingClient, VectorStore vectorStore) {
        this.clipMapper = clipMapper;
        this.embeddingClient = embeddingClient;
        this.vectorStore = vectorStore;
    }

    public SearchResponse search(String query, int limit) {
        List<Long> keywordIds = clipMapper.fullTextSearch(query, limit).stream()
                .map(Clip::getId).toList();

        List<Long> vectorIds = List.of();
        boolean semantic = false;
        if (embeddingClient.isConfigured()) {
            try {
                float[] queryVector = embeddingClient.embed(query);
                vectorIds = vectorStore.search(queryVector, limit).stream()
                        .map(VectorStore.VectorHit::clipId).toList();
                semantic = true;
            } catch (Exception e) {
                log.warn("向量召回失败，降级为关键词搜索：{}", e.getMessage());
            }
        }

        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(RRF_K, List.of(keywordIds, vectorIds));
        List<Long> topIds = fused.keySet().stream().limit(limit).toList();
        if (topIds.isEmpty()) {
            return new SearchResponse(semantic, List.of());
        }
        return new SearchResponse(semantic, toResults(topIds, fused));
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
                vectorIds = vectorStore.search(q, Math.max(limit * 3, 30)).stream()
                        .map(VectorStore.VectorHit::clipId).toList();
            } catch (Exception e) {
                log.warn("相似推荐向量召回失败：{}", e.getMessage());
            }
        }

        LinkedHashMap<Long, Double> fused = RrfFusion.fuse(RRF_K, List.of(tagIds, vectorIds));
        List<Long> topIds = fused.keySet().stream()
                .filter(cid -> !cid.equals(id))
                .limit(limit)
                .toList();
        return toResults(topIds, fused);
    }

    private List<SearchResult> toResults(List<Long> topIds, Map<Long, Double> scores) {
        if (topIds.isEmpty()) {
            return List.of();
        }
        Map<Long, Clip> byId = clipMapper.selectBatchIds(topIds).stream()
                .collect(Collectors.toMap(Clip::getId, Function.identity()));

        return topIds.stream()
                .filter(byId::containsKey)
                .map(id -> {
                    Clip c = byId.get(id);
                    return new SearchResult(c.getId(), c.getTitle(), c.getUrl(),
                            UrlTimeParams.build(c.getUrl(), c.getTimestampSec()),
                            c.getTimestampSec(), c.getTag(), c.getNote(), scores.get(id));
                })
                .toList();
    }
}
