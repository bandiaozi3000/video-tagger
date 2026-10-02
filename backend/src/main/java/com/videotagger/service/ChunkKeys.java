package com.videotagger.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 「块键」的 Java 半边（2026-10-01 增量更新，设计规格 §4.1/§4.3）。
 *
 * 分工：**TS 说"什么算内容"**（`src/chunk-keys.ts`：全局键 + 每段键，probe 时打印出来），
 * **本类说"哪些块相等"**（把全局键 + 本块各段键拼起来算 sha256 → 按键比对复用）。
 *
 * 为什么不把整个键计算都放 Java：段表（plan）只有 TS 侧有（`scene-plan.ts` / `cinema/plan.ts`），
 * Java 拿到的只有 `boundaryFrames`。反过来"哪些帧算一块"只有 Java 的 `RenderChunks.planByBoundaries` 知道 ——
 * 所以两边各管一半，接口就是 probe 那一行 JSON。
 *
 * ⚠️ 键只用于**比较相等**，不参与画面：任何一处不一致都只是"少复用一块"（多渲），不会出错片。
 *   所以这里的失败策略一律是**退化**（返回空表/退到 pending），绝不抛异常中断渲染。
 */
public final class ChunkKeys {

    /** 一条块键记录：`key` = sha256 十六进制；`file` = **相对任务工作目录**的块产物路径。 */
    public record Entry(String key, String file) {
    }

    /** 复用决策：`reuse` = 新块号 → 旧产物相对路径；`pending` = 必须重渲的新块号。 */
    public record ReusePlan(Map<Integer, String> reuse, List<Integer> pending) {

        /** 没有任何一块能复用（= 等同整片重渲）。 */
        public boolean allChanged() {
            return reuse.isEmpty();
        }
    }

    private static final Pattern GLOBAL_KEY = Pattern.compile("\"globalKey\"\\s*:\\s*\"([0-9a-f]{16})\"");
    private static final Pattern SEGMENT_KEYS = Pattern.compile("\"segmentKeys\"\\s*:\\s*\\[([^\\]]*)\\]");
    private static final Pattern HEX16 = Pattern.compile("[0-9a-f]{16}");
    private static final Pattern ENTRY = Pattern.compile("\"key\"\\s*:\\s*\"([0-9a-f]{64})\"\\s*,\\s*\"file\"\\s*:\\s*\"([^\"]+)\"");

    private ChunkKeys() {
    }

    /**
     * 从 probe 输出里取全局键与段键。
     *
     * 用正则而不是 JSON 库：键是我们自己生成的 **hex**（无转义/无引号风险），
     * 且这段代码在 `RecommendVideoService` 里与 `parseJsonInt`/`parseBoundaryFrames` 同风格 ——
     * 但会**校验数量**（段键数必须等于 probe 里的段数，由调用方比对），对不上就当没有。
     *
     * @return `[globalKey, segmentKeys…]`；取不到返回空数组
     */
    public static List<String> parseProbeKeys(String probeOutput) {
        if (probeOutput == null || probeOutput.isBlank()) {
            return List.of();
        }
        Matcher global = GLOBAL_KEY.matcher(probeOutput);
        String globalKey = null;
        while (global.find()) {
            globalKey = global.group(1);   // 取最后一条（与进度解析同口径）
        }
        Matcher segments = SEGMENT_KEYS.matcher(probeOutput);
        String body = null;
        while (segments.find()) {
            body = segments.group(1);
        }
        if (globalKey == null || body == null) {
            return List.of();
        }
        List<String> keys = new ArrayList<>();
        keys.add(globalKey);
        Matcher hex = HEX16.matcher(body);
        while (hex.find()) {
            keys.add(hex.group());
        }
        return keys.size() > 1 ? keys : List.of();
    }

    /**
     * 把「全局键 + 各段键」装配成**块键**（每块一个 sha256 hex）。
     *
     * 段 i 的帧范围 = `[boundaryFrames[i], boundaryFrames[i+1])`；块由 `planByBoundaries` 生成，
     * 天然是若干**完整段**的并集 —— 所以按帧范围取段索引是精确的（不靠猜）。
     *
     * @return 与 `chunks` 一一对应的块键；**任何不自洽**（段数对不上 / 块没盖住整段）→ 返回空表（调用方退全渲）
     */
    public static List<String> assemble(String globalKey, List<String> segmentKeys, List<Integer> boundaryFrames,
                                        List<RenderChunks.Chunk> chunks) {
        if (globalKey == null || segmentKeys == null || segmentKeys.isEmpty() || chunks == null || chunks.isEmpty()) {
            return List.of();
        }
        TreeSet<Integer> cuts = new TreeSet<>();
        if (boundaryFrames != null) {
            for (Integer cut : boundaryFrames) {
                if (cut != null && cut >= 0) {
                    cuts.add(cut);
                }
            }
        }
        List<Integer> bounds = new ArrayList<>(cuts);
        int segmentCount = bounds.size() - 1;
        if (segmentCount != segmentKeys.size()) {
            return List.of();
        }
        List<String> blockKeys = new ArrayList<>();
        int segment = 0;
        for (RenderChunks.Chunk chunk : chunks) {
            StringBuilder payload = new StringBuilder();
            int covered = 0;
            int coveredStart = -1;
            int coveredEnd = -1;
            while (segment < segmentCount) {
                int from = bounds.get(segment);
                int to = bounds.get(segment + 1);
                if (to <= chunk.fromFrame()) {
                    segment++;                     // 这一段落在这块之前（不该发生；容错跳过）
                    continue;
                }
                if (from > chunk.toFrame()) {
                    break;                         // 这一段属于后面的块
                }
                if (covered == 0) {
                    coveredStart = from;
                }
                payload.append(segmentKeys.get(segment)).append('\u0000');
                covered++;
                coveredEnd = to;
                segment++;
            }
            // 块必须**恰好**是若干完整段的并集：起点落在段首、终点落在段尾（否则退全渲）
            if (covered == 0 || coveredStart != chunk.fromFrame() || coveredEnd - 1 != chunk.toFrame()) {
                return List.of();
            }
            blockKeys.add(sha256(globalKey + '\u0000' + payload));
        }
        return blockKeys;
    }

    /**
     * 按键比对复用（**不按下标**：插入/删除段会让块整体错位，下标匹配会拿错产物）。
     *
     * 规则：同一个旧产物**不允许被两个新块复用**（第二次命中视为 pending → 重渲），
     * 因为同一文件在拼接清单里出现两次的时间戳语义没验过（宁可靠重渲）。
     */
    public static ReusePlan planReuse(List<Entry> oldEntries, List<String> newKeys) {
        Map<String, String> byKey = new LinkedHashMap<>();
        if (oldEntries != null) {
            for (Entry entry : oldEntries) {
                if (entry != null && entry.key() != null && entry.file() != null) {
                    byKey.putIfAbsent(entry.key(), entry.file());   // 同键多个文件时取先出现的
                }
            }
        }
        Map<Integer, String> reuse = new LinkedHashMap<>();
        List<Integer> pending = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (int index = 0; index < (newKeys == null ? 0 : newKeys.size()); index++) {
            String key = newKeys.get(index);
            String file = key == null ? null : byKey.get(key);
            if (file != null && used.add(file)) {
                reuse.put(index, file);
            } else {
                pending.add(index);
            }
        }
        return new ReusePlan(reuse, pending);
    }

    /** 序列化成任务行列里的 TEXT（JSON 数组）。文件路径是我们自己拼的相对路径，无需转义。 */
    public static String toJson(List<Entry> entries) {
        if (entries == null || entries.isEmpty()) {
            return null;
        }
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < entries.size(); i++) {
            Entry entry = entries.get(i);
            if (i > 0) {
                json.append(',');
            }
            json.append("{\"key\":\"").append(entry.key()).append("\",\"file\":\"").append(entry.file()).append("\"}");
        }
        return json.append(']').toString();
    }

    /** 解析任务行里的 TEXT（容忍空/坏数据：解析不出就当没有 → 调用方补算或全渲）。 */
    public static List<Entry> parseEntries(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        List<Entry> entries = new ArrayList<>();
        Matcher matcher = ENTRY.matcher(json);
        while (matcher.find()) {
            entries.add(new Entry(matcher.group(1), matcher.group(2)));
        }
        return entries;
    }

    private static String sha256(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte value : digest) {
                hex.append(Character.forDigit((value >> 4) & 0xf, 16)).append(Character.forDigit(value & 0xf, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }
}
