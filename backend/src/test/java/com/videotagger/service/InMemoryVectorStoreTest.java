package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InMemoryVectorStoreTest {

    @Test
    void searchOrdersByCosineDescending() {
        InMemoryVectorStore store = new InMemoryVectorStore();
        store.upsert(EntityType.CLIP, 1L, new float[]{1f, 0f});     // 与查询同向，相似度 1
        store.upsert(EntityType.CLIP, 2L, new float[]{0f, 1f});     // 正交，相似度 0
        store.upsert(EntityType.CLIP, 3L, new float[]{0.6f, 0.8f}); // 相似度 0.6

        List<VectorStore.VectorHit> hits = store.search(new float[]{1f, 0f}, 3);

        assertEquals(List.of(1L, 3L, 2L), hits.stream().map(VectorStore.VectorHit::entityId).toList());
    }

    @Test
    void searchByTypeFiltersOutOtherLayers() {
        InMemoryVectorStore store = new InMemoryVectorStore();
        store.upsert(EntityType.CLIP, 1L, new float[]{1f, 0f});
        store.upsert(EntityType.MEDIA, 1L, new float[]{0.9f, 0.1f}); // 同 id 不同层，应被过滤

        List<VectorStore.VectorHit> hits = store.search(EntityType.CLIP, new float[]{1f, 0f}, 10);

        assertEquals(1, hits.size());
        assertEquals(EntityType.CLIP, hits.get(0).type());
        assertEquals(1L, hits.get(0).entityId());
    }

    @Test
    void searchRespectsTopKAndDelete() {
        InMemoryVectorStore store = new InMemoryVectorStore();
        store.upsert(EntityType.CLIP, 1L, new float[]{1f, 0f});
        store.upsert(EntityType.CLIP, 2L, new float[]{0.9f, 0.1f});

        assertEquals(1, store.search(new float[]{1f, 0f}, 1).size());

        store.delete(EntityType.CLIP, 1L);
        List<VectorStore.VectorHit> hits = store.search(new float[]{1f, 0f}, 10);
        assertEquals(1, hits.size());
        assertEquals(2L, hits.get(0).entityId());
    }
}
