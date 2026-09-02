package com.videotagger.videosource;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "videotagger.video-sources.mikan", name = "enabled", havingValue = "true")
public class MikanVideoSourceProvider extends AbstractRssVideoSourceProvider {
    public MikanVideoSourceProvider(
            @Value("${videotagger.video-sources.mikan.base-url:https://mikanani.me}") String baseUrl,
            @Value("${videotagger.video-sources.mikan.search-url-template:https://mikanani.me/RSS/Search?searchstr={keyword}}") String searchUrlTemplate,
            @Value("${videotagger.video-sources.mikan.timeout-ms:10000}") int timeoutMs,
            @Value("${videotagger.video-sources.mikan.max-results:100}") int maxResults) {
        super("mikan", "Mikan", baseUrl, searchUrlTemplate, timeoutMs, maxResults, false);
    }

    MikanVideoSourceProvider(String baseUrl, String searchUrlTemplate,
                             int timeoutMs, int maxResults, boolean allowPrivateNetwork) {
        super("mikan", "Mikan", baseUrl, searchUrlTemplate,
                timeoutMs, maxResults, allowPrivateNetwork);
    }
}
