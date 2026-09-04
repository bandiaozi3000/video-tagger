package com.videotagger.videosource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Nyaa 种子源（v0.25 D3 主源）：RSS 搜索。
 *  默认搜 Anime 全部分类 c=1_0（1_4=Raw / 1_2=English-translated / 1_3=Non-English；1_1=AMV 不单独搜），
 *  AMV 等噪音由上层候选解析兜底丢弃；直连常需代理 → base-url/模板可配镜像。 */
@Component
@ConditionalOnProperty(prefix = "videotagger.video-sources.nyaa", name = "enabled", havingValue = "true")
public class NyaaVideoSourceProvider extends AbstractRssVideoSourceProvider {

    @Autowired
    public NyaaVideoSourceProvider(
            @Value("${videotagger.video-sources.nyaa.base-url:https://nyaa.si}") String baseUrl,
            @Value("${videotagger.video-sources.nyaa.search-url-template:https://nyaa.si/?page=rss&q={keyword}&c=1_0}") String searchUrlTemplate,
            @Value("${videotagger.video-sources.nyaa.timeout-ms:10000}") int timeoutMs,
            @Value("${videotagger.video-sources.nyaa.max-results:100}") int maxResults) {
        super("nyaa", "Nyaa", baseUrl, searchUrlTemplate, timeoutMs, maxResults, false);
    }

    NyaaVideoSourceProvider(String baseUrl, String searchUrlTemplate,
                            int timeoutMs, int maxResults, boolean allowPrivateNetwork) {
        super("nyaa", "Nyaa", baseUrl, searchUrlTemplate,
                timeoutMs, maxResults, allowPrivateNetwork);
    }
}
