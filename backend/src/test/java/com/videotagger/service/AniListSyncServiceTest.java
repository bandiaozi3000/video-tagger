package com.videotagger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.Media;
import com.videotagger.mapper.MediaMapper;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AniListSyncServiceTest {

    private MediaMapper mediaMapper;
    private CoverService coverService;
    private MockWebServer server;
    private AniListSyncService service;

    @BeforeEach
    void setUp() throws Exception {
        mediaMapper = mock(MediaMapper.class);
        coverService = mock(CoverService.class);
        server = new MockWebServer();
        server.start();
        service = new AniListSyncService(mediaMapper, coverService, new ObjectMapper(),
                server.url("/").toString());
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void syncYearCreatesLocalMediaWithoutExternalDuplicates() throws Exception {
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {"data":{"Page":{"pageInfo":{"hasNextPage":false},"media":[
                          {"id":1,"title":{"native":"モンスター"},"startDate":{"year":2004},"coverImage":{"large":"https://x/cover.jpg"},"format":"TV"},
                          {"id":2,"title":{"native":"頭文字D FOURTH STAGE"},"startDate":{"year":2004},"coverImage":{"large":null},"format":"TV"}
                        ]}}}
                        """));

        AniListSyncService.SyncResult r = service.sync(List.of(2004));

        assertEquals(2, r.added());
        assertEquals(0, r.skipped());
        // 两条都入库，捕获全部 insert
        org.mockito.ArgumentCaptor<Media> captor = org.mockito.ArgumentCaptor.forClass(Media.class);
        verify(mediaMapper, org.mockito.Mockito.times(2)).insert(captor.capture());
        Media inserted = captor.getAllValues().get(0);
        assertEquals("モンスター", inserted.getTitle());
        assertEquals(2004, inserted.getYear());
        assertEquals("VIDEO", inserted.getMediaFormat());
        assertEquals("WANT", inserted.getStatus());
        assertEquals(1, inserted.getConfirmed());
        verify(coverService, never()).downloadAsync(any(), any());
    }

    @Test
    void duplicateTitleSkipped() throws Exception {
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {"data":{"Page":{"pageInfo":{"hasNextPage":false},"media":[
                          {"id":9,"title":{"native":"既存のタイトル"},"startDate":{"year":2005},"coverImage":{"large":"https://x/c.jpg"},"format":"TV"}
                        ]}}}
                        """));
        when(mediaMapper.selectByTitleOrOriginal("既存のタイトル")).thenReturn(new Media());

        AniListSyncService.SyncResult r = service.sync(List.of(2005));

        assertEquals(0, r.added());
        assertEquals(1, r.skipped());
        verify(mediaMapper, never()).insert(any(Media.class));
    }

    @Test
    void paginationFetchesUntilHasNextPageFalse() throws Exception {
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {"data":{"Page":{"pageInfo":{"hasNextPage":true},"media":[
                          {"id":1,"title":{"native":"第一页"},"startDate":{"year":2010},"coverImage":{"large":null},"format":"TV"}
                        ]}}}
                        """));
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {"data":{"Page":{"pageInfo":{"hasNextPage":false},"media":[
                          {"id":2,"title":{"native":"第二页"},"startDate":{"year":2010},"coverImage":{"large":null},"format":"TV"}
                        ]}}}
                        """));

        AniListSyncService.SyncResult r = service.sync(List.of(2010));

        assertEquals(2, r.added());
        assertEquals(0, r.skipped());
        assertEquals(2, server.getRequestCount());
    }

    @Test
    void invalidYearIgnored() {
        AniListSyncService.SyncResult r = service.sync(List.of(1990, 9999));

        assertEquals(0, r.added());
        assertEquals(0, r.skipped());
        assertEquals(0, server.getRequestCount());
    }

    @Test
    void blankTitleIgnoredNotCounted() throws Exception {
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {"data":{"Page":{"pageInfo":{"hasNextPage":false},"media":[
                          {"id":1,"title":{"native":""},"startDate":{"year":2004},"coverImage":{"large":null},"format":"TV"}
                        ]}}}
                        """));

        AniListSyncService.SyncResult r = service.sync(List.of(2004));

        assertEquals(0, r.added());
        assertEquals(0, r.skipped());
        verify(mediaMapper, never()).insert(any(Media.class));
    }

    @Test
    void nonTargetYearFilteredOut() throws Exception {
        // seasonYear 查询会混入未标季度的老番，必须严格按 startDate.year 过滤
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {"data":{"Page":{"pageInfo":{"hasNextPage":false},"media":[
                          {"id":1,"title":{"native":"2000年正解"},"startDate":{"year":2000},"coverImage":{"large":null},"format":"TV"},
                          {"id":2,"title":{"native":"混入的1992老番"},"startDate":{"year":1992},"coverImage":{"large":null},"format":"TV"},
                          {"id":3,"title":{"native":"混入的1969老番"},"startDate":{"year":1969},"coverImage":{"large":null},"format":"TV"}
                        ]}}}
                        """));

        AniListSyncService.SyncResult r = service.sync(List.of(2000));

        assertEquals(1, r.added());
        assertEquals(0, r.skipped());
        org.mockito.ArgumentCaptor<Media> captor = org.mockito.ArgumentCaptor.forClass(Media.class);
        verify(mediaMapper, org.mockito.Mockito.times(1)).insert(captor.capture());
        assertEquals("2000年正解", captor.getValue().getTitle());
        assertEquals(2000, captor.getValue().getYear());
    }

    @Test
    void duplicateDoesNotMutateLocalCover() throws Exception {
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {"data":{"Page":{"pageInfo":{"hasNextPage":false},"media":[
                          {"id":9,"title":{"native":"既存のタイトル"},"startDate":{"year":2005},"coverImage":{"large":"https://x/c.jpg"},"format":"TV"}
                        ]}}}
                        """));
        Media existing = new Media();
        existing.setId(99L);
        existing.setTitle("既存のタイトル");
        when(mediaMapper.selectByTitleOrOriginal("既存のタイトル")).thenReturn(existing);

        AniListSyncService.SyncResult r = service.sync(List.of(2005));

        assertEquals(0, r.added());
        assertEquals(1, r.skipped());
        verify(mediaMapper, never()).updateById(existing);
        verify(coverService, never()).downloadAsync(any(), any());
    }

    @Test
    void syncWithFormatsPassesFormatInToGraphQL() throws Exception {
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {"data":{"Page":{"pageInfo":{"hasNextPage":false},"media":[]}}}
                        """));

        AniListSyncService.SyncResult r = service.sync(List.of(2004), List.of("TV", "MOVIE"));

        assertEquals(0, r.added());
        assertEquals(0, r.skipped());
        String reqBody = server.takeRequest().getBody().readUtf8();
        assertTrue(reqBody.contains("\"formats\":[\"TV\",\"MOVIE\"]"));
    }

    @Test
    void syncWithEmptyFormatsSendsNull() throws Exception {
        server.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("""
                        {"data":{"Page":{"pageInfo":{"hasNextPage":false},"media":[]}}}
                        """));

        service.sync(List.of(2004), List.of());

        String reqBody = server.takeRequest().getBody().readUtf8();
        assertTrue(reqBody.contains("\"formats\":null"));
    }
}
