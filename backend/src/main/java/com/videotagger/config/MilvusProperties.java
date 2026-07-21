package com.videotagger.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties("videotagger.milvus")
public class MilvusProperties {
    private String uri = "http://localhost:19530";
    private String collection = "clip_embeddings";
}
