package com.videotagger.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * faststart 判定：浏览器 <video> 拿到 moov 前解不出帧，moov 在尾的片段会让预览只剩模糊底图
 * （2026-09-21 实测 clip-182/clip-189 都是 moov 在尾）。这里只钉住"盒子走法"的判定。
 */
class RecommendClipSourceServiceFastStartTest {

    /** 造一个只含给定盒子序列的迷你文件（size + type + 填充）。 */
    private static Path file(List<String> boxTypes, Path dir, String name) throws IOException {
        Path p = dir.resolve(name);
        List<byte[]> chunks = new ArrayList<>();
        for (String type : boxTypes) {
            int size = 16;   // 8 字节头 + 8 字节填充
            ByteBuffer buf = ByteBuffer.allocate(size);
            buf.putInt(size);
            buf.put(type.getBytes(StandardCharsets.US_ASCII));
            buf.putLong(0L);
            chunks.add(buf.array());
        }
        byte[] all = new byte[chunks.size() * 16];
        int at = 0;
        for (byte[] c : chunks) {
            System.arraycopy(c, 0, all, at, c.length);
            at += c.length;
        }
        Files.write(p, all);
        return p;
    }

    @Test
    @DisplayName("moov 在 mdat 之前 → faststart；在之后 → 不是")
    void detectsMoovPosition() throws Exception {
        Path dir = Files.createTempDirectory("vt-faststart");
        assertTrue(RecommendClipSourceService.isFastStart(file(List.of("ftyp", "moov", "mdat"), dir, "ok.mp4")));
        assertFalse(RecommendClipSourceService.isFastStart(file(List.of("ftyp", "free", "mdat", "moov"), dir, "tail.mp4")),
                "moov 在文件尾：浏览器要先取尾部才能解帧 → 判定为需要 remux");
    }

    @Test
    @DisplayName("读不懂/结构异常 → 当作需要 remux（宁可多跑一次，不赌）")
    void garbageIsNotFastStart() throws Exception {
        Path dir = Files.createTempDirectory("vt-faststart-bad");
        Path garbage = dir.resolve("garbage.mp4");
        Files.writeString(garbage, "not-an-mp4");
        assertFalse(RecommendClipSourceService.isFastStart(garbage));
        assertFalse(RecommendClipSourceService.isFastStart(dir.resolve("missing.mp4")));
    }
}
