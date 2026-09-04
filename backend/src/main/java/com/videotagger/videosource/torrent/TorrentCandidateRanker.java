package com.videotagger.videosource.torrent;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** 候选排序器（v0.25 D1 纯函数）：档位优先（RAW>SOFT>UNKNOWN>HARD），级内
 *  分辨率降序 → x264 优先 → 体积升序 → 原始顺序稳定。输入顺序即"站点返回顺序"兜底。 */
public final class TorrentCandidateRanker {

    private TorrentCandidateRanker() {
    }

    public static List<RankedCandidate> rank(List<RankedCandidate> candidates) {
        List<RankedCandidate> list = new ArrayList<>(candidates);
        list.sort(Comparator
                .comparingInt((RankedCandidate c) -> c.tier().rank())
                .thenComparing(Comparator.comparingInt((RankedCandidate c) -> c.resolutionHeight()).reversed())
                .thenComparing(c -> codecPref(c.codec()))
                .thenComparingLong(c -> c.bytes() < 0 ? Long.MAX_VALUE : c.bytes()));
        return list;
    }

    /** x264 家族排前（D1：素材导出链路省事）；x265/AV1/未知同列于后。 */
    private static int codecPref(String codec) {
        String c = codec == null ? "" : codec.toLowerCase(Locale.ROOT);
        if (c.contains("x264") || c.contains("h264") || c.contains("avc")) {
            return 0;
        }
        return 1;
    }
}
