package com.videotagger.videosource;

import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.net.http.HttpClient;

import static org.junit.jupiter.api.Assertions.*;

class RealVideoSourceProviderTest {
    @Test
    void providerHttpRequiresExplicitPrivateNetworkOptIn() {
        VideoSourceProviderException error = assertThrows(
                VideoSourceProviderException.class,
                () -> new ProviderHttpClient("public-provider", "http://127.0.0.1:8096", 1000, false));
        assertEquals("PRIVATE_ADDRESS", error.reasonCode());
    }

    @Test
    void providerHttpRejectsRedirectsAndOversizedResponses() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(new MockResponse().setResponseCode(302).setHeader("Location", "/other"));
            String baseUrl = server.url("/").toString();
            ProviderHttpClient redirectClient = new ProviderHttpClient(
                    "test", baseUrl, 5000, true);
            assertEquals("UNSAFE_REDIRECT", assertThrows(
                    VideoSourceProviderException.class,
                    () -> redirectClient.get("/redirect", Map.of())).reasonCode());

            server.enqueue(new MockResponse().setResponseCode(200).setBody("123456789"));
            ProviderHttpClient boundedClient = new ProviderHttpClient(
                    "test", baseUrl, 5000, true, 8,
                    HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build());
            assertEquals("RESPONSE_TOO_LARGE", assertThrows(
                    VideoSourceProviderException.class,
                    () -> boundedClient.get("/large", Map.of())).reasonCode());
        }
    }

    @Test
    void jellyfinDiscoversSeriesWithoutLeakingApiKey() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(json("""
                    {"Items":[{"Id":"series-1","Name":"示例动画","ProductionYear":2026,
                    "DateLastSaved":"2026-08-31T01:00:00Z","ProviderIds":{"Tmdb":"42"}}]}
                    """));
            server.enqueue(json("""
                    {"Items":[{"Id":"episode-1","Name":"第一话","IndexNumber":1,
                    "RunTimeTicks":14400000000,"DateLastSaved":"2026-08-31T01:01:00Z"}]}
                    """));
            String baseUrl = server.url("/").toString();
            ProviderHttpClient http = new ProviderHttpClient(
                    "jellyfin", baseUrl, 5000, true);
            JellyfinVideoSourceProvider provider = new JellyfinVideoSourceProvider(
                    baseUrl, "user-1", "top-secret", 20, http, new ObjectMapper());

            List<VideoSourcePackage> packages = provider.discover(query("示例动画"));

            assertEquals(1, packages.size());
            VideoSourcePackage sourcePackage = packages.get(0);
            assertEquals("series-1", sourcePackage.providerPackageId());
            assertEquals(1, sourcePackage.items().size());
            assertEquals(1, sourcePackage.items().get(0).episodeNumber());
            assertEquals(1_440_000L, sourcePackage.items().get(0).durationMs());
            assertFalse(sourcePackage.toString().contains("top-secret"));

            RecordedRequest search = server.takeRequest();
            RecordedRequest episodes = server.takeRequest();
            assertEquals("top-secret", search.getHeader("X-Emby-Token"));
            assertEquals("top-secret", episodes.getHeader("X-Emby-Token"));
            assertFalse(search.getPath().contains("top-secret"));
            assertFalse(episodes.getPath().contains("top-secret"));
        }
    }

    @Test
    void jellyfinMapsUnauthorizedResponseWithoutLeakingApiKey() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(new MockResponse().setResponseCode(401));
            String baseUrl = server.url("/").toString();
            JellyfinVideoSourceProvider provider = new JellyfinVideoSourceProvider(
                    baseUrl, "user-1", "top-secret", 20,
                    new ProviderHttpClient("jellyfin", baseUrl, 5000, true),
                    new ObjectMapper());

            VideoSourceProviderException error = assertThrows(
                    VideoSourceProviderException.class,
                    () -> provider.discover(query("示例动画")));

            assertEquals("LOGIN_REQUIRED", error.reasonCode());
            assertFalse(error.getMessage().contains("top-secret"));
            assertFalse(server.takeRequest().getPath().contains("top-secret"));
        }
    }

    @Test
    void mikanGroupsRssEntriesAndPreservesTorrentMetadata() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(xml("""
                    <?xml version="1.0" encoding="UTF-8"?>
                    <rss version="2.0"><channel>
                      <item><title>[字幕组A] 示例动画 [01][1080P]</title><link>/Home/Episode/1</link>
                        <guid>item-1</guid><enclosure url="magnet:?xt=urn:btih:abc" type="application/x-bittorrent"/></item>
                      <item><title>[字幕组A] 示例动画 [02][1080P]</title><link>/Home/Episode/2</link>
                        <guid>item-2</guid><enclosure url="/Download/2.torrent" type="application/x-bittorrent"/></item>
                    </channel></rss>
                    """));
            String baseUrl = server.url("/").toString();
            MikanVideoSourceProvider provider = new MikanVideoSourceProvider(
                    baseUrl, baseUrl + "rss?keyword={keyword}", 5000, 20, true);

            List<VideoSourcePackage> packages = provider.discover(query("示例动画"));

            assertEquals(1, packages.size());
            assertEquals("字幕组A", packages.get(0).releaseGroup());
            assertEquals(List.of(1, 2), packages.get(0).items().stream()
                    .map(VideoSourceItem::episodeNumber).toList());
            assertEquals("magnet:?xt=urn:btih:abc",
                    packages.get(0).items().get(0).sanitizedSnapshot().get("torrentUrl"));
            assertTrue(packages.get(0).items().get(1).sanitizedSnapshot()
                    .get("torrentUrl").toString().endsWith("/Download/2.torrent"));
            assertFalse(provider.capabilities().supports(VideoSourceStatus.Capability.DOWNLOAD));
        }
    }

    @Test
    void rssParserRejectsDoctypeAndExternalEntity() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(xml("""
                    <?xml version="1.0"?>
                    <!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
                    <rss version="2.0"><channel><item><title>&xxe;</title><link>/x</link></item></channel></rss>
                    """));
            String baseUrl = server.url("/").toString();
            AnimeGardenVideoSourceProvider provider = new AnimeGardenVideoSourceProvider(
                    baseUrl, baseUrl + "rss?keyword={keyword}", 5000, 20, true);

            VideoSourceProviderException error = assertThrows(
                    VideoSourceProviderException.class,
                    () -> provider.discover(query("示例动画")));

            assertEquals("INVALID_RSS", error.reasonCode());
        }
    }

    @Test
    void webSelectorResolvesRelativePagesAndPublicDirectMedia() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(html("""
                    <html><body><article class="result"><a class="title" href="/show/1">示例动画</a></article></body></html>
                    """));
            server.enqueue(html("""
                    <html><head><title>示例动画</title></head><body>
                    <div class="episode"><a class="episode-link" href="/play/1"><span class="episode-title">第1话</span></a></div>
                    </body></html>
                    """));
            server.enqueue(html("""
                    <html><body><video id="player" src="https://93.184.216.34/media/episode-1.mp4"></video></body></html>
                    """));
            String baseUrl = server.url("/").toString();
            WebSelectorVideoSourceProvider provider = selectorProvider(baseUrl, "#player");

            VideoSourcePackage sourcePackage = provider.discover(query("示例动画")).get(0);
            VideoSourceItem item = sourcePackage.items().get(0);
            VideoSourceResolution resolution = provider.resolve(new VideoSourceResolveRequest(
                    sourcePackage.providerPackageId(), item.providerItemId(), item.revision(),
                    VideoSourceStatus.ResolutionPurpose.PLAYBACK, null, null, null));

            assertEquals(1, item.episodeNumber());
            assertTrue(item.sourcePageUrl().endsWith("/play/1"));
            assertEquals("https://93.184.216.34/media/episode-1.mp4", resolution.resolvedLocator());
            assertEquals("video/mp4", resolution.mimeType());
        }
    }

    @Test
    void webSelectorRejectsHlsAndInvalidSelectors() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> new WebSelectorVideoSourceProvider(
                "web-test", "Web Test", "http://127.0.0.1:9/", "search?q={keyword}",
                "[", ".title", "a", ".episode", ".episode-title", "a",
                "video", "src", 1000, 10, true));

        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(html("<video id=\"player\" src=\"https://93.184.216.34/live/index.m3u8\"></video>"));
            String baseUrl = server.url("/").toString();
            WebSelectorVideoSourceProvider provider = selectorProvider(baseUrl, "#player");
            String itemId = VideoSourceText.encodeIdentity(baseUrl + "play/1");

            VideoSourceProviderException error = assertThrows(
                    VideoSourceProviderException.class,
                    () -> provider.resolve(new VideoSourceResolveRequest(
                            VideoSourceText.encodeIdentity(baseUrl + "show/1"), itemId,
                            "r1", VideoSourceStatus.ResolutionPurpose.PLAYBACK,
                            null, null, null)));

            assertEquals("UNSUPPORTED_FORMAT", error.reasonCode());
        }
    }

    @Test
    void webSelectorRejectsPrivateDirectMedia() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(html("<video id=\"player\" src=\"http://127.0.0.1/private.mp4\"></video>"));
            String baseUrl = server.url("/").toString();
            WebSelectorVideoSourceProvider provider = selectorProvider(baseUrl, "#player");
            String itemId = VideoSourceText.encodeIdentity(baseUrl + "play/1");

            VideoSourceProviderException error = assertThrows(
                    VideoSourceProviderException.class,
                    () -> provider.resolve(new VideoSourceResolveRequest(
                            VideoSourceText.encodeIdentity(baseUrl + "show/1"), itemId,
                            "r1", VideoSourceStatus.ResolutionPurpose.PLAYBACK,
                            null, null, null)));

            assertEquals("PRIVATE_ADDRESS", error.reasonCode());
        }
    }

    @Test
    void animekoWebSelectorRunsSearchEpisodeAndDirectPlaybackChain() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(html("""
                    <div class="search"><a href="/show/1" title="示例动画">示例动画</a></div>
                    """));
            server.enqueue(html("""
                    <div class="channels"><span>线路 A</span></div>
                    <div class="episodes"><a href="/play/1">第 1 集</a></div>
                    """));
            server.enqueue(html("""
                    <script>window.player={url:"https://93.184.216.34/media/episode-1.mp4"};</script>
                    """));
            String baseUrl = server.url("/").toString();
            var arguments = new ObjectMapper().readTree("""
                    {"searchConfig":{
                      "searchUrl":"%ssearch?q={keyword}",
                      "subjectFormatId":"a",
                      "selectorSubjectFormatA":{"selectLists":".search a"},
                      "channelFormatId":"index-grouped",
                      "selectorChannelFormatFlattened":{
                        "selectChannelNames":".channels span",
                        "selectEpisodeLists":".episodes",
                        "selectEpisodesFromList":"a",
                        "selectEpisodeLinksFromList":""
                      },
                      "defaultResolution":"1080P"
                    }}
                    """.formatted(baseUrl));
            AnimekoWebSelectorVideoSourceProvider provider = new AnimekoWebSelectorVideoSourceProvider(
                    "animeko-web", "Animeko Web", arguments, 5000, 20, true);

            VideoSourcePackage sourcePackage = provider.discover(query("示例动画")).get(0);
            VideoSourceItem item = sourcePackage.items().get(0);
            VideoSourceResolution resolution = provider.resolve(new VideoSourceResolveRequest(
                    sourcePackage.providerPackageId(), item.providerItemId(), item.revision(),
                    VideoSourceStatus.ResolutionPurpose.PLAYBACK, null, null, null));

            assertEquals(1, item.episodeNumber());
            assertTrue(item.sourcePageUrl().endsWith("/play/1"));
            assertEquals("https://93.184.216.34/media/episode-1.mp4", resolution.resolvedLocator());
        }
    }

    @Test
    void animekoWebSelectorRetriesAliasesAndRanksMatchingSubject() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(html("<div class=\"search\"></div>"));
            server.enqueue(html("<div class=\"search\"><a href=\"/show/1\" title=\"少女与战车 TV版\">少女与战车</a></div>"));
            server.enqueue(html("<div class=\"episodes\"><a href=\"/play/1\">1</a></div>"));
            String baseUrl = server.url("/").toString();
            var arguments = new ObjectMapper().readTree("""
                    {"searchConfig":{
                      "searchUrl":"%ssearch?q={keyword}",
                      "subjectFormatId":"a",
                      "selectorSubjectFormatA":{"selectLists":".search a"},
                      "channelFormatId":"no-channel",
                      "selectorChannelFormatNoChannel":{"selectEpisodes":".episodes a","selectEpisodeLinks":""}
                    }}
                    """.formatted(baseUrl));
            AnimekoWebSelectorVideoSourceProvider provider = new AnimekoWebSelectorVideoSourceProvider(
                    "animeko-web", "Animeko Web", arguments, 5000, 20, true);
            VideoSourceDiscoveryQuery query = new VideoSourceDiscoveryQuery(
                    1L, Map.of(), List.of("Girls und Panzer", "少女与战车"), 2012, null, "TV", 12, 0, 20);

            VideoSourcePackage sourcePackage = provider.discover(query).get(0);

            assertEquals("少女与战车 TV版", sourcePackage.title());
            assertEquals(1, sourcePackage.items().get(0).episodeNumber());
            assertTrue(server.takeRequest().getPath().contains("Girls%20und%20Panzer"));
            assertTrue(server.takeRequest().getPath().contains("%E5%B0%91%E5%A5%B3%E4%B8%8E%E6%88%98%E8%BD%A6"));
        }
    }

    @Test
    void animekoWebSelectorPrefersMediaUrlMatchingPageEpisode() throws Exception {
        try (MockWebServer server = new MockWebServer()) {
            server.enqueue(html("<script>var a='https://93.184.216.34/media/03.mp4';var b='https://93.184.216.34/media/02.mp4';</script>"));
            String pageUrl = server.url("/play/2.html").toString();
            var arguments = new ObjectMapper().readTree("""
                    {"searchConfig":{
                      "searchUrl":"%ssearch?q={keyword}",
                      "subjectFormatId":"a",
                      "selectorSubjectFormatA":{"selectLists":".search a"},
                      "channelFormatId":"no-channel",
                      "selectorChannelFormatNoChannel":{"selectEpisodes":".episodes a","selectEpisodeLinks":""}
                    }}
                    """.formatted(server.url("/").toString()));
            AnimekoWebSelectorVideoSourceProvider provider = new AnimekoWebSelectorVideoSourceProvider(
                    "animeko-web", "Animeko Web", arguments, 5000, 20, true);

            VideoSourceResolution resolution = provider.resolve(new VideoSourceResolveRequest(
                    "pkg", VideoSourceText.encodeIdentity(pageUrl), "r1",
                    VideoSourceStatus.ResolutionPurpose.PLAYBACK, null, null, null));

            assertEquals("https://93.184.216.34/media/02.mp4", resolution.resolvedLocator());
        }
    }

    private static WebSelectorVideoSourceProvider selectorProvider(String baseUrl, String mediaSelector) {
        return new WebSelectorVideoSourceProvider(
                "web-test", "Web Test", baseUrl, baseUrl + "search?q={keyword}",
                ".result", ".title", "a", ".episode", ".episode-title", "a",
                mediaSelector, "src", 5000, 20, true);
    }

    private static VideoSourceDiscoveryQuery query(String title) {
        return new VideoSourceDiscoveryQuery(
                1L, Map.of(), List.of(title), 2026, null, "TV", 12, 0, 20);
    }

    private static MockResponse json(String body) {
        return new MockResponse().setResponseCode(200)
                .setHeader("Content-Type", "application/json; charset=utf-8")
                .setBody(body);
    }

    private static MockResponse xml(String body) {
        return new MockResponse().setResponseCode(200)
                .setHeader("Content-Type", "application/rss+xml; charset=utf-8")
                .setBody(body);
    }

    private static MockResponse html(String body) {
        return new MockResponse().setResponseCode(200)
                .setHeader("Content-Type", "text/html; charset=utf-8")
                .setBody(body);
    }
}
