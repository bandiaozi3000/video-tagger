package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.util.UrlTimeParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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

        Map<Long, Clip> byId = clipMapper.selectBatchIds(topIds).stream()
                .collect(Collectors.toMap(Clip::getId, Function.identity()));

        List<SearchResult> results = topIds.stream()
                .filter(byId::containsKey)
                .map(id -> {
                    Clip c = byId.get(id);
                    return new SearchResult(c.getId(), c.getTitle(), c.getUrl(),
                            UrlTimeParams.build(c.getUrl(), c.getTimestampSec()),
                            c.getTimestampSec(), c.getTag(), c.getNote(), fused.get(id));
                })
                .toList();
        return new SearchResponse(semantic, results);
    }
}
