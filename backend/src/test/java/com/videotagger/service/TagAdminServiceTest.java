package com.videotagger.service;

import com.videotagger.entity.Clip;
import com.videotagger.entity.Tag;
import com.videotagger.mapper.ClipMapper;
import com.videotagger.mapper.ClipTagMapper;
import com.videotagger.mapper.EpisodeTagMapper;
import com.videotagger.mapper.MediaTagMapper;
import com.videotagger.mapper.TagMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TagAdminServiceTest {

    TagMapper tagMapper;
    MediaTagMapper mediaTagMapper;
    EpisodeTagMapper episodeTagMapper;
    ClipTagMapper clipTagMapper;
    ClipMapper clipMapper;
    EmbeddingTaskService embeddingTaskService;
    TagAdminService service;

    @BeforeEach
    void setUp() {
        tagMapper = mock(TagMapper.class);
        mediaTagMapper = mock(MediaTagMapper.class);
        episodeTagMapper = mock(EpisodeTagMapper.class);
        clipTagMapper = mock(ClipTagMapper.class);
        clipMapper = mock(ClipMapper.class);
        embeddingTaskService = mock(EmbeddingTaskService.class);
        service = new TagAdminService(tagMapper, mediaTagMapper, episodeTagMapper,
                clipTagMapper, clipMapper, embeddingTaskService);
    }

    private Tag tag(long id, String name) {
        Tag t = new Tag();
        t.setId(id);
        t.setName(name);
        t.setCreatedAt(1L);
        return t;
    }

    private Clip clip(long id, String tag) {
        Clip c = new Clip();
        c.setId(id);
        c.setTag(tag);
        return c;
    }

    @Test
    void listGlobalFiltersByQuery() {
        when(tagMapper.countGlobal()).thenReturn(List.of(
                new TagUsage(1L, "高燃", 1L, 1, 2, 5, 0),
                new TagUsage(2L, "泪目", 1L, 0, 0, 3, 0)));

        PageResult<TagUsage> hits = service.list("高", null, 1, 50);

        assertEquals(1, hits.total());
        assertEquals("高燃", hits.items().get(0).name());
    }

    @Test
    void listGlobalPaginatesInMemory() {
        when(tagMapper.countGlobal()).thenReturn(List.of(
                new TagUsage(1L, "A", 1L, 0, 0, 0, 0),
                new TagUsage(2L, "B", 1L, 0, 0, 0, 0),
                new TagUsage(3L, "C", 1L, 0, 0, 0, 0)));

        PageResult<TagUsage> page1 = service.list("", null, 1, 2);
        assertEquals(3, page1.total());
        assertEquals(2, page1.items().size());
        assertEquals("A", page1.items().get(0).name());

        PageResult<TagUsage> page2 = service.list("", null, 2, 2);
        assertEquals(1, page2.items().size());
        assertEquals("C", page2.items().get(0).name());
    }

    @Test
    void renameUpdatesWordSyncsClipTagsAndReembeds() {
        Tag t = tag(1L, "高燃");
        when(tagMapper.selectById(1L)).thenReturn(t);
        when(tagMapper.selectByName("热血")).thenReturn(null);
        when(tagMapper.mediaIdsByTag(1L)).thenReturn(List.of(10L));
        when(tagMapper.episodeIdsByTag(1L)).thenReturn(List.of());
        when(tagMapper.clipIdsByTag(1L)).thenReturn(List.of(100L));
        when(clipMapper.selectByTagContains("高燃")).thenReturn(List.of(clip(100L, "高燃 战斗")));

        service.rename(1L, "热血");

        assertEquals("热血", t.getName());
        verify(tagMapper).updateById(t);
        verify(clipMapper).updateTag(100L, "热血 战斗");
        verify(embeddingTaskService).enqueue(EntityType.MEDIA, 10L);
        // clip 同时命中 clip_tag 引用和 clips.tag 词扫描，重嵌入队两次（幂等无害）
        verify(embeddingTaskService, times(2)).enqueue(EntityType.CLIP, 100L);
    }

    @Test
    void renameRejectsDuplicateName() {
        when(tagMapper.selectById(1L)).thenReturn(tag(1L, "高燃"));
        when(tagMapper.selectByName("燃")).thenReturn(tag(9L, "燃"));

        assertThrows(IllegalArgumentException.class, () -> service.rename(1L, "燃"));
        verify(tagMapper, never()).updateById(any(Tag.class));
    }

    @Test
    void renameRejectsBlankName() {
        when(tagMapper.selectById(1L)).thenReturn(tag(1L, "高燃"));

        assertThrows(IllegalArgumentException.class, () -> service.rename(1L, "  "));
    }

    @Test
    void mergeMigratesRefsSyncsClipTagsDeletesSourceAndReembeds() {
        when(tagMapper.selectById(1L)).thenReturn(tag(1L, "高然"));
        when(tagMapper.selectById(2L)).thenReturn(tag(2L, "高燃"));
        when(tagMapper.mediaIdsByTag(1L)).thenReturn(List.of(10L));
        when(tagMapper.episodeIdsByTag(1L)).thenReturn(List.of());
        when(tagMapper.clipIdsByTag(1L)).thenReturn(List.of());
        when(tagMapper.mediaIdsByTag(2L)).thenReturn(List.of());
        when(tagMapper.episodeIdsByTag(2L)).thenReturn(List.of());
        when(tagMapper.clipIdsByTag(2L)).thenReturn(List.of(100L));
        when(clipMapper.selectByTagContains("高然")).thenReturn(List.of(clip(100L, "高然 名场面")));

        service.merge(1L, 2L);

        verify(mediaTagMapper).moveRefs(1L, 2L);
        verify(mediaTagMapper).deleteRefs(1L);
        verify(episodeTagMapper).moveRefs(1L, 2L);
        verify(clipTagMapper).moveRefs(1L, 2L);
        verify(clipMapper).updateTag(100L, "高燃 名场面");
        verify(tagMapper).deleteById(1L);
        verify(embeddingTaskService).enqueue(EntityType.MEDIA, 10L);
        verify(embeddingTaskService, times(2)).enqueue(EntityType.CLIP, 100L);
    }

    @Test
    void mergeRejectsSameFromTo() {
        assertThrows(IllegalArgumentException.class, () -> service.merge(1L, 1L));
    }

    @Test
    void deleteOrphanAllowedButReferencedRejected() {
        when(tagMapper.selectById(1L)).thenReturn(tag(1L, "孤儿词"));
        when(tagMapper.countRefs(1L)).thenReturn(0L);
        service.delete(1L);
        verify(tagMapper).deleteById(1L);

        when(tagMapper.selectById(2L)).thenReturn(tag(2L, "在用词"));
        when(tagMapper.countRefs(2L)).thenReturn(3L);
        assertThrows(IllegalArgumentException.class, () -> service.delete(2L));
        verify(tagMapper, times(1)).deleteById(anyLong());
    }

    @Test
    void addCreatesWordWhenNoDuplicate() {
        when(tagMapper.selectByName("燃")).thenReturn(null, tag(1L, "燃"));

        TagUsage created = service.add("燃");

        assertEquals("燃", created.name());
        verify(tagMapper).insertIgnore(eq("燃"), anyLong());
    }

    @Test
    void addRejectsBlankAndDuplicate() {
        assertThrows(IllegalArgumentException.class, () -> service.add("  "));
        when(tagMapper.selectByName("燃")).thenReturn(tag(9L, "燃"));
        assertThrows(IllegalArgumentException.class, () -> service.add("燃"));
        verify(tagMapper, never()).insertIgnore(anyString(), anyLong());
    }

    @Test
    void deleteBatchAllOrphansDeletesEach() {
        when(tagMapper.countRefs(1L)).thenReturn(0L);
        when(tagMapper.countRefs(2L)).thenReturn(0L);

        service.deleteBatch(List.of(1L, 2L));

        verify(tagMapper).deleteById(1L);
        verify(tagMapper).deleteById(2L);
    }

    @Test
    void deleteBatchRejectsWhenAnyReferenced() {
        when(tagMapper.countRefs(1L)).thenReturn(0L);
        when(tagMapper.countRefs(2L)).thenReturn(2L);
        when(tagMapper.selectById(2L)).thenReturn(tag(2L, "在用词"));

        assertThrows(IllegalArgumentException.class, () -> service.deleteBatch(List.of(1L, 2L)));
        verify(tagMapper, never()).deleteById(anyLong());
    }

    @Test
    void episodeStatsDelegatesToMapper() {
        List<TagUsage> stats = List.of(
                new TagUsage(1L, "神作", 1L, 0, 0, 0, 5),
                new TagUsage(2L, "日常", 1L, 0, 0, 0, 2));
        when(tagMapper.countByEpisode(7L)).thenReturn(stats);

        List<TagUsage> result = service.episodeStats(7L);

        assertEquals(stats, result);
        verify(tagMapper).countByEpisode(7L);
    }
}
