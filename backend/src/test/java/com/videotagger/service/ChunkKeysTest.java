package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 块键（增量更新 P1）的 Java 半边：probe 键解析、装配、按键复用。
 *
 * 三条要点：
 *   1. **不自洽一律退全渲**（返回空表 / 全 pending）—— 键只用于省时间，绝不能让省时间变成错片；
 *   2. 复用**按内容键**而不是按下标（插段会让块整体错位）；
 *   3. 序列化 ↔ 解析要能往返回任务行列那一份。
 */
class ChunkKeysTest {

    private static RenderChunks.Chunk chunk(int index, int from, int to) {
        return new RenderChunks.Chunk(index, from, to);
    }

    @Test
    void 解析probe键并装配块键() {
        String probe = "{\"composition\":true,\"durationInFrames\":300,\"fps\":30,\"boundaryFrames\":[0,100,200,300],"
                + "\"globalKey\":\"0123456789abcdef\",\"segmentKeys\":[\"aaaaaaaaaaaaaaaa\",\"bbbbbbbbbbbbbbbb\",\"cccccccccccccccc\"]}";
        List<String> parsed = ChunkKeys.parseProbeKeys(probe);
        assertEquals("0123456789abcdef", parsed.get(0));
        assertEquals(List.of("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", "cccccccccccccccc"), parsed.subList(1, parsed.size()));

        // 三块 = 一段一块
        List<String> keys = ChunkKeys.assemble(parsed.get(0), parsed.subList(1, parsed.size()),
                List.of(0, 100, 200, 300), List.of(chunk(0, 0, 99), chunk(1, 100, 199), chunk(2, 200, 299)));
        assertEquals(3, keys.size());
        assertEquals(64, keys.get(0).length());
        assertFalse(keys.get(0).equals(keys.get(1)));

        // 一块 = 两段：键必须与"把两段拼起来"等价，且与单段块不同
        List<String> merged = ChunkKeys.assemble(parsed.get(0), parsed.subList(1, parsed.size()),
                List.of(0, 100, 200, 300), List.of(chunk(0, 0, 199), chunk(1, 200, 299)));
        assertEquals(2, merged.size());
        assertEquals(merged.get(1), keys.get(2), "同一段的块键必须可复现");
    }

    @Test
    void 段数对不上或块没盖住整段时退全渲() {
        // 段键数量 ≠ 边界推出的段数
        assertTrue(ChunkKeys.assemble("0123456789abcdef", List.of("aaaaaaaaaaaaaaaa"),
                List.of(0, 100, 200, 300), List.of(chunk(0, 0, 299))).isEmpty());
        // 块起点落在段中间（不该发生）→ 不自洽
        assertTrue(ChunkKeys.assemble("0123456789abcdef", List.of("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"),
                List.of(0, 100, 200), List.of(chunk(0, 50, 99))).isEmpty());
        // 没有全局键/段键
        assertTrue(ChunkKeys.assemble(null, List.of("aaaaaaaaaaaaaaaa"), List.of(0, 100), List.of(chunk(0, 0, 99))).isEmpty());
        assertTrue(ChunkKeys.assemble("0123456789abcdef", List.of(), List.of(0, 100), List.of(chunk(0, 0, 99))).isEmpty());
    }

    @Test
    void 复用按键匹配而不是按下标() {
        ChunkKeys.Entry a = new ChunkKeys.Entry("a".repeat(64), "chunk-000.mp4");
        ChunkKeys.Entry b = new ChunkKeys.Entry("b".repeat(64), "chunk-001.mp4");
        ChunkKeys.Entry c = new ChunkKeys.Entry("c".repeat(64), "chunk-002.mp4");
        // 新的一轮：多了一段插在前面 → 第一块变成全新的，后两块顺序也变了（内容键仍是同两个）
        ChunkKeys.ReusePlan plan = ChunkKeys.planReuse(
                List.of(a, b, c),
                List.of("d".repeat(64), c.key(), b.key()));
        assertEquals(2, plan.reuse().size());
        assertEquals("chunk-002.mp4", plan.reuse().get(1), "按内容键复用的应是 c 那块");
        assertEquals("chunk-001.mp4", plan.reuse().get(2));
        assertEquals(List.of(0), plan.pending());
        assertFalse(plan.allChanged());
    }

    @Test
    void 同一旧产物不会被两块复用() {
        ChunkKeys.Entry a = new ChunkKeys.Entry("a".repeat(64), "chunk-000.mp4");
        ChunkKeys.ReusePlan plan = ChunkKeys.planReuse(List.of(a), List.of(a.key(), a.key()));
        assertEquals(Map.of(0, "chunk-000.mp4"), plan.reuse());
        assertEquals(List.of(1), plan.pending());
    }

    @Test
    void 没有旧键时全部重渲() {
        ChunkKeys.ReusePlan plan = ChunkKeys.planReuse(List.of(), List.of("a".repeat(64), "b".repeat(64)));
        assertTrue(plan.reuse().isEmpty());
        assertEquals(List.of(0, 1), plan.pending());
        assertTrue(plan.allChanged());
    }

    @Test
    void 行列里的键能往返() {
        List<ChunkKeys.Entry> entries = List.of(
                new ChunkKeys.Entry("a".repeat(64), "chunk-000.mp4"),
                new ChunkKeys.Entry("b".repeat(64), "inc-20261001-150000/chunk-3.mp4"));
        assertEquals(entries, ChunkKeys.parseEntries(ChunkKeys.toJson(entries)));
        assertEquals(List.of(), ChunkKeys.parseEntries(null));
        assertEquals(List.of(), ChunkKeys.parseEntries("坏数据"));
        assertEquals(null, ChunkKeys.toJson(List.of()));
    }
}
