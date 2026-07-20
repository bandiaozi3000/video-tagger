package com.videotagger.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties("videotagger.embedding")
public class EmbeddingProperties {
    private String baseUrl = "";
    private String apiKey = "";
    private String model = "text-embedding-3-small";
    private int dim = 1024;
}
