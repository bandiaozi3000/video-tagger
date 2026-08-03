package com.videotagger.service;

import java.util.List;

/** 向量存储：三层（番剧/集/片段）共享单 collection，实体用 (type, entityId) 组合标识。 */
public interface VectorStore {

    void upsert(EntityType type, long entityId, float[] vector);

    /** 全类型 ANN 检索，按相似度从高到低返回。 */
    List<VectorHit> search(float[] queryVector, int topK);

    /** 限定类型的 ANN 检索。 */
    List<VectorHit> search(EntityType type, float[] queryVector, int topK);

    void delete(EntityType type, long entityId);

    record VectorHit(EntityType type, long entityId, double score) {
    }
}
