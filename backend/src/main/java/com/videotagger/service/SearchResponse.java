package com.videotagger.service;

import java.util.List;

public record SearchResponse(boolean semanticEnabled, List<SearchResult> results, long total) {
    /** 未显式给 total 时按结果条数兜底（内部 doSearch 各维度分支用）。 */
    public SearchResponse(boolean semanticEnabled, List<SearchResult> results) {
        this(semanticEnabled, results, results == null ? 0 : results.size());
    }
}
