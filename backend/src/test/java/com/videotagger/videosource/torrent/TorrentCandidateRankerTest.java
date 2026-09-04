package com.videotagger.videosource.torrent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TorrentCandidateRankerTest {

    private static RankedCandidate c(String provider, String id, String title, long bytes) {
        return RankedCandidate.fromTitle(provider, id, title, bytes);
    }

    @Test
    @DisplayName("档位优先：RAW 720p 胜过 SOFT/UNKNOWN/HARD 的 1080p")
    void tierBeatsResolution() {
        List<RankedCandidate> ranked = TorrentCandidateRanker.rank(List.of(
                c("nyaa", "a", "[FansubX] Frieren 第05话 [1080p]", 500_000_000L),          // UNKNOWN 1080p
                c("dmhy", "b", "【千夏字幕组】葬送的芙莉莲 第24集 [1080p]", 400_000_000L),     // SOFT 1080p
                c("nyaa", "c", "[SubsPlease] Frieren - 05 (720p)", 200_000_000L),           // RAW 720p
                c("nyaa", "d", "[BadSub] Frieren - 05 [hardsub][1080p]", 300_000_000L)));   // HARD 1080p
        assertEquals(SubtitleTier.RAW, ranked.get(0).tier(), "RAW 720p 应排第一（档位优先于清晰度）");
        assertEquals(SubtitleTier.HARD, ranked.get(3).tier(), "HARD 应垫底");
    }

    @Test
    @DisplayName("级内 tiebreak：分辨率降序 → x264 优先 → 体积升序")
    void intraTierTiebreak() {
        List<RankedCandidate> ranked = TorrentCandidateRanker.rank(List.of(
                c("nyaa", "a", "[Erai-raws] X S1 - 01 [720p]", 300_000_000L),
                c("nyaa", "b", "[Erai-raws] X S1 - 01 [1080p][x265]", 600_000_000L),
                c("nyaa", "c", "[Erai-raws] X S1 - 01 [1080p][x264]", 800_000_000L),
                c("nyaa", "d", "[Erai-raws] X S1 - 01 [1080p][x264]", 700_000_000L)));
        assertEquals("d", ranked.get(0).itemId(), "1080p x264 且体积最小者第一");
        assertEquals("c", ranked.get(1).itemId(), "1080p x264 体积次小");
        assertEquals("b", ranked.get(2).itemId(), "x265 排 x264 之后");
        assertEquals("a", ranked.get(3).itemId(), "720p 垫底");
    }

    @Test
    @DisplayName("同级同特征保持输入顺序（稳定）")
    void stableOrder() {
        List<RankedCandidate> ranked = TorrentCandidateRanker.rank(List.of(
                c("nyaa", "x1", "[Erai-raws] Frieren - 01 [1080p]", 1L),
                c("nyaa", "x2", "[Erai-raws] Frieren - 01 [1080p]", 1L)));
        assertEquals(List.of("x1", "x2"), ranked.stream().map(RankedCandidate::itemId).toList());
    }

    @Test
    @DisplayName("未知体积（-1）排同特征之后")
    void unknownBytesLast() {
        List<RankedCandidate> ranked = TorrentCandidateRanker.rank(List.of(
                c("nyaa", "u", "[Erai-raws] X - 02 [1080p]", -1L),
                c("nyaa", "k", "[Erai-raws] X - 02 [1080p]", 10_000_000L)));
        assertEquals("k", ranked.get(0).itemId());
        assertTrue(ranked.get(1).bytes() < 0);
    }
}
