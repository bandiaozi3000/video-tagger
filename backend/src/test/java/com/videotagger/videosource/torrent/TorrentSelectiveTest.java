package com.videotagger.videosource.torrent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TorrentSelectiveTest {

    @Test
    @DisplayName("v2 选择性：从合集文件名里挑第 N 集视频（排除特典/OVA/非视频）")
    void pickEpisodeFiles() {
        List<String> names = List.of(
                "[DBD-Raws] 少女与战车 第01话 [BDRip].mkv",
                "[DBD-Raws] 少女与战车 第02话 [BDRip].mkv",
                "[DBD-Raws] 少女与战车 SP01 特典 [BDRip].mkv",
                "[DBD-Raws] 少女与战车 OVA 01 [BDRip].mkv",
                "[DBD-Raws] 少女与战车 第01话.chs.ass",
                "[DBD-Raws] 目录.txt");
        List<Integer> hit = TorrentClient.selectiveIndices(names, 1);
        assertEquals(List.of(0), hit, "只应选中第01话的 mkv（索引0），字幕/特典/OVA/非视频排除");
    }

    @Test
    @DisplayName("显式 EP/E/SxxEyy 标记与普通数字命名都能命中")
    void explicitMarkersAndPlainNumbers() {
        assertTrue(TorrentClient.selectiveIndices(List.of("Frieren - 05.mkv"), 5).equals(List.of(0)));
        assertTrue(TorrentClient.selectiveIndices(List.of("Frieren EP12.mkv"), 12).equals(List.of(0)));
        assertTrue(TorrentClient.selectiveIndices(List.of("Frieren S01E03.mkv"), 3).equals(List.of(0)));
        assertTrue(TorrentClient.selectiveIndices(List.of("Frieren E03.mkv"), 3).equals(List.of(0)));
        assertEquals(List.of(), TorrentClient.selectiveIndices(List.of("Frieren - 06.mkv"), 5));
    }

    @Test
    @DisplayName("正片判定：OVA/特典等附属不参与集号匹配；种子根目录名含 OVA 不误伤正片")
    void mainOnlyMatching() {
        List<String> names = List.of(
                "[DBD-Raws][少女与战车][01-12TV全集+OVA+特典映像]/[DBD-Raws][Girls und Panzer][01].mkv",
                "[DBD-Raws][少女与战车][01-12TV全集+OVA+特典映像]/[DBD-Raws][Girls und Panzer][OVA][01].mkv",
                "[DBD-Raws][少女与战车][01-12TV全集+OVA+特典映像]/OVA/[DBD-Raws][Girls und Panzer] OVA 01.mkv",
                "[DBD-Raws][少女与战车][01-12TV全集+OVA+特典映像]/[DBD-Raws][Girls und Panzer][01].sc.ass",
                "[SubsMix] S01E01.mkv");
        assertEquals(List.of(0), TorrentClient.selectiveIndices(List.of(names.get(0), names.get(1), names.get(2), names.get(3)), 1),
                "只应选中正片 TV 第1集：索引0 是根目录下正片[01]，OVA 行/根目录名含OVA均不误伤");
        assertEquals(List.of(0), TorrentClient.selectiveIndices(List.of(names.get(4)), 1), "SubsMix S01E01 也应命中");
        assertFalse(TorrentClient.isMainEpisodeName("[DBD-Raws][少女与战车][01-12TV全集+OVA+特典映像]/OVA/[DBD-Raws] OVA 01.mkv"));
        assertTrue(TorrentClient.isMainEpisodeName("[DBD-Raws][少女与战车][01-12TV全集+OVA+特典映像]/[DBD-Raws][Girls und Panzer][01].mkv"));
    }
}
