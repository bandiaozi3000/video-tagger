package com.videotagger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.HighlightProjectItem;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
public class HighlightStyleCompiler {
    private static final int MAX_STYLE_JSON_LENGTH = 100_000;
    private static final Set<String> CANVAS_RENDERERS = Set.of("blurred-background", "contain-black");
    private static final Set<String> CARD_RENDERERS = Set.of("cover-title", "glass-title", "media-summary");
    private static final Set<String> TRANSITION_RENDERERS = Set.of("none", "crossfade", "fade-black");
    private static final Map<String, String> PRESETS = Map.of(
            "cinematic", "{\"canvasRenderer\":\"blurred-background\",\"openingRenderer\":\"cover-title\",\"captionRenderer\":\"glass-title\",\"transitionRenderer\":\"fade-black\",\"audioRenderer\":\"fixed-scene-ducking\",\"openingDurationMs\":3500,\"captionDurationMs\":1200,\"endingDurationMs\":4000,\"transitionDurationMs\":350}",
            "energetic", "{\"canvasRenderer\":\"blurred-background\",\"openingRenderer\":\"cover-title\",\"captionRenderer\":\"glass-title\",\"transitionRenderer\":\"crossfade\",\"audioRenderer\":\"fixed-scene-ducking\",\"openingDurationMs\":1800,\"captionDurationMs\":700,\"endingDurationMs\":2500,\"transitionDurationMs\":220}",
            "minimal", "{\"canvasRenderer\":\"contain-black\",\"openingRenderer\":\"cover-title\",\"captionRenderer\":\"glass-title\",\"transitionRenderer\":\"none\",\"audioRenderer\":\"fixed-scene-ducking\",\"openingDurationMs\":1800,\"captionDurationMs\":0,\"endingDurationMs\":1800,\"transitionDurationMs\":0}");
    private static final Set<String> AUDIO_RENDERERS = Set.of("fixed-scene-ducking");

    private final ObjectMapper objectMapper;
    private final HighlightStylePackRegistry packRegistry;

    public HighlightStyleCompiler(ObjectMapper objectMapper) {
        this(objectMapper, new HighlightStylePackRegistry(objectMapper, new HighlightProperties()));
    }

    @Autowired
    public HighlightStyleCompiler(ObjectMapper objectMapper, HighlightStylePackRegistry packRegistry) {
        this.objectMapper = objectMapper;
        this.packRegistry = packRegistry;
    }

    public List<String> presets() {
        return PRESETS.keySet().stream().sorted().toList();
    }

    public CompiledStyle compile(String configJson) {
        if (configJson == null || configJson.isBlank()) return CompiledStyle.defaults();
        if (configJson.length() > MAX_STYLE_JSON_LENGTH) throw new IllegalArgumentException("风格配置过大");
        try {
            JsonNode root = objectMapper.readTree(configJson);
            JsonNode style = root.has("style") ? root.get("style") : root;
            if (style.has("stylePack") && !style.has("preset")) {
                JsonNode external = packRegistry.load(style.get("stylePack").asText());
                if (external == null) throw new IllegalArgumentException("外部风格包不存在：" + style.get("stylePack").asText());
                style = merge(external, style);
            }
            if (style.has("stylePreset") && !style.has("preset")) {
                com.fasterxml.jackson.databind.node.ObjectNode alias = style.deepCopy();
                alias.put("preset", style.get("stylePreset").asText());
                style = alias;
            }
            if (style.has("preset")) {
                String preset = style.get("preset").asText("").trim().toLowerCase(Locale.ROOT);
                String presetJson = PRESETS.get(preset);
                if (presetJson == null) throw new IllegalArgumentException("未知风格预设：" + preset);
                JsonNode base = objectMapper.readTree(presetJson);
                style = merge(base, style);
            }
            if (style.has("transition") && !style.has("transitionRenderer")) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) style).put("transitionRenderer", style.get("transition").asText());
            }
            if (style.has("cardsEnabled") && !style.get("cardsEnabled").asBoolean()) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) style).put("openingDurationMs", 0);
                ((com.fasterxml.jackson.databind.node.ObjectNode) style).put("endingDurationMs", 0);
            }
            String canvas = text(style, "canvasRenderer", "blurred-background");
            String opening = text(style, "openingRenderer", "cover-title");
            String caption = text(style, "captionRenderer", "glass-title");
            String transition = text(style, "transitionRenderer", "none");
            String audio = text(style, "audioRenderer", "fixed-scene-ducking");
            require(CANVAS_RENDERERS, canvas, "画幅");
            require(CARD_RENDERERS, opening, "片头");
            require(CARD_RENDERERS, caption, "标题卡");
            require(TRANSITION_RENDERERS, transition, "转场");
            require(AUDIO_RENDERERS, audio, "音频");
            int openingMs = boundedInt(style, "openingDurationMs", 3500, 0, 30_000);
            int captionMs = boundedInt(style, "captionDurationMs", 1200, 0, 10_000);
            int endingMs = boundedInt(style, "endingDurationMs", 4000, 0, 30_000);
            int transitionMs = boundedInt(style, "transitionDurationMs", 350, 0, 5_000);
            return new CompiledStyle(canvas, opening, caption, transition, audio,
                    openingMs, captionMs, endingMs, transitionMs);
        } catch (IOException e) {
            throw new IllegalArgumentException("风格配置 JSON 无效", e);
        }
    }

    public ScenePlan plan(String configJson, long mediaId, List<HighlightProjectItem> items) {
        CompiledStyle style = compile(configJson);
        List<Scene> content = new ArrayList<>();
        if (style.openingDurationMs() > 0) {
            content.add(new Scene("opening-card", style.openingRenderer(), null, style.openingDurationMs()));
        }
        for (HighlightProjectItem item : items) {
            if (item.getCaption() != null && !item.getCaption().isBlank() && style.captionDurationMs() > 0) {
                content.add(new Scene("caption-card", style.captionRenderer(), item.getId(), style.captionDurationMs()));
            }
            content.add(new Scene("clip", style.canvasRenderer(), item.getId(),
                    Math.max(0, Math.round((item.getOutSec() - item.getInSec()) * 1000))));
        }
        if (style.endingDurationMs() > 0) {
            content.add(new Scene("ending-card", "media-summary", mediaId, style.endingDurationMs()));
        }
        List<Scene> scenes = new ArrayList<>();
        for (int i = 0; i < content.size(); i++) {
            scenes.add(content.get(i));
            if (i + 1 < content.size() && !"none".equals(style.transitionRenderer())) {
                scenes.add(new Scene("transition", style.transitionRenderer(), null, style.transitionDurationMs()));
            }
        }
        return new ScenePlan(style, scenes);
    }

    private JsonNode merge(JsonNode base, JsonNode overrides) {
        com.fasterxml.jackson.databind.node.ObjectNode result = base.deepCopy();
        overrides.fields().forEachRemaining(entry -> {
            if (!"preset".equals(entry.getKey())) result.set(entry.getKey(), entry.getValue());
        });
        return result;
    }

    private static String text(JsonNode node, String field, String fallback) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || !value.isTextual() || value.asText().isBlank()
                ? fallback : value.asText().trim().toLowerCase(Locale.ROOT);
    }

    private static int boundedInt(JsonNode node, String field, int fallback, int min, int max) {
        JsonNode value = node == null ? null : node.get(field);
        int result = value != null && value.canConvertToInt() ? value.asInt() : fallback;
        if (result < min || result > max) throw new IllegalArgumentException(field + " 超出允许范围");
        return result;
    }

    private static void require(Set<String> supported, String value, String label) {
        if (!supported.contains(value)) throw new IllegalArgumentException(label + "渲染能力不支持：" + value);
    }

    public record CompiledStyle(String canvasRenderer, String openingRenderer, String captionRenderer,
                                String transitionRenderer, String audioRenderer, int openingDurationMs,
                                int captionDurationMs, int endingDurationMs, int transitionDurationMs) {
        static CompiledStyle defaults() {
            return new CompiledStyle("blurred-background", "cover-title", "glass-title",
                    "none", "fixed-scene-ducking", 3500, 1200, 4000, 350);
        }
    }

    public record Scene(String type, String renderer, Long itemId, long durationMs) { }

    public record ScenePlan(CompiledStyle style, List<Scene> scenes) { }
}
