package com.videotagger.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties("videotagger.milvus")
public class MilvusProperties {
    private String uri = "http://localhost:19530";
    private String collection = "clip_embeddings_v2";
    /**
     * ANN 相似度下限（余弦）。COSINE 指标下 score 即余弦相似度（越高越相关）；
     * 低于此值视为噪声召回（乱搜/无关查询），直接丢弃。
     * 实测 text-embedding-v4：相关命中 top1 ≥0.545，无关噪声 top1 ≤0.432，故默认 0.45 可分界。
     */
    private float minCosineScore = 0.45f;
}
