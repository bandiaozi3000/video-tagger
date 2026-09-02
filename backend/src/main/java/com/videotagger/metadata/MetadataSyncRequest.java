package com.videotagger.metadata;

import java.util.List;

public record MetadataSyncRequest(
        String mode,
        String keyword,
        Integer year,
        String season,
        String externalId,
        Integer limit,
        String importMode,
        List<Decision> decisions
) {
    public ProviderQuery toQuery() {
        return new ProviderQuery(mode, keyword, year, season, externalId,
                limit == null ? 50 : Math.min(Math.max(limit, 1), 1000));
    }

    public record Decision(String externalId, String action, Long mediaId) { }
}
