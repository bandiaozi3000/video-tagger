package com.videotagger.metadata;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalRelation;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Clip;
import com.videotagger.entity.Media;
import com.videotagger.entity.MediaEntry;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalRelationMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaEntryMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.VideoSourceEpisodeMapMapper;
import com.videotagger.service.CoverService;
import com.videotagger.service.EpisodeService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyLong;

class MetadataSyncServiceTest {

    @Test
    void previewOnlyQueriesProviderAndNeverWrites() {
        Fixture fixture = new Fixture();
        when(fixture.provider.search(eq("机械手臂"), eq(1))).thenReturn(List.of(record("235634")));
        when(fixture.mediaMapper.selectByTitleOrOriginal("机械手臂")).thenReturn(null);

        List<MetadataCandidate> candidates = fixture.service.preview(
                new MetadataSyncRequest("WORK", "机械手臂", null, null, null, 1, null, null));

        assertEquals(1, candidates.size());
        assertEquals("235634", candidates.get(0).externalId());
        verify(fixture.workMapper, never()).insert(any(ExternalWork.class));
        verify(fixture.workMapper, never()).updateById(any(ExternalWork.class));
        verify(fixture.mediaMapper, never()).insert(any(Media.class));
        verify(fixture.entryMapper, never()).insert(any(MediaEntry.class));
        verify(fixture.externalEpisodeMapper, never()).insert(any(ExternalEpisode.class));
        verify(fixture.relationMapper, never()).insert(any(ExternalRelation.class));
    }

    @Test
    void mediaSearchIsCappedAtTwentyAndNeverWrites() {
        Fixture fixture = new Fixture();
        when(fixture.mediaMapper.selectById(42L)).thenReturn(media(42L));
        List<MetadataRecord> records = java.util.stream.IntStream.range(0, 25)
                .mapToObj(index -> record(String.valueOf(index))).toList();
        when(fixture.provider.search("机械手臂", 20)).thenReturn(records);

        List<MetadataCandidate> result = fixture.service.searchForMedia(42L, " 机械手臂 ");

        assertEquals(20, result.size());
        verify(fixture.provider).search("机械手臂", 20);
        verify(fixture.mediaMapper, never()).insert(any(Media.class));
        verify(fixture.entryMapper, never()).insert(any(MediaEntry.class));
    }

    @Test
    void linkImportsOnlyIntoSpecifiedMedia() {
        Fixture fixture = new Fixture();
        fixture.stubImport(42L, record("235634"), 0);

        fixture.service.linkMedia(42L, new MediaMetadataLinkRequest("235634", "PRIMARY"));

        verify(fixture.mediaMapper, never()).insert(any(Media.class));
        verify(fixture.entryMapper).insert(org.mockito.ArgumentMatchers.<MediaEntry>argThat(
                entry -> entry.getMediaId() == 42L));
    }

    @Test
    void additionalEntryUsesNextSortOrder() {
        Fixture fixture = new Fixture();
        fixture.stubImport(42L, record("235634"), 3);

        fixture.service.addMediaEntry(42L, new MediaMetadataLinkRequest("235634", "ADD"));

        verify(fixture.entryMapper).insert(org.mockito.ArgumentMatchers.<MediaEntry>argThat(entry ->
                entry.getMediaId() == 42L && entry.getSortOrder() == 4));
    }

    @Test
    void replaceRebuildDeletesOldSyncedEpisodes() {
        Fixture fixture = new Fixture();
        MediaEntry primary = entry(5L, 42L, 0);
        ExternalWork old = work(1L, "old", 42L, 5L);
        Episode oldEpisode = episode(7L, 42L, 5L);
        when(fixture.mediaMapper.selectById(42L)).thenReturn(media(42L));
        when(fixture.provider.get("new")).thenReturn(record("new", "OVA"));
        when(fixture.workMapper.listByMedia(42L)).thenReturn(List.of(old));
        when(fixture.workMapper.selectByProviderAndExternalId("BANGUMI", "new")).thenReturn(null);
        when(fixture.externalEpisodeMapper.listByWork(1L)).thenReturn(List.of(externalEpisode(7L)));
        when(fixture.localEpisodeMapper.selectBatchIds(List.of(7L))).thenReturn(List.of(oldEpisode));
        when(fixture.entryMapper.selectPrimary(42L)).thenReturn(primary);
        doAnswer(invocation -> { ((ExternalWork) invocation.getArgument(0)).setId(2L); return 1; })
                .when(fixture.workMapper).insert(any(ExternalWork.class));

        fixture.service.linkMedia(42L, new MediaMetadataLinkRequest("new", "REPLACE"));

        // 换绑＝推倒重建：旧条目本地集删除、桥接解绑、旧 work 从媒体脱离
        verify(fixture.episodeService).delete(7L);
        verify(fixture.externalEpisodeMapper).unbindByEpisodeIds(eq(List.of(7L)), anyLong());
        verify(fixture.externalEpisodeMapper).deleteByWorkId(eq(1L));
        verify(fixture.workMapper).detachFromMedia(eq(1L), anyLong());
    }

    @Test
    void replaceWithUserAssetsRequiresExplicitConfirm() {
        Fixture fixture = new Fixture();
        ExternalWork old = work(1L, "old", 42L, 5L);
        Episode oldEpisode = episode(7L, 42L, 5L);
        when(fixture.mediaMapper.selectById(42L)).thenReturn(media(42L));
        when(fixture.provider.get("new")).thenReturn(record("new"));
        when(fixture.workMapper.listByMedia(42L)).thenReturn(List.of(old));
        when(fixture.workMapper.selectByProviderAndExternalId("BANGUMI", "new")).thenReturn(null);
        when(fixture.externalEpisodeMapper.listByWork(1L)).thenReturn(List.of(externalEpisode(7L)));
        when(fixture.localEpisodeMapper.selectBatchIds(List.of(7L))).thenReturn(List.of(oldEpisode));
        when(fixture.clipMapper.listByEpisode(7L)).thenReturn(List.of(new Clip()));
        when(fixture.episodeTagMapper.selectTags(7L)).thenReturn(List.of());
        when(fixture.videoSourceEpisodeMapMapper.listByEpisode(7L)).thenReturn(List.of());
        doAnswer(invocation -> { ((ExternalWork) invocation.getArgument(0)).setId(2L); return 1; })
                .when(fixture.workMapper).insert(any(ExternalWork.class));

        // 旧集含用户数据（片段）且未二次确认 → 拒绝执行
        assertThrows(IllegalArgumentException.class, () -> fixture.service.linkMedia(42L,
                new MediaMetadataLinkRequest("new", "REPLACE", List.of(), false)));
        verify(fixture.episodeService, never()).delete(anyLong());
        verify(fixture.workMapper, never()).detachFromMedia(anyLong(), anyLong());

        // 携带 confirmProtected=true 后放行并删除
        fixture.service.linkMedia(42L, new MediaMetadataLinkRequest("new", "REPLACE", List.of(), true));
        verify(fixture.episodeService).delete(7L);
    }

    private static ExternalEpisode externalEpisode(long episodeId) {
        ExternalEpisode external = new ExternalEpisode();
        external.setId(100L);
        external.setExternalWorkId(1L);
        external.setEpisodeId(episodeId);
        return external;
    }

    private static MetadataRecord record(String externalId) {
        return record(externalId, "TV");
    }

    private static MetadataRecord record(String externalId, String format) {
        return new MetadataRecord("BANGUMI", externalId, "机械手臂", "メカウデ", null, null,
                List.of("机械臂"), "简介", "https://cover.example/235634.jpg", List.of("原创"), format,
                2024, "FALL", "2024-10-03", null, 12, List.of(), List.of(), "{}");
    }

    private static Media media(long id) {
        Media media = new Media();
        media.setId(id);
        media.setTitle("机械手臂");
        return media;
    }

    private static MediaEntry entry(long id, long mediaId, int sortOrder) {
        MediaEntry entry = new MediaEntry();
        entry.setId(id);
        entry.setMediaId(mediaId);
        entry.setSortOrder(sortOrder);
        entry.setEntryType("TV");
        return entry;
    }

    private static ExternalWork work(long id, String externalId, long mediaId, long entryId) {
        ExternalWork work = new ExternalWork();
        work.setId(id);
        work.setProvider("BANGUMI");
        work.setExternalId(externalId);
        work.setMediaId(mediaId);
        work.setMediaEntryId(entryId);
        return work;
    }

    private static Episode episode(long id, long mediaId, long entryId) {
        Episode episode = new Episode();
        episode.setId(id);
        episode.setMediaId(mediaId);
        episode.setMediaEntryId(entryId);
        episode.setEpisodeNo(1);
        episode.setTitle("第 1 集");
        return episode;
    }

    private static class Fixture {
        final MetadataProvider provider = mock(MetadataProvider.class);
        final MediaMapper mediaMapper = mock(MediaMapper.class);
        final ExternalWorkMapper workMapper = mock(ExternalWorkMapper.class);
        final ExternalEpisodeMapper externalEpisodeMapper = mock(ExternalEpisodeMapper.class);
        final ExternalRelationMapper relationMapper = mock(ExternalRelationMapper.class);
        final MediaEntryMapper entryMapper = mock(MediaEntryMapper.class);
        final EpisodeMapper localEpisodeMapper = mock(EpisodeMapper.class);
        final ClipMapper clipMapper = mock(ClipMapper.class);
        final EpisodeTagMapper episodeTagMapper = mock(EpisodeTagMapper.class);
        final EpisodeService episodeService = mock(EpisodeService.class);
        final CoverService coverService = mock(CoverService.class);
        final VideoSourceEpisodeMapMapper videoSourceEpisodeMapMapper = mock(VideoSourceEpisodeMapMapper.class);
        final MetadataSyncService service = new MetadataSyncService(provider, mediaMapper, entryMapper, workMapper,
                externalEpisodeMapper, relationMapper, localEpisodeMapper, clipMapper, episodeTagMapper,
                episodeService, coverService, videoSourceEpisodeMapMapper,
                new ObjectMapper());

        void stubImport(long mediaId, MetadataRecord record, int maxSortOrder) {
            when(mediaMapper.selectById(mediaId)).thenReturn(media(mediaId));
            when(provider.get(record.externalId())).thenReturn(record);
            when(workMapper.selectByProviderAndExternalId(record.provider(), record.externalId())).thenReturn(null);
            when(entryMapper.maxSortOrder(mediaId)).thenReturn(maxSortOrder);
            doAnswer(invocation -> { ((MediaEntry) invocation.getArgument(0)).setId(5L); return 1; })
                    .when(entryMapper).insert(any(MediaEntry.class));
            doAnswer(invocation -> { ((ExternalWork) invocation.getArgument(0)).setId(6L); return 1; })
                    .when(workMapper).insert(any(ExternalWork.class));
            when(externalEpisodeMapper.listByWork(6L)).thenReturn(List.of());
        }
    }
}
