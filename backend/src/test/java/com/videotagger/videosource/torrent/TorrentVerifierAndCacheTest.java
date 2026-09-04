package com.videotagger.videosource.torrent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TorrentVerifierAndCacheTest {

    @Test
    @DisplayName("精判：外挂字幕文件把 UNKNOWN/HARD 提到 SOFT（FILE_LIST）")
    void externalSubtitlesUpgradeToSoft() {
        RankedCandidate unknown = RankedCandidate.fromTitle("nyaa", "u", "[FansubXYZ] Frieren 第08话 [1080p]", -1);
        RankedCandidate refined = TorrentSubtitleVerifier.refine(unknown, List.of("Frieren_08.mkv", "Frieren_08.chs.ass"));
        assertEquals(SubtitleTier.SOFT, refined.tier());
        assertEquals("FILE_LIST", refined.tierBasis());

        RankedCandidate hard = RankedCandidate.fromTitle("dmhy", "h", "[BadSub] X - 02 [hardsub][1080p]", -1);
        RankedCandidate refined2 = TorrentSubtitleVerifier.refine(hard, List.of("X_02.mp4", "X_02.srt"));
        assertEquals(SubtitleTier.SOFT, refined2.tier());
    }

    @Test
    @DisplayName("精判：纯视频清单维持原档（内封轨需下载后 ffprobe）")
    void pureVideoKeepsTier() {
        RankedCandidate raw = RankedCandidate.fromTitle("nyaa", "r", "[SubsPlease] Frieren - 05 (1080p)", 100L);
        RankedCandidate kept = TorrentSubtitleVerifier.refine(raw, List.of("Frieren_05.mkv"));
        assertSame(raw, kept, "RAW 且无外挂字幕文件 → 维持 RAW 实例");
    }

    @Test
    @DisplayName("精判缓存：放取/覆盖/键列表")
    void cacheRoundTrip() {
        InMemoryTorrentFileListCache cache = new InMemoryTorrentFileListCache();
        assertEquals(Optional.empty(), cache.fileNames("k1"));
        cache.put("k1", List.of("a.mkv", "b.ass"));
        assertEquals(Optional.of(List.of("a.mkv", "b.ass")), cache.fileNames("k1"));
        cache.put("k1", List.of("a.mkv"));
        assertEquals(List.of("a.mkv"), cache.fileNames("k1").orElseThrow());
        assertTrue(cache.keys().contains("k1"));
    }
}
