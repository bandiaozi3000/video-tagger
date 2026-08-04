package com.videotagger.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.videotagger.entity.MediaFormat;
import com.videotagger.entity.MediaSubcategory;
import com.videotagger.mapper.MediaFormatMapper;
import com.videotagger.mapper.MediaMapper;
import com.videotagger.mapper.MediaSubcategoryMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MediaFormatServiceTest {

    private final MediaFormatMapper formatMapper = mock(MediaFormatMapper.class);
    private final MediaSubcategoryMapper subMapper = mock(MediaSubcategoryMapper.class);
    private final MediaMapper mediaMapper = mock(MediaMapper.class);
    private final MediaFormatService service = new MediaFormatService(formatMapper, subMapper, mediaMapper);

    @Test
    void createFormat_uppercasesCodeAndRejectsDuplicate() {
        when(formatMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);
        MediaFormat created = service.createFormat("audio", "音频", 0);
        assertEquals("AUDIO", created.getCode());
        verify(formatMapper).insert(created);

        when(formatMapper.selectOne(any(QueryWrapper.class))).thenReturn(created);
        assertThrows(IllegalArgumentException.class, () -> service.createFormat("AUDIO", "音频", 0));
    }

    @Test
    void deleteFormat_rejectsWhenMediaReferenced() {
        MediaFormat f = new MediaFormat();
        f.setId(1L);
        f.setCode("VIDEO");
        f.setName("视频");
        when(formatMapper.selectById(1L)).thenReturn(f);
        when(mediaMapper.countByFormat("VIDEO")).thenReturn(3L);
        assertThrows(IllegalArgumentException.class, () -> service.deleteFormat(1L));
        verify(formatMapper, never()).deleteById(1L);
    }

    @Test
    void deleteFormat_cascadesSubcategoriesWhenUnused() {
        MediaFormat f = new MediaFormat();
        f.setId(1L);
        f.setCode("VIDEO");
        f.setName("视频");
        when(formatMapper.selectById(1L)).thenReturn(f);
        when(mediaMapper.countByFormat("VIDEO")).thenReturn(0L);
        service.deleteFormat(1L);
        verify(subMapper).delete(any(QueryWrapper.class));
        verify(formatMapper).deleteById(1L);
    }

    @Test
    void addSubcategory_rejectsBlankAndDuplicate() {
        MediaFormat f = new MediaFormat();
        f.setId(1L);
        when(formatMapper.selectById(1L)).thenReturn(f);
        assertThrows(IllegalArgumentException.class, () -> service.addSubcategory(1L, "  "));
        when(subMapper.selectCount(any(QueryWrapper.class))).thenReturn(1L);
        assertThrows(IllegalArgumentException.class, () -> service.addSubcategory(1L, "美剧"));
    }

    @Test
    void deleteSubcategory_rejectsWhenMediaReferenced() {
        MediaSubcategory s = new MediaSubcategory();
        s.setId(5L);
        s.setName("番剧");
        when(subMapper.selectById(5L)).thenReturn(s);
        when(mediaMapper.countBySubcategory("番剧")).thenReturn(2L);
        assertThrows(IllegalArgumentException.class, () -> service.deleteSubcategory(5L));
        verify(subMapper, never()).deleteById(5L);
    }

    @Test
    void listFormats_returnsTreeWithMediaCounts() {
        MediaFormat video = new MediaFormat();
        video.setId(1L);
        video.setCode("VIDEO");
        video.setName("视频");
        video.setHasChildren(1);
        when(formatMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(video));
        MediaSubcategory sub = new MediaSubcategory();
        sub.setId(2L);
        sub.setFormatId(1L);
        sub.setName("番剧");
        when(subMapper.listByFormat(1L)).thenReturn(List.of(sub));
        when(mediaMapper.countBySubcategory("番剧")).thenReturn(6L);

        List<MediaFormatView> views = service.listFormats();
        assertEquals(1, views.size());
        assertEquals("视频", views.get(0).name());
        assertEquals(1, views.get(0).subcategories().size());
        assertEquals("番剧", views.get(0).subcategories().get(0).name());
        assertEquals(6L, views.get(0).subcategories().get(0).mediaCount());
    }
}
