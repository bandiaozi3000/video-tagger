package com.videotagger.metadata;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videotagger.entity.ExternalEpisode;
import com.videotagger.entity.ExternalRelation;
import com.videotagger.entity.ExternalWork;
import com.videotagger.entity.Media;
import com.videotagger.entity.MediaEntry;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.ExternalEpisodeMapper;
import com.videotagger.mapper.ExternalRelationMapper;
import com.videotagger.mapper.ExternalWorkMapper;
import com.videotagger.mapper.MediaEntryMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.VideoSourceEpisodeMapMapper;
import com.videotagger.service.CoverService;
import com.videotagger.service.EpisodeService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 新同步流程的提交语义（2026-09-21，设计规格 §6/§7）。
 *
 * 用户要求：「本地已有则更新，**不动本地数据**；没有则新增本地媒体和 Bangumi 数据」。
 * 这里把这条要求钉成断言：
 *   · `LINK`（标题唯一命中的"更新"）→ **绝不** insert/update 本地 `media`
 *   · `CREATE`（新增）→ 建 `media` 且默认字段符合规格（VIDEO / WANT / confirmed=1）
 *   · `SKIP` → 什么都不写，计入 skipped
 *   · 单项失败**不影响**其它项，且失败原因回传到明细
 */
class MetadataSyncCommitServiceTest {

    @Test
    void 标题命中的更新_只刷Bangumi镜像_绝不改本地媒体() {
        Fixture f = new Fixture();
        f.stubLinkedImport(6917L, f.record("252322"), 3L);
        MetadataSyncCommitService commit = new MetadataSyncCommitService(f.service, f.mediaMapper, f.workMapper);

        SyncCommitResult result = commit.commit(new SyncCommitRequest(List.of(
                new SyncCommitRequest.Item("252322", "LINK", 6917L))));

        assertEquals(1, result.total());
        assertEquals(0, result.added());
        assertEquals(1, result.updated());
        assertEquals(0, result.failed());
        // 「不动本地数据」的核心断言：本地媒体行没有被写
        verify(f.mediaMapper, never()).insert(any(Media.class));
        verify(f.mediaMapper, never()).updateById(any(Media.class));
        // Bangumi 镜像表被刷新（upsert + 成功时间，两次 update）、缺失的集被补
        verify(f.workMapper, org.mockito.Mockito.atLeastOnce()).updateById(any(ExternalWork.class));
        verify(f.externalEpisodeMapper).insert(any(ExternalEpisode.class));
        verify(f.relationMapper).insert(any(ExternalRelation.class));
    }

    @Test
    void 本地没有则新建媒体_带规格默认字段() {
        Fixture f = new Fixture();
        f.stubCreateImport(f.record("252322"), 7L);
        MetadataSyncCommitService commit = new MetadataSyncCommitService(f.service, f.mediaMapper, f.workMapper);

        SyncCommitResult result = commit.commit(new SyncCommitRequest(List.of(
                new SyncCommitRequest.Item("252322", "CREATE", null))));

        assertEquals(1, result.added());
        ArgumentCaptor<Media> captor = ArgumentCaptor.forClass(Media.class);
        verify(f.mediaMapper).insert(captor.capture());
        Media created = captor.getValue();
        assertEquals("机械手臂", created.getTitle());
        assertEquals(2024, created.getYear());
        assertEquals("VIDEO", created.getMediaFormat());
        assertEquals("WANT", created.getStatus());
        assertEquals(1, created.getConfirmed());
        assertEquals("ADDED", result.items().get(0).status());
    }

    @Test
    void 跳过项什么都不写_只计数() {
        Fixture f = new Fixture();
        MetadataSyncCommitService commit = new MetadataSyncCommitService(f.service, f.mediaMapper, f.workMapper);

        SyncCommitResult result = commit.commit(new SyncCommitRequest(List.of(
                new SyncCommitRequest.Item("111", "SKIP", null),
                new SyncCommitRequest.Item("222", "SKIP", 5L))));

        assertEquals(2, result.total());
        assertEquals(2, result.skipped());
        assertEquals(0, result.added() + result.updated() + result.failed());
        verify(f.mediaMapper, never()).insert(any(Media.class));
        verify(f.mediaMapper, never()).updateById(any(Media.class));
    }

    @Test
    void 单项失败不影响其它项_失败原因进明细() {
        Fixture f = new Fixture();
        when(f.provider.get("bad")).thenThrow(new MetadataProviderException("Bangumi 502", 502));
        f.stubCreateImport(f.record("good"), 9L);
        MetadataSyncCommitService commit = new MetadataSyncCommitService(f.service, f.mediaMapper, f.workMapper);

        SyncCommitResult result = commit.commit(new SyncCommitRequest(List.of(
                new SyncCommitRequest.Item("bad", "CREATE", null),
                new SyncCommitRequest.Item("good", "CREATE", null))));

        assertEquals(2, result.total());
        assertEquals(1, result.failed());
        assertEquals(1, result.added(), "一项失败不该拖垮另一项");
        assertEquals("FAILED", result.items().get(0).status());
        assertEquals("Bangumi 502", result.items().get(0).error());
        assertEquals("ADDED", result.items().get(1).status());
    }

    /** 只测提交语义，不真联网：provider 与 mapper 全 mock。 */
    private static class Fixture {
        final MetadataProvider provider = mock(MetadataProvider.class);
        final MediaMapper mediaMapper = mock(MediaMapper.class);
        final ExternalWorkMapper workMapper = mock(ExternalWorkMapper.class);
        final ExternalEpisodeMapper externalEpisodeMapper = mock(ExternalEpisodeMapper.class);
        final ExternalRelationMapper relationMapper = mock(ExternalRelationMapper.class);
        final MediaEntryMapper entryMapper = mock(MediaEntryMapper.class);
        final EpisodeMapper localEpisodeMapper = mock(EpisodeMapper.class);
        final MetadataSyncService service = new MetadataSyncService(provider, mediaMapper, entryMapper, workMapper,
                externalEpisodeMapper, relationMapper, localEpisodeMapper, mock(ClipMapper.class),
                mock(EpisodeTagMapper.class), mock(EpisodeService.class), mock(CoverService.class),
                mock(VideoSourceEpisodeMapMapper.class), new ObjectMapper());

        MetadataRecord record(String externalId) {
            return new MetadataRecord("BANGUMI", externalId, "机械手臂", "メカウデ", null, null,
                    List.of("机械臂"), "简介", "https://cover.example/x.jpg", List.of("原创"), "TV",
                    2024, "FALL", "2024-10-03", null, 12,
                    List.of(new MetadataEpisodeRecord("ep-1", 1, "第 1 集", "第 1 集", null, "2024-10-03", 24)),
                    List.of(new MetadataRelationRecord("999", "番外篇", "OVA")), "{}");
        }

        /** 已关联本地媒体 6917 的更新路径。 */
        void stubLinkedImport(long mediaId, MetadataRecord record, long entryId) {
            when(provider.get(record.externalId())).thenReturn(record);
            when(mediaMapper.selectById(mediaId)).thenReturn(media(mediaId));
            when(workMapper.selectByProviderAndExternalId(record.provider(), record.externalId()))
                    .thenReturn(work(6L, record.externalId(), mediaId, entryId));
            when(entryMapper.selectLegacy(mediaId, "TV", 0)).thenReturn(entry(entryId, mediaId, 0));
            when(entryMapper.selectPrimary(mediaId)).thenReturn(entry(entryId, mediaId, 0));
            when(externalEpisodeMapper.selectByProviderEpisode(6L, "ep-1")).thenReturn(null);
            when(externalEpisodeMapper.listByWork(6L)).thenReturn(List.of());
            when(localEpisodeMapper.selectByMediaEntryAndEpisodeNo(entryId, 1)).thenReturn(null);
            doAnswer(invocation -> { invocation.getArgument(0, Media.class).setId(mediaId); return 1; })
                    .when(mediaMapper).insert(any(Media.class));
        }

        /** 本地没有 → 新建路径。 */
        void stubCreateImport(MetadataRecord record, long newMediaId) {
            when(provider.get(record.externalId())).thenReturn(record);
            when(workMapper.selectByProviderAndExternalId(record.provider(), record.externalId())).thenReturn(null);
            when(mediaMapper.selectByTitleOrOriginal(record.displayTitle())).thenReturn(null);
            doAnswer(invocation -> { invocation.getArgument(0, Media.class).setId(newMediaId); return 1; })
                    .when(mediaMapper).insert(any(Media.class));
            doAnswer(invocation -> { invocation.getArgument(0, MediaEntry.class).setId(11L); return 1; })
                    .when(entryMapper).insert(any(MediaEntry.class));
            doAnswer(invocation -> { invocation.getArgument(0, ExternalWork.class).setId(12L); return 1; })
                    .when(workMapper).insert(any(ExternalWork.class));
            when(externalEpisodeMapper.listByWork(12L)).thenReturn(List.of());
            when(localEpisodeMapper.selectByMediaEntryAndEpisodeNo(anyLong(), eq(1))).thenReturn(null);
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
    }
}
