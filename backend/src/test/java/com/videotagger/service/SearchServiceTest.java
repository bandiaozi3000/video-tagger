package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.mapper.ClipMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SearchServiceTest {

    ClipMapper clipMapper;
    EmbeddingClient embeddingClient;
    InMemoryVectorStore vectorStore;
    SearchService searchService;

    @BeforeEach
    void setUp() {
        clipMapper = mock(ClipMapper.class);
        embeddingClient = mock(EmbeddingClient.class);
        vectorStore = new InMemoryVectorStore();
        searchService = new SearchService(clipMapper, embeddingClient, vectorStore);
    }

    private Clip clip(long id, String tag) {
        Clip c = new Clip();
        c.setId(id);
        c.setTitle("某动画");
        c.setUrl("https://v.example.com/" + id);
        c.setTimestampSec(60.0);
        c.setTag(tag);
        c.setNote("");
        return c;
    }

    @Test
    void hybridFusesKeywordAndVector() {
        // 关键词召回 [1,2]；向量召回 [2,3] → 融合后 2 第一
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt()))
                .thenReturn(List.of(clip(1L, "战斗A"), clip(2L, "战斗B")));
        when(clipMapper.selectBatchIds(anyCollection()))
                .thenReturn(List.of(clip(1L, "战斗A"), clip(2L, "战斗B"), clip(3L, "战斗C")));
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed("战斗")).thenReturn(new float[]{1f, 0f});
        vectorStore.upsert(2L, new float[]{1f, 0f});
        vectorStore.upsert(3L, new float[]{0.9f, 0.1f});

        SearchResponse resp = searchService.search("战斗", 10);

        assertTrue(resp.semanticEnabled());
        assertEquals(2L, resp.results().get(0).id());
        assertEquals(3, resp.results().size());
    }

    @Test
    void degradesToKeywordWhenNotConfigured() {
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt())).thenReturn(List.of(clip(1L, "战斗A")));
        when(clipMapper.selectBatchIds(anyCollection())).thenReturn(List.of(clip(1L, "战斗A")));
        when(embeddingClient.isConfigured()).thenReturn(false);

        SearchResponse resp = searchService.search("战斗", 10);

        assertFalse(resp.semanticEnabled());
        assertEquals(1, resp.results().size());
    }

    @Test
    void degradesToKeywordWhenEmbedFails() {
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt())).thenReturn(List.of(clip(1L, "战斗A")));
        when(clipMapper.selectBatchIds(anyCollection())).thenReturn(List.of(clip(1L, "战斗A")));
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed(anyString())).thenThrow(new RuntimeException("API 超时"));

        SearchResponse resp = searchService.search("战斗", 10);

        assertFalse(resp.semanticEnabled());
        assertEquals(1, resp.results().size());
    }

    @Test
    void similarReturnsSameTagClips() {
        when(clipMapper.selectById(1L)).thenReturn(clip(1L, "高燃 战斗"));
        when(clipMapper.findSimilarByTag(eq(1L), anyList(), anyInt())).thenReturn(List.of(2L, 3L));
        when(clipMapper.selectBatchIds(anyCollection()))
                .thenReturn(List.of(clip(2L, "高燃 战斗"), clip(3L, "高燃 名场面")));
        when(embeddingClient.isConfigured()).thenReturn(false);

        List<SearchResult> result = searchService.similar(1L, 10);

        assertEquals(List.of(2L, 3L), result.stream().map(SearchResult::id).toList());
    }

    @Test
    void similarExcludesSelf() {
        when(clipMapper.selectById(1L)).thenReturn(clip(1L, "高燃"));
        when(clipMapper.findSimilarByTag(eq(1L), anyList(), anyInt())).thenReturn(List.of(2L, 1L));
        when(clipMapper.selectBatchIds(anyCollection()))
                .thenReturn(List.of(clip(1L, "高燃"), clip(2L, "高燃")));
        when(embeddingClient.isConfigured()).thenReturn(false);

        List<SearchResult> result = searchService.similar(1L, 10);

        assertEquals(List.of(2L), result.stream().map(SearchResult::id).toList());
    }
}
