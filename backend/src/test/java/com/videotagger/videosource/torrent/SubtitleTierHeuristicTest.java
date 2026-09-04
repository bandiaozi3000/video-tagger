package com.videotagger.videosource.torrent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SubtitleTierHeuristicTest {

    @Test
    @DisplayName("RAW 组白名单 → RAW")
    void rawGroups() {
        assertEquals(SubtitleTier.RAW, tier("[SubsPlease] Frieren - 01 (1080p)"));
        assertEquals(SubtitleTier.RAW, tier("[Erai-raws] Jujutsu Kaisen S2 - 12 [1080p]"));
        assertEquals(SubtitleTier.RAW, tier("[Moozzi2] Spice and Wolf - 01 (BDrip 1080p)"));
        assertEquals(SubtitleTier.RAW, tier("[ANK-Raws] リコリス・リコイル 01 (BDrip)"));
    }

    @Test
    @DisplayName("字幕组白名单 → SOFT（惯例内封/外挂）")
    void softGroups() {
        assertEquals(SubtitleTier.SOFT, tier("[VCB-Studio] 孤独摇滚！[BDRip 1080p HEVC]"));
        assertEquals(SubtitleTier.SOFT, tier("[LoliHouse] 莉可丽丝 [WebRip 1080p HEVC]"));
        assertEquals(SubtitleTier.SOFT, tier("【爱恋字幕社】葬送的芙莉莲 第24集 [1080p]"));
        assertEquals(SubtitleTier.SOFT, tier("【千夏字幕组】我心危 第05集 [1080p]"));
    }

    @Test
    @DisplayName("显式软字幕词（含 RAW 组发多字幕版）→ SOFT")
    void explicitSoftTokens() {
        assertEquals(SubtitleTier.SOFT, tier("[SubsPlease] Frieren - 01 (1080p) [Multi-Subs]"));
        assertEquals(SubtitleTier.SOFT, tier("[Erai-raws] DanMachi S5 - 06 [1080p][Multiple Subtitle]"));
        assertEquals(SubtitleTier.SOFT, tier("【某组】香格里拉 第03话 [外挂字幕][1080p]"));
    }

    @Test
    @DisplayName("显式硬字幕词 → HARD（强于组白名单）")
    void explicitHardTokenWins() {
        assertEquals(SubtitleTier.HARD, tier("[SomeSub] 摇曳露营 第02集 [hardsub][720p]"));
        assertEquals(SubtitleTier.HARD, tier("【压片组】败犬女主 第01话 [内嵌硬字幕][1080p]"));
    }

    @Test
    @DisplayName("未知组无字幕词 → UNKNOWN（精判对象）")
    void unknownFallback() {
        assertEquals(SubtitleTier.UNKNOWN, tier("[随机组名] 某番 S1 - 03 (1080p)"));
        assertEquals(SubtitleTier.UNKNOWN, tier("[FansubXYZ] Frieren 第08话 [1080p][10bit]"));
    }

    private static SubtitleTier tier(String title) {
        return SubtitleTierHeuristic.guess(TorrentTitleParser.parse(title)).tier();
    }
}
