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
        assertThrows(IllegalArgumentException.class, () -> service.addSubcategory(1L, null, "  "));
        when(subMapper.selectCount(any(QueryWrapper.class))).thenReturn(1L);
        assertThrows(IllegalArgumentException.class, () -> service.addSubcategory(1L, null, "美剧"));
    }

    @Test
    void addSubcategory_inheritsFormatFromParent() {
        MediaFormat f = new MediaFormat();
        f.setId(1L);
        when(formatMapper.selectById(1L)).thenReturn(f);
        MediaSubcategory parent = new MediaSubcategory();
        parent.setId(2L);
        parent.setFormatId(1L);
        when(subMapper.selectById(2L)).thenReturn(parent);
        when(subMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);

        MediaSubcategory created = service.addSubcategory(1L, 2L, "热血");

        assertEquals(1L, created.getFormatId());
        assertEquals(2L, created.getParentId());
        verify(subMapper).insert(created);
    }

    @Test
    void addSubcategory_rejectsParentFromOtherFormat() {
        MediaFormat f = new MediaFormat();
        f.setId(1L);
        when(formatMapper.selectById(1L)).thenReturn(f);
        MediaSubcategory parent = new MediaSubcategory();
        parent.setId(9L);
        parent.setFormatId(99L);
        when(subMapper.selectById(9L)).thenReturn(parent);
        assertThrows(IllegalArgumentException.class, () -> service.addSubcategory(1L, 9L, "新分类"));
    }

    @Test
    void deleteSubcategory_rejectsWhenHasChildren() {
        MediaSubcategory s = new MediaSubcategory();
        s.setId(5L);
        s.setName("番剧");
        when(subMapper.selectById(5L)).thenReturn(s);
        when(subMapper.selectCount(any(QueryWrapper.class))).thenReturn(1L);
        assertThrows(IllegalArgumentException.class, () -> service.deleteSubcategory(5L));
        verify(subMapper, never()).deleteById(5L);
    }

    @Test
    void deleteSubcategory_rejectsWhenMediaReferencedInSubtree() {
        MediaSubcategory s = new MediaSubcategory();
        s.setId(5L);
        s.setName("番剧");
        when(subMapper.selectById(5L)).thenReturn(s);
        when(subMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);
        when(mediaMapper.countBySubcategoryId(5L)).thenReturn(2L);
        assertThrows(IllegalArgumentException.class, () -> service.deleteSubcategory(5L));
        verify(subMapper, never()).deleteById(5L);
    }

    @Test
    void deleteSubcategory_deletesWhenEmptyLeaf() {
        MediaSubcategory s = new MediaSubcategory();
        s.setId(5L);
        s.setName("番剧");
        when(subMapper.selectById(5L)).thenReturn(s);
        when(subMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);
        when(mediaMapper.countBySubcategoryId(5L)).thenReturn(0L);
        service.deleteSubcategory(5L);
        verify(subMapper).deleteById(5L);
    }

    @Test
    void listFormats_returnsTreeWithSubtreeMediaCounts() {
        MediaFormat video = new MediaFormat();
        video.setId(1L);
        video.setCode("VIDEO");
        video.setName("视频");
        video.setHasChildren(1);
        when(formatMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(video));
        MediaSubcategory root = new MediaSubcategory();
        root.setId(2L);
        root.setFormatId(1L);
        root.setParentId(0L);
        root.setName("番剧");
        MediaSubcategory child = new MediaSubcategory();
        child.setId(3L);
        child.setFormatId(1L);
        child.setParentId(2L);
        child.setName("热血");
        when(subMapper.listByFormat(1L)).thenReturn(List.of(root, child));
        // 直接计数：根挂 4 个媒体，叶子挂 2 个 → 根子树累计 6
        when(mediaMapper.countDirectByFormat(1L))
                .thenReturn(List.of(new MediaMapper.SubcategoryDirectCount(2L, 4L),
                        new MediaMapper.SubcategoryDirectCount(3L, 2L)));

        List<MediaFormatView> views = service.listFormats();
        assertEquals(1, views.size());
        assertEquals("视频", views.get(0).name());
        assertEquals(2, views.get(0).subcategories().size());
        MediaFormatView.SubcategoryView rootView = views.get(0).subcategories().get(0);
        assertEquals("番剧", rootView.name());
        assertEquals(0L, rootView.parentId());
        assertEquals(6L, rootView.mediaCount());
        MediaFormatView.SubcategoryView childView = views.get(0).subcategories().get(1);
        assertEquals("热血", childView.name());
        assertEquals(2L, childView.parentId());
        assertEquals(2L, childView.mediaCount());
    }
}
