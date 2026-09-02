package com.videotagger.metadata;

public record MetadataSyncTaskItemRetryRequest(String action, Long targetMediaId) { }