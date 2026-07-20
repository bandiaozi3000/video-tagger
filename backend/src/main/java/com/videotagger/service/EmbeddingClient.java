package com.videotagger.service;

import com.videotagger.config.EmbeddingProperties;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
public class EmbeddingClient {

    private final EmbeddingProperties props;
    private volatile RestClient restClient;

    public EmbeddingClient(EmbeddingProperties props) {
        this.props = props;
    }

    public boolean isConfigured() {
        return StringUtils.hasText(props.getApiKey()) && StringUtils.hasText(props.getBaseUrl());
    }

    public float[] embed(String text) {
        EmbeddingApiResponse resp = client().post()
                .uri("/embeddings")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("model", props.getModel(), "input", text))
                .retrieve()
                .body(EmbeddingApiResponse.class);

        if (resp == null || resp.data() == null || resp.data().isEmpty()) {
            throw new IllegalStateException("Embedding API 返回为空");
        }
        List<Float> values = resp.data().get(0).embedding();
        float[] vector = new float[values.size()];
        for (int i = 0; i < values.size(); i++) {
            vector[i] = values.get(i);
        }
        return vector;
    }

    private RestClient client() {
        if (restClient == null) {
            synchronized (this) {
                if (restClient == null) {
                    restClient = RestClient.builder()
                            .baseUrl(props.getBaseUrl())
                            .defaultHeader("Authorization", "Bearer " + props.getApiKey())
                            .build();
                }
            }
        }
        return restClient;
    }

    record EmbeddingApiResponse(List<EmbeddingApiData> data) {
    }

    record EmbeddingApiData(List<Float> embedding) {
    }
}
