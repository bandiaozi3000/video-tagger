package com.videotagger.service;

import java.util.List;

public interface VectorStore {

    void upsert(long clipId, float[] vector);

    /** 按相似度从高到低返回 */
    List<VectorHit> search(float[] queryVector, int topK);

    void delete(long clipId);

    record VectorHit(long clipId, double score) {
    }
}
