package com.videotagger.service;

/** 保存片段的结果。animeId/animeTitle/episodeNo 供扩展浮层小字展示「识别到：番剧 · 第X集」（A 做轻）。 */
public record SaveClipResult(Long id, boolean deduped, Long animeId, String animeTitle, Integer episodeNo) {

    public SaveClipResult(Long id, boolean deduped) {
        this(id, deduped, null, null, null);
    }
}
