package com.videotagger.metadata;

import java.util.List;

public record ProviderQuery(String mode, String keyword, Integer year, String season, String externalId,
                            int limit) {
    public static ProviderQuery keyword(String keyword) {
        return new ProviderQuery("WORK", keyword, null, null, null, 20);
    }

    public static ProviderQuery year(Integer year, String season) {
        return new ProviderQuery(season == null || season.isBlank() ? "YEAR" : "YEAR_SEASON",
                null, year, season, null, 100);
    }

    public static ProviderQuery work(String externalId) {
        return new ProviderQuery("EXTERNAL_ID", null, null, null, externalId, 1);
    }

    public List<String> validate() {
        if (mode == null || mode.isBlank()) return List.of("mode 不能为空");
        if ("WORK".equals(mode) && (keyword == null || keyword.isBlank())) return List.of("keyword 不能为空");
        if (("YEAR".equals(mode) || "YEAR_SEASON".equals(mode)) && (year == null || year < 1900 || year > 2200)) {
            return List.of("year 无效");
        }
        if ("EXTERNAL_ID".equals(mode) && (externalId == null || !externalId.matches("[0-9]+"))) {
            return List.of("externalId 无效");
        }
        return List.of();
    }
}
