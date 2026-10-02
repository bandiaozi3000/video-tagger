package com.videotagger.service;

import java.util.ArrayList;
import java.util.List;

/**
 * 分块渲染的**纯计算**部分（可单测，不碰进程/文件）——2026-09-21 下期实现。
 *
 * 为什么分块：Remotion **没有暂停**，只有 `frameRange` 分段 + `cancelSignal` 取消。
 * 所以「暂停 / 断点续渲 / 异常从上次进度继续」共用同一套机制：每块渲成一个 mp4，
 * 块之间可以自由停；全部完成后再 `ffmpeg -f concat -c copy` 拼成成品。
 *
 * 两个 spike 实测得到的硬性要求（写死在 {@link #concatList} 里，有回归测试）：
 *   1. 每块必须带音轨（Remotion 侧 `enforceAudioTrack`），否则 `-c copy` 按流索引对齐会丢音频；
 *   2. 拼接清单每个文件后面必须写 `duration <秒>`，否则块之间的时间戳有约 0.18s 空洞
 *      （实测：块 0 结束在 5.9667s，块 1 却从 6.144s 起）。
 */
public final class RenderChunks {

    /** 一块的成片时长（秒）：2 分钟（用户 2026-09-21 拍板）。 */
    public static final int CHUNK_SECONDS = 120;

    private RenderChunks() {
    }

    /** 一块的帧数（按合成 fps 换算，至少 1 帧）。 */
    public static int chunkFrames(int fps) {
        return Math.max(1, CHUNK_SECONDS * Math.max(1, fps));
    }

    /** 一段 [起始帧, 结束帧]（含两端）——与 Remotion `frameRange` 的语义一致。 */
    public record Chunk(int index, int fromFrame, int toFrame) {

        public int frames() {
            return toFrame - fromFrame + 1;
        }
    }

    /**
     * 把总帧数切成若干块。
     *
     * @param totalFrames 合成总帧数
     * @param fps         合成帧率
     * @return 至少一块；`totalFrames <= 0` 时返回空表（调用方按错误处理）
     */
    public static List<Chunk> plan(int totalFrames, int fps) {
        List<Chunk> chunks = new ArrayList<>();
        if (totalFrames <= 0) {
            return chunks;
        }
        int span = chunkFrames(fps);
        int index = 0;
        for (int from = 0; from < totalFrames; from += span) {
            int to = Math.min(totalFrames - 1, from + span - 1);
            chunks.add(new Chunk(index++, from, to));
        }
        return chunks;
    }

    /** 块文件名（放在工作目录里，续渲时按存在与否跳过）。 */
    public static String chunkFileName(int index) {
        return String.format("chunk-%03d.mp4", index);
    }

    /**
     * `ffmpeg -f concat` 的清单内容。
     *
     * **每个 file 后面都要写 `duration`**：这是 spike 实测出来的 —— 不写就会出现约 0.18s 的空洞
     * （Remotion 分块的音频对齐会让第二块的首帧时间戳往后挪），拼接后画面对不上（PSNR 从 53dB 掉到 23dB）。
     *
     * @param chunks 块列表（顺序即拼接顺序）
     * @param fps    合成帧率，用来把块帧数换算成秒
     */
    public static String concatList(List<Chunk> chunks, int fps) {
        return concatList(chunks, fps, RenderChunks::chunkFileName);
    }

    /**
     * 拼接清单（自定义文件来源）：增量更新会把**复用块**指到旧工作目录、新渲块指到本轮目录 ——
     * 清单里因此可能是绝对路径，`concatChunks` 那边已带 `-safe 0`。
     *
     * ⚠️ 每项后面的 `duration` **一个都不能少**（`ffmpeg -f concat` 少了它块间会出现 ~0.18s 空洞）。
     */
    public static String concatList(List<Chunk> chunks, int fps, java.util.function.IntFunction<String> fileOf) {
        StringBuilder sb = new StringBuilder();
        for (Chunk chunk : chunks) {
            sb.append("file '").append(fileOf.apply(chunk.index())).append("'\n");
            sb.append("duration ").append(seconds(chunk.frames(), fps)).append('\n');
        }
        return sb.toString();
    }

    /** 帧数 → 秒（3 位小数，够 1/1000 帧的精度）。 */
    public static String seconds(int frames, int fps) {
        double value = frames / (double) Math.max(1, fps);
        return String.format(java.util.Locale.ROOT, "%.3f", value);
    }

    /**
     * 按**时间轴段边界**切块（2026-09-21 追加）：切点尽量落在转场处，而不是把某个片段拦腰截断。
     *
     * 算法（两步，全是纯计算）：
     * 1. 先把每个段切成**不超过 target 的原子片**（超长段 —— 真实数据里有 560s 的片段 —— 在段内按 target 细分）；
     * 2. 再**贪心合并**相邻原子片，直到累计 ≥ target 才切一刀。
     *
     * 效果：每块 = 整数个段（或超长段内的整数片），块长 ≥ target（最后一块除外），
     * 且**恰好覆盖** `[0, totalFrames)`，不重不漏。
     *
     * @param boundaryFrames 段边界帧（升序，含 0；不含 totalFrames 也行），来自渲染脚本的 `--probe`
     * @param totalFrames    合成总帧数
     * @param targetFrames   目标块长（帧）
     */
    public static List<Chunk> planByBoundaries(List<Integer> boundaryFrames, int totalFrames, int targetFrames) {
        List<Chunk> chunks = new ArrayList<>();
        if (totalFrames <= 0) {
            return chunks;
        }
        int target = Math.max(1, targetFrames);

        // 1) 段列表：去重、排序、裁到 [0, totalFrames]，并补齐末尾
        java.util.TreeSet<Integer> cuts = new java.util.TreeSet<>();
        cuts.add(0);
        if (boundaryFrames != null) {
            for (Integer b : boundaryFrames) {
                if (b != null && b > 0 && b < totalFrames) {
                    cuts.add(b);
                }
            }
        }
        cuts.add(totalFrames);
        List<int[]> segments = new ArrayList<>();
        Integer prev = null;
        for (Integer cut : cuts) {
            if (prev != null) {
                segments.add(new int[]{prev, cut});
            }
            prev = cut;
        }

        // 2) 每段切原子片（≤ target），再贪心合并
        List<int[]> pieces = new ArrayList<>();
        for (int[] seg : segments) {
            int from = seg[0];
            while (from < seg[1]) {
                int to = Math.min(seg[1], from + target);
                pieces.add(new int[]{from, to});
                from = to;
            }
        }
        int index = 0;
        int start = 0;
        int acc = 0;
        for (int[] piece : pieces) {
            acc += piece[1] - piece[0];
            if (acc >= target) {
                chunks.add(new Chunk(index++, start, piece[1] - 1));
                start = piece[1];
                acc = 0;
            }
        }
        if (start < totalFrames) {
            chunks.add(new Chunk(index, start, totalFrames - 1));
        }
        return chunks;
    }

    /** 从脚本 `--probe` 输出里取 `"boundaryFrames":[0,165,...]`（拿不到就返回空表 → 回退固定分块）。 */
    public static List<Integer> parseBoundaryFrames(String output) {
        List<Integer> frames = new ArrayList<>();
        if (output == null || output.isBlank()) {
            return frames;
        }
        var matcher = java.util.regex.Pattern.compile("\"boundaryFrames\"\\s*:\\s*\\[([0-9,\\s]*)\\]").matcher(output);
        String body = null;
        while (matcher.find()) {
            body = matcher.group(1);   // 取最后一条（与进度解析同口径）
        }
        if (body == null || body.isBlank()) {
            return frames;
        }
        for (String part : body.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                frames.add(Integer.parseInt(trimmed));
            }
        }
        return frames;
    }
}
