package com.videotagger.service;

public record SearchResult(
        Long id,
        String title,
        String url,
        String jumpUrl,
        Double timestampSec,
        String tag,
        String note,
        Double score
) {
}
