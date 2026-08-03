package com.videotagger.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * OpenAI 兼容 Chat Completions 客户端（LLM 后台归组用）。
 * 只用于后台任务，绝不进入打标主链路；默认关闭（grouping-enabled=false）。
 */
@Component
public class LlmClient {

    private static final Logger log = LoggerFactory.getLogger(LlmClient.class);

    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final boolean enabled;

    public LlmClient(@Value("${videotagger.llm.base-url:}") String baseUrl,
                     @Value("${videotagger.llm.api-key:}") String apiKey,
                     @Value("${videotagger.llm.model:}") String model,
                     @Value("${videotagger.llm.grouping-enabled:false}") boolean enabled) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null ? "" : model.trim();
        this.enabled = enabled;
    }

    public boolean isConfigured() {
        return enabled && !baseUrl.isBlank() && !apiKey.isBlank() && !model.isBlank();
    }

    /** 调用 chat completions，返回模型文本。失败抛异常由调用方兜底。 */
    public String chat(String system, String user) {
        String url = baseUrl.endsWith("/") ? baseUrl + "chat/completions" : baseUrl + "/chat/completions";
        String body = jsonBody(system, user);
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        try {
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() != 200) {
                throw new IllegalStateException("LLM HTTP " + resp.statusCode());
            }
            return extractContent(resp.body());
        } catch (IOException e) {
            throw new IllegalStateException("LLM 调用失败: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("LLM 调用被中断", e);
        }
    }

    private String jsonBody(String system, String user) {
        return "{\"model\":\"" + model + "\",\"temperature\":0,\"messages\":["
                + "{\"role\":\"system\",\"content\":\"" + escape(system) + "\"},"
                + "{\"role\":\"user\",\"content\":\"" + escape(user) + "\"}]}";
    }

    /** 粗解析 choices[0].message.content（本工具只用纯文本回复，无需完整 JSON 解析）。 */
    private static String extractContent(String json) {
        int idx = json.indexOf("\"content\":\"");
        if (idx < 0) {
            return "";
        }
        int start = idx + "\"content\":\"".length();
        int end = json.indexOf('"', start);
        return end < 0 ? "" : json.substring(start, end).replace("\\n", "\n").replace("\\\"", "\"");
    }

    private static String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
