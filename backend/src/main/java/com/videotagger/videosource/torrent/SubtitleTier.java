package com.videotagger.videosource.torrent;

/** 候选版本的字幕分档（v0.25 D1：级联优先 RAW > 字幕分离 > 硬烧）。
 *  档位是"启发式优先，可被精判复核"的中间产物，见 {@link SubtitleTierHeuristic}。 */
public enum SubtitleTier {
    /** 完全无字幕轨（画面最干净，剪辑首选） */
    RAW(0),
    /** 字幕分离：内封可关软字幕轨，或外挂 .ass/.srt 文件 */
    SOFT(1),
    /** 启发式无法判定（可成为 swarm 精判对象） */
    UNKNOWN(2),
    /** 硬烧内嵌字幕（最后兜底档） */
    HARD(3);

    private final int rank;

    SubtitleTier(int rank) {
        this.rank = rank;
    }

    /** 排序用序号：越小越优先（RAW=0 … HARD=3）。 */
    public int rank() {
        return rank;
    }
}
