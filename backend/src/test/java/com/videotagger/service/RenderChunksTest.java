package com.videotagger.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 分块规划与拼接清单：纯函数，重点锁死两个 spike 实测出来的硬要求。 */
class RenderChunksTest {

    @Test
    void 按两分钟一块切分() {
        // 24fps、2 分钟 = 2880 帧；3600 帧 → 2 块（2880 + 720）
        List<RenderChunks.Chunk> chunks = RenderChunks.plan(3600, 24);
        assertEquals(2, chunks.size());
        assertEquals(0, chunks.get(0).fromFrame());
        assertEquals(2879, chunks.get(0).toFrame());
        assertEquals(2880, chunks.get(1).fromFrame());
        assertEquals(3599, chunks.get(1).toFrame());
        assertEquals(3600, chunks.stream().mapToInt(RenderChunks.Chunk::frames).sum());
    }

    @Test
    void 边界与退化输入() {
        assertTrue(RenderChunks.plan(0, 24).isEmpty());
        assertTrue(RenderChunks.plan(-5, 24).isEmpty());
        assertEquals(1, RenderChunks.plan(1, 24).size());
        assertEquals(1, RenderChunks.plan(2880, 24).size(), "正好一块不要切成两块");
        assertEquals(2, RenderChunks.plan(2881, 24).size(), "多一帧也要有第二块");
    }

    @Test
    void 块文件名按序号补零() {
        assertEquals("chunk-000.mp4", RenderChunks.chunkFileName(0));
        assertEquals("chunk-007.mp4", RenderChunks.chunkFileName(7));
    }

    @Test
    void 拼接清单每个文件后面都要写duration() {
        // spike 实测：不写 duration，块之间的时间戳会差约 0.18s（块 0 结束 5.9667s、块 1 从 6.144s 起），
        // 拼接后画面对不上（PSNR 53dB → 23dB）。这条断言就是那道防线。
        String list = RenderChunks.concatList(RenderChunks.plan(3600, 24), 24);
        assertEquals("file 'chunk-000.mp4'\nduration 120.000\nfile 'chunk-001.mp4'\nduration 30.000\n", list);
        assertTrue(list.lines().filter(l -> l.startsWith("duration ")).count() == 2, "每个 file 都要跟一条 duration");
    }

    /** 真实草稿的段边界（来自 render-recommend.ts --probe，POC 输入）。 */
    private static final List<Integer> POC = List.of(0, 165, 300, 360, 513, 573, 813, 873, 1023, 1173);

    @Test
    void 按段边界切_切点都落在边界上且覆盖完整() {
        // target 取 300 帧（10s）便于观察：每块 ≥ 300 帧、切点必须是段边界
        List<RenderChunks.Chunk> chunks = RenderChunks.planByBoundaries(POC, 1173, 300);
        for (RenderChunks.Chunk c : chunks) {
            assertTrue(POC.contains(c.toFrame() + 1) || c.toFrame() == 1172, "切点应落在段边界上: " + c);
        }
        assertEquals(0, chunks.get(0).fromFrame());
        assertEquals(1172, chunks.get(chunks.size() - 1).toFrame());
        for (int i = 1; i < chunks.size(); i++) {
            assertEquals(chunks.get(i - 1).toFrame() + 1, chunks.get(i).fromFrame(), "块必须首尾相接");
        }
        assertEquals(1173, chunks.stream().mapToInt(RenderChunks.Chunk::frames).sum(), "总帧数必须不变");
    }

    @Test
    void 超长段在段内按目标长度细分() {
        // 一段 0..99，然后是超长段 100..5099（5000 帧）；target 1000
        List<RenderChunks.Chunk> chunks = RenderChunks.planByBoundaries(List.of(0, 100, 5100), 5100, 1000);
        assertEquals(5100, chunks.stream().mapToInt(RenderChunks.Chunk::frames).sum());
        for (RenderChunks.Chunk c : chunks) {
            assertTrue(c.frames() <= 2000, "块长不该爆炸（最大 = 两片）: " + c.frames());
        }
        // 第一块会把 100 帧的小段合并进来 → ≥ 1000
        assertTrue(chunks.get(0).frames() >= 1000, "除最后一块外都应 ≥ target");
    }

    @Test
    void 没有边界时回退固定切法() {
        assertTrue(RenderChunks.parseBoundaryFrames("{\"durationInFrames\":1173}").isEmpty());
        assertEquals(List.of(0, 165, 1173), RenderChunks.parseBoundaryFrames("{\"boundaryFrames\":[0,165,1173]}"));
        assertEquals(List.of(0, 165), RenderChunks.parseBoundaryFrames("x{\"boundaryFrames\":[0,1]} y{\"boundaryFrames\":[0,165]}"),
                "多条取最后一条（与进度解析同口径）");
    }

    @Test
    void 段边界退化输入不炸() {
        assertEquals(1, RenderChunks.planByBoundaries(List.of(), 100, 1000).size());
        assertEquals(100, RenderChunks.planByBoundaries(List.of(50, 50, 9999), 100, 1000).stream()
                .mapToInt(RenderChunks.Chunk::frames).sum(), "去重/越界裁剪后仍要覆盖完整");
    }
}
