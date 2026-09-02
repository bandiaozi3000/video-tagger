package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class VideoSourceSubscriptionServiceTest {
    private final VideoSourceSubscriptionService service =
            new VideoSourceSubscriptionService(null, null, null, new ObjectMapper());

    @Test
    void importsAnimekoRssAndWebSelectorWithCompatibility() {
        String json = """
                {"exportedMediaSourceDataList":{"mediaSources":[
                  {"factoryId":"rss","version":1,"arguments":{"name":"RSS 源","description":"BT","iconUrl":"https://example.com/a.png","searchConfig":{"searchUrl":"https://example.com/feed?q={keyword}"}}},
                  {"factoryId":"web-selector","version":2,"arguments":{"name":"网页源","tier":1,"searchConfig":{
                    "searchUrl":"https://example.org/search?q={keyword}",
                    "subjectFormatId":"a","selectorSubjectFormatA":{"selectLists":".result a"},
                    "channelFormatId":"no-channel","selectorChannelFormatNoChannel":{"selectEpisodes":".episodes a"}
                  }}}
                ]}}
                """;

        var sources = service.parse(json);

        assertEquals(2, sources.size());
        assertEquals("SUPPORTED", sources.get(0).compatibility());
        assertEquals("SUPPORTED", sources.get(1).compatibility());
        assertEquals(1, sources.get(1).tier());
    }

    @Test
    void rejectsUnknownEnvelopeAndBlocksSecrets() {
        assertThrows(IllegalArgumentException.class, () -> service.parse("{}"));
        String json = """
                {"exportedMediaSourceDataList":{"mediaSources":[
                  {"factoryId":"rss","version":1,"arguments":{"name":"危险源","apiKey":"secret","searchConfig":{"searchUrl":"https://example.com?q={keyword}"}}}
                ]}}
                """;
        assertEquals("UNSAFE", service.parse(json).get(0).compatibility());
    }

    @Test
    void keepsSelectorsButStripsCookieAndHeaderOverrides() {
        String json = """
                {"exportedMediaSourceDataList":{"mediaSources":[
                  {"factoryId":"web-selector","version":2,"arguments":{"name":"网页源","searchConfig":{
                    "searchUrl":"https://example.com/search?q={keyword}",
                    "subjectFormatId":"a","selectorSubjectFormatA":{"selectLists":".result a"},
                    "channelFormatId":"no-channel","selectorChannelFormatNoChannel":{"selectEpisodes":".episodes a"},
                    "matchVideo":{"matchVideoUrl":"https?://.+\\\\.mp4","cookies":"quality=1080","addHeadersToVideo":{"referer":"https://example.com"}}
                  }}}
                ]}}
                """;

        var source = service.parse(json).get(0);

        assertEquals("SUPPORTED", source.compatibility());
        assertEquals(".result a", source.arguments().path("searchConfig").path("selectorSubjectFormatA").path("selectLists").asText());
        assertEquals(false, source.arguments().toString().contains("cookies"));
        assertEquals(false, source.arguments().toString().contains("addHeadersToVideo"));
    }

    @Test
    void reparsesStoredSnapshotsSoOfflineCompatibilityFixesCanTakeEffect() {
        String snapshot = """
                {"exportedMediaSourceDataList":{"mediaSources":[
                  {"factoryId":"web-selector","version":2,"arguments":{"name":"网页源","searchConfig":{
                    "searchUrl":"https://example.com/search?q={keyword}",
                    "selectorSubjectFormatA":{"selectLists":".result a"},
                    "selectorChannelFormatNoChannel":{"selectEpisodes":".episodes a"},
                    "matchVideo":{"cookies":"quality=1080"}
                  }}}
                ]}}
                """;

        var source = service.parse(snapshot).get(0);

        assertEquals("SUPPORTED", source.compatibility());
        assertEquals(false, source.arguments().toString().contains("cookies"));
    }
}
