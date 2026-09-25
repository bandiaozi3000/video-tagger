package com.videotagger.metadata;

import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BangumiMetadataProviderTest {
    private MockWebServer server;
    private BangumiMetadataProvider provider;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        provider = new BangumiMetadataProvider(new ObjectMapper(), server.url("/").toString());
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void parsesSearchResult() {
        server.enqueue(new MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json")
                .setBody("{\"total\":1,\"data\":[{\"id\":1,\"name\":\"Original\",\"name_cn\":\"中文名\",\"date\":\"2026-07-01\",\"images\":{\"large\":\"https://img/x.jpg\"},\"tags\":[{\"name\":\"动作\"}]}]}"));
        List<MetadataRecord> result = provider.search("中文", 10);
        assertEquals(1, result.size());
        assertEquals("1", result.get(0).externalId());
        assertEquals("中文名", result.get(0).displayTitle());
        assertEquals("SUMMER", result.get(0).season());
        assertEquals(List.of("动作"), result.get(0).genres());
    }

    @Test
    void rejectsInvalidSeason() {
        assertThrows(MetadataProviderException.class, () -> provider.discover(2026, "BAD", 10));
    }

    @Test
    void discoversWithoutUnsupportedSort() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json")
                .setBody("{\"data\":[]}"));

        provider.discover(2026, "FALL", 10);

        RecordedRequest request = server.takeRequest();
        String body = request.getBody().readUtf8();
        assertFalse(body.contains("\"sort\""));
        assertTrue(body.contains("\"type\":[2]"));
        assertEquals("POST", request.getMethod());
        assertEquals("/v0/search/subjects?limit=10&offset=0", request.getPath());
    }

    @Test
    void preservesClientErrorStatus() {
        server.enqueue(new MockResponse().setResponseCode(400).setHeader("Content-Type", "application/json")
                .setBody("{\"description\":\"sort not supported\"}"));

        MetadataProviderException error = assertThrows(MetadataProviderException.class,
                () -> provider.search("中文", 10));

        assertEquals(400, error.status());
    }

    @Test
    void followsActualPageSizeUntilTotalIsReached() throws Exception {
        server.enqueue(json(page(45, 1, 20, true)));
        server.enqueue(json(page(45, 21, 20, true)));
        server.enqueue(json(page(45, 41, 5, true)));

        List<MetadataRecord> result = provider.discover(2024, null, 45);

        assertEquals(45, result.size());
        assertEquals("/v0/search/subjects?limit=45&offset=0", server.takeRequest().getPath());
        assertEquals("/v0/search/subjects?limit=45&offset=20", server.takeRequest().getPath());
        assertEquals("/v0/search/subjects?limit=45&offset=40", server.takeRequest().getPath());
    }

    @Test
    void continuesShortPagesWithoutTotalUntilEmptyPage() {
        server.enqueue(json(page(0, 1, 20, false)));
        server.enqueue(json(page(0, 21, 10, false)));
        server.enqueue(json("{\"data\":[]}"));

        List<MetadataRecord> result = provider.search("动画", 40);

        assertEquals(30, result.size());
        assertEquals(3, server.getRequestCount());
    }

    @Test
    void stopsWhenProviderRepeatsTheSamePage() {
        String repeated = page(80, 1, 20, true);
        server.enqueue(json(repeated));
        server.enqueue(json(repeated));

        List<MetadataRecord> result = provider.discover(2024, null, 80);

        assertEquals(20, result.size());
        assertEquals(2, server.getRequestCount());
    }

    @Test
    void sendsRegionAsMetaTagFilter() throws Exception {
        server.enqueue(json("{\"data\":[]}"));

        provider.discoverRange("2024-04-01", "2024-07-01", "日本", null, 10);

        String body = server.takeRequest().getBody().readUtf8();
        assertTrue(body.contains("\"meta_tags\":[\"日本\"]"));
        assertTrue(body.contains("\"type\":[2]"));
    }

    @Test
    void omitsMetaTagsWhenRegionBlank() throws Exception {
        server.enqueue(json("{\"data\":[]}"));

        provider.discoverRange("2024-04-01", "2024-07-01", "  ", null, 10);

        assertFalse(server.takeRequest().getBody().readUtf8().contains("meta_tags"));
    }

    @Test
    void rejectsUnknownRegionBeforeAnyRequest() {
        MetadataProviderException error = assertThrows(MetadataProviderException.class,
                () -> provider.discoverRange("2024-04-01", "2024-07-01", "火星", null, 10));

        assertEquals(422, error.status());
        assertEquals(0, server.getRequestCount());
    }

    @Test
    void sendsCategoryAsMetaTagFilterWhenRegionBlank() throws Exception {
        server.enqueue(json("{\"data\":[]}"));

        provider.discoverRange("2024-04-01", "2024-07-01", "  ", "TV", 10);

        String body = server.takeRequest().getBody().readUtf8();
        assertTrue(body.contains("\"meta_tags\":[\"TV\"]"));
    }

    @Test
    void sendsRegionAndCategoryAsAndedMetaTags() throws Exception {
        server.enqueue(json("{\"data\":[]}"));

        provider.discoverRange("2024-04-01", "2024-07-01", "日本", "剧场版", 10);

        // 顺序固定 region 在前：meta_tags 是且关系，[日本,剧场版] = 日本的剧场版
        assertTrue(server.takeRequest().getBody().readUtf8().contains("\"meta_tags\":[\"日本\",\"剧场版\"]"));
    }

    @Test
    void rejectsUnknownCategoryBeforeAnyRequest() {
        // Bangumi 对未知 meta_tags 不报错、只静默返回 0 条 —— 所以必须本地白名单卡住，
        // 否则打错一个字的效果是「拉了 0 条候选」而不是报错。
        MetadataProviderException error = assertThrows(MetadataProviderException.class,
                () -> provider.discoverRange("2024-04-01", "2024-07-01", "日本", "其他", 10));

        assertEquals(422, error.status());
        assertEquals(0, server.getRequestCount());
    }

    @Test
    void fetchesSubjectAndEpisodes() {
        server.enqueue(new MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json")
                .setBody("{\"id\":2,\"name\":\"Original\",\"name_cn\":\"中文\",\"summary\":\"简介\",\"date\":\"2025-01-01\",\"eps\":1}"));
        server.enqueue(new MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json")
                .setBody("[{\"id\":20,\"sort\":1,\"name\":\"EP\",\"name_cn\":\"第一集\",\"desc\":\"集简介\"}]"));
        server.enqueue(new MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json")
                .setBody("[]"));
        MetadataRecord result = provider.get("2");
        assertEquals("简介", result.description());
        assertEquals(1, result.episodes().size());
        assertEquals("20", result.episodes().get(0).externalId());
    }

    private static MockResponse json(String body) {
        return new MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody(body);
    }

    private static String page(int total, int startId, int count, boolean includeTotal) {
        StringBuilder body = new StringBuilder("{");
        if (includeTotal) body.append("\"total\":").append(total).append(',');
        body.append("\"data\":[");
        for (int i = 0; i < count; i++) {
            if (i > 0) body.append(',');
            int id = startId + i;
            body.append("{\"id\":").append(id)
                    .append(",\"name\":\"Work ").append(id)
                    .append("\",\"name_cn\":\"作品 ").append(id)
                    .append("\",\"date\":\"2024-01-01\"}");
        }
        return body.append("]}").toString();
    }
}
