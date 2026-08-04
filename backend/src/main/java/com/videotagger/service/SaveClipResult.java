package com.videotagger.service;

/** 保存片段的结果。mediaId/mediaTitle/episodeNo 供扩展浮层小字展示「识别到：番剧 · 第X集」（A 做轻）。 */
public record SaveClipResult(Long id, boolean deduped, Long mediaId, String mediaTitle, Integer episodeNo) {

    public SaveClipResult(Long id, boolean deduped) {
        this(id, deduped, null, null, null);
    }
}
