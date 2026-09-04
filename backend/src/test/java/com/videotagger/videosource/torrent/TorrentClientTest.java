package com.videotagger.videosource.torrent;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TorrentClientTest {

    @Test
    @DisplayName("locator 判定：磁力 / .torrent / 普通视频 URL")
    void locatorKind() {
        assertTrue(TorrentClient.isTorrentLocator("magnet:?xt=urn:btih:abc"));
        assertTrue(TorrentClient.isTorrentLocator("https://nyaa.si/download/1.torrent"));
        assertTrue(TorrentClient.isTorrentLocator("http://a/1.torrent"));
        assertFalse(TorrentClient.isTorrentLocator("https://cdn/x/ep5.mp4"));
        assertFalse(TorrentClient.isTorrentLocator(null));
    }

    @Test
    @DisplayName("主视频挑选：忽略字幕/未完成/非视频，取最大体积")
    void pickVideoSelectsLargest() {
        List<TorrentClient.DownloadedFile> files = List.of(
                new TorrentClient.DownloadedFile("s1.chs.ass", 10_000, true),
                new TorrentClient.DownloadedFile("ep05.part", 50_000_000, false),
                new TorrentClient.DownloadedFile("folder/ep05.mkv", 300_000_000, true),
                new TorrentClient.DownloadedFile("folder/ep05_extra.mp4", 100_000, true));
        TorrentClient.DownloadedFile best = TorrentClient.pickVideo(files);
        assertEquals("folder/ep05.mkv", best.name());
        assertNull(TorrentClient.pickVideo(List.of(
                new TorrentClient.DownloadedFile("a.srt", 1, true))));
    }

    @Test
    @DisplayName("扩展名/mime 派生")
    void extAndMime() {
        assertEquals("mkv", TorrentClient.extensionOf("F:/anime/EP05.mkv"));
        assertEquals("mp4", TorrentClient.extensionOf("ep.mp4"));
        assertEquals("video/x-matroska", TorrentClient.mimeOf("EP05.mkv"));
        assertEquals("video/mp4", TorrentClient.mimeOf("EP05.mp4"));
    }
}
