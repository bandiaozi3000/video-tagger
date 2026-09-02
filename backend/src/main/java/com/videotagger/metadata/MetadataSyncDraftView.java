package com.videotagger.metadata;

import com.fasterxml.jackson.databind.JsonNode;

public record MetadataSyncDraftView(
        String provider,
        JsonNode query,
        JsonNode candidates,
        JsonNode review,
        JsonNode view,
        Long createdAt,
        Long updatedAt
) { }