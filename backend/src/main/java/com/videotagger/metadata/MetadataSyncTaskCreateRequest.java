package com.videotagger.metadata;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

public record MetadataSyncTaskCreateRequest(
        String provider,
        String scopeType,
        JsonNode query,
        Boolean automatic,
        List<Item> items
) {
    public record Item(
            String externalId,
            String title,
            String titleCn,
            String action,
            Long targetMediaId,
            String matchType,
            JsonNode snapshot
    ) { }
}