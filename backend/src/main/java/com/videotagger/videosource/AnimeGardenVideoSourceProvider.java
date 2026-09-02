package com.videotagger.videosource;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "videotagger.video-sources.dmhy", name = "enabled", havingValue = "true")
public class AnimeGardenVideoSourceProvider extends AbstractRssVideoSourceProvider {
    public AnimeGardenVideoSourceProvider(
            @Value("${videotagger.video-sources.dmhy.base-url:https://share.dmhy.org}") String baseUrl,
            @Value("${videotagger.video-sources.dmhy.search-url-template:https://share.dmhy.org/topics/rss/rss.xml?keyword={keyword}}") String searchUrlTemplate,
            @Value("${videotagger.video-sources.dmhy.timeout-ms:10000}") int timeoutMs,
            @Value("${videotagger.video-sources.dmhy.max-results:100}") int maxResults) {
        super("dmhy", "动漫花园", baseUrl, searchUrlTemplate, timeoutMs, maxResults, false);
    }

    AnimeGardenVideoSourceProvider(String baseUrl, String searchUrlTemplate,
                                   int timeoutMs, int maxResults, boolean allowPrivateNetwork) {
        super("dmhy", "动漫花园", baseUrl, searchUrlTemplate,
                timeoutMs, maxResults, allowPrivateNetwork);
    }
}
