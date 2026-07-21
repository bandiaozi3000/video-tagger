package com.videotagger.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryVectorStore implements VectorStore {

    private final Map<Long, float[]> vectors = new ConcurrentHashMap<>();

    @Override
    public void upsert(long clipId, float[] vector) {
        vectors.put(clipId, vector);
    }

    @Override
    public List<VectorHit> search(float[] queryVector, int topK) {
        return vectors.entrySet().stream()
                .map(e -> new VectorHit(e.getKey(), cosine(queryVector, e.getValue())))
                .sorted(Comparator.comparingDouble(VectorHit::score).reversed())
                .limit(topK)
                .toList();
    }

    @Override
    public void delete(long clipId) {
        vectors.remove(clipId);
    }

    private double cosine(float[] a, float[] b) {
        double dot = 0, normA = 0, normB = 0;
        int len = Math.min(a.length, b.length);
        for (int i = 0; i < len; i++) {
            dot += (double) a[i] * b[i];
            normA += (double) a[i] * a[i];
            normB += (double) b[i] * b[i];
        }
        if (normA == 0 || normB == 0) {
            return 0;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
