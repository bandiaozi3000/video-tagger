package com.videotagger.material;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;import com.videotagger.material.MaterializationChannel.State;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Clip 的"渠道线索"。一条 hint 表达某渠道的一个可追溯出处：文件在不在场、从哪来。
 * 持久化为 {@code clips.channel_hints} 的 JSON 数组（老库为空 = 无渠道线索，走 C1/C3/C4 推断）。
 */
public record ChannelHint(
        String channel,          // C1/C2/C3/C4
        String state,            // PRESENT / PENDING / UNAVAILABLE
        String kind,             // local-file / animeko-cache / web-url / screen-capture
        String episodeId,        // Bangumi episodeId（C2）
        String subjectId,        // Bangumi subjectId（C2）
        String videoFp,          // C1 指纹
        Long assetId,            // 已登记本地/远端资产 id
        String url,              // C3 直链
        String filePath,         // 定位到的本地文件绝对路径（C1/C2 present 时）
        Long updatedAt) {

    public static ChannelHint present(String channel, String kind) {
        return new ChannelHint(channel, State.PRESENT.name(), kind, null, null, null, null, null, null, now());
    }

    public static ChannelHint pending(String channel, String kind) {
        return new ChannelHint(channel, State.PENDING.name(), kind, null, null, null, null, null, null, now());
    }

    public boolean isPresent() {
        return State.PRESENT.name().equals(state);
    }

    public boolean isPending() {
        return State.PENDING.name().equals(state);
    }

    private static long now() {
        return System.currentTimeMillis();
    }

    /** channel_hints JSON ↔ List 的序列化助手（JsonNode 手写编解码，规避 record 反射；容忍坏 JSON → 空列表）。 */
    public static final class Codec {
        private static final ObjectMapper MAPPER = new ObjectMapper();

        private Codec() {
        }

        public static String encode(List<ChannelHint> hints) {
            if (hints == null || hints.isEmpty()) return null;
            try {
                com.fasterxml.jackson.databind.node.ArrayNode arr = MAPPER.createArrayNode();
                for (ChannelHint h : hints) {
                    if (h == null) continue;
                    com.fasterxml.jackson.databind.node.ObjectNode o = arr.addObject();
                    o.put("channel", h.channel());
                    o.put("state", h.state());
                    o.put("kind", h.kind());
                    putIf(o, "episodeId", h.episodeId());
                    putIf(o, "subjectId", h.subjectId());
                    putIf(o, "videoFp", h.videoFp());
                    if (h.assetId() != null) o.put("assetId", h.assetId());
                    putIf(o, "url", h.url());
                    putIf(o, "filePath", h.filePath());
                    if (h.updatedAt() != null) o.put("updatedAt", h.updatedAt());
                }
                return MAPPER.writeValueAsString(arr);
            } catch (Exception e) {
                return null;
            }
        }

        private static void putIf(com.fasterxml.jackson.databind.node.ObjectNode o, String key, String value) {
            if (value != null) o.put(key, value);
        }

        public static List<ChannelHint> decode(String json) {
            if (json == null || json.isBlank()) return List.of();
            try {
                com.fasterxml.jackson.databind.JsonNode root = MAPPER.readTree(json);
                if (root == null || !root.isArray()) return List.of();
                List<ChannelHint> out = new ArrayList<>();
                for (com.fasterxml.jackson.databind.JsonNode n : root) {
                    if (n == null || !n.isObject()) continue;
                    String channel = text(n, "channel");
                    String state = text(n, "state");
                    String kind = text(n, "kind");
                    String episodeId = text(n, "episodeId");
                    String subjectId = text(n, "subjectId");
                    String videoFp = text(n, "videoFp");
                    Long assetId = longOf(n, "assetId");
                    String url = text(n, "url");
                    String filePath = text(n, "filePath");
                    Long updatedAt = longOf(n, "updatedAt");
                    out.add(new ChannelHint(channel, state, kind, episodeId, subjectId, videoFp,
                            assetId, url, filePath, updatedAt));
                }
                return out;
            } catch (Exception e) {
                return List.of();
            }
        }

        private static String text(com.fasterxml.jackson.databind.JsonNode n, String key) {
            com.fasterxml.jackson.databind.JsonNode v = n.get(key);
            return v == null || v.isNull() ? null : v.asText();
        }

        private static Long longOf(com.fasterxml.jackson.databind.JsonNode n, String key) {
            com.fasterxml.jackson.databind.JsonNode v = n.get(key);
            return v == null || v.isNull() || !v.isNumber() ? null : v.asLong();
        }

        /** 追加/替换一条 hint：同 channel 同 kind 覆盖旧值，否则追加。 */
        public static List<ChannelHint> upsert(List<ChannelHint> base, ChannelHint hint) {
            List<ChannelHint> out = new ArrayList<>();
            boolean replaced = false;
            if (base != null) {
                for (ChannelHint h : base) {
                    if (h != null && h.channel() != null && h.channel().equals(hint.channel())
                            && h.kind() != null && h.kind().equals(hint.kind())) {
                        out.add(hint);
                        replaced = true;
                    } else {
                        out.add(h);
                    }
                }
            }
            if (!replaced) out.add(hint);
            return out;
        }

        /** 按渠道优先级取第一个 PRESENT 的 hint（管线主选），无则取第一个 PENDING（提示可预取），再无返回 null。 */
        public static ChannelHint firstActionable(List<ChannelHint> hints) {
            if (hints == null || hints.isEmpty()) return null;
            List<ChannelHint> sorted = new ArrayList<>(hints);
            sorted.sort(Comparator.comparingInt(h -> {
                MaterializationChannel c = MaterializationChannel.parse(h.channel());
                return c == null ? 99 : c.priority();
            }));
            for (ChannelHint h : sorted) {
                if (h.isPresent()) return h;
            }
            for (ChannelHint h : sorted) {
                if (h.isPending()) return h;
            }
            return null;
        }
    }
}
