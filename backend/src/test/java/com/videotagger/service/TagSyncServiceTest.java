package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Episode;
import com.videotagger.entity.Media;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaTagMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 标签三级同步核心逻辑：片段→集→媒体单向向上并集（INSERT IGNORE 幂等）。 */
class TagSyncServiceTest {

    private ClipMapper clipMapper;
    private EpisodeMapper episodeMapper;
    private MediaMapper mediaMapper;
    private ClipTagMapper clipTagMapper;
    private EpisodeTagMapper episodeTagMapper;
    private MediaTagMapper mediaTagMapper;
    private EmbeddingTaskService embeddingTaskService;
    private TagSyncService service;

    @BeforeEach
    void setUp() {
        clipMapper = mock(ClipMapper.class);
        episodeMapper = mock(EpisodeMapper.class);
        mediaMapper = mock(MediaMapper.class);
        clipTagMapper = mock(ClipTagMapper.class);
        episodeTagMapper = mock(EpisodeTagMapper.class);
        mediaTagMapper = mock(MediaTagMapper.class);
        embeddingTaskService = mock(EmbeddingTaskService.class);
        service = new TagSyncService(clipMapper, episodeMapper, mediaMapper,
                clipTagMapper, episodeTagMapper, mediaTagMapper, embeddingTaskService);
    }

    @Test
    void syncFromClipSyncsClipTagsUpToEpisodeThenMedia() {
        Clip clip = new Clip();
        clip.setId(1L);
        clip.setEpisodeId(10L);
        when(clipMapper.selectById(1L)).thenReturn(clip);
        when(clipTagMapper.selectTags(1L)).thenReturn(List.of(tag(80L)));
        Episode ep = new Episode();
        ep.setId(10L);
        ep.setMediaId(100L);
        when(episodeMapper.selectById(10L)).thenReturn(ep);
        when(episodeTagMapper.selectTags(10L)).thenReturn(List.of(tag(80L)));

        service.syncFromClip(1L);

        // 片段标签并集到集
        verify(episodeTagMapper).insertIgnore(10L, 80L);
        // 集标签再并集到媒体
        verify(mediaTagMapper).insertIgnore(100L, 80L);
        // 媒体标签变化触发重嵌
        verify(embeddingTaskService).enqueue(EntityType.MEDIA, 100L);
    }

    @Test
    void syncFromEpisodeSyncsEpisodeTagsUpToMedia() {
        Episode ep = new Episode();
        ep.setId(10L);
        ep.setMediaId(100L);
        when(episodeMapper.selectById(10L)).thenReturn(ep);
        when(episodeTagMapper.selectTags(10L)).thenReturn(List.of(tag(80L), tag(81L)));

        service.syncFromEpisode(10L);

        verify(mediaTagMapper).insertIgnore(100L, 80L);
        verify(mediaTagMapper).insertIgnore(100L, 81L);
        verify(embeddingTaskService).enqueue(EntityType.MEDIA, 100L);
    }

    @Test
    void syncAllUnionsAllClipAndEpisodeTagsPerMedia() {
        Media m = new Media();
        m.setId(100L);
        Episode ep = new Episode();
        ep.setId(10L);
        ep.setMediaId(100L);
        Clip c1 = new Clip();
        c1.setId(1L);
        c1.setEpisodeId(10L);
        Clip c2 = new Clip();
        c2.setId(2L);
        c2.setEpisodeId(10L);
        when(mediaMapper.selectList(null)).thenReturn(List.of(m));
        when(episodeMapper.listByMedia(100L)).thenReturn(List.of(ep));
        when(clipMapper.listByEpisode(10L)).thenReturn(List.of(c1, c2));
        // 片段 c1 带标签 80、c2 带标签 81；集已带标签 90
        when(clipTagMapper.selectTags(1L)).thenReturn(List.of(tag(80L)));
        when(clipTagMapper.selectTags(2L)).thenReturn(List.of(tag(81L)));
        when(episodeTagMapper.selectTags(10L)).thenReturn(List.of(tag(90L)));
        when(mediaTagMapper.insertIgnore(anyLong(), anyLong())).thenReturn(1);

        int synced = service.syncAll();

        // 片段标签并集到集
        verify(episodeTagMapper).insertIgnore(10L, 80L);
        verify(episodeTagMapper).insertIgnore(10L, 81L);
        // 三标签并集落媒体
        verify(mediaTagMapper).insertIgnore(100L, 80L);
        verify(mediaTagMapper).insertIgnore(100L, 81L);
        verify(mediaTagMapper).insertIgnore(100L, 90L);
        // 幂等：同一标签不重复计数
        verify(mediaTagMapper, times(1)).insertIgnore(100L, 80L);
        verify(embeddingTaskService).enqueue(EntityType.MEDIA, 100L);
        org.junit.jupiter.api.Assertions.assertEquals(3, synced);
    }

    @Test
    void syncAllSkipsMediaWithNoTags() {
        Media m = new Media();
        m.setId(100L);
        Episode ep = new Episode();
        ep.setId(10L);
        ep.setMediaId(100L);
        when(mediaMapper.selectList(null)).thenReturn(List.of(m));
        when(episodeMapper.listByMedia(100L)).thenReturn(List.of(ep));
        when(clipMapper.listByEpisode(10L)).thenReturn(List.of());
        when(episodeTagMapper.selectTags(10L)).thenReturn(List.of());

        int synced = service.syncAll();

        org.junit.jupiter.api.Assertions.assertEquals(0, synced);
        verify(mediaTagMapper, times(0)).insertIgnore(100L, 80L);
        verify(embeddingTaskService, times(0)).enqueue(EntityType.MEDIA, 100L);
    }

    private static Tag tag(long id) {
        Tag t = new Tag();
        t.setId(id);
        return t;
    }
}
