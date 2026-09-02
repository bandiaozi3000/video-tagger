package com.videotagger.material;

import java.util.List;

/**
 * 素材化渠道（v0.24 M3）。Clip 通过 {@code channel_hints} 携带"这集视频可以从哪来"的线索，
 * 素材化管线按 C1 → C2 → C3 → C4 依次求值，取首个可用的源。
 *
 * <ul>
 *   <li><b>C1 本地文件池</b>：{@code data/videos} 按 videoFp 指纹命中（v0.19 既有约定 + 精确裁剪）。</li>
 *   <li><b>C2 Animeko</b>：Bangumi episodeId → Animeko 本地缓存/整集文件（读 Animeko cache registry，
 *       缺文件时标记 pending，可由 fork CLI 批量预取）。</li>
 *   <li><b>C3 网页直链</b>：受限 URL + Referer/UA 中继 + 断点下载任务（v0.23 引擎）。</li>
 *   <li><b>C4 录屏回退</b>：getDisplayMedia 低精度兜底（仅标记，由前端引导）。</li>
 * </ul>
 *
 * 语义：{@code channel_hints} 中每条 hint 的 state 表达"该线索当前是否可提供文件"：
 * present=文件/URL 此刻可用；pending=已知出处但文件不在场（可预取）；unavailable=不可用。
 * 管线消费最高优先级（编号最小）的 present 线索；全无则产物标记缺素材（REFERENCE_ONLY）。
 */
public enum MaterializationChannel {
    C1(1, "本地文件池"),
    C2(2, "Animeko 缓存"),
    C3(3, "网页直链"),
    C4(4, "录屏回退");

    public static final String C1_LOCAL = "C1";
    public static final String C2_ANIMEKO = "C2";
    public static final String C3_WEB = "C3";
    public static final String C4_SCREEN = "C4";

    private final int priority;
    private final String label;

    MaterializationChannel(int priority, String label) {
        this.priority = priority;
        this.label = label;
    }

    public int priority() {
        return priority;
    }

    public String label() {
        return label;
    }

    public String code() {
        return name();
    }

    /** 线索可用状态。 */
    public enum State {
        /** 文件/URL 此刻可用（管线可消费） */
        PRESENT,
        /** 已知出处但文件不在场（可预取，例如 Animeko 缓存被清理） */
        PENDING,
        /** 不可用 */
        UNAVAILABLE
    }

    public static MaterializationChannel parse(String code) {
        if (code == null) return null;
        for (MaterializationChannel c : values()) {
            if (c.name().equalsIgnoreCase(code.trim())) return c;
        }
        return null;
    }

    /** 按渠道优先级排序（C1 最小 = 最高优先）。 */
    public static List<MaterializationChannel> inPriorityOrder() {
        return List.of(C1, C2, C3, C4);
    }
}
