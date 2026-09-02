package com.videotagger.service;

import com.videotagger.entity.Episode;
import com.videotagger.entity.Media;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.MediaEntryMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.VideoAssetMapper;
import com.videotagger.mapper.VideoSourceEpisodeMapMapper;
import com.videotagger.mapper.VideoSourceItemMapper;
import com.videotagger.videosource.FakeVideoSourceProvider;
import com.videotagger.videosource.VideoSourceItem;
import com.videotagger.videosource.VideoSourcePackage;
import com.videotagger.videosource.VideoSourceProviderRegistry;
import com.videotagger.videosource.VideoSourceStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class VideoSourceQuickPlayServiceTest {
    @Test
    void selectsPlayableCandidateWithoutPersistingPackage() {
        EpisodeMapper episodeMapper = mock(EpisodeMapper.class);
        MediaEntryMapper entryMapper = mock(MediaEntryMapper.class);
        MediaMapper mediaMapper = mock(MediaMapper.class);
        VideoSourceSubscriptionService subscriptions = mock(VideoSourceSubscriptionService.class);
        VideoSourceDiscoveryService discoveryService = mock(VideoSourceDiscoveryService.class);
        VideoSourceItemMapper sourceItemMapper = mock(VideoSourceItemMapper.class);
        VideoSourceEpisodeMapMapper episodeMapMapper = mock(VideoSourceEpisodeMapMapper.class);
        VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
        Episode episode = new Episode();
        episode.setId(7L);
        episode.setMediaId(3L);
        episode.setEpisodeNo(1);
        episode.setTitle("第 1 集");
        Media media = new Media();
        media.setId(3L);
        media.setTitle("测试动画");
        when(episodeMapper.selectById(7L)).thenReturn(episode);
        when(mediaMapper.selectById(3L)).thenReturn(media);
        when(subscriptions.enabledProviders()).thenReturn(List.of());

        VideoSourceItem item = new VideoSourceItem("fast", "pkg", "item", "r1",
                VideoSourceStatus.ItemKind.EPISODE, 1, null, "第 1 集", null,
                List.of("zh"), List.of(), "1080P",
                Set.of(VideoSourceStatus.Capability.RESOLVE_PLAYBACK),
                "https://example.com/source", Map.of());
        VideoSourcePackage sourcePackage = new VideoSourcePackage("fast", "pkg", "r1", "测试动画",
                "字幕组", 2026, null, "TV", 1, List.of("zh"), List.of(), "1080P",
                null, "mp4", Set.of(VideoSourceStatus.Capability.RESOLVE_PLAYBACK),
                "https://example.com/source", Map.of(), List.of(item));
        FakeVideoSourceProvider provider = new FakeVideoSourceProvider("fast")
                .addPackage(sourcePackage)
                .addResolution("pkg", "item", "r1", "https://93.184.216.34/video.mp4", Instant.now().plusSeconds(300));
        VideoSourceQuickPlayService service = new VideoSourceQuickPlayService(episodeMapper, entryMapper,
                mediaMapper, new VideoSourceProviderRegistry(List.of(provider)), subscriptions,
                discoveryService, sourceItemMapper, episodeMapMapper, assetMapper, Runnable::run);

        var session = service.start(7L, new VideoSourceQuickPlayService.StartRequest(null));

        assertEquals("READY", session.status());
        assertNotNull(session.selected());
        assertEquals("fast", session.selected().providerId());
        assertEquals(1, session.candidates().size());
        verifyNoInteractions(discoveryService, sourceItemMapper, episodeMapMapper, assetMapper);
    }

    @Test
    void materializesSelectedCandidateOnlyAfterExplicitRequest() {
        EpisodeMapper episodeMapper = mock(EpisodeMapper.class);
        MediaEntryMapper entryMapper = mock(MediaEntryMapper.class);
        MediaMapper mediaMapper = mock(MediaMapper.class);
        VideoSourceSubscriptionService subscriptions = mock(VideoSourceSubscriptionService.class);
        VideoSourceDiscoveryService discoveryService = mock(VideoSourceDiscoveryService.class);
        VideoSourceItemMapper sourceItemMapper = mock(VideoSourceItemMapper.class);
        VideoSourceEpisodeMapMapper episodeMapMapper = mock(VideoSourceEpisodeMapMapper.class);
        VideoAssetMapper assetMapper = mock(VideoAssetMapper.class);
        Episode episode = new Episode();
        episode.setId(7L);
        episode.setMediaId(3L);
        episode.setMediaEntryId(11L);
        episode.setEpisodeNo(1);
        episode.setTitle("第 1 集");
        Media media = new Media();
        media.setId(3L);
        media.setTitle("测试动画");
        when(episodeMapper.selectById(7L)).thenReturn(episode);
        when(mediaMapper.selectById(3L)).thenReturn(media);
        when(subscriptions.enabledProviders()).thenReturn(List.of());

        com.videotagger.videosource.VideoSourceItem item = new com.videotagger.videosource.VideoSourceItem("fast", "pkg", "item", "r1",
                VideoSourceStatus.ItemKind.EPISODE, 1, null, "第 1 集", null,
                List.of("zh"), List.of(), "1080P",
                Set.of(VideoSourceStatus.Capability.RESOLVE_PLAYBACK),
                "https://example.com/source", Map.of());
        com.videotagger.videosource.VideoSourcePackage sourcePackage = new com.videotagger.videosource.VideoSourcePackage("fast", "pkg", "r1", "测试动画",
                "字幕组", 2026, null, "TV", 1, List.of("zh"), List.of(), "1080P",
                null, "mp4", Set.of(VideoSourceStatus.Capability.RESOLVE_PLAYBACK),
                "https://example.com/source", Map.of(), List.of(item));
        FakeVideoSourceProvider provider = new FakeVideoSourceProvider("fast")
                .addPackage(sourcePackage)
                .addResolution("pkg", "item", "r1", "https://93.184.216.34/video.mp4", Instant.now().plusSeconds(300));
        com.videotagger.entity.VideoSourcePackage storedPackage = new com.videotagger.entity.VideoSourcePackage();
        storedPackage.setId(41L);
        com.videotagger.entity.VideoSourceItem storedItem = new com.videotagger.entity.VideoSourceItem();
        storedItem.setId(51L);
        storedItem.setProviderItemId("item");
        storedItem.setRevision("r1");
        when(discoveryService.cacheCandidate(11L, sourcePackage)).thenReturn(storedPackage);
        when(sourceItemMapper.listByPackage(41L)).thenReturn(List.of(storedItem));

        VideoSourceQuickPlayService service = new VideoSourceQuickPlayService(episodeMapper, entryMapper,
                mediaMapper, new VideoSourceProviderRegistry(List.of(provider)), subscriptions,
                discoveryService, sourceItemMapper, episodeMapMapper, assetMapper, Runnable::run);
        var session = service.start(7L, new VideoSourceQuickPlayService.StartRequest(null));

        verifyNoInteractions(discoveryService, sourceItemMapper, episodeMapMapper, assetMapper);
        var asset = service.materialize(session.sessionId(), session.selected().id());

        assertEquals(7L, asset.getEpisodeId());
        assertEquals(51L, asset.getSourceItemId());
        assertEquals("REMOTE_STREAM", asset.getAssetType());
        assertEquals("AVAILABLE", asset.getAvailabilityState());
        verify(discoveryService).cacheCandidate(11L, sourcePackage);
        verify(episodeMapMapper).insert(org.mockito.ArgumentMatchers.<com.videotagger.entity.VideoSourceEpisodeMap>argThat(mapping ->
                mapping.getEpisodeId() == 7L && mapping.getSourceItemId() == 51L && "CONFIRMED".equals(mapping.getStatus())));
        verify(assetMapper).insert(asset);
    }

    @Test
    void selectsSourcePageFallbackWhenDirectPlaybackCannotResolve() {
        EpisodeMapper episodeMapper = mock(EpisodeMapper.class);
        MediaEntryMapper entryMapper = mock(MediaEntryMapper.class);
        MediaMapper mediaMapper = mock(MediaMapper.class);
        VideoSourceSubscriptionService subscriptions = mock(VideoSourceSubscriptionService.class);
        Episode episode = new Episode();
        episode.setId(7L);
        episode.setMediaId(3L);
        episode.setEpisodeNo(1);
        Media media = new Media();
        media.setId(3L);
        media.setTitle("测试动画");
        when(episodeMapper.selectById(7L)).thenReturn(episode);
        when(mediaMapper.selectById(3L)).thenReturn(media);
        when(subscriptions.enabledProviders()).thenReturn(List.of());
        VideoSourceItem item = new VideoSourceItem("external", "pkg", "item", "r1",
                VideoSourceStatus.ItemKind.EPISODE, 1, null, "第 1 集", null,
                List.of(), List.of(), "1080P", Set.of(VideoSourceStatus.Capability.SOURCE_PAGE),
                "https://example.com/play/1", Map.of());
        VideoSourcePackage sourcePackage = new VideoSourcePackage("external", "pkg", "r1", "测试动画",
                "网页源", null, null, "WEB_PAGE", 1, List.of(), List.of(), "1080P",
                null, null, Set.of(VideoSourceStatus.Capability.DISCOVER_PACKAGES, VideoSourceStatus.Capability.SOURCE_PAGE),
                "https://example.com/show/1", Map.of(), List.of(item));
        FakeVideoSourceProvider provider = new FakeVideoSourceProvider("external").addPackage(sourcePackage);
        VideoSourceQuickPlayService service = new VideoSourceQuickPlayService(episodeMapper, entryMapper,
                mediaMapper, new VideoSourceProviderRegistry(List.of(provider)), subscriptions,
                mock(VideoSourceDiscoveryService.class), mock(VideoSourceItemMapper.class),
                mock(VideoSourceEpisodeMapMapper.class), mock(VideoAssetMapper.class), Runnable::run);

        var session = service.start(7L, new VideoSourceQuickPlayService.StartRequest(null));

        assertEquals("READY", session.status());
        assertEquals("EXTERNAL", session.selected().playMode());
        assertEquals("https://example.com/play/1", session.selected().sourcePageUrl());
        assertEquals(session.selected().id(), service.select(session.sessionId(), session.selected().id()).selected().id());
    }
}
