package com.videotagger.videosource;

public final class ConfiguredRssVideoSourceProvider extends AbstractRssVideoSourceProvider {
    public ConfiguredRssVideoSourceProvider(String providerId, String displayName, String baseUrl,
                                            String searchUrlTemplate, int timeoutMs, int maxResults) {
        super(providerId, displayName, baseUrl, searchUrlTemplate, timeoutMs, maxResults, false);
    }
}
