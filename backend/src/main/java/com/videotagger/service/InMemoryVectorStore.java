package com.videotagger.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** 内存向量存储（测试 / 无 Milvus 环境兜底）：三层共享，key 为 "type:id"。 */
public class InMemoryVectorStore implements VectorStore {

    private final Map<String, float[]> vectors = new ConcurrentHashMap<>();

    private static String key(EntityType type, long entityId) {
        return type.name().charAt(0) + ":" + entityId;
    }

    @Override
    public void upsert(EntityType type, long entityId, float[] vector) {
        vectors.put(key(type, entityId), vector);
    }

    @Override
    public List<VectorHit> search(float[] queryVector, int topK) {
        return vectors.entrySet().stream()
                .map(e -> hit(e.getKey(), queryVector, e.getValue()))
                .sorted(Comparator.comparingDouble(VectorHit::score).reversed())
                .limit(topK)
                .toList();
    }

    @Override
    public List<VectorHit> search(EntityType type, float[] queryVector, int topK) {
        String prefix = type.name().charAt(0) + ":";
        return vectors.entrySet().stream()
                .filter(e -> e.getKey().startsWith(prefix))
                .map(e -> hit(e.getKey(), queryVector, e.getValue()))
                .sorted(Comparator.comparingDouble(VectorHit::score).reversed())
                .limit(topK)
                .toList();
    }

    @Override
    public void delete(EntityType type, long entityId) {
        vectors.remove(key(type, entityId));
    }

    private static VectorHit hit(String key, float[] query, float[] v) {
        double cos = cosine(query, v);
        int colon = key.indexOf(':');
        String prefix = key.substring(0, colon);
        EntityType type;
        switch (prefix) {
            case "A" -> type = EntityType.MEDIA;
            case "E" -> type = EntityType.EPISODE;
            default -> type = EntityType.CLIP;
        }
        return new VectorHit(type, Long.parseLong(key.substring(colon + 1)), cos);
    }

    private static double cosine(float[] a, float[] b) {
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
