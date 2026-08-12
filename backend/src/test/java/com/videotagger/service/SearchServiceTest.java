package com.videotagger.service;

import com.videotagger.config.VectorProperties;
import com.videotagger.entity.Clip;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SearchServiceTest {

    ClipMapper clipMapper;
    MediaMapper mediaMapper;
    EpisodeMapper episodeMapper;
    EmbeddingClient embeddingClient;
    InMemoryVectorStore vectorStore;
    SearchService searchService;

    @BeforeEach
    void setUp() {
        clipMapper = mock(ClipMapper.class);
        mediaMapper = mock(MediaMapper.class);
        episodeMapper = mock(EpisodeMapper.class);
        embeddingClient = mock(EmbeddingClient.class);
        vectorStore = new InMemoryVectorStore();
        searchService = new SearchService(clipMapper, mediaMapper, episodeMapper, embeddingClient, vectorStore,
                new VectorProperties());
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
    void clipDimFusesKeywordAndVector() {
        // 关键词召回 [1,2]；向量召回 [2,3] → 融合后 2 第一
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt()))
                .thenReturn(List.of(clip(1L, "战斗A"), clip(2L, "战斗B")));
        when(clipMapper.selectBatchIds(anyCollection()))
                .thenReturn(List.of(clip(1L, "战斗A"), clip(2L, "战斗B"), clip(3L, "战斗C")));
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed("战斗")).thenReturn(new float[]{1f, 0f});
        vectorStore.upsert(EntityType.CLIP, 2L, new float[]{1f, 0f});
        vectorStore.upsert(EntityType.CLIP, 3L, new float[]{0.9f, 0.1f});

        SearchResponse resp = searchService.search("战斗", 10, 0, "clip", null, null, null, null, null);

        assertTrue(resp.semanticEnabled());
        assertEquals(2L, resp.results().get(0).id());
        assertEquals("CLIP", resp.results().get(0).entityType());
        assertEquals(3, resp.results().size());
    }

    @Test
    void degradesToKeywordWhenNotConfigured() {
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt())).thenReturn(List.of(clip(1L, "战斗A")));
        when(clipMapper.selectBatchIds(anyCollection())).thenReturn(List.of(clip(1L, "战斗A")));
        when(embeddingClient.isConfigured()).thenReturn(false);

        SearchResponse resp = searchService.search("战斗", 10, 0, "clip", null, null, null, null, null);

        assertFalse(resp.semanticEnabled());
        assertEquals(1, resp.results().size());
    }

    @Test
    void degradesToKeywordWhenEmbedFails() {
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt())).thenReturn(List.of(clip(1L, "战斗A")));
        when(clipMapper.selectBatchIds(anyCollection())).thenReturn(List.of(clip(1L, "战斗A")));
        when(embeddingClient.isConfigured()).thenReturn(true);
        when(embeddingClient.embed(anyString())).thenThrow(new RuntimeException("API 超时"));

        SearchResponse resp = searchService.search("战斗", 10, 0, "clip", null, null, null, null, null);

        assertFalse(resp.semanticEnabled());
        assertEquals(1, resp.results().size());
    }

    @Test
    void vectorDisabledSkipsEmbeddingEvenIfConfigured() {
        // 向量功能全局关闭：即便 Embedding API 已配置，也不生成查询向量，纯关键词搜索
        when(clipMapper.fullTextSearch(eq("战斗"), anyInt())).thenReturn(List.of(clip(1L, "战斗A")));
        when(clipMapper.selectBatchIds(anyCollection())).thenReturn(List.of(clip(1L, "战斗A")));
        when(embeddingClient.isConfigured()).thenReturn(true);
        VectorProperties vp = new VectorProperties();
        vp.setEnabled(false);
        SearchService disabled = new SearchService(clipMapper, mediaMapper, episodeMapper, embeddingClient, vectorStore, vp);

        SearchResponse resp = disabled.search("战斗", 10, 0, "clip", null, null, null, null, null);

        assertFalse(resp.semanticEnabled());
        assertEquals(1, resp.results().size());
        verify(embeddingClient, never()).embed(anyString());
    }

    @Test
    void mediaDimReturnsMediaResults() {
        com.videotagger.entity.Media a = new com.videotagger.entity.Media();
        a.setId(7L);
        a.setTitle("热血番");
        when(mediaMapper.searchByKeyword(eq("热血"), anyInt())).thenReturn(List.of(a));
        when(mediaMapper.selectBatchIds(anyCollection())).thenReturn(List.of(a));

        SearchResponse resp = searchService.search("热血", 10, 0, "media", null, null, null, null, null);

        assertEquals(1, resp.results().size());
        SearchResult r = resp.results().get(0);
        assertEquals("MEDIA", r.entityType());
        assertEquals(7L, r.mediaId());
        assertEquals("热血番", r.title());
    }

    @Test
    void clipResultsEnrichedWithMediaInfo() {
        // 片段结果经 episode→media 补齐 mediaId/mediaTitle/格式/子分类
        Clip c = clip(1L, "高燃");
        c.setEpisodeId(5L);
        c.setCreatedAt(1000L);
        when(clipMapper.fullTextSearch(eq("高燃"), anyInt())).thenReturn(List.of(c));
        when(clipMapper.selectBatchIds(anyCollection())).thenReturn(List.of(c));
        com.videotagger.entity.Episode ep = new com.videotagger.entity.Episode();
        ep.setId(5L);
        ep.setMediaId(7L);
        when(episodeMapper.selectBatchIds(anyCollection())).thenReturn(List.of(ep));
        com.videotagger.entity.Media a = new com.videotagger.entity.Media();
        a.setId(7L);
        a.setTitle("热血番");
        a.setMediaFormat("VIDEO");
        a.setSubcategory("番剧");
        when(mediaMapper.selectBatchIds(anyCollection())).thenReturn(List.of(a));
        when(embeddingClient.isConfigured()).thenReturn(false);

        SearchResponse resp = searchService.search("高燃", 10, 0, "clip", null, null, null, null, null);

        SearchResult r = resp.results().get(0);
        assertEquals(7L, r.mediaId());
        assertEquals("热血番", r.mediaTitle());
        assertEquals("VIDEO", r.mediaFormat());
        assertEquals("番剧", r.subcategory());
        assertEquals(1000L, r.createdAt());
    }

    @Test
    void subcategoryFilterKeepsSubtreeMembers() {
        // 子分类过滤按子树收敛：选中中间节点 7，其子树 [7,8]；挂 8 的媒体保留、挂 9 的丢弃
        com.videotagger.entity.Media a8 = new com.videotagger.entity.Media();
        a8.setId(8L);
        a8.setTitle("热血番");
        a8.setMediaFormat("VIDEO");
        a8.setSubcategoryId(8L);
        com.videotagger.entity.Media a9 = new com.videotagger.entity.Media();
        a9.setId(9L);
        a9.setTitle("恋爱番");
        a9.setMediaFormat("VIDEO");
        a9.setSubcategoryId(9L);
        when(mediaMapper.searchByKeyword(eq("番"), anyInt())).thenReturn(List.of(a8, a9));
        when(mediaMapper.selectBatchIds(anyCollection())).thenReturn(List.of(a8, a9));
        when(mediaMapper.subtreeIds(7L)).thenReturn(List.of(7L, 8L));
        when(embeddingClient.isConfigured()).thenReturn(false);

        SearchResponse resp = searchService.search("番", 10, 0, "media", null, 7L, null, null, null);

        assertEquals(1, resp.results().size());
        assertEquals(8L, resp.results().get(0).id());
    }

    @Test
    void timeRangeFiltersResultsByCreatedAt() {
        Clip c1 = clip(1L, "高燃");
        c1.setCreatedAt(1000L);
        Clip c2 = clip(2L, "高燃");
        c2.setCreatedAt(5000L);
        when(clipMapper.fullTextSearch(eq("高燃"), anyInt())).thenReturn(List.of(c1, c2));
        when(clipMapper.selectBatchIds(anyCollection())).thenReturn(List.of(c1, c2));
        when(embeddingClient.isConfigured()).thenReturn(false);

        SearchResponse resp = searchService.search("高燃", 10, 0, "clip", null, null, 2000L, null, null);

        assertEquals(1, resp.results().size());
        assertEquals(2L, resp.results().get(0).id());
    }

    @Test
    void sourceFilterKeepsOnlyMatchingMedia() {
        // 来源过滤：media 维度结果带自身 source，只保留匹配项
        com.videotagger.entity.Media aOmofuna = new com.videotagger.entity.Media();
        aOmofuna.setId(1L);
        aOmofuna.setTitle("中文番");
        aOmofuna.setSource("OMOFUNA");
        com.videotagger.entity.Media aManual = new com.videotagger.entity.Media();
        aManual.setId(2L);
        aManual.setTitle("手动画");
        aManual.setSource("MANUAL");
        when(mediaMapper.searchByKeyword(eq("番"), anyInt())).thenReturn(List.of(aOmofuna, aManual));
        when(mediaMapper.selectBatchIds(anyCollection())).thenReturn(List.of(aOmofuna, aManual));
        when(embeddingClient.isConfigured()).thenReturn(false);

        SearchResponse resp = searchService.search("番", 10, 0, "media", null, null, null, null, "OMOFUNA");

        assertEquals(1, resp.results().size());
        assertEquals("OMOFUNA", resp.results().get(0).source());
    }

    @Test
    void sourceFilterIgnoredWhenBlank() {
        // source 为空不过滤（默认全部来源）
        com.videotagger.entity.Media a = new com.videotagger.entity.Media();
        a.setId(1L);
        a.setTitle("某番");
        a.setSource("MANUAL");
        when(mediaMapper.searchByKeyword(eq("某"), anyInt())).thenReturn(List.of(a));
        when(mediaMapper.selectBatchIds(anyCollection())).thenReturn(List.of(a));
        when(embeddingClient.isConfigured()).thenReturn(false);

        SearchResponse resp = searchService.search("某", 10, 0, "media", null, null, null, null, "");

        assertEquals(1, resp.results().size());
    }

    @Test
    void mediaNoteSurfacesInResult() {
        com.videotagger.entity.Media a = new com.videotagger.entity.Media();
        a.setId(7L);
        a.setTitle("热血番");
        a.setNote("值得二刷的名场面合集");
        when(mediaMapper.searchByKeyword(eq("二刷"), anyInt())).thenReturn(List.of(a));
        when(mediaMapper.selectBatchIds(anyCollection())).thenReturn(List.of(a));

        SearchResponse resp = searchService.search("二刷", 10, 0, "media", null, null, null, null, null);

        assertEquals("值得二刷的名场面合集", resp.results().get(0).note());
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
