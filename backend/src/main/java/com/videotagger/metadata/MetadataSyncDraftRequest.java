package com.videotagger.metadata;

import com.fasterxml.jackson.databind.JsonNode;

public record MetadataSyncDraftRequest(
        String provider,
        JsonNode query,
        JsonNode candidates,
        JsonNode review,
        JsonNode view
) { }