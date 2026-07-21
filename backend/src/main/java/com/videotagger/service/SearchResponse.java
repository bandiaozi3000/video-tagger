package com.videotagger.service;

import java.util.List;

public record SearchResponse(boolean semanticEnabled, List<SearchResult> results) {
}
