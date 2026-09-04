package com.videotagger.videosource.torrent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TorrentTitleParserTest {

    @Test
    @DisplayName("国际组方括号 + 集号 + 分辨率")
    void internationalGroup() {
        TorrentTitleInfo info = TorrentTitleParser.parse("[SubsPlease] Solo Leveling S2 - 01 (1080p) [Multi-Subs]");
        assertEquals("SubsPlease", info.group());
        assertEquals(1080, RankedCandidate.height(info.resolution()));
        assertEquals(List.of(1), info.episodes());
        assertFalse(info.batch());
        assertNull(info.codec());
    }

    @Test
    @DisplayName("BDrip 像素分辨率 + x265")
    void pixelResolutionAndX265() {
        TorrentTitleInfo info = TorrentTitleParser.parse("[Moozzi2] Spice and Wolf S2 - 01 (BDrip 1920x1080 x265 flac)");
        assertEquals("Moozzi2", info.group());
        assertEquals("1080p", info.resolution());
        assertEquals("x265", info.codec());
        assertEquals(List.of(1), info.episodes());
    }

    @Test
    @DisplayName("中文组【】前缀 + 第N集")
    void chineseGroupMarkedEpisode() {
        TorrentTitleInfo info = TorrentTitleParser.parse("【爱恋字幕社】葬送的芙莉莲 第24集 [1080p]");
        assertEquals("爱恋字幕社", info.group());
        assertEquals(List.of(24), info.episodes());
        assertEquals("1080p", info.resolution());
    }

    @Test
    @DisplayName("RAW 组 ANK 风格无 E 前缀集号（取末位独立数字）")
    void rawNoPrefixEpisode() {
        TorrentTitleInfo info = TorrentTitleParser.parse("[ANK-Raws] リコリス・リコイル 01 (BDrip 1920x1080 x264 FLAC)");
        assertEquals("ANK-Raws", info.group());
        assertEquals(List.of(1), info.episodes());
    }

    @Test
    @DisplayName("不被 1080p / 4K / 10bit / S2 / x 里的数字误抓")
    void ignoresFakeEpisodeNumbers() {
        TorrentTitleInfo info = TorrentTitleParser.parse("[Erai-raws] Jujutsu Kaisen Season 2 - 12 [1080p][10bit][Multi-Subs]");
        assertEquals(List.of(12), info.episodes(), "应只抓到短横线后的 12");
        TorrentTitleInfo tv = TorrentTitleParser.parse("[SubsPlease] Spy x Family S2 - 03 (1080p)");
        assertEquals(List.of(3), tv.episodes(), "Spy x Family 里的数字不得当集号");
        TorrentTitleInfo movie = TorrentTitleParser.parse("[Erai-raws] Detective Conan - Movie 26 (1080p)");
        assertTrue(movie.episodes().isEmpty(), "标题尾部分部编号不应误当集号");
    }

    @Test
    @DisplayName("合集包识别：区间 / Batch / 全集")
    void batchDetection() {
        assertTrue(TorrentTitleParser.parse("[Erai-raws] Mashle S2 - Batch [01-12] (1080p)").batch());
        assertTrue(TorrentTitleParser.parse("【VCB-Studio】孤独摇滚！[01-12] 全12话 [BDRip 1080p]").batch());
        assertFalse(TorrentTitleParser.parse("[SubsPlease] Frieren - 01 (1080p)").batch());
    }

    @Test
    @DisplayName("语种/字幕线索与来源")
    void hints() {
        TorrentTitleInfo info = TorrentTitleParser.parse("[SweetSub] 葬送的芙莉莲 第05话 [简日双语][1080p][BDRip]");
        assertEquals("BDRip", info.releaseSource());
        assertTrue(info.languageHint() != null && info.languageHint().contains("简日"));
        assertNull(TorrentTitleParser.parse("随便一个标题").group());
    }
}
